function ninco#get_selection()
  let [line_start, column_start] = "'<"->getpos()[1:2]
  let [line_end, column_end] = "'>"->getpos()[1:2]
  let lines = line_start->getline(line_end)
  if lines->len() == 0
    return ''
  endif
  let lines[-1] = lines[-1][: column_end - (&selection == 'inclusive' ? 1 : 2)]
  let lines[0] = lines[0][column_start - 1:]
  return lines->join("\n")
endfunction

function! ninco#delete(name)
  return denops#request('ninco', 'delete', [a:name])
endfunction

function! ninco#tree_window(buf='AITREE')
  let winid = a:buf->bufwinid()
  if winid == -1
    return
  endif
  call win_execute(winid, 'silent! %d_')
  for line in denops#request('ninco', 'tree', [])->split("\n")
    call win_execute(winid, 'norm G')
    call appendbufline(a:buf, '$'->line(a:buf->bufwinid())-1, line)
  endfor
  exec "au BufEnter ".a:buf." noremap <CR> :call ninco#_show_ai()<CR>"
  exec "au BufLeave ".a:buf." noremap <CR> <CR>"
endfunction

function! ninco#get_param(name, param)
  return denops#request('ninco', 'get_param', [a:name, a:param])
endfunction

function! ninco#_show_in_window(ai, vertical=v:false)
  let bufname = denops#request('ninco', 'get_param', [a:ai, 'bufname'])
  let bufname = bufname == '' ? a:ai : bufname
  if bufname->bufwinid() == -1
    execute (a:vertical ?'vsplit ':'split ').bufname
    setlocal noswapfile
    setlocal wrap nonumber signcolumn=no
  endif
  call win_execute(bufname->bufwinid(), 'setlocal modifiable', 1)
  call win_execute(bufname->bufwinid(), 'silent! %d_')
  for line in denops#request('ninco', 'show', [a:ai])->split("\n")
    call appendbufline(bufname, '$'->line(bufname->bufwinid()), line)
  endfor
  return bufname
endfunction

function! ninco#split_window(buf='', vertical=v:false)
  if a:buf->bufwinid() != -1
    return
  endif
  execute (a:vertical ?'vsplit ':'split ').a:buf
  setlocal noswapfile
  setlocal wrap nonumber signcolumn=no filetype=markdown
  call win_execute(a:buf->bufwinid(), 'setlocal modifiable', 1)
  wincmd p
  return a:buf
endfunction

function ninco#new(options = #{}, name='ai')
  if match(a:name, '[A-Za-z]') == -1
    echo "Invalid thread name. Top of name should be alphabet."
    return
  endif
  if match(a:name, '[^A-Za-z0-9_]') != -1
    echo "Invalid thread name. Please use alphabet, integer and underbar"
    return
  endif
  return denops#request('ninco', 'new',
        \[a:name, a:options->extend(#{name: a:name})])
endfunction

function ninco#config(name, options = #{})
  call denops#request('ninco', 'config', [a:name, a:options->extend(#{name: a:name})])
  return a:name
endfunction

function ninco#set_bufname(name, buf='')
  call ninco#config(a:name, #{bufname: a:name})
  return a:name
endfunction

function ninco#option(name, options = #{})
  call denops#request('ninco', 'config', [a:name, a:options->extend(#{name: a:name})])
  return a:name
endfunction


function ninco#status(name)
  return denops#request('ninco', 'status', [a:name])
endfunction

function ninco#goback(name, num)
  call denops#request('ninco', 'goback', [a:name, a:num])
  return a:name
endfunction

function! ninco#copy(source, dest='')
  call denops#request('ninco', 'copy', [a:source, a:dest])
  return a:dest
endfunction

function! ninco#run(context, order='%s', ...)
  let order = 'printf'->call([a:order]+ a:000)
  call denops#request('ninco', 'order', [a:context, order])
  call ninco#compress(a:context)
  return a:context
endfunction

function! ninco#put_window(args, buf, winid = '-1', normal = v:false) abort
  let text = a:buf->getbufline('$')[-1] . a:args->substitute('\\ ', ' ', 'g')
  let winid = a:winid == '-1'? a:buf->bufwinid() : a:winid
  call win_execute(winid, 'norm G')
  call setbufline(a:buf, '$'->line(winid), text)
  call win_execute(winid, 'norm $')
endfunction

function! ninco#compress(buf)
  call denops#request('ninco', 'compress',
        \[a:buf, 'Please summaryze these messages.'])
endfunction

function! ninco#save_all(path, delete_key=v:true)
  call denops#request('ninco', 'saveAll', [a:path, delete_key])
endfunction

function! ninco#save(name, path, delete_key=v:true)
  call denops#request('ninco', 'save', [a:name, a:path, delete_key])
endfunction

function! ninco#load(name, path)
  call denops#request('ninco', 'load', [a:name, a:path])
  return name
endfunction

function! ninco#load_all(path)
  call denops#request('ninco', 'loadAll', [a:path])
endfunction

function! ninco#list_talk()
  return denops#request('ninco', 'listTalk', [])
endfunction

function! ninco#put_system(order)
  call denops#request('ninco', 'putSystem', [a:order])
endfunction

function! ninco#_show_ai()
  let line = line('.')->getline()
  let start = match(line, "[A-Za-z]")
  let end = match(line, "[")
  call ninco#_show_in_window(line[start:end-1])
endfunction

function! ninco#tree_split(vertical=v:true, buf='AITREE')
  eval a:buf->ninco#split_window(a:vertical)->ninco#tree_window()
endfunction

let s:cmd = {}

function ninco#command_wrapper(...)
  let args = a:000
  if a:000->len() == 1
    norm o
    let args = args + [ninco#get_selection()]
  endif
  call call('ninco#run', args)
endfunction

function ninco#make_command(cmd)
  let cmd = (toupper(a:cmd[0]).a:cmd[1:])->split('_')->join('')
  execute "command! -nargs=? ".cmd." call ninco#command_wrapper('".a:cmd."', <f-args>)"
  let s:cmd = s:cmd->extend({cmd: a:cmd})
  echo cmd
  return a:cmd
endfunction

function ninco#get_commands()
  return s:cmd
endfunction

function! ninco#find_vim_popup(buf) abort
  if has('nvim')
    return -1
  endif
  for p in popup_list()
    if winbufnr(p)->bufname() == a:buf
      return p
    endif
  endfor
  return -1
endfunction

function! ninco#float(buf, pos) abort
  execute "badd ".a:buf
  if has('nvim')
    let opts = #{relative: 'editor', anchor: 'NW',
          \style: 'minimal'}->extend(a:pos)
    return nvim_open_win(a:buf->bufnr(), 0, opts)
  endif
  let winid = popup_create(a:buf->bufnr(), {})
  let pos = #{line: a:pos['row']+1, col: a:pos['col']+1,
        \maxheight: a:pos['height'], maxwidth: a:pos['width'],
        \minheight: a:pos['height'], minwidth: a:pos['width']}
  call popup_move(winid, pos)
  return winid
endfunction

function! ninco#float_close(winid) abort
  if has('nvim')
    call nvim_win_close(a:winid, v:true)
  else
    call popup_close(a:winid)
  endif
endfunction
