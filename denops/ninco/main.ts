import {Denops, execute, call, cmd} from "jsr:@denops/std@^7.0.0/function";
import {Order, copy} from './order.ts'
import {VimWriter} from './writer.ts'
import {processChunk} from './response_parser.ts'
import {duckduckgo, webSearch, readHTML} from './websearch.ts'
import {divideTaskTest} from './team.ts'

/* Global object to talk with chatGPT. */
let globalOrders = {}

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

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = {

    new(name: string, options: any): string{
      if (name === 'ai') name = nextId(name)
      if (name in globalOrders){
        console.log(`${name} is duplicated and could not made.`)
        return ''
      }
      options.name = name
      globalOrders[name] = new Order()
      globalOrders[name].setParameter(options)
      return name
    },

    async delete(name: string): Promise<void>{
      let parent: string = globalOrders[name].parent
      for (let n in globalOrders[parent]){
        if (globalOrders[parent].children[n] === name)
          globalOrders[parent].children.splice(n, n)
      }
      let child: string
      for (let n in globalOrders[name].children){
        child = globalOrders[name].children[n]
        globalOrders[child].parent = ''
      }
      delete globalOrders[name]
    },

    async config(name: string, options: any): Promise<void>{
      globalOrders[name].setParameter(options)
    },

    async option(name: string, options: any): Promise<void>{
      globalOrders[name].setOptions(options)
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
      console.log(JSON.stringify(globalOrders[name], null, 2))
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
      .then(x=>console.log(`Written to ${path}`))
    },

    async load(path: string, name: string = ''): Promise<void>{
      Deno.readTextFile(path).then(
        x=> {
          let option = JSON.parse(x)
          name = name === '' ? nextId(option.name) : nextId(name)
          globalOrders[name] = (new Order()).setParameter(option).load(option)
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
      .then(x=>console.log(`Written to ${path}`))
    },

    async loadAll(path: string): Promise<void>{
      Deno.readTextFile(path).then(
        x=>{
          let options = JSON.parse(x)
          for (let key in options){
            globalOrders[options[key].name] =
              (new Order()).setParameter(options[key]).load(options[key])
          }
        }
      )
    },

    async order(name, text){
      const order = globalOrders[name]
      const writer = new VimWriter(denops, order)
      order.order(writer, text)
    },

    async compress(name): Promise<void>{
      globalOrders[name].compress(denops)
    },

    copy(name: string, new_name: string = ''): string{
      if (new_name === '') new_name = nextId(name)
      globalOrders[new_name] = globalOrders[name].copy()
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
      console.log(globalOrders[name].body.messages)
    },

    listTalk(): Array<string>{
      let result = Array()
      for (let n in globalOrders){
        result.push(n)
      }
      return result
    },

    webSearch(name, query, start, num): Promise<void>{
      webSearch(globalOrders[name], query, start, num)
    },

    isNeedToSearch(name, text){
      return isNeedToSearch(globalOrders[name], text)
    },

    async divideTaskTest(name, text, div=5){
      let tasks = await divideTaskTest(globalOrders[name], text, div=5)
      for (let n = 0; n < div; n++){
        let fname = (await tasks.fnames[n])
          .trim()
          .replace(/`/g, '')
          .replace(/'/g, '')
          .replace(/"/g, '')
          .replace(/\n/g, '')
        console.log(fname)
        let bufnr = await denops.eval(`bufadd('${fname}')`)
        console.log(bufnr)
        denops.call('bufload', bufnr)
        denops.call(
          'setbufline',
          bufnr, 1, (await tasks.tasks[n]).split('\n')
        )
        denops.call('setbufvar', bufnr, '&buflisted', 1)
      }
    }
  };
};
