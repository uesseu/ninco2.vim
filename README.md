# What is this?
Tree style ChatGPT compatible client for vim and neovim
written in typescript by denops.
It depends on openai compatible web api.
There is a chatgpt compatible interface of LLAMA and so you can use it.

It is still under developping and destructive change may be done.
It is just for my daily life, work and hobby.

This is newer version of [ninco.vim](https://github.com:uesseu/ninco.vim) but 95% of code was rewrited.

# Features of ninco.vim
Good and bad point of ninco.vim is simplicity and cheapness.
However, I use it in daily life and it is useful for me. It can...

- Work on vim/neovim
- Fundamental function of AI client
- Clone thread and goback with tree like UI
- Save and load configuration and talk log
- Almost all the commands can work by method chain

# Requirements
Vim or neovim, Denops and API key of openai is also needed.
About library, it depends only on denops and so please see the requirements of denops.

# Usage
At first, write config. The dictionary below is all the options.

- name: string
    + Name of thread
- type: string
    + Type of service. 'chatgpt' of 'ollama'
- command: string
    + Command name to put to shell
- command_args: Array<string>
    + Command arguments to put to shell
- print: boolean
    + Whether write in vim buffer
- repeat: boolean
    + Repeat what you say on vim
- model: string
    + Model name
- url: string
    + url of web api
- key: string
    + Key of your account
- max_length: number
    + If over, compress
- compress_num: number
    + Number to compress
- compress_style: string
    + summarize, delete  :Now, summarize only
- compress_prompt: string
    + Prompt to apply compress.
    + Default is 'Please summarize this talk log.'
- bufname: string
    + Buffer name to write.
- log: Array
    + Log of thread to go back
- dry_run: boolean
    + Just for debug.

```vim
let ai_config = #{
    \ print: true,
    \ repeat: true,
    \ command: '',
    \ command_arg: [],
    \ key: '[Your API key]',
    \ url: "https://api.openai.com/v1/chat/completions",
    \ max_length: 20,
    \ compress_num: 5
    \ }
```

Then, lets make new stream. I named the stream 'chat'.
If you did not set name, the name will be set automatically.
ninco#make_command makes command automatically.
If you do not want command, you need not use it.
For me, it is useful.

```vim
let chat = ai_config->ninco#new('chat')->ninco#make_command()
```

Now, internal name of the stream is 'chat'.
ninco#make_command() names command capital style.
Now, command name is 'Chat'. The command name is showen in the command line.
Almost all the functions requires internal name and so you can use method chain.
At last, lets talk with AI!

```vim
Chat Hello world!

" Same as bellow
call ninco#run(chat, 'Hello world!')
```

# Prompt programming
Ninco does not support prompt programming.
However, ninco#run function can be used like printf.
If your template is a file, named 'hoge.txt', like below

```vim
Please translate below to Japanese.
----------
%s
```

then, write code like below.

```vim
let chat = 'chat'->ninco#new(ai_config)
let template = 'hoge.txt'->readfile()->join("\n")
call ninco#run(chat, template, 'Hello world!')
```

If you have multiple variables(%s), then write like this.

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

# Fork and go back
The talk threads can be forked.
And you can go back.
Lets fork! It is easy.
The name should be internal name.
You can show internal names by 'ninco#list_talk()'

```vim
echo ninco#list_talk()
call ninco#copy('ai')
```

# Save and load thread
Saving thread is easy. However, you want to delete api_key.
If last argument is v:true, you can delete api_key.

```vim
call ninco#save('chat', 'path to save', v:true)
```

If you want to save all, use ninco#save_all.

```vim
call ninco#save_all('path to save', v:true)
```

Loading is same as save.
But when you load, internal name will be modified, because same name is not good.

```vim
call ninco#save('chat', 'path to save', v:true)
```

# Compressing
Cost is bad factor of AI. It supports compressing.

```vim
ninco#compress('chat')
```

The way to compress can be configured in the configuration dict.

# Show AI talk log status
```vim
ninco#status('chat')
```

# Make new window for ninco
```vim
call ninco#split_window('chat')
```

# Tree view
It can copy and go back talk threads.
So, it is a tree style AI client.
And so it can show tree like mapping.

```vim
call ninco#tree_split()
```

You can use tree like mapping as link. Just hit enter key on the link!

```
chat[6]: Please teach about math...
ai[2]: Hello...
  ai_1[6]: I love vim!...
emacs[0]: ...
```

# Options
You can configure AI talk log by ninco#config().
This function can set some options of ninco.
```vim
call ninco#option('chat', #{})
```

Some deeper options like temperature of chatgpt can be set by ninco#option().

```vim
call ninco#option('chat', #{})
```


# TODO
- vscode version

# Q and A

#### Q. But why vim?
A. Because, I heard that emacs has tree style AI client. Why not vim?
