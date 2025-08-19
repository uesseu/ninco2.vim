const defaultKey = ""
const defaultModel = "gpt-5-nano"
const defaultURLName = 'openai'
const COMPRESS_PROMPT = 'Please summarize this talk log.'

export interface AgentFormat{
  Goal: string
  Format: string
  Example: string
  Body: string
  Error: string
  Output: string
}

export interface Agent{
  command: AgentFormat
  filename: AgentFormat
  terminal: AgentFormat
  better: AgentFormat
  write: AgentFormat
  websearch: AgentFormat
  select: AgentFormat
}

export const defaultAgent: Agent = {
  command: {
    Goal: `Select one of the commands user is requiring.
The output should be one of words in 'write', 'websearch', or 'talk'.
Understand carefully what user wants.
'write' should be selected only when user's request is coding and can be written in one file instantly.
If the output should be multiple files, select 'plan'.
'websearch' should be selected only when user is requiring special knowledge.
You must not select 'websearch' if we have much information already.
In other cases, select 'talk'.

- write: If the user is requiring source code of programming language and it can be written in one file, select this.
- websearch: If the user want to learn or research something, select this.
- talk: In other cases, including user needs advice, select this.`,
    Format: 'Just coding one word in items.',
    Example: 'talk',
    Body: '',
    Error: '',
    Output: ''
  },

  filename:{
    Goal: `Make a file path of result of user's request.`,
    Format: `The path must be under ./.
Do not add comment or brace. Just write the path.`,
    Example: `./src/get_pos.py`,
    Body: '',
    Error: '',
    Output: ''
  },

  terminal:{
    Goal: `Make a command to run the command.`,
    Format: `The command must be shell command.`,
    Example: `python parse.py '4 | 3 + 8'`,
    Body: '',
    Error: '',
    Output: ''
  },


  write: {
    Goal: `Write a perfect output and submit to the user.
The output should be able to execute, tested and submit.`,
    Format: `If output is code, you must not write anything outside of the code.
If you need to say something, write it as comment. It must be editable by text editor.
The example is simple, but the output may be big code if it needs to be big.
If possible, write test code.`,
    Example: `# This is a python code to perform fizzbuzz.
def fizzbuzz(num: int):
    fizz = 'fizz' if num % 3 == 0 else ''
    buzz = 'buzz' if num % 5 == 0 else ''
    return f'{fizz}{buzz}'

if __name__ == '__main__':
    assert fizzbuzz(15) == 'fizzbuzz'
    assert fizzbuzz(5) == 'buzz'
    assert fizzbuzz(8) == ''
    assert fizzbuzz(3) == 'fizz'
`,
    Body: '',
    Error: '',
    Output: ''
  },

  better: {
    Goal: `Body is the code and Output is the output. Rewrite the code to get better output.`,
    Format: `Format is same as format of Body.`,
    Example: ``,
    Body: '',
    Error: '',
    Output: ''
  },

  websearch: {
    Goal: 'Write a query for web search about the subject.',
    Format: 'Separate by space.',
    Example: 'book pupil brain knowledge',
    Body: '',
    Error: '',
    Output: ''
  },

  select: {
    Goal: 'Make options for the user. The options must be conditions needed for work, not procedure.',
    Format: `Output must be consist of short lines and the content is order for you. One line includes only one order.`,
    Example: `1. Use fourier transform.
2. Use wavelet transform and extract frequency axis.
3. Perform hilbert transform.`,
    Body: '',
    Error: '',
    Output: ''
  },

}

export const defaultURL = {
  openai: "https://api.openai.com/v1/chat/completions",
  ollama: "http://localhost:11434/api/chat", 
  webui: "http://127.0.0.1:8000/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
}

export const defaultOrder: object = {
  print: true,
  repeat: true,
  command: '',
  type: 'chatgpt',
  name: '',
  key: defaultKey,
  url: defaultURL['openai'],
  model: defaultModel,
  mode: 'talk',
  command_args: [],
  max_length: 10,
  compress_num: 4,
  filename: '',
  dry_run: false,
  pre_user_write: '# ',
  freeze: false,
  post_user_write: "\n--------------------\n",
  window_style: 'horizontal',
  float_geometry: {row: 2, col: 20, height: 6, width: 50},
  options: {},
  compress_prompt: COMPRESS_PROMPT,
  compress_style: 'summarize',
  job: 'individual',
  timeout: 60000,
  callback: 'ninco#tree_window',
  body: {
    messages: [],
    stream: true,
  },
  log: [[]],
  parent: '',
  children: [],
  agent: defaultAgent,
  websearch: false
}

export let urlOption = [
  '-youtube.com',
  '-www.sejuku.net'
]
