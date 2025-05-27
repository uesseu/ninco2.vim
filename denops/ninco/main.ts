//import { Denops } from "https://deno.land/x/denops_std@v1.0.0/mod.ts";
import {Denops, execute, call, cmd} from "jsr:@denops/std@^7.0.0/function";
//import { execute, call } from "https://deno.land/x/denops_std@v1.0.0/helper/mod.ts";

let defaultKey = ""
let defaultModel = "gpt-4.1-nano"
let defaultUrl = "https://api.openai.com/v1/chat/completions"
const COMPRESS_PROMPT = 'Please summarize this talk log.'
//let url = "http://127.0.0.1:8000/v1/chat/completions"

function copy(x){
  return JSON.parse(JSON.stringify(x))
}

/**
 * A manager of order for chatGPT.
 * It can make JSON string to send to openai.
 */
class Order{
  body // The body of messages.
  name: string // Name of thread
  command: string // Command name and arguments
  command_arg: Array<string>
  print: boolean // Whether write in vim buffer
  repeat: boolean // Repeat what you say on vim
  model: string // Model name
  url: string  // url of web api
  key: string  // Key of your account
  max_length: number  // If over, compress
  compress_num: number // Number to compress
  compress_style: string // [summarize, delete](Now, summarize only)
  winid: string  // ID of window
  log: Array<Array<object>> // Log of thread to go back
  dry_run: boolean // Just for debug.
  parent: string // Name of parent thread
  children: Array<string> // Names of child threads

  /**
   * Setup order object to make JSON to send to openai.
   * @param {string} model - Name of model. (Ex. "gpt-3.5-turbo")
   */
  constructor(print = true, repeat = true, command = '',
    name = '', key = defaultKey, url = defaultUrl,
    model = defaultModel, command_arg = [],
    max_length = 10, compress_num = 4, winid = '',
    dry_run = false, order = null){
    this.body = {
      model: model,
      messages: [],
      stream: true,
    }
    this.name = name
    this.print = print
    this.repeat = repeat
    this.command = command
    this.command_arg = command_arg
    this.key = key
    this.url = url
    this.max_length = max_length
    this.compress_num = compress_num
    this.winid = winid
    this.log = [[]]
    this.dry_run = dry_run
    this.parent = ''
    this.children = []
  }

  /**
   * Set parameter from json.
   * @param {object} param - Content of parameter.
   */
  putParameter(param: any){
    for (let p in param){
      if (p in this) this[p] = param[p]
    }
  }

  /**
   * Put system parameter to the last of message.
   * @param {string} content - Content of message.
   * @returns {null} - It returns null.
   */
  putSystem(content: string){
    this.body.messages.push({role: "system", content: content})
    this.log[this.log.length-1].push(
      {kind: "normal", role: "system", content: content}
    )
  }

  /**
   * Put user parameter to the last of message.
   * @param {string} content - Content of message.
   * @returns {null} - It returns null.
   */
  putUser(content: string){
    this.body.messages.push({role: "user", content: content})
    this.log[this.log.length-1].push(
      {kind: "normal", role: "user", content: content}
    )
  }

  /**
   * Put assistant parameter to the last of message.
   * @param {string} content - Content of message.
   * @returns {null} - It returns null.
   */
  putAssistant(content: string){
    this.body.messages.push(
      {role: "assistant", content: content}
    )
    this.log[this.log.length-1].push(
      {kind: "normal", role: "assistant", content: content}
    )
  }

  /**
   * Unshift user parameter to the last of message.
   * It is needed when you want to compress the chat data.
   * @param {string} content - Content of message.
   * @returns {null} - It returns null.
   */
  unshiftHistory(content: string){
    this.body.messages.unshift(
      {role: "user", content: content}
    )
    this.log[this.log.length-1].unshift(
      {kind: "compress", role: "user", content: content}
    )
    this.log.push([])
  }

  copy(){
    let order = new Order()
    order.print = this.print
    order.repeat = this.repeat
    order.command = this.command
    order.command_arg = copy(this.command_arg)
    order.key = this.key
    order.url = this.url
    order.max_length = this.max_length
    order.compress_num = this.compress_num
    order.winid = this.winid
    order.body = copy(this.body)
    order.log = copy(this.log)
    return order
  }

  showTree(n=0){
    const message = this.body.messages
    const lastMessage = message.length >= 2 ? message[message.length - 2].content : ''
    let lognum = 0
    let flatten = this.log.flat()
    for (let log in flatten){
      if (flatten[log].kind === 'normal') lognum++
    }
    let result = `${' '.repeat(n*2)}${this.name}[${lognum}]: ${lastMessage.slice(0, 20)}...\n`
    for (let c in this.children)
      result += globalOrders[this.children[c]].showTree(n + 1)
    return result
  }

  goback(num: number){
    this.body.messages = []
    let flat_log = this.log.flat()
    let end = flat_log.length - 1
    while (num!==0){
      if(flat_log[end].kind === 'normal') num --
      end--
    }
    let start = end
    let has_compress = false
    num = this.max_length
    while (start !==0 && num!==0){
      if(flat_log[start].kind === 'normal') num --
      if(flat_log[start].kind === 'compress') has_compress = true
      start --
    }
    if (has_compress){
      while (true){
        if(flat_log[start].kind === 'compress') break
        start ++
      }
      this.body.messages.unshift(flat_log[start])
    }
    let sliced_flat_log = flat_log.slice(0, end+1)
    this.log = [[]]
    for (let n in sliced_flat_log){
      if (sliced_flat_log[n].kind === 'compress'){
        this.log.push([])
        this.log[this.log.length-1].push(sliced_flat_log[n])
      } else {
        this.log[this.log.length-1].push(sliced_flat_log[n])
      }
    }
    let for_body = flat_log.slice(start, end+1)
    for (let n in for_body){
      if (for_body[n].kind !== 'compress') this.body.messages.push(for_body[n])
    }
  }

  /**
   * Remove old messages except system.
   * @param {number} num - Number of messages to remain.
   * @returns {null} - It returns null.
   */
  removeOld(){
    const result = this.body.messages.slice(0, this.compress_num)
    this.body.messages = this.body.messages.slice(this.compress_num)
    return result
  }

  /**
   * Send order to openai and receive fetche object.
   * @returns {null} - JSON string for openai.
   */
  receive(){
    return fetch(this.url, {
      method: "POST",
      headers: {
	"Content-Type": "application/json",
	"Authorization": `Bearer ${this.key}`
      },
      body: JSON.stringify(this.body)
    });
  }

  /**
   * Reset messages.
   * @returns {null}
   */
  reset(){
    this.body.messages = []
  }
}

/**
 * Put string with new lines to vim window by denops.
 * @param {Denops} denops - Denops object.
 * @param {string} text - String to write.
 * @returns {null} - It returns null.
 */
function putString(denops: Denops, text: string, winid: string){
  let num = 0
  denops.eval(`"${winid}"->bufwinid()`).then(x => {
    text.split("\n").map(d =>{
      if(num !== 0) denops.call('win_execute', x, 'norm o')
      denops.call('ninco#put_window', d.replaceAll(' ', '\\ '), winid)
      num++
    })
  })
}

function parseResponse(response: any){
  // The worst boiler plate of this software.
  // Code tries to parse something like json bun not json.
  if (response.trim()[0] === "{"){
    try {
      return Array(JSON.parse(response.trim().slice(5)))
      .filter(x => x !== "")
      .map(x => x["choices"][0]["delta"]["content"]).join("")
    } catch (er) {
      try{
        return JSON.parse(response)["error"]["message"]
      }
      catch {
        console.log(er)
      }
    }
  }
  if (response.length === 0) return ""
  if (response.trim() === "data: [DONE]") return ""
  if (response.trim().slice(5, 10) === "error") {
    try{
      return JSON.parse(response)["error"]["message"]
    } catch (er) {
      console.log(er)
    }
  }
  if (response.trim().slice(0, 8) === ": ping -") return ""
  if (response[0] !== "[") {
    try {
      return Array(JSON.parse(response.trim().slice(5)))
      .filter(x => x !== "")
      .map(x => x["choices"][0]["delta"]["content"]).join("")
    } catch (er) {
      return "[Error]"
    }
  }
}

/**
 * Receive reply from chatgpt and put it to vim window by denops.
 * @param {Denops} denops - Denops object.
 * @param {Order} order - Order object to use.
 * @param {bool} bool - If it is true, it put string to vim.
 * @returns {null} - All output of chatGPT.
 */
async function chatgpt(denops: Denops, order: Order){
  let allData = ""
  let process = null
  let writer = null
  if (order.command !== ""){
    process = new Deno.Command(order.command, {
      args: order.args,
      stdin: "piped",
    }).spawn();
    writer = process.stdin.getWriter();
  }
  if (order.repeat){
    putString(denops,
              "# "+order.body.messages.slice(-1)[0].content
              +"\n--------------------\n",
              order.winid)
  }
  if (order.dry_run){
    if (order.print) putString(
      denops,
      order.body.messages.slice(-1)[0].content + "\n",
      order.winid
    )
    if (order.command !== ""){
      writer.write(
        new TextEncoder().encode(order.body.messages.slice(-1)[0].content)
      )
      writer.releaseLock();
      await process.stdin.close();
    }
    return "echo " + order.body.messages.slice(-1)[0].content
  } else {
    // Receive response of AI
    let resp = await order.receive()
    for await (const chunk of resp.body){
      const data = new TextDecoder().decode(chunk)
        .split("\n\n").map(parseResponse)
      if (order.print) putString(denops, data.join(""), order.winid)
      if (order.command !== "")
        writer.write(new TextEncoder().encode(data.join('')))
      allData += data.join("")
    }
  }
  if (order.command !== ""){
    writer.releaseLock();
    await process.stdin.close();
  }
  if (order.print) putString(denops, "\n", order.winid)
  return allData
}


/* Global object to talk with chatGPT. */
let globalOrders = {}

function nextId(id: string){
  let splitted = id.split('_')
  let num = Number(splitted[splitted.length - 1])
  if (Number.isInteger(num)) return id + '_' + String(num + 1)
  return id + '_' + '1'
}


export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {

    async init(key: string, model: string, url: string): Promise<void> {
      defaultKey = key
      defaultModel = model
      defaultUrl = url
    },

    async new(name: string, options: any): Promise<void>{
      if (name in globalOrders){
        console.log(`${name} is duplicated and could not made.`)
        return undefined
      }
      options.name = name
      globalOrders[name] = new Order()
      globalOrders[name].putParameter(options)
    },

    async delete(name): Promise<void>{
      delete globalOrders[name]
    },

    async config(name: string, options: any): Promise<void>{
      globalOrders[name].putParameter(options)
      execute(denops, 'echo "' + name + '"')
    },

    tree(): string{
      let result = ''
      for (let name in globalOrders){
        if (globalOrders[name].parent === ''){
          result += globalOrders[name].showTree()
        }
      }
      return result
    },

    async status(name: string): Promise<void>{
      console.log(JSON.stringify(globalOrders[name], null, 2))
    },

    show(name: string): string{
      let result = ''
      for (let content in globalOrders[name].log){
        let data = globalOrders[name].log[content]
        for (let c in data){
          if (data[c].kind === 'normal'){
            if (data[c].role === 'user'){
              result += '# ' + data[c].content + "\n--------------------\n"
            } else if (data[c].role === 'assistant'){
              result += data[c].content + "\n"
            }
          }
        }
      }
      return result
    },

    get_param(name: string, param: string): string{
      return globalOrders[name][param]
    },

    async goback(name: string, num: number): Promise<void>{
      globalOrders[name].goback(num)
    },

    async save(name: string, path: string, deleteKey=true): Promise<void>{
      let toSave = null
      if (deleteKey){
        toSave = copy(globalOrders[name])
        toSave.key = ''
      } else {
        toSave = globalOrders[name]
      }
      Deno.writeTextFile(path, JSON.stringify(toSave, null, 2))
      .then(x=>console.log(`Written to ${name}`))
    },

    async load(name: string, path: string): Promise<void>{
      Deno.readTextFile(path).then(x=> globalOrders[name] = JSON.parse(x))
    },

    saveAll(path: string, deleteKey=true): void{
      let toSave: Array<Order>
      if (deleteKey){
        toSave = copy(globalOrders)
        for (let order in toSave){
          toSave[order].key = ''
        }
      } else {
        toSave = globalOrders
      }
      Deno.writeTextFile(path, JSON.stringify(toSave, null, 2))
      .then(x=>console.log(`Written to ${path}`))
    },

    async loadAll(path: string): Promise<void>{
      Deno.readTextFile(path).then(x=> globalOrders = JSON.parse(x))
    },

    async order(name, order){
      let letter: Order
      if (name === '') {
        letter = new Order()
      } else {
        if(!(name in globalOrders)) globalOrders[name] = new Order()
        letter = globalOrders[name]
      }
      letter.putUser(order)
      chatgpt(denops, letter).then(x=>letter.putAssistant(x))
    },

    async compress(name, prompt = COMPRESS_PROMPT): Promise<void>{
      const order: Order = globalOrders[name]
      if (globalOrders[name].max_length
          <= globalOrders[name].body.messages.length){
        let tmpOrder: Order = new Order()
        tmpOrder.key = order.key
        tmpOrder.model = order.model
        tmpOrder.print = false
        tmpOrder.repeat = false
        tmpOrder.url = order.url
        tmpOrder.body.messages = order.removeOld()
        tmpOrder.putUser(
          prompt + JSON.stringify(order.removeOld())
        )
        if (globalOrders[name].dry_run){
          order.unshiftHistory('compressed')
        } else {
          chatgpt(denops, tmpOrder).then(x=>order.unshiftHistory(x))
        }
      }
    },

    async copy(name: string, new_name: string = ''): Promise<void>{
      if (new_name === '') new_name = nextId(name)
      globalOrders[new_name] = globalOrders[name].copy()
      globalOrders[new_name].parent = name
      globalOrders[new_name].name = new_name
      globalOrders[name].children.push(new_name)
      globalOrders[name].children = Array(...new Set(globalOrders[name].children))
    },

    async reset(name: string): Promise<void>{
      globalOrders[name].reset()
    },

    async putSystem(order: string, name: string): Promise<void>{
      globalOrders[name].putSystem(order)
    },

    async printLog(name: string): Promise<void>{
      console.log(globalOrders[name].body.messages)
    }

  };
};
