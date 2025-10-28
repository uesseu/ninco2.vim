scriptencoding utf-8
" ninco.vim
" Last Change:	2023 Sep 25
" Maintainer:	Shoichiro Nakanishi <sheepwing@kyudai.jp>
" License:	Mit licence

if exists('g:loaded_ninco')
  finish
endif
let s:save_cpo = &cpo
set cpo&vim

let g:loaded_ninco = 1

command! -nargs=1 Ninco call ninco#ninco(ninco#atmark(<f-args>))
command! -nargs=1 Ninco2 echo ninco#atmark($'<f-args>')

let &cpo = s:save_cpo
unlet s:save_cpo
