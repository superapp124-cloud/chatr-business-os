const { ledger } = require('../ledger/event-ledger.cjs');
const { bus } = require('../events/bus.cjs');
const { worldModel } = require('../world-model/world-model.cjs');

class ExecutiveFunction {
  /**
   * Evaluate the Goal Graph against the World Model.
   * We use basic heuristics here to decide what to do with goals.
   */
  evaluateDailyPriorities() {
    const goals = worldModel.getSnapshot().goals || [];
    const priorities = [];
    
    for (const goal of goals) {
      // Very simple prioritization logic
      priorities.push({
        goalId: goal.id,
        title: goal.title,
        priority: goal.status === 'in_progress' ? 'high' : 'low'
      });
    }

    ledger.append('PRIORITIES_EVALUATED', {
      component: 'ExecutiveFunction',
      method: 'evaluateDailyPriorities',
      priorities
    });

    return priorities;
  }

  /**
   * Generates a structured action plan.
   * Returns a structured plan: [{ action: 'automate', intent: {...} }, { action: 'defer', reason: '...' }, { action: 'recommend', ... }]
   */
  generateActionPlan() {
    const priorities = this.evaluateDailyPriorities();
    const actionPlan = [];

    for (const priority of priorities) {
      if (priority.priority === 'high') {
        actionPlan.push({
          action: 'automate',
          intent: {
            goalId: priority.goalId,
            action: 'Execute high priority goal'
          }
        });
      } else {
        actionPlan.push({
          action: 'defer',
          reason: 'Low priority based on current evaluation'
        });
      }
    }

    // Add a default recommendation if empty
    if (actionPlan.length === 0) {
      actionPlan.push({
        action: 'recommend',
        suggestion: 'No active goals found. Review world model or add new goals.'
      });
    }

    ledger.append('ACTION_PLAN_GENERATED', {
      component: 'ExecutiveFunction',
      method: 'generateActionPlan',
      plan: actionPlan
    });

    return actionPlan;
  }
}

const executiveFunction = new ExecutiveFunction();
module.exports = { ExecutiveFunction, executiveFunction };
