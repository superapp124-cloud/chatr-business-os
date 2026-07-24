import { CommunicationAgent } from './CommunicationAgent';

export interface AIContext {
  activeWindow?: string;
  clipboardText?: string | null;
  batteryState?: { onBatteryPower: boolean };
  idleTimeSecs?: number;
}

export class AgentOrchestrator {
  private communicationAgent = new CommunicationAgent();
  
  /**
   * Evaluates the current OS Context and determines if any agent should act proactively.
   */
  async evaluateContext(context: AIContext): Promise<void> {
    console.log('[AgentOrchestrator] Evaluating new context state:', context);

    // If battery is low or system is heavily used, we might pause proactive agents
    if (context.batteryState?.onBatteryPower && context.idleTimeSecs && context.idleTimeSecs < 10) {
      console.log('[AgentOrchestrator] Suppressing background agents to save battery.');
      return;
    }

    // Example 1: If user is idle for a while, let the Communication Agent draft replies
    if (context.idleTimeSecs && context.idleTimeSecs > 60) {
      await this.communicationAgent.proactiveDrafting();
    }

    // Example 2: If clipboard contains something interesting, route to specific agents
    if (context.clipboardText) {
      if (context.clipboardText.includes('http')) {
        console.log('[AgentOrchestrator] URL detected, routing to Browser Agent (Not implemented yet).');
      } else {
        // Maybe route to Document Agent
      }
    }
  }

  /**
   * Explicitly request an agent to perform a skill.
   */
  async requestSkill(agentName: 'communication' | 'calendar' | 'document', skillName: string, payload: any): Promise<any> {
    switch(agentName) {
      case 'communication':
        return this.communicationAgent.executeSkill(skillName, payload);
      default:
        throw new Error(`Agent ${agentName} not found or not implemented.`);
    }
  }
}
