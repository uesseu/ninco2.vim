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
      if(num !== 0) denops.call('win_execute', x, 'norm o')
      denops.call('ninco#put_window', d.replaceAll(' ', '\\ '), buf, x, normal)
      denops.cmd('redraw')
      num++
    })
  })
}


export class Writer{
  constructor(){ }
  write(){ }
}

export class VimWriter extends Writer{
  denops: Denops
  buffer: string

  constructor(denops: Denops, order: Order){
    super()
    this.denops = denops
    this.bufname = order.bufname
  }

  write(text: string){
    vimPutString(this.denops, text, this.bufname)
  }
}

