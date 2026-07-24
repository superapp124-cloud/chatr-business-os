const { ledger } = require('../ledger/event-ledger.cjs');
const { bus } = require('../events/bus.cjs');
const { worldModel } = require('../world-model/world-model.cjs');
const { executiveFunction } = require('./executive-function.cjs');

class DailyLoopService {
  constructor() {
    this.intervalId = null;
  }

  /**
   * Start the daily loop service. For demonstration, we'll use a simulated cron timer.
   */
  start() {
    // In a real system, use node-cron or similar
    // Here we just mock starting it.
    bus.emit('INTELLIGENCE.DAILY_LOOP_STARTED', { timestamp: new Date().toISOString() });
    
    ledger.append('DAILY_LOOP_STARTED', {
      component: 'DailyLoopService',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Run the morning routine.
   * Morning: Calls Executive Function to plan the day, publishes INTELLIGENCE.DAILY_PLAN_READY.
   */
  runMorningRoutine() {
    const actionPlan = executiveFunction.generateActionPlan();
    
    const eventPayload = {
      timestamp: new Date().toISOString(),
      plan: actionPlan
    };

    bus.emit('INTELLIGENCE.DAILY_PLAN_READY', eventPayload);
    
    ledger.append('MORNING_ROUTINE_COMPLETED', {
      component: 'DailyLoopService',
      method: 'runMorningRoutine',
      ...eventPayload
    });

    return actionPlan;
  }

  /**
   * Run the evening routine.
   * Evening: Reviews completed intents, triggers world model consolidation.
   */
  runEveningRoutine() {
    // Simulated review of completed intents
    const completedIntents = []; 
    // Trigger world model consolidation
    // For now just simulate an update to world model or ledger
    
    ledger.append('EVENING_ROUTINE_COMPLETED', {
      component: 'DailyLoopService',
      method: 'runEveningRoutine',
      completedIntentsCount: completedIntents.length,
      consolidationTriggered: true
    });

    bus.emit('INTELLIGENCE.EVENING_REVIEW_COMPLETED', {
      timestamp: new Date().toISOString(),
      completedIntents
    });
  }
}

const dailyLoopService = new DailyLoopService();
module.exports = { DailyLoopService, dailyLoopService };
