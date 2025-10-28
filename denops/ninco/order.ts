import {Writer} from './writer.ts'
import {Denops} from "jsr:@denops/std@^7.0.0/function";
import {parseResponseChatgpt, processChunk} from './response_parser.ts'
import {Agent, defaultAgent, AgentFormat, defaultOrder} from './defaults.ts'
import {duckduckgo, readHTML, Web, SearchEngine} from './websearch.ts'
import {MCP, MCPS} from './mcp.ts'


const COMPRESS_PROMPT = 'Please summarize this talk log.'

export function copy(x){
  return JSON.parse(JSON.stringify(x))
}

export interface Team{
  plan: Order
  command: Order
  filename: Order
  better: Order
  appendix: Order
  write: Order
  structure: Order
  websearch: Order
  test: Order
  select: Order
  extract: Order
}


/**
 * Make markdown from object
 * @param {AgentFromat} template - Template
 * @param {Number} depth - Depth of template. Need not to set.
 */
function toMarkdown(template: AgentFormat, depth=1){
  if (typeof template === 'string') return template
  let result = ''
  for (let key in template){
    if (template[key]){
    result += `${'#'.repeat(depth)} ${key}
${toMarkdown(template[key], depth+1)}
`
    }
  }
  return `${result}`
}

/**
 * A manager of order for LLM.
 * It can make JSON string to send to openai.
 */
export class Order{
  // Messages
  body // The body of messages.
  log: Array<Array<object>> // Log of thread to go back

  // Base options
  type: string // ['chatgpt', 'ollama']
  name: string // Name of thread
  model: string // Model name
  url: string  // url of web api
  key_ai: string  // Key of your AI account
  key_websearch: string  // Key of your MCP web search service
  freeze: boolean // Do not go next

  // Shell command
  command: string // Command name and arguments
  command_args: Array<string>

  // Compress
  max_length: number  // If over, compress
  compress_num: number // Number to compress
  compress_style: string // [summarize, delete](Now, summarize only)
  web_compress_prompt: string // Prompt to compress
  compress_prompt: string // Prompt to compress
  websearch_compress: boolean // Run compress

  // AI window
  filename: string  // ID of window
  window_style: string
  float_geometry: object

  // Tree
  parent: string // Name of parent thread
  children: Array<string> // Names of child threads

  // Write style
  print: boolean // Whether write in vim buffer
  repeat: boolean // Repeat what you say on vim
  pre_user_write: string
  post_user_write: string
  timeout: number
  agentPrompt: Agent
  writer: Writer

  // Agent
  use_websearch: boolean // Whether perform websearch or not
  mode: string
  team: Team | null
  fast: boolean
  platform: string
  parallel: number


  /**
   * Setup order object to make JSON to send to openai.
   * @param {string} model - Name of model. (Ex. "gpt-3.5-turbo")
   */
  constructor(options: object = defaultOrder, agent: object = defaultAgent){
    this.agentPrompt = agent
    this.configure(options)
    this.body = {
      model: this.model,
      messages: [],
      stream: true,
    }
    this.team = {}
    this.autoTune()
    if (this.key_ai === '') this.key_ai = Deno.env.get('NINCO_KEY_AI')
    if (this.key_websearch === '') this.key_websearch = Deno.env.get('NINCO_KEY_WEBSEARCH')
  }

  autoTune(){
    if (this.fast) return 0
    switch (this.model) {
      default:
        this.fast = {config: {}, parameter: {}}
        return
      case 'gpt-5-nano':
        this.fast = {config: {}, parameter: {reasoning_effort: 'minimal', verbosity: 'low'}}
        return
      case 'gpt-5-mini':
        this.fast = {config: {model: 'gpt-5-nano'}, parameter: {reasoning_effort: 'minimal', verbosity: 'low'}}
        return
      case 'gpt-5':
        this.fast = {config: {model: 'gpt-5-nano'}, parameter: {reasoning_effort: 'minimal', verbosity: 'low'}}
        return
    }
  }

  /**
   * Set parameter from json.
   * @param {object} param - Content of parameter.
   */
  configure(param: any){
    for (let p in param){
      if (p in this && p !== 'body') this[p] = param[p]
    }
  return this
  }

  setWriter(writer: Writer){
    this.writer = writer
    return this
  }

  load(data: any){
    this.body = copy(data.body)
    return this
  }

  setParameter(param: any){
    this.body= {...this.body, ...param}
    return this
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

  compress(){
    this.writer.filename = this.filename
    if (this.max_length <= this.body.messages.length){
      let tmpOrder: Order = this.makeWorker()
      tmpOrder.writer = this.writer
      tmpOrder.body.messages = this.removeOld()
      tmpOrder.putUser(
        this.compress_prompt
        + ":\n"
        + JSON.stringify(this.removeOld())
      )
      tmpOrder.run().then(x=>this.unshiftHistory(x))
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

  async reserve(texts: Array<string>){
    for (let text of texts){
      await this.putUser(text).run().then((x)=>{this.putAssistant(x)})
    }
    return this
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

  copy(register: boolean = true){
    let order = new Order()
    if (register){
      for (const n in this){
        order[n] = copy(this[n])
      }
      order.parent = this.name
      order.children = []
    }
    order.writer = this.writer
    return order
  }

  showTree(root, n=0){
    const message = this.body.messages
    const lastMessage = message.length >= 2 ? message[message.length - 2].content : ''
    let lognum = 0
    let flatten = this.log.flat()
    for (let log in flatten){
      if (flatten[log].kind === 'normal') lognum++
    }
    let result = `${' '.repeat(n*2)}${this.name}[${lognum}]: ${lastMessage.slice(0, 20)}...\n`
    for (let c in this.children)
      result += root[this.children[c]].showTree(root, n + 1)
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
      if (flat_log[start].kind === 'normal') num --
      if (flat_log[start].kind === 'compress') has_compress = true
      start --
    }
    if (has_compress){
      while (true){
        if (flat_log[start].kind === 'compress') break
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
      "Authorization": `Bearer ${this.key_ai}`
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
      if (timeIsOut) break
      let data = processChunk(this.type, chunk)
      if (this.print) this.writer.write(data.join(""))
      allData += data.join("")
    }
    return allData
  }

  /**
   * Make a copy of main AI to use other back ground task.
   * @param {Order} order - Template of order object.
   * @returns {Order} - Order.
   */
  makeWorker(freeze=true, fast=false){
    let tmpOrder: Order = this.copy(false)
    tmpOrder.print = false
    tmpOrder.repeat = false
    tmpOrder.freeze = freeze
    tmpOrder.command = ''
    if (fast){
      tmpOrder.configure(this.fast.config)
      tmpOrder.setParameter(this.fast.parameter)
    }
    return tmpOrder
  }

  /**
   * Receive reply from chatgpt and write the result though writer.
   * @param {Order} order - Order object to use.
   * @param {bool} bool - If it is true, it put string to vim.
   * @returns {null} - All output of chatGPT.
   */
  async run(){
    this.writer.filename = this.filename
    if (this.repeat){
      this.writer.write(
        "\n"
        + this.pre_user_write
        + this.body.messages.slice(-1)[0].content
        + this.post_user_write
      )
    }
    let data = await this.getText()
    if (this.command !== ""){
      let process = new Deno.Command(this.command, {
        args: this.command_args,
        stdin: "piped",
        stdout: "piped",
      }).spawn()
      let shell_writer = process.stdin.getWriter();
      shell_writer.write(new TextEncoder().encode(data));
      shell_writer.releaseLock();
      await process.stdin.close();
      console.log(new TextDecoder().decode(
        (await process.stdout.getReader().read()).value
      ))
    }
    if (this.print) this.writer.write("\n")
    if (this.freeze) this.body.messages.pop()
    return data
  }

  async websearch(query: string, num:number = 10, stringNum = 10000, kind: string = 'duckduckgo'){
    let links = []
    links = kind === 'duckduckgo' ?
      await duckduckgo(query, 1, num) :
      await (new Web(SearchEngine.brave, this.key_websearch).search(query, num, 'jp', 'jp'))
    let results = await Promise.all(
      links.map(
        link=>readHTML(link.link).then((text: string)=>{
          let texts: Array<string> = [];
          let i = 0
          while (i < text.length){
            let n = 0
            while (
              (text[n + i] !== '\n' && n < stringNum)
                || (n + i) < text.length){
              n += 1
            }
            texts.push(text.slice(i, n + i))
            i = i + n
            if (i >= text.length) break
          }
          if (this.websearch_compress) return Promise.all(
            texts.map(
              x => this.makeWorker().putUser(this.web_compress_prompt + ":\n" + x).receive()
            )
          )
          return texts
        }).then(
          async(x)=>{
            if (this.websearch_compress) {
              console.log('====================COMPRESS====================')
              let allData: Array<string> = []
              for await (const xx of x){
                let data = ''
                let timeIsOut = false
                let timeoutId = setTimeout(() => timeIsOut = true, this.timeout)
                for await (const chunk of xx.body){
                  if (timeIsOut) break
                  data += processChunk(this.type, chunk)
                }
                allData.push(data)
              }
              return allData
            }
            return x
          })
      )
    )
    for (const n in results){
      for (const nn in results[n]){
        try{
          console.log(typeof results[n][nn])
        this.putSystem(`According to ${links[n].title}
${results[n][nn]}`)
        } catch(er) {
          throw er
        }
      }
    }
    return this
  }

  /**
   * Get response along the agent prompts.
   * @param {string} order - Role of the AI.
   * @param {text} string - Prompt for the AI.
   * @param {asChild} bool - If true, child will be yielded.
   * @param {reset} bool - If true, the talk will be reset before get result.
   * @param {fast} bool - If true, the child will be yielded in fast mode. Only works when asChild is true.
   * @returns {string} - Result of part of agent response.
   */
  private async getAgentResponse(key: string, text: string, asChild: boolean = false, onetask: boolean = false, fast = false){
    let order = asChild ? this.makeWorker(true, fast) : this
    if (onetask) order.reset()
    let tmpPrompt = copy(order.agentPrompt)[key]
    tmpPrompt['Input'] = text
    tmpPrompt.repeat = false
    tmpPrompt.print = false
    return order.putUser(
      toMarkdown(tmpPrompt)
    ).run().then((x)=>{
      if(!asChild) ai.putAssistant(x)
      return x
    })
  }

  /**
   * Detect command
   * @param {text} string - Prompt for the AI.
   * @param {command} string - If true, child will be yielded.
   * @param {retry} number - Number of retry.
   * @returns {string} - command
   */
  private async detectCommand(text: string, retry: number = 1){
    if (this.mode === 'talk') return 'talk'
    this.writer.message('Detecting command')
    let command = ''
    for (let n=0; n < retry; n++){
      command = (
        await this.getAgentResponse('command', text, true, true, true)
      ).trim()
      if (command in this.agentPrompt){
        break
      }
    }
    this.writer.message(`Current mode is ${command}`)
    return command
  }

  async order(text: string, command: string = ''){
    this.writer.filename = this.filename
    if (command === '') command = await this.detectCommand(text)
    switch (command) {

      default :
        await this.writer.message(`Command parse failed ${command}`)
        return (async()=>null)

      case "write":
        let coder = this.getAgentResponse('write', text, true, true, false)
        return this.makeWorker(true, true).getAgentResponse("filename", text, true, true, true).then(filename =>{
          runOnce(this)({'file': filename, 'prompt': text})
        })

      case "talk":
        return await this.putUser(text).run().then((x)=>{
          this.putAssistant(x)
          return x
        })

      case "plan":
        this.getAgentResponse(command, text, true, true)
          .then(async plan=>{
            for (let files of divider(this.parallel)(getPlanPiece(plan).filter(x=>x.prompt !== ""))){
              await Promise.all(files.map(runOnce(this)))
            }
          })
        this.writer.message('Done!')

      case "websearch":
        if (this.use_websearch){
          this.writer.message('Web search is going on.')
          let websearch = this.makeWorker(false, false)
          this.team['websearch'] = websearch
          let prompt = await this.makeWorker(true).getAgentResponse(command, text, true, true, true)
          console.log(prompt)
          await this.webSearch(
            prompt,
            1, 10, toMarkdown(this.agentPrompt['denoise'])
          )
          return websearch.putUser(text).run().then((x)=>{
            this.putAssistant(x)
            return x
          })
        }
        return this.putUser(text).run().then((x)=>{
          this.putAssistant(x)
          return x
        })

    }
  }

}


/**
 * Divide plan task
 * @param {string} text - The result of plan
 */
function getPlanPiece(text: string){
  let texts = text.split("\n")
  let files: Array<object> = []
  for (let t of texts){
    if (t.length === 0) files[files.length-1]['prompt'].push(t)
    if (t[0] !== ' ') files.push({file: t, prompt: []})
    else files[files.length-1]['prompt'].push(t)
  }
  return files.map(x=>{return {file: x['file'], prompt: x['prompt'].map(y=>y.slice(4)).join('\n')}})
}

/**
 * Divider of array.
 * @param {number} num - The result of plan
 * @returns {null} - It returns null.
 */
const divider = (num: number)=>(array: Array<any>) => {
  return new Array(Math.ceil(array.length / num)).fill()
    .map((_, i) => array.slice(i * num, (i + 1) * num))
}

/**
 * Run write or plan task of agent
 * @param {Order} order - The order
 * @param {string} file - The filename
 */
const runOnce = (order) => async (file) => {
  let child = order.makeWorker(true, false)
  let x = await child.getAgentResponse('write', file.prompt, true, true, false)
  await child.writer.makefile(file.file)
  await child.writer.write(x, file.file)
  await child.writer.hide(file.file)
  order.putAssistant(x)
}

