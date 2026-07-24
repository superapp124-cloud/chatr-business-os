'use strict';

const { bus } = require('../events/bus.cjs');
const { worldModel } = require('../world-model/world-model.cjs');
const { goalEngine } = require('./goal-engine.cjs');

/**
 * CHATR Intelligence Platform — Reasoning Engine
 * Phase 3
 *
 * Analyzes the UWM to generate possibilities, evaluate goal feasibility,
 * and identify conflicts before any decision is made or intent is planned.
 */

class ReasoningEngine {
  constructor() {
    // Only re-evaluate feasibility when a goal changes or milestone is updated
    bus.subscribe('intelligence.goal.created', (e) => this.evaluateAllActiveGoals());
    bus.subscribe('intelligence.goal.updated', (e) => this.evaluateAllActiveGoals());
    bus.subscribe('intelligence.goal.milestone.added', (e) => this.evaluateAllActiveGoals());
    bus.subscribe('intelligence.goal.milestone.updated', (e) => this.evaluateAllActiveGoals());
  }

  /**
   * Evaluates all active goals to find conflicts or generate tactical recommendations.
   */
  evaluateAllActiveGoals() {
    const activeGoals = goalEngine.getActiveGoals('user_1');
    const constraints = worldModel.getConstraints();
    
    for (const goal of activeGoals) {
      this.evaluateGoalFeasibility(goal, constraints);
    }
  }

  /**
   * Checks a specific goal against known constraints in the UWM.
   */
  evaluateGoalFeasibility(goal, constraints) {
    const conflicts = [];
    
    // naive constraint checking logic for Phase 3:
    const milestoneTexts = goal.milestones.map(m => m.title).join(' ');
    const goalText = (goal.title + ' ' + goal.success_criteria.join(' ') + ' ' + milestoneTexts).toLowerCase();
    
    if (goalText.includes('travel') || goalText.includes('fly') || goalText.includes('meet')) {
      const travelConstraints = constraints.filter(c => c.category === 'travel');
      for (const c of travelConstraints) {
        if (c.limit && c.limit < 10000) { // arbitrary reasoning logic for demo
          conflicts.push(`Warning: Goal '${goal.title}' may violate travel constraint (Limit: $${c.limit}). Strategy adjustment recommended.`);
        }
      }
    }

    if (conflicts.length > 0) {
      // Emit conflict event to the Decision Engine
      bus.publish('intelligence.reasoning.conflict_detected', {
        goal_id: goal.id,
        conflicts
      });
      console.log(`[ReasoningEngine] Conflict detected for goal ${goal.id}:`, conflicts);
    }
  }

  /**
   * Proposes high-level tactical steps to advance a stalled goal
   */
  generateTactics(goalId) {
    const goal = goalEngine.getGoal(goalId);
    if (!goal || goal.status !== 'active') return null;

    const tactics = [];
    if (goal.progress_score === 0) {
      tactics.push({ action: 'research', description: `Gather initial context for ${goal.title}` });
      tactics.push({ action: 'breakdown', description: 'Decompose goal into smaller milestones' });
    } else if (goal.progress_score > 0 && goal.progress_score < 50) {
      tactics.push({ action: 'schedule', description: `Block calendar time to advance ${goal.title}` });
    }

    bus.publish('intelligence.reasoning.tactics_generated', {
      goal_id: goal.id,
      tactics
    });
    
    return tactics;
  }
}

const reasoningEngine = new ReasoningEngine();

module.exports = { ReasoningEngine, reasoningEngine };
