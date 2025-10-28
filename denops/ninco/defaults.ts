const defaultModel = "gpt-5-nano"
const defaultURLName = 'openai'
const COMPRESS_PROMPT = 'Please summarize this talk log.'

interface Example{
  Input: string
  Output: string
}

export interface AgentFormat{
  Goal: string
  Format: string
  Example: Array<Example>
  Input: string
  FileName: string
  Error: string
}

export interface Agent{
  command: AgentFormat
  filename: AgentFormat
  terminal: AgentFormat
  write: AgentFormat
  websearch: AgentFormat
  denoise: AgentFormat
  prepare: AgentFormat
  plan: AgentFormat
}

export const defaultAgent: Agent = {
  command: {
    Goal: `Select one of the commands user is requiring.
The output should be one of words in 'write', 'websearch', 'plan' or 'talk'.
Understand carefully what user wants.
'code' should be selected only when user's request is coding and can be written in one file instantly.
If the output should be multiple files, select 'plan'.
'websearch' should be selected only when user is requiring special knowledge.
You must not select 'websearch' if we have much information already.
In other cases, select 'talk'.

- write: If the user is requiring source code of programming language or detailed report, and it can be written in one file, select this.
- plan: Same as 'code' command, but if the is requiring user's request cannot be achieved by one file, select this.
- websearch: If the user want to learn or research something, which is not well known, select this.
- talk: In other cases, including teaching, advicing or just talking, select this.`,
    Format: `Just coding one word in items.`,
    Example: 
      [
        {
          Input: 'Hello! I bought a new computer!',
          Output: 'talk'
        },
        {
          Input: 'Please write a code to draw circular plot by python with matplotlib. The file name should be "circular.py".',
          Output: 'write'
        },
        {
          Input: 'How should I write Optional type in typescript?',
          Output: 'talk'
        },
        {
          Input: '鎌倉武士の武装についてのレポートを書いてください。題名は「鎌倉武士の武装について.md」としてください。',
          Output: 'report'
        },
        {
          Input: '鎌倉武士の武装について教えてください。',
          Output: 'talk'
        },
        {
          Input: 'Please teach me about kakutouhu strategy of japanese chess.',
          Output: 'websearch'
        },
        {
          Input: 'Please make a python package which performs like a spread sheet program.',
          Output: 'plan'
        },
      ]
    ,
    Input: '',
    FileName: '',
    Error: '',
  },

  filename:{
    Goal: `Make a file path of result of user's request.`,
    Format: `The path must be under ./.
Do not add comment or brace. Just write the path.
The file must be a format which is editable by a texteditor.`,
    Example: [
      {
        Input : 'Please write a python code for fizzbuzz.',
        Output: './fizzbuzz.py'
      },
      {
        Input : '鎌倉武士のレポートを書いてください。',
        Output: './鎌倉武士について.md'
      }
    ],
    Input: '',
    FileName: '',
    Error: '',
  },

  terminal:{
    Goal: `Make a command to run the file. If you need, compile the file.`,
    Format: `The command must be shell command.`,
    Example: [
      {
        Input: `./parse.py`,
        Output: `python ./parse.py`
      },
      {
        Input: `./main.c`,
        Output: `gcc main.c; ./a.out`
      },
      {
        Input: `./src/stat_calc.R`,
        Output: `Rscript ./src/stat_calc.py`
      },
    ],
    Input: '',
    FileName: '',
    Error: '',
  },

  write: {
    Goal: `Write a perfect output and submit to the user.
If the output is a source code of programming language, comments must be written in comment lines
and is able to execute.
If the output is a report it should be easy to read.
You need not write greetings even if the required output is a report.`,
    Format: `If output is code, you must write executable script or .
If you need to say something, write it as comment. It must be editable by text editor.
The example is simple, but the output may be big if it needs to be.
In case of programming, if possible, write test code.`,
    Example: [],
    Input: '',
    FileName: '',
    Error: '',
  },

  websearch: {
    Goal: 'Write a query for web search about the subject.',
    Format: 'Separate by space.',
    Example: [],
    Input: '',
    FileName: '',
    Error: '',
  },

  denoise: {
    Goal: 'The input data is a text, decoded from website, including TOC or advertizements. What you should do is extracting the content of the website.',
    Format: 'There is no format. Please write in the best way you think.',
    Example: [],
    Input: '',
    FileName: '',
    Error: '',
  },

  prepare: {
    Goal: 'Write needed information to prepare to answer for the input.',
    Format: 'There is no format but you should write detailed information as preparation. Please write in the best way you think.',
    Example: [],
    Input: '',
    FileName: '',
    Error: '',
  },

  plan: {
    Goal: `You must make file structure of project.
The directory tree must be constructed as specific structure for the project.
Each files needs contents.`,
    Format: `Write file path and contents.
The base directory must be './'. All the files must be listed as relative path.
After each paths, write order to make AI write the contents. The format is offside rule.
The path line must not start with any spaces.
The content must be starts with '    ' (4 spaces) and needs detailed summary because coders will write the content following the summary.
This format will be read by machine and so do not write anything in other format.
If the project is a programming project, summary of the contents must contain API.`,
    Example: [],
    Input: '',
    FileName: '',
    Error: '',
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
  key_ai: '',
  key_websearch: '',
  url: defaultURL['openai'],
  model: defaultModel,
  mode: 'talk',
  command_args: [],
  max_length: 10,
  compress_num: 4,
  filename: '',
  pre_user_write: '# ',
  freeze: false,
  post_user_write: "\n--------------------\n",
  window_style: 'horizontal',
  float_geometry: {row: 2, col: 20, height: 6, width: 50},
//  options: {},
  web_compress_prompt: "Please remove needless data and summaryze report below.\n",
  compress_prompt: COMPRESS_PROMPT,
  compress_style: 'summarize',
//  job: 'individual',
  timeout: 60000,
  body: {
    messages: [],
    stream: true,
  },
  log: [[]],
  parent: '',
  children: [],
  agent: defaultAgent,
  use_websearch: false,
  websearch_compress: false,
//  oneshot: false,
  fast: null,
  platform: 'vim',
  parallel: 4

}

export let urlOption = [
  '-youtube.com',
  '-www.sejuku.net'
]
