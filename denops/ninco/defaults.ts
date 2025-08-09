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
  main: string
  depth: number
  retry: number
  format: AgentFormat
  plan: AgentFormat
  command: AgentFormat
  filename: AgentFormat
  better: AgentFormat
  appendix: AgentFormat
  write: AgentFormat
  structure: AgentFormat
  websearch: AgentFormat
  test: AgentFormat
  select: AgentFormat
  extract: AgentFormat
}

export const defaultAgent: Agent = {
  main: `You are an AI agent.
Your must write according to a certain format.
Do your best.
`,
  command: {
    Goal: `Select one of the commands user is requiring.
The output should be one of words in 'write', 'websearch', 'plan' or 'talk'.
Understand carefully what user wants.
'write' should be selected only when user's request is coding and can be written in one file instantly.
If the output should be multiple files, select 'plan'.
'websearch' should be selected only when user is requiring special knowledge.
You must not select 'websearch' if we have much information already.
In other cases, select 'talk'.

- write: If the user is requiring source code of programming language and it can be written in one file, select this.
- websearch: If the user want to learn or research something, select this.
- plan: If the user is requiring source code but the output needs multiple files.
- talk: In other cases, including user needs advice, select this.`,
    Format: 'Just coding one word in items.',
    Example: 'talk',
    Body: '',
    Error: '',
    Output: ''
  },

  filename:{
    Goal: `Make a path for the content below.`,
    Format: `The path must be under ./.
Do not add comment or brace. Just write the path.`,
    Example: `./src/get_pos.py`,
    Body: '',
    Error: '',
    Output: ''
  },

  write: {
    Goal: `Write a perfect output and submit to the user.
The output should be able to execute, tested and submit.`,
    Format: `If output is code, you must not write anything outside of the code.
If you need to say something, write it as comment. It must be editable by text editor.
The example is simple, but the output may be big code if it needs to be big.`,
    Example: `# This is a python code to plot line.

import matplotlib.pyplot as plt
plt.plot([1, 2], [4, 1])
plt.show()`,
    Body: '',
    Error: '',
    Output: ''
  },

  appendix: {
    Goal: `Make script to install libraries or set up environ to run the program you wrote.
The interpreter or compiler are already installed and set up of virtual environment has done.`,
    Format: `Write small commands with only one or two comments. Do not write long script.`,
    Example: `\`\`\`# The commands to setup.
sudo apt install qt5
pip install pandas\`\`\``,
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

  test: {
    Goal: 'Write a test code for the body.',
    Format: 'There is no special format. But the test code must be executable.',
    Example: '',
    Body: '',
    Error: '',
    Output: ''
  },

  plan: {
    Goal: `Divide the task into some child tasks with details.`,
    Format: `Each child has same sections.
Each tasks has to have number like 'Task1' or 'Task2'.
Each tasks has sections like below.
- Todo
- Details
- Filepath
- Language
Task label has one sharp, and other labels has two sharps.
`,
    Example: `# Task1
## Goal
Write a code to process toml data.
The class name is "Toml" and it will be imported from other scripts.

## Details
Name of the class is "Toml" which is inherit from "dict". The structure of the class is below.

- __init__(self)
- load(self, fname: str) -> None
- loads(self, text: str) -> None
- dump(self, fname) -> None
- dumps(self) -> str
- from_dict(self, data: dict) -> Toml

## Filepath
./toml.py

## Language
code: python3
comment: English

# Task2
## Goal
Write a code to process toml data.
The class name is "Toml" and it will be imported from other scripts.

## Details
Name of the class is "Toml" which is inherit from "dict". The structure of the class is below.

- __init__(self)
- load(self, fname: str) -> None
- loads(self, text: str) -> None
- dump(self, fname) -> None
- dumps(self) -> str
- from_dict(self, data: dict) -> Toml

## Filepath
./toml.py

## Language
code: python3
comment: English
`,
    Body: '',
    Error: ''
  },

  extract: {
    Goal: `Extract the section from divided tasks.`,
    Format: `Write in markdown style. Each child has same sections.
- Todo
- Details
- Filepath
- Language`,
    Example: `
# Section3
## Todo
Write a code to process toml data.
The class name is "Toml" and it will be imported from other scripts.

## Details
Name of the class is "Toml" which is inherit from "dict". The structure of the class is below.

- __init__(self)
- load(self, fname: str) -> None
- loads(self, text: str) -> None
- dump(self, fname) -> None
- dumps(self) -> str
- from_dict(self, data: dict) -> Toml

## Filepath
./toml.py

## Language
code: python3
comment: English
`,
    Body: '',
    Error: ''
  }
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
