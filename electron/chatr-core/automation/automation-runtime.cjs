'use strict';

/**
 * CHATR Kernel — Automation Runtime (Phase 5.3)
 *
 * Handles background automated executions for habits and scheduled tasks.
 * Bypasses the active UI session, executing outcomes autonomously.
 * Publishes events to the Notification Center.
 */

const { bus } = require('../events/bus.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class AutomationRuntime {
  constructor() {
    this.intervalId = null;
  }

  start() {
    if (this.intervalId) return;
    log.info('[AutomationRuntime] Starting background schedulers...');
    
    // Simulate cron ticking every minute
    this.intervalId = setInterval(() => {
      this._checkTriggers();
    }, 60000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    log.info('[AutomationRuntime] Stopped.');
  }

  async _checkTriggers() {
    // In a full implementation, this queries the `wm_habits` table in WorldModel
    // to find triggers that match the current time/context.
    log.debug('[AutomationRuntime] Checking automation triggers...');
  }

  /**
   * Prompts the user to elevate a repeated pattern into a background automation.
   */
  suggestAutomation(intent, constraints) {
    log.info(`[AutomationRuntime] Suggesting automation for intent '${intent}'`);
    
    // Emits an event that the UI can catch to show "Want me to handle this automatically?"
    bus.publish('automation:suggest', {
      intent,
      constraints,
      message: `I've noticed you frequently perform this action. Want me to handle this automatically in the background?`
    });
  }

  /**
   * Executes an intent autonomously in the background.
   */
  async executeAutonomous(intent, constraints) {
    log.info(`[AutomationRuntime] Executing autonomous intent '${intent}'`);
    
    try {
      // 1. Send notification that automation has started
      this._notify(`Starting automated execution for ${intent}`);

      // 2. Resolve via Workflow Engine (skipping Planner since we have constraints)
      const { workflowEngine } = require('../execution/workflow-engine.cjs');
      const plan = workflowEngine.buildGraph(`auto_${Date.now()}`, intent, constraints);

      // 3. Execute Graph
      const { executionGraph } = require('../kernel/execution-graph.cjs');
      const result = await executionGraph.execute(plan);

      // 4. Send success notification
      this._notify(`Successfully completed automated execution for ${intent}`);
      
      return result;
    } catch (err) {
      log.error('[AutomationRuntime] Autonomous execution failed:', err);
      this._notify(`Failed to complete automated execution for ${intent}: ${err.message}`, 'error');
    }
  }

  _notify(message, type = 'info') {
    // Sends a native OS notification or an in-app notification center push
    bus.publish('notification:push', { message, type, timestamp: new Date().toISOString() });
    
    const { Notification } = require('electron');
    if (Notification && Notification.isSupported()) {
      new Notification({ title: 'CHATR Automation', body: message }).show();
    }
  }
}

const automationRuntime = new AutomationRuntime();
module.exports = { automationRuntime, AutomationRuntime };
