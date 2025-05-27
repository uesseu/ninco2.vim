function ninco#get_selection()
  let [line_start, column_start] = "'<"->getpos()[1:2]
  let [line_end, column_end] = "'>"->getpos()[1:2]
  let lines = line_start->getline(line_end)
  if lines->len() == 0
    return ''
  endif
  let lines[-1] = lines[-1][: column_end - (&selection == 'inclusive' ? 1 : 2)]
  let lines[0] = lines[0][column_start - 1:]
  return join(lines, "\n")
endfunction

function! ninco#init(key, model='gpt-3.5-turbo',
	\url="https://api.openai.com/v1/chat/completions", vertical=0)
  call denops#request("ninco", "init", [a:key, a:model, a:url])
endfunction

function! ninco#delete(name)
  return denops#request('ninco', 'delete', [a:name])
endfunction

function! ninco#tree(winname)
  let winid = a:winname->bufwinid()
  call win_execute(winid, 'silent! %d_')
  for line in denops#request('ninco', 'tree', [])->split("\n")
    call win_execute(winid, 'norm G')
    call appendbufline(a:winname, '$'->line(a:winname->bufwinid())-1, line)
  endfor
endfunction

function! ninco#get_param(name, param)
  return denops#request('ninco', 'get_param', [a:name, a:param])
endfunction

function! ninco#open_window(ai, vertical=v:false)
  let winid = denops#request('ninco', 'get_param', [a:ai, 'winid'])
  let winid = winid == '' ? a:ai : winid
  if winid->bufwinid() == -1
    execute (a:vertical ?'vsplit ':'split ').winid
    setlocal noswapfile
    setlocal wrap nonumber signcolumn=no filetype=markdown
  endif
  call win_execute(winid->bufwinid(), 'setlocal modifiable', 1)
  call win_execute(winid->bufwinid(), 'silent! %d_')
  for line in denops#request('ninco', 'show', [a:ai])->split("\n")
    call appendbufline(winid, '$'->line(winid->bufwinid()), line)
  endfor
  return winid
endfunction

function! ninco#new_window(winid, vertical=v:false)
  if a:winid->bufwinid() != -1
    return
  endif
  execute (a:vertical ?'vsplit ':'split ').a:winid
  setlocal noswapfile
  setlocal wrap nonumber signcolumn=no filetype=markdown
  call win_execute(a:winid->bufwinid(), 'setlocal modifiable', 1)
  wincmd p
  return a:winid
endfunction

function ninco#new(name, options = #{})
  if match(a:name, '[A-Za-z]') == -1
    echo "Invalid thread name. Top of name should be alphabet."
    return
  endif
  if match(a:name, '[^A-Za-z0-9_]') != -1
    echo "Invalid thread name. Please use alphabet, integer and underbar"
    return
  endif
  call denops#request('ninco', 'new', [a:name, a:options->extend(#{name: a:name})])
  return a:name
endfunction

function ninco#config(name, options = #{})
  call denops#request('ninco', 'config', [a:name, a:options->extend(#{name: a:name})])
  return a:name
endfunction

function ninco#status(name)
  call denops#request('ninco', 'status', [a:name])
endfunction

function ninco#goback(name, num)
  call denops#request('ninco', 'goback', [a:name, a:num])
  return a:name
endfunction

function! ninco#copy(source, dest='')
  call denops#request('ninco', 'copy', [a:source, a:dest])
  return a:dest
endfunction

function! ninco#run(context, order, ...)
  let order = 'printf'->call([a:order]+ a:000)
  call denops#request('ninco', 'order', [a:context, order])
  call ninco#compress(a:context)
endfunction


function! ninco#put_window(args, winname) abort
  let text = a:winname->getbufline('$')[-1] . a:args->substitute('\\ ', ' ', 'g')
  let winid = a:winname->bufwinid()
  call win_execute(winid, 'norm G')
  call setbufline(a:winname, '$'->line(winid), text)
  call win_execute(winid, 'norm $')
endfunction

function! ninco#put_enter(winid)
  call win_execute(a:winid, 'norm o')
endfunction

function! ninco#compress(context)
  call denops#request('ninco', 'compress',
        \[a:context, 'Please summaryze these messages.'])
endfunction

function! ninco#save_all(path)
  call denops#request('ninco', 'saveAll', [a:path])
endfunction

function! ninco#save(name, path)
  call denops#request('ninco', 'save', [a:name, a:path])
endfunction

function! ninco#load(name, path)
  call denops#request('ninco', 'load', [a:name, a:path])
  return name
endfunction

function! ninco#load_all(path)
  call denops#request('ninco', 'loadAll', [a:path])
  return name
endfunction

function! ninco#put_system(order)
  call denops#request('ninco', 'putSystem', [a:order])
endfunction

function! ninco#reset()
  call denops#request('ninco', 'reset', [])
endfunction

function! ninco#show_ai()
  let line = line('.')->getline()
  let start = match(line, "[A-Za-z]")
  let end = match(line, "[")
  call ninco#open_window(line[start:end-1])
endfunction

function! ninco#tree_toggle(winname='AITREE')
  eval ninco#new_window(a:winname, v:true)->ninco#tree()
  exec "au BufEnter ".a:winname." noremap <CR> :call ShowAI()<CR>"
  exec "au BufLeave ".a:winname." noremap <CR> <CR>"
endfunction
