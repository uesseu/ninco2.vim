import {Order} from './order.ts'
import {defaultAgent, Agent, AgentFormat} from './defaults.ts'
import {copy} from './order.ts'


export interface Team{
  command: any
  filename: any
  terminal: any
  write: any
  websearch: any
  denoise: any
  prepare: any
  plan: any
}
