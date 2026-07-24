'use strict';

const { bus } = require('../events/bus.cjs');
const { worldModel } = require('../world-model/world-model.cjs');

/**
 * CHATR Intelligence Platform — Reflection Service
 * Phase 4
 *
 * Event-driven reflection subsystem triggered by goal completion or failure.
 * Analyzes the UWM context to extract "Insights" (e.g., why a goal failed).
 */

class ReflectionService {
  constructor() {
    bus.subscribe('intelligence.goal.failed', (e) => this.handleGoalFailure(e.payload));
    bus.subscribe('intelligence.goal.completed', (e) => this.handleGoalSuccess(e.payload));
  }

  handleGoalFailure(goal) {
    if (!goal || !goal.id) return;
    
    // Naive Phase 4 Reflection Logic:
    // If a goal failed, and it involved "travel", let's check the travel budget.
    const goalText = (goal.title || '').toLowerCase();
    
    if (goalText.includes('travel') || goalText.includes('meet') || goalText.includes('seed')) {
      const travelConstraints = worldModel.getConstraints('travel');
      
      for (const c of travelConstraints) {
        if (c.limit && c.limit <= 5000) {
          console.log(`[ReflectionService] Analyzed failure for goal '${goal.id}'. Cause: Overly restrictive travel constraint ($${c.limit}).`);
          
          bus.publish('intelligence.reflection.insight_generated', {
            goal_id: goal.id,
            insight_type: 'constraint_too_strict',
            entity_id: c.id || 'const_finance_1',
            recommendation: {
              field: 'limit',
              action: 'increase',
              percentage: 20 // Recommend a 20% increase
            }
          });
          return; // Stop analyzing after finding primary cause
        }
      }
    }

    // Default insight if no specific constraint is found
    bus.publish('intelligence.reflection.insight_generated', {
      goal_id: goal.id,
      insight_type: 'insufficient_time',
      recommendation: { action: 'review_priorities' }
    });
  }

  handleGoalSuccess(goal) {
    if (!goal || !goal.id) return;
    console.log(`[ReflectionService] Analyzing success for goal '${goal.id}'.`);
    
    // Emit positive reinforcement insight
    bus.publish('intelligence.reflection.insight_generated', {
      goal_id: goal.id,
      insight_type: 'successful_strategy',
      recommendation: { action: 'reinforce_habits' }
    });
  }
}

const reflectionService = new ReflectionService();

module.exports = { ReflectionService, reflectionService };
