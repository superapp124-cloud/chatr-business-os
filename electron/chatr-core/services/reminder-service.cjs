'use strict';

/**
 * CHATR Kernel — OS Reminder Service
 *
 * Backed by SQLite, tracks long-running intents and wait-states.
 * Exposes a polling mechanism for notifications.
 */

const crypto = require('crypto');
const persistence = require('../db/persistence.cjs');

class ReminderService {
  constructor() {
    this.pollInterval = null;
  }

  startService() {
    if (this.pollInterval) return;
    // Check every minute
    this.pollInterval = setInterval(() => this.checkDueReminders(), 60000);
    console.log('[ReminderService] OS Reminder Service started.');
  }

  stopService() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Schedule a new reminder.
   */
  schedule(workflowId, input) {
    const id = crypto.randomUUID();
    const delayDays = input.delayDays || 1;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + delayDays);

    const record = {
      id,
      source_conversation_id: 'system',
      created_by: 'intent_planner',
      status: 'pending',
      metadata: JSON.stringify({
        workflowId,
        condition: input.condition,
        referenceNode: input.referenceNode,
        dueDate: dueDate.toISOString()
      })
    };

    persistence.insertRecord('reminders', record);
    console.log(`[ReminderService] Scheduled reminder ${id} for ${dueDate.toISOString()}`);
    return { id, status: 'scheduled', dueDate: dueDate.toISOString() };
  }

  checkDueReminders() {
    // In a full implementation, this queries SQLite for due dates 
    // and triggers the Notification system.
  }
}

const reminderService = new ReminderService();
module.exports = { reminderService, ReminderService };
