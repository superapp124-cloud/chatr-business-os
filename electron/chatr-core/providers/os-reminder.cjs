'use strict';

/**
 * CHATR OS Reminder Provider
 * Capability: workflow.start
 */

const { reminderService } = require('../services/reminder-service.cjs');

class OSReminderProvider {
  constructor() {
    this.name = 'OSReminderProvider';
    // Ensure service is started when provider is loaded
    reminderService.startService();
  }

  async start(parameters) {
    // Parameters shape from planner:
    // { workflowId: 'reminder', input: { delayDays: 5, condition: 'not_paid' } }
    
    const result = reminderService.schedule(parameters.workflowId, parameters.input);
    
    return {
      success: true,
      reminderId: result.id,
      dueDate: result.dueDate
    };
  }
}

module.exports = { OSReminderProvider };
