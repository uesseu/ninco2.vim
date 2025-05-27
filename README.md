# What is this?
ChatGPT compatible client for vim and neovim written in typescript by denops.

It is still under developping and destructive change may be done.
It is just for my daily life, work and hobby.

This is newer version of ninco.vim.

# Features of ninco.vim
Good and bad point of ninco.vim is simplicity and cheapness.
However, I use it in daily life and it is useful for me. It can...

- Ask a simple question
- Ask a question of selected lines
- Compressing old data automatically
- Function to clone thread and goback with tree like UI
- Not only chatgpt of openai but also compatible servers

# Requirements
Vim or neovim, Denops and API key of openai is also needed.
About library, it depends only on denops and so please see the requirements of denops.

# Usage
At first, write config. The dictionary below is all the options.

name: string
    Name of thread
command: string
    Command name and arguments
command_arg: Array<string>
print: boolean
    Whether write in vim buffer
repeat: boolean
    Repeat what you say on vim
model: string
    Model name
url: string
    url of web api
key: string
    Key of your account
max_length: number
    If over, compress
compress_num: number
    Number to compress
compress_style: string
    [summarize, delete](Now, summarize only)
winid: string
    ID of window
log: Array<Array<object>>
    Log of thread to go back
dry_run: boolean
    Just for debug.

```vim
let ai_config = #{
    \ print: true,
    \ repeat: true,
    \ command: '',
    \ command_arg: [],
    \ key: '[Your API key]',
    \ url: "https://api.openai.com/v1/chat/completions",
    \ model: "gpt3.5-turbo",
    \ max_length: 20,
    \ compress_num: 5
    \ }
```

Then, lets make new stream. I named the stream 'chat'.

```vim
let chat = 'chat'->ninco#new(ai_config)
```

Internal name of the stream is 'chat'.
At last, talk with AI!

```vim
eval chat->ninco#run('Hello world!')
```

# Prompt programming
Ninco does not support. However, ninco#run function can be used like printf.
If your template if a file, names 'hoge.txt', like below

```vim
Please translate below to Japanese.
----------
%s
```

then, write code like below.

```vim
let chat = 'chat'->ninco#new(ai_config)
let template = 'hoge.txt'->readfile()->join("\n")
eval chat->ninco#run(template, 'Hello world!')
```

If you have multiple variables, then write like this.

```vim
eval chat->ninco#run(template, 'Hello world!', 'Lets wright vim script!')
```

If you want to use list as arguments, write like below.

```vim
let Chat = 'ninco#run'->function(['chat'->ninco#new(#{key: g:api_key})])
call Chat('hello', 'world')
eval Chat->call(['hello', 'world'])
eval Chat->call(['%s%s'] + ['hello', 'world'])
```

Complicated?

