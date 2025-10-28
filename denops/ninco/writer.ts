import {Denops, execute, call, cmd} from "jsr:@denops/std@^7.0.0/function";

/**
 * Put string with new lines to vim window by denops.
 * @param {Denops} denops - Denops object.
 * @param {string} text - String to write.
 * @returns {null} - It returns null.
 */
export async function vimPutString(denops: Denops, text: string, buf: string){
  let num = 0
  await denops.eval(`"${buf}"->bufwinid()`).then(async (x) => {
    let normal = false
    if(x === -1) {
      x = await denops.eval(`"${buf}"->ninco#_find_vim_popup()`)
      normal = true
    }
    await text.split("\n").map(async d =>{
      if (num!==0){
        denops.call('win_execute', x, 'norm o')
        denops.call('win_execute', x, 'norm 0D')
      }
      denops.call('ninco#put_window', d.replaceAll(' ', '\\ '), buf, x, normal)
      num++
    })
  })
}

export class Writer{
  filename: string
  constructor(connector: any, filename: string = ''){ }
  async makefile(filename: string = ''){}
  async reset(filename: string = ''){}
  async hide(filename: string = ''){}
  async write(text: string, filename: string = ''){}
  async message(text: string){ }
}


export class DenoWriter{
  filename: string
  constructor(connector: any, filename: string = ''){
  }
  async makefile(filename: string){
  }
  async reset() {
  }
  async hide() {
  }
  async write(text: string, filename: string = ''){
    Deno.stdout.write(new TextEncoder().encode(text))
  }
  async message(text: string){
    console.log(text)
  }
}


export class VimWriter extends Writer{
  denops: Denops
  filename: string

  constructor(denops: Denops, filename: string){
    super()
    this.denops = denops
    this.filename = filename
  }

  getFilename(filename){
    return filename === '' ? this.filename : filename
  }

  async makefile(filename: string = ''){
    await this.denops.cmd(`split ${this.getFilename(filename)}`)
  }

  async changefile(filename: string = ''){
    await this.denops.cmd(`file ${this.getFilename(filename)}`)
  }

  async write(text: string, filename: string = ''){
    await vimPutString(this.denops, text, this.getFilename(filename))
  }

  async hide(filename: string = ''){
    await this.denops.call('win_execute', await this.denops.eval(`bufwinid("${this.getFilename(filename)}")`), "hide")
  }

  async reset(filename: string = ''){
    this.denops.call('win_execute', await this.denops.eval(`bufwinid("${this.getFilename(filename)}")`), "norm ggVGd")
  }

  async message(text: string){
    await this.denops.cmd('redraw')
    await this.denops.cmd(`echo "${text.replaceAll('\\', '\\\\').replaceAll('\"', '\\\"').replaceAll('\n', '\\n')}"`)
  }
}
