import {VimWriter} from './writer.ts'
import {parseResponseChatgpt, processChunk} from './response_parser.ts'

let defaultKey = ""
let defaultModel = "gpt-4.1-nano"
let defaultUrl = "https://api.openai.com/v1/chat/completions"
const COMPRESS_PROMPT = 'Please summarize this talk log.'

export function copy(x){
  return JSON.parse(JSON.stringify(x))
}

/**
 * A manager of order for LLM.
 * It can make JSON string to send to openai.
 */
export class Order{
  body // The body of messages.
  type: string // ['chatgpt', 'ollama']
  name: string // Name of thread
  command: string // Command name and arguments
  command_args: Array<string>
  print: boolean // Whether write in vim buffer
  repeat: boolean // Repeat what you say on vim
  model: string // Model name
  url: string  // url of web api
  key: string  // Key of your account
  max_length: number  // If over, compress
  compress_num: number // Number to compress
  compress_style: string // [summarize, delete](Now, summarize only)
  compress_prompt: string // Prompt to compress
  bufname: string  // ID of window
  log: Array<Array<object>> // Log of thread to go back
  dry_run: boolean // Just for debug.
  freeze: boolean // Do not go next
  window_style: string
  float_geometry: object
  parent: string // Name of parent thread
  children: Array<string> // Names of child threads
  pre_user_write: string
  post_user_write: string
  callback: string // Callback vim function
  timeout: number

  /**
   * Setup order object to make JSON to send to openai.
   * @param {string} model - Name of model. (Ex. "gpt-3.5-turbo")
   */
  constructor(print = true, repeat = true, command = '',
    type = 'chatgpt',
    name = '', key = defaultKey, url = defaultUrl,
    model = defaultModel, command_args = [],
    max_length = 10, compress_num = 4, bufname = '',
    dry_run = false, pre_user_write = '# ',
    freeze = false, post_user_write = "\n--------------------\n",
    window_style = 'horizontal',
    float_geometry = {row: 2, col: 20, height: 6, width: 50},
    options = {}, compress_prompt = COMPRESS_PROMPT,
    compress_style = 'summarize',
    timeout = 60000,
    callback = 'ninco#tree_window'){
    this.body = {
      model: model,
      messages: [],
      stream: true,
    }
    this.model = model
    this.body = {...this.body, ...options}
    this.name = name
    this.type = type
    this.print = print
    this.repeat = repeat
    this.command = command
    this.command_args = command_args
    this.key = key
    this.url = url
    this.max_length = max_length
    this.compress_num = compress_num
    this.compress_style = compress_style
    this.bufname = bufname
    this.freeze = freeze
    this.log = [[]]
    this.dry_run = dry_run
    this.parent = ''
    this.children = []
    this.window_style = window_style
    this.float_geometry = float_geometry
    this.pre_user_write = pre_user_write
    this.post_user_write = post_user_write
    this.compress_prompt = compress_prompt
    this.callback = callback
    this.timeout = timeout
  }

  /**
   * Set parameter from json.
   * @param {object} param - Content of parameter.
   */
  setParameter(param: any){
    for (let p in param){
      if (p in this && p !== 'body') this[p] = param[p]
    }
  return this
  }

  setOptions(param: any){
    this.body= {...this.body, ...param}
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
    return this
  }

  compress(writer: Writer){
    if (this.max_length <= this.body.messages.length){
      let tmpOrder: Order = this.copyChild()
      tmpOrder.body.messages = this.removeOld()
      tmpOrder.putUser(
        this.compress_prompt + ":\n" + JSON.stringify(this.removeOld())
      )
      if (this.dry_run){
        this.unshiftHistory('compressed')
      } else {
        tmpOrder.run(writer).then(x=>this.unshiftHistory(x))
      }
    }
    return this
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
    return this
  }

  order(writer: Writer, text: string){
    return this.putUser(text).run(writer).then((x)=>{
      if(!this.freeze) this.putAssistant(x)
    })
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
    for (const n in this){
      order[n] = copy(this[n])
    }
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
      if(end === 0) {
        this.body.messages = []
        this.log = [[]]
        return this
      }
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
   * Example
   * let ai = new Order()
   * ai.putUser('hello')
   * let task = await ai.receive()
   * let result = ''
   * for await (const chunk of task.body){
   *   result = result + processChunk(chunk)
   * }
   */
  receive(){
    this.body.model = this.model
    return fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.key}`
      },
      body: JSON.stringify(this.body),
    });
  }

  /**
   * Reset messages and returns itself.
   * @returns {Order}
   */
  reset(){
    this.body.messages = []
    return this
  }

  /**
   * Receive reply from chatgpt and put it to vim window by denops.
   * @param {Order} order - Order object to use.
   * @param {string} text - String to process.
   * @returns {string} - Output of AI.
   */
  async getText(){
    let resp = await this.receive()
    let allData = ''
    let timeIsOut = false
    let timeoutId = setTimeout(() => timeIsOut = true, this.timeout);
    for await (const chunk of resp.body){
      if (timeIsOut) return allData
      allData += processChunk(this.type, chunk).join("")
    }
    return allData
  }

  /**
   * Make a copy of main AI to use other back ground task.
   * @param {Order} order - Template of order object.
   * @returns {Order} - Order.
   */
  copyChild(freeze=true){
    let tmpOrder: Order = this.copy()
    tmpOrder.print = false
    tmpOrder.repeat = false
    tmpOrder.freeze = freeze
    tmpOrder.command = ''
    return tmpOrder
  }

  /**
   * Receive reply from chatgpt and put it to vim window by denops.
   * @param {Writer} writer - Writer object.
   * @param {Order} order - Order object to use.
   * @param {bool} bool - If it is true, it put string to vim.
   * @returns {null} - All output of chatGPT.
   */
  async run(writer: Writer){
    let allData = ""
    let process
    if (this.command !== ""){
      process = new Deno.Command(this.command, {
        args: this.command_args,
        stdin: "piped",
      }).spawn();
      writer = process.stdin.getWriter();
    }
    if (this.repeat){
      writer.write(
        "\n"
        + this.pre_user_write
        + this.body.messages.slice(-1)[0].content
        + this.post_user_write
      )
    }
    if (this.dry_run){
      if (this.print) writer.write(
        "\n" + this.body.messages.slice(-1)[0].content + "\n",
      )
      if (this.command !== ""){
        writer.write(
          new TextEncoder().encode(this.body.messages.slice(-1)[0].content)
        )
        writer.releaseLock();
        await process.stdin.close();
      }
      allData += this.body.messages.slice(-1)[0].content
    } else {
      // Receive response of AI
      let resp = await this.receive()
      let timeIsOut = false
      let timeoutId = setTimeout(() => timeIsOut = true, this.timeout);
      for await (const chunk of resp.body){
        if (timeIsOut) break
        let data = processChunk(this.type, chunk)
        if (this.print) writer.write(data.join(""), this.bufname)
        if (this.command !== "")
          writer.write(new TextEncoder().encode(data.join('')))
        allData += data.join("")
      }
    }
    if (this.command !== ""){
      writer.releaseLock();
      await process.stdin.close();
    }
    if (this.print) writer.write("\n")
    if (this.freeze) this.body.messages.pop()
    return allData
  }

}
