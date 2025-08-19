import {Denops, execute, call, cmd} from "jsr:@denops/std@^7.0.0/function";

/**
 * Put string with new lines to vim window by denops.
 * @param {Denops} denops - Denops object.
 * @param {string} text - String to write.
 * @returns {null} - It returns null.
 */
export function vimPutString(denops: Denops, text: string, buf: string){
  let num = 0
  denops.eval(`"${buf}"->bufwinid()`).then(async (x) => {
    let normal = false
    if(x === -1) {
      x = await denops.eval(`"${buf}"->ninco#_find_vim_popup()`)
      normal = true
    }
    text.split("\n").map(d =>{
      if(num !== 0) {
        denops.call('win_execute', x, 'norm o')
      }
      denops.call('ninco#put_window', d.replaceAll(' ', '\\ '), buf, x, normal)
      num++
    })
  })
}

export class Writer{
  filename: string
  constructor(){ }
  makefile(){ }
  reset() { }
  write(text: string){ }
  alart(text: string){ }
}

export class VimWriter extends Writer{
  denops: Denops
  filename: string

  constructor(denops: Denops, filename: string){
    super()
    this.denops = denops
    this.filename = filename
  }

  async makefile(){
    await this.denops.cmd(`split ${this.filename}`)
  }

  async write(text: string){
    vimPutString(this.denops, text, this.filename)
  }

  async reset(){
    this.denops.call('win_execute', await this.denops.eval(`bufwinid("${this.filename}")`), "norm ggVGd")
  }

  async alart(text: string){
    await this.denops.cmd('redraw')
    await this.denops.cmd(`echomsg '${text}'`)
  }
}

