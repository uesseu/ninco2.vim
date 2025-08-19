import {VimWriter, Writer} from './writer.ts'
import {parseResponseChatgpt, processChunk} from './response_parser.ts'
import {Agent, defaultAgent, AgentFormat, defaultOrder} from './defaults.ts'
import {duckduckgo, readHTML} from './websearch.ts'

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

function countChar(text: string, char: string = '#'){
  let n: number = 0
  for (let t of text){
    if (t === char) {n++}
    else {return n}
  }
  return 0
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
  mode: string
  url: string  // url of web api
  key: string  // Key of your account
  max_length: number  // If over, compress
  compress_num: number // Number to compress
  compress_style: string // [summarize, delete](Now, summarize only)
  compress_prompt: string // Prompt to compress
  filename: string  // ID of window
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
  agentPrompt: Agent
  writer: Writer
  websearch: boolean // Whether perform websearch or not
  team: Team

  /**
   * Setup order object to make JSON to send to openai.
   * @param {string} model - Name of model. (Ex. "gpt-3.5-turbo")
   */
  constructor(options: object = defaultOrder, agent: object = defaultAgent){
    this.agentPrompt = agent
    this.setParameter(options)
    this.body = {
      model: this.model,
      messages: [],
      stream: true,
    }
    this.team = {}
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

  setWriter(writer: Writer){
    this.writer = writer
    return this
  }

  load(data: any){
    this.body = copy(data.body)
    return this
  }

  setOptions(param: any){
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
      let tmpOrder: Order = this.copyChild()
      tmpOrder.setWriter(this.writer)
      tmpOrder.body.messages = this.removeOld()
      tmpOrder.putUser(
        this.compress_prompt
        + ":\n"
        + JSON.stringify(this.removeOld())
      )
      if (this.dry_run){
        this.unshiftHistory('compressed')
      } else {
        tmpOrder.run().then(x=>this.unshiftHistory(x))
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

  copy(){
    let order = new Order()
    for (const n in this){
      order[n] = copy(this[n])
    }
    order.parent = this.name
    order.children = []
    order.team = {}
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
   * Receive reply from chatgpt and write the result though writer.
   * @param {Order} order - Order object to use.
   * @param {bool} bool - If it is true, it put string to vim.
   * @returns {null} - All output of chatGPT.
   */
  async run(){
    this.writer.filename = this.filename
    let allData = ""
    let process
    let shell_writer
    if (this.command !== ""){
      process = new Deno.Command(this.command, {
        args: this.command_args,
        stdin: "piped",
      }).spawn();
      shell_writer = process.stdin.getWriter();
    }
    if (this.repeat){
      this.writer.write(
        "\n"
        + this.pre_user_write
        + this.body.messages.slice(-1)[0].content
        + this.post_user_write
      )
    }
    if (this.dry_run){
      if (this.print) this.writer.write(
        "\n" + this.body.messages.slice(-1)[0].content + "\n",
      )
      if (this.command !== ""){
        shell_writer.write(
          new TextEncoder().encode(
            this.body.messages.slice(-1)[0].content
          )
        )
        shell_writer.releaseLock();
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
        if (this.print) this.writer.write(data.join(""))
        if (this.command !== "")
          this.writer.write(new TextDecoder().decode(data.join('')))
        allData += data.join("")
      }
    }
    if (this.command !== ""){
      shell_writer.releaseLock();
      await process.stdin.close();
    }
    if (this.print) this.writer.write("\n")
    if (this.freeze) this.body.messages.pop()
    return allData
  }

  async webSearch(query: string, start: number = 1, num:number = 10,
            compressPrompt: string = '', stringNum = 10000){
    let links = await duckduckgo(query, start, num)
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
          if (compressPrompt !== '') {
            return Promise.all(texts.map(x=>this.copyChild()
              .putUser(compressPrompt + ":\n" + x).receive()))
          }
          return texts
        }).then(
        async(x)=>{
          if (compressPrompt !== '') {
            let allData: Array<string> = []
            for await (const xx of x){
              let data = ''
              let timeIsOut = false
              let timeoutId = setTimeout(
                () => timeIsOut = true, this.timeout)
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
        this.putSystem(`According to ${links[n].title}
${results[n][nn]}`)
      }
    }
    return this
  }

  private async getAgentResponse(key: string, text: string, asChild: boolean = false, onetask: boolean = false){
    const ai = this.team[key] ? this.team[key] : this
    let prompt = this.agentPrompt[key]
    let order = asChild ? ai.copyChild(true) : ai
    if (onetask) order.reset()
    let tmpPrompt = copy(ai.agentPrompt)[key]
    tmpPrompt['Body'] = text
    return order.putUser(
      toMarkdown(tmpPrompt)
    ).run().then((x)=>{
      if(!asChild) ai.putAssistant(x)
      return x
    })
  }

  private async detectCommand(text: string, command: string, retry: number = 1){
    // Make command
    for (let n=0; n < retry; n++){
      let tmpCommand = (
        await this.getAgentResponse('command', text, true, true)
      ).trim()
      if (tmpCommand in this.agentPrompt){
        command = tmpCommand
        break
      }
    }
    return command
  }

  async order(text: string, command: string = ''){
    if (this.mode === 'talk') command = 'talk'
    this.writer.filename = this.filename
    if (command === ''){
      await this.writer.alart('Process command')
      command = await this.detectCommand(text, command)
      if (command === '') command = 'talk'
      // Process
      await this.writer.alart(`Current mode is ${command}`)
    }
    switch (command) {

      default :
        await this.writer.alart(`Command parse failed ${command}`)
        return (async()=>null)

      case "talk":
        return this.putUser(text).run().then((x)=>{
          this.putAssistant(x)
          return x
        })

      case "write":
        let filename = await this.getAgentResponse('filename', text, true)
        if (filename[0] == "'") filename = filename.slice(1, filename.length - 1)
        if (filename[0] == '"') filename = filename.slice(1, filename.length - 1)
        this.writer.alart(`New file name ${filename}`)
        this.writer.filename = filename.trim()
        let original_filename = this.writer.filename
        this.writer.makefile()
        return this.getAgentResponse(command, text, true)
          .then(async x=>{
            try{
              this.writer.write(x)
              this.putUser(text)
              this.putAssistant(x)
              this.writer.filename = original_filename
              return {type: command, content: x}
            } catch(er) {
              throw er
            }
          })

      case "plan":
        return this.getAgentResponse(command, text, true)
          .then(x=>{
            this.writer.write(x)
          })

      case "websearch":
        if (this.websearch){
          this.writer.alart('Web search is going on.')
          await this.webSearch(await this.getAgentResponse(command, text, true))
        }
        return this.putUser(text).run().then((x)=>{
            this.putAssistant(x)
          return x
        })
    }
  }

  async better(command: Array<string>, text: string, filename: string){
    process = new Deno.Command('sh', {
      args: ['-c'].concat(command),
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    let out = await new TextDecoder().decode(process.stderr.getReader().read().value)
    let err = await new TextDecoder().decode(process.stdout.getReader().read().value)
    let prompt = copy(this.agentPrompt.better)
    prompt.Error = err
    prompt.Output = out
    prompt.Body = text
    return this.putUser(toMarkdown(prompt)).run().then(async (x)=>{
        this.putAssistant(x)
        let original_filename = this.writer.filename
        this.writer.filename = filename.trim()
        await this.writer.reset()
        this.writer.write(x)
        this.putUser(x)
        this.writer.filename = original_filename
      return x
    })

  }

}
