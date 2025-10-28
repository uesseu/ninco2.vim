call denops#request('ninco', 'putEnv', [environ()])

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

function! ninco#atmark(input)
  if a:input[0:2] == '@@ '
    return '@@ '.eval('$"'.$"{a:input[3:]}".'"')
  endif
  return a:input
endfunction

function! ninco#delete(name)
  return denops#request('ninco', 'delete', [a:name])
endfunction

function! ninco#tree_window(bufname = 'AITREE')
  let winid = a:bufname->bufwinid()
  if winid == -1
    return
  endif
  call win_execute(winid, 'silent! %d_')
  for line in denops#request('ninco', 'tree', [])->split("\n")
    call win_execute(winid, 'norm G')
    call appendbufline(a:bufname, '$'->line(a:bufname->bufwinid())-1, line)
  endfor
  exec "au BufEnter ".a:bufname." noremap <CR> :call ninco#_show_ai()<CR>"
  exec "au BufLeave ".a:bufname." noremap <CR> <CR>"
endfunction

function! ninco#get_param(name, param)
  return denops#request('ninco', 'get_param', [a:name, a:param])
endfunction

function! ninco#open(ai)
  let bufname = denops#request('ninco', 'get_param', [a:ai, 'filename'])
  let bufname = bufname == '' ? a:ai : bufname
  if bufwinid('^'.bufname.'$') == -1
    let style = denops#request('ninco', 'get_param', [a:ai, 'window_style'])
    if style == 'horizontal'
      execute 'split '.bufname
    elseif style == 'vertical'
      execute 'vsplit '.bufname
    elseif style == 'float'
      call ninco#float(a:ai,
            \denops#request('ninco', 'get_param', [a:ai, 'float_geometry']))
    endif
    setlocal noswapfile
    setlocal wrap nonumber signcolumn=no
  endif
  call win_execute(bufname->bufwinid(), 'setlocal modifiable', 1)
  call win_execute(bufname->bufwinid(), 'silent! %d_')
  for line in denops#request('ninco', 'show', [a:ai])->split("\n")
    call appendbufline(bufname, '$'->line(bufname->bufwinid()), line)
  endfor
  call win_execute(bufname->bufwinid(), 'norm G')
  return bufname
endfunction

function! ninco#split_window(buf='', vertical=v:false, set_name=v:true)
  if a:buf->bufwinid() != -1
    return
  endif
  if a:set_name
    call ninco#set_bufname(a:buf)
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
  let options = a:options
  if !has_key(options, 'key') || options['key'] == ''
    let options['key'] = $NINCO_KEY
  endif
  return denops#request('ninco', 'new',
        \[a:name, options->extend(#{name: a:name})])
endfunction

function ninco#config(name, options = #{})
  call denops#request('ninco', 'config', [a:name, a:options->extend(#{name: a:name})])
  return a:name
endfunction

function ninco#set_bufname(name)
  call ninco#config(a:name, #{filename: a:name})
  return a:name
endfunction

function ninco#set_param(name, options = #{})
  call denops#request('ninco', 'setParam', [a:name, a:options])
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

function! ninco#run(context, order='%s', mode='')
  call denops#notify('ninco', 'run', [a:context, a:order, a:mode])
  call ninco#compress(a:context)
  return a:context
endfunction

function! ninco#ninco(order='%s')
  call denops#notify('ninco', 'ninco', [a:order])
endfunction

function! ninco#better(context, command)
  call denops#request('ninco', 'better', [a:context, a:command])
  return a:context
endfunction

function! ninco#reserve(context, orders)
  call denops#request('ninco', 'reserve', [a:context, a:orders])
  return a:context
endfunction


function! ninco#put_window(args, buf, winid = '-1', normal = v:false) abort
  let winid = a:winid == '-1'? a:buf->bufwinid() : a:winid
  let lin = a:buf->getbufline('.'->line(winid))
  let lin = len(lin)? lin[-1] : ''
  let text = lin . a:args->substitute('\\ ', ' ', 'g')
  call setbufline(a:buf, '.'->line(winid), text)
  call win_execute(winid, 'norm $')
endfunction

function! ninco#compress(buf)
  call denops#request('ninco', 'compress',
        \[a:buf, 'Please summaryze these messages.'])
endfunction

function! ninco#save_all(path, delete_key=v:true)
  let path = isabsolutepath(a:path)? a:path : getcwd().'/'.a:path
  call denops#request('ninco', 'saveAll', [path, a:delete_key])
endfunction

function! ninco#save(name, path, delete_key=v:true)
  let path = isabsolutepath(a:path)? a:path : getcwd().'/'.a:path
  call denops#request('ninco', 'save', [a:name, path, a:delete_key])
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
  call ninco#open(line[start:end-1])
endfunction

function! ninco#open_tree(option=#{window_style:'vertical', bufname:'AITREE', float_geometry:#{row: 2, col: 20, height: 6, width: 50}})
  let window_style = a:option['window_style']
  let bufname = a:option['bufname']
  if window_style == 'vertical'
    call ninco#split_window(bufname, v:true)->ninco#tree_window()
  elseif window_style == 'horizontal'
    call ninco#split_window(bufname, v:false)->ninco#tree_window()
  elseif window_style == 'float'
    call ninco#float(bufname, option['float_geometry'])->ninco#tree_window()
  endif
endfunction

let s:cmd = {}

function ninco#command_wrapper(name, text)
  let args = a:text
  if a:text->match('%s') != -1
    let [line_end, column_end] = "'>"->getpos()[1:2]
    call setpos('.', [0, column_end, 0, 0])
    norm o
    let args = printf(args, ninco#get_selection())
  endif
  call ninco#run(a:name, args)
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

function! ninco#_find_vim_popup(buf) abort
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

function! ninco#websearch(name, query, num=10, string_num = 10000)
  call denops#request('ninco', 'websearch',
        \[a:name, a:query, a:num, a:string_num])
endfunction

function! ninco#float(buf, pos = #{row: 2, col: 20, height: 6, width: 50}) abort
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

function! ninco#float_move(winid, new_pos) abort
  if has('nvim')
    call nvim_win_set_config(
          \a:winid,
          \#{relative: 'editor',
          \  row: a:new_pos['row'],
          \  col: a:new_pos['col'],
          \  width: a:new_pos['width'],
          \  height: a:new_pos['height']
          \})
  else
    call popup_move(a:winid,
          \#{line: a:new_pos['row']+1,
          \  col: a:new_pos['col']+1,
          \  minwidth: a:new_pos['width'],
          \  maxwidth: a:new_pos['width'],
          \  minheight: a:new_pos['height'],
          \  maxheight: a:new_pos['height']
          \})
  endif
endfunction

let ninco#url = #{
      \openai: "https://api.openai.com/v1/chat/completions",
      \ollama: "http://localhost:11434/api/chat", 
      \webui: "http://127.0.0.1:8000/v1/chat/completions",
      \gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      \}
