import {Order} from './order.ts'
import {defaultAgent, Agent, AgentFormat} from './defaults.ts'
import {copy} from './order.ts'


export class Team{
  agentPrompt: Agent
  order: Order
  constructor(order: Order, agent: Agent = defaultAgent){
    this.order = order
    this.agentPrompt = agent
  }

}
