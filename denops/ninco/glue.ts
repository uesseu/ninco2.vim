import {Denops, execute, call, cmd} from "jsr:@denops/std@^7.0.0/function";
import {Order, copy} from './order.ts'
import {processChunk} from './response_parser.ts'
import {duckduckgo, webSearch, readHTML} from './websearch.ts'
import {divideTaskTest, Team} from './team.ts'

/* Global object to talk with chatGPT. */
export let globalOrders = {}

/**
 * Whether the id of AI exists.
 * @param {string} id - Name of AI.
 * @returns {boolean} - Exists or not.
 */
function isExisting(id: string){
  let exists = false
  for (let n in globalOrders){
    if(n === id) exists = true
  }
  return exists
}

/**
 * Make next id of AI.
 * @param {string} id - Name of AI.
 * @returns {string} - New name.
 */
function nextId(id: string){
  while (isExisting(id)){
    let splitted = id.split('_')
    let num = Number(splitted[splitted.length - 1])
    if (Number.isInteger(num)){
      id = splitted.slice(0, splitted.length-1).join('_') + '_' + String(num + 1)
    } else {
      id += '_1'
    }
  }
  return id
}

const helptexts = {all: `Ninco the free light weight AI agent by amateur person.

Usage:
    If you want to talk with AI, type as you like.
    But if you want to configure, @ command interface should be used.
    Type @ at the head of line is the command trigger.
Commands:
    General
        @help [command]: Show help of a command.
        @exit: Quit the program.
    Context management
        @new [name options]: Make a new AI context.
        @change [name]: Change the AI context.
        @delete: Delete current AI context.
        @copy [name]: Copy the AI context.
        @list: Show the list of AI context.
        @tree: Show the list of AI contexts in tree style.
        @config: Load config file from json.
    Context usage
        @goback [num]: Go to the past of the AI context.
        @websearch [query]: Search the query by duckduckgo.
    Save and load
        @save [name path]: Save a context.
        @load [name path]: Load a context.
        @saveall [path]: Load all the context.
        @loadall [path]: Load all the context.
    Custom
        @@ : Evaluate environment specific string.
          It is specific input for each environments.
Example:
    @help new
    @ hoge + fuga
`,
'@': `@@ : Evaluate environment specific string.
It is specific for each environments.

Example(vim):
    Ninco @@ Please translate below to english. {}
Example(deno):
    Ninco @@ Please calculate \${hoge}
`,
new: `Make new context.

Make new context. It requires name of the context.
Optionally, you can set JSON to configure the context.
When ninco boot, it makes content named 'ai'.

Example:
    @new AI {key: 'hogefugapiyo', model: 'gpt-5-nano'}
`,
help: `Show help of a command.

Example:
    @help new
`,
exit: 'Just quit the program.',
change: `Change the AI context.
The context must be made before changed.

Example:
    @change hoge`,
save: `Save the AI context.
The path can contain space.

Example:
    @save ai /home/yourname/AI/hoge.json
`,
load: `Load the AI context.
The path can contain space.

Example:
    @load ai /home/yourname/AI/hoge.json
`,
saveall: `Save all the AI context.
The path can contain space.

Example:
    @saveall /home/yourname/AI/hoge.json
`,
loadall: `Load all the AI context.
The path can contain space.

Example:
    @loadall /home/yourname/AI/hoge.json
`,
loadall: `Go back to past.

Example:
    @goback 2
`,
tree: `Show in tree style

Example:
    @tree
`,
show: `Show current context log.

Example:
    @show
`,
copy: `Copy the context and set it in child.

Example:
    @copy
`,
delete: `Delete the context.

Example:
    @delete
`,
status: `Show the status of context.

Example:
    @status
`,
config: `Load a configuration file.

Example:
    @config conf.json
`
}

let current = 'ai'

export const connector = (handler, writerMaker) => {
  return {
    putEnv(options){
      for (let key in options) Deno.env.set(key, options[key])
    },
    getWriterMaker(){
      return {maker: writerMaker, handler: handler}
    },
    new(name: string, options: any): string{
      let writer = writerMaker(handler)
      if (name === 'ai') name = nextId(name)
      if (name in globalOrders){
        writer.alert(`${name} is duplicated and could not made.`)
        return ''
      }
      options.name = name
      globalOrders[name] = new Order()
      globalOrders[name].configure(options)
      globalOrders[name].setWriter(writerMaker(handler, globalOrders[name].filename))
      return name
    },

    async delete(name: string): Promise<void>{
      let parent: string = globalOrders[name].parent
      if (parent !== ''){
        for (let n in globalOrders[parent]){
          if (globalOrders[parent].children[n] === name)
            globalOrders[parent].children.splice(n, n)
        }
      }
      let child: string
      for (let n in globalOrders[name].children){
        child = globalOrders[name].children[n]
        globalOrders[child].parent = ''
      }
      delete globalOrders[name]
    },

    async config(name: string, options: any): Promise<void>{
      globalOrders[name].configure(options)
    },

    async setParam(name: string, options: any): Promise<void>{
      globalOrders[name].setParameter(options)
    },

    tree(root = globalOrders): string{
      let result = ''
      for (let name in globalOrders){
        if (globalOrders[name].parent === ''){
          result += globalOrders[name].showTree(root)
        }
      }
      return result
    },

    async status(name: string): Promise<void>{
      writerMaker(handler).message(JSON.stringify(globalOrders[name], null, 2))
    },

    show(name: string): string{
      let result = ''
      for (let content in globalOrders[name].log){
        let data = globalOrders[name].log[content]
        for (let c in data){
          if (data[c].kind === 'normal'){
            if (data[c].role === 'user'){
              result += (
                globalOrders[name].pre_user_write
                + data[c].content
                + globalOrders[name].post_user_write
              )
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
      let toSave: Order
      if (deleteKey){
        toSave = copy(globalOrders[name])
        toSave.key = ''
      } else {
        toSave = globalOrders[name]
      }
      Deno.writeTextFile(path, JSON.stringify(toSave, null, 2))
      .then(x=>writerMaker(handler)(`Written to ${path}`))
    },

    async load(path: string, name: string = ''): Promise<void>{
      Deno.readTextFile(path).then(
        x=> {
          let option = JSON.parse(x)
          name = name === '' ? nextId(option.name) : nextId(name)
          globalOrders[name] = (new Order()).setWriter(writerMaker(handler, globalOrders[name].filename)).configure(option).load(option)
        }
      )
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
      .then(x=>writerMaker(handler)(`Written to ${path}`))
    },

    async loadAll(path: string): Promise<void>{
      Deno.readTextFile(path).then(
        x=>{
          let options = JSON.parse(x)
          for (let key in options){
            globalOrders[options[key].name] =
              (new Order()).setWriter(
                writerMaker(handler, globalOrders[name].filename)
            ).configure(options[key]).load(options[key])
          }
        }
      )
    },

    async run(name, text, command=''){
      return await globalOrders[name].order(text, command)
    },

    async ninco(text){
      await runoneline(this, current, text, ()=>{})
    },

    async reserve(name, texts){
      globalOrders[name].reserve(texts)
    },

    async compress(name): Promise<void>{
      globalOrders[name].compress(handler)
    },

    copy(name: string, new_name: string = ''): string{
      if (new_name === '') new_name = nextId(name)
      globalOrders[new_name] = globalOrders[name].copy()
      globalOrders[new_name].setWriter(writerMaker(handler, globalOrders[name].filename))
      globalOrders[new_name].parent = name
      globalOrders[new_name].name = new_name
      globalOrders[name].children.push(new_name)
      globalOrders[name].children = Array(...new Set(globalOrders[name].children))
      return new_name
    },

    async putSystem(order: string, name: string): Promise<void>{
      globalOrders[name].putSystem(order)
    },

    async printLog(name: string): Promise<void>{
      writerMaker(handler)(globalOrders[name].body.messages)
    },

    listTalk(): Array<string>{
      let result = Array()
      for (let n in globalOrders) result.push(n)
      return result
    },

    websearch(name, query, num=10, stringNum=10000): Promise<void>{
      globalOrders[name].websearch(query, num, stringNum)
    },

    async better(name, command): Promise<void>{
      let fname = await handler.eval('buffer_name()')
      globalOrders[name].better(command, (await handler.eval(`getbufline('${fname}', 0, '$')`)).join('\n'), fname)
    },
  }
}

export async function runoneline(connection, current, line, exitfunc){
  let conmaker = connection.getWriterMaker()
  let writer = conmaker.maker(conmaker.handler)
  if (line === null) return
  const command = line.trim().split(' ')[0].trim()
  let content = line.trim().slice(command.length).trim()
  switch (command) {
    default:
      await connection.run(current, line)
      return
    case '':
      writer.message(helptexts.all)
      return
    case '@':
      writer.message(helptexts.all)
      return
    case '@help':
      if (helptexts.hasOwnProperty(content)) writer.message(helptexts[content])
      else writer.message(helptexts.all)
      return
    case '@new':
      if (content === '') return
      let option
      let name = content.trim().split(' ')[0].trim()
      let optionContent = content.trim().slice(name.length).trim()
      try {
        if (optionContent[0] === '{') option = JSON.parse(optionContent)
        else option = {}
      } catch {
        option = {}
      }
      await connection.new(name, option)
      current = name
      writer.message(`Current context: ${name}`)
      return
    case '@list':
      for (let line of listTalk()) writer.message(line)
      return
    case '@change':
      if (globalOrders.hasOwnProperty(content)) current = content
      else writer.message('No such context.')
      writer.message(`Current context is '${current}'`)
      return
    case '@copy':
      connection.copy(current, content)
      return
    case '@delete':
      if (content !== '') connection.delete(current)
      else connection.delete(content)
      return
    case '@exit':
      exitfunc()
      return
    case '@quit':
      exitfunc()
      return
    case '@load':
      connection.load(content, current)
      return
    case '@loadall':
      connection.load(content)
      return
    case '@show':
      connection.show(current)
      return
    case '@tree':
      writer.message(connection.tree())
      return
    case '@goback':
      connection.goback(current, Number(content))
      return
    case '@config':
      connection.config(current, Number(content))
      return
    case '@status':
      connection.status(current)
      return
    case '@websearch':
      connection.webSearch(current, content)
      return
  }
}

