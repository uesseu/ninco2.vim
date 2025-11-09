import {Order} from '../denops/ninco/order.ts'
import {globalOrders, connector, runoneline} from '../denops/ninco/glue.ts'
import {DenoWriter} from '../denops/ninco/writer.ts'
import { Input, type InputOptions } from "jsr:@cliffy/prompt@1.0.0-rc.7";

async function setParam(name: string, options: any): Promise<void>{
  globalOrders[name].setParameter(options)
}

function get_param(name: string, param: string): string{
  return globalOrders[name][param]
}

async function reserve(name, texts){
  globalOrders[name].reserve(texts)
}

async function compress(name): Promise<void>{
  globalOrders[name].compress()
}

function copy(name: string, new_name: string = ''): string{
  if (new_name === '') new_name = nextId(name)
  globalOrders[new_name] = globalOrders[name].copy()
  globalOrders[new_name].setWriter(new DenoWriter(globalOrders[name].filename))
  globalOrders[new_name].parent = name
  globalOrders[new_name].name = new_name
  globalOrders[name].children.push(new_name)
  globalOrders[name].children = Array(...new Set(globalOrders[name].children))
  return new_name
}

async function putSystem(order: string, name: string): Promise<void>{
  globalOrders[name].putSystem(order)
}

async function printLog(name: string): Promise<void>{
  console.log(globalOrders[name].body.messages)
}

function listTalk(): Array<string>{
  let result = Array()
  for (let n in globalOrders) result.push(n)
  return result
}

function webSearch(name, query, num=1, compressPrompt='', stringNum=10000): Promise<void>{
  globalOrders[name].webSearch(query, 1, num, compressPrompt, stringNum)
}


const connection = connector({}, (handler, fname)=>new DenoWriter(handler, fname))

console.log(` _   _ _                  ____ _     ___ 
| \\ | (_)_ __   ___ ___  / ___| |   |_ _|
|  \\| | | '_ \\ / __/ _ \\| |   | |    | | 
| |\\  | | | | | (_| (_) | |___| |___ | | 
|_| \\_|_|_| |_|\\___\\___/ \\____|_____|___|

Type @exit to exit. You can use completion by hitting tab.
`)

async function runcommand(connection, exitfunc=()=>Deno.exit()) {
  let current: string
  connection.new('ai', {})
  current = 'ai'
  while (true) {
    //const line = prompt('>')
    const line = await Input.prompt({
      message: '',
      suggestions: ["@exit", "@help", "@new", "@change",
        "@delete", "@copy", "@list", "@tree", "@configure", "@goback",
        "@websearch", "@save", "@load", "@saveall", "@loadall"]
    })
    await runoneline(connection, current, line, exitfunc)
  }
}

await runcommand(connection);
