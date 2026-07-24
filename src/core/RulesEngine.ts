export class RulesEngine {
  private static instance: RulesEngine;

  private constructor() {}

  public static getInstance(): RulesEngine {
    if (!RulesEngine.instance) {
      RulesEngine.instance = new RulesEngine();
    }
    return RulesEngine.instance;
  }

  /**
   * Evaluates rules/automations defined in the JSON schemas when an event occurs.
   */
  public async evaluate(eventType: string, payload: any) {
    console.log(`[RulesEngine] Evaluating automations for event: ${eventType}`, payload);
    
    // Example: If STATUS_CHANGED to 'Approved', trigger notification
    if (eventType === 'STATUS_CHANGED' && payload.newState === 'Approved') {
      console.log(`[RulesEngine] Condition matched! Executing actions: notify, update_calendar`);
      
      // In reality, this would dynamically read the schema's "automation" block:
      // "automation": [{ "event": "STATUS_CHANGED", "conditions": [...], "actions": [...] }]
      
      this.executeAction({ type: 'notify', template: 'leave_approved', target: payload.objectId });
    }
  }

  private executeAction(action: any) {
    console.log(`[RulesEngine] Executing Action:`, action);
    // e.g., send email, trigger webhook, invoke NotificationRuntime
  }
}

export const rulesEngine = RulesEngine.getInstance();
