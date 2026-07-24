'use strict';

const { Projection, projectionManager } = require('../kernel/projection-manager.cjs');
const { bus } = require('../events/bus.cjs');

/**
 * CHATR Intelligence Platform — Goal Engine (v2.0)
 *
 * Distinct from the IntentStore. Goals exist for months/years; Intents exist for seconds.
 * Goals generate intents. Intents fulfill goals.
 *
 * The Goal Engine projects the Goal Graph from the Event Ledger. It tracks:
 * - Hierarchical Goals (Parent -> Sub-Goal)
 * - Milestones
 * - Dependencies
 * - Priority & Deadlines
 * - Progress Metrics
 */

class GoalEngine extends Projection {
  constructor() {
    super('GoalEngine', '*');

    this._graphs = {
      goals: new Map(), // goal_id -> goal object
    };

    // Subscriptions
    bus.subscribe('intelligence.goal.created', (e) => this.applyEvent(e));
    bus.subscribe('intelligence.goal.updated', (e) => this.applyEvent(e));
    bus.subscribe('intelligence.goal.milestone.added', (e) => this.applyEvent(e));
    bus.subscribe('intelligence.goal.milestone.updated', (e) => this.applyEvent(e));
  }

  applyEvent(envelope) {
    const payload = envelope.payload || {};
    const goalId = payload.goal_id || payload.id;

    if (!goalId) return;

    if (envelope.event_type === 'intelligence.goal.created') {
      this._graphs.goals.set(goalId, {
        id: goalId,
        owner: payload.owner || 'user_1',
        title: payload.title || 'Untitled Goal',
        priority: payload.priority || 'normal',
        status: payload.status || 'active',
        deadline: payload.deadline || null,
        parent_goal_id: payload.parent_goal_id || null,
        success_criteria: payload.success_criteria || [],
        milestones: [],
        dependencies: payload.dependencies || [],
        progress_score: 0,
        created_at: envelope.timestamp,
        updated_at: envelope.timestamp
      });
    }
    else if (envelope.event_type === 'intelligence.goal.updated') {
      const goal = this._graphs.goals.get(goalId);
      if (goal) {
        Object.assign(goal, payload);
        goal.updated_at = envelope.timestamp;
      }
    }
    else if (envelope.event_type === 'intelligence.goal.milestone.added') {
      const goal = this._graphs.goals.get(goalId);
      if (goal) {
        goal.milestones.push({
          id: payload.milestone_id,
          title: payload.title,
          status: payload.status || 'pending',
          added_at: envelope.timestamp
        });
        this._recalculateProgress(goal);
        goal.updated_at = envelope.timestamp;
      }
    }
    else if (envelope.event_type === 'intelligence.goal.milestone.updated') {
      const goal = this._graphs.goals.get(goalId);
      if (goal) {
        const ms = goal.milestones.find(m => m.id === payload.milestone_id);
        if (ms) {
          ms.status = payload.status;
          ms.updated_at = envelope.timestamp;
          this._recalculateProgress(goal);
          goal.updated_at = envelope.timestamp;
        }
      }
    }
  }

  _recalculateProgress(goal) {
    if (goal.milestones.length === 0) return;
    const completed = goal.milestones.filter(m => m.status === 'completed' || m.status === 'achieved').length;
    goal.progress_score = Math.round((completed / goal.milestones.length) * 100);
    if (goal.progress_score === 100) {
      goal.status = 'completed';
    } else if (goal.status === 'completed') {
      goal.status = 'active';
    }
  }

  // --- Queries ---

  getGoal(id) {
    return this._graphs.goals.get(id) || null;
  }

  getActiveGoals(ownerId = 'user_1') {
    return Array.from(this._graphs.goals.values())
      .filter(g => g.owner === ownerId && g.status === 'active')
      .sort((a, b) => {
        const pWeights = { 'critical': 3, 'high': 2, 'medium': 1, 'low': 0 };
        if (pWeights[a.priority] !== pWeights[b.priority]) {
          return pWeights[b.priority] - pWeights[a.priority];
        }
        if (a.deadline && b.deadline) {
          return new Date(a.deadline) - new Date(b.deadline);
        }
        return 0;
      });
  }

  getSlippingGoals() {
    const now = Date.now();
    return this.getActiveGoals().filter(g => {
      if (g.deadline) {
        const daysLeft = (new Date(g.deadline).getTime() - now) / (1000 * 60 * 60 * 24);
        if (daysLeft < 7 && g.progress_score < 50) return true;
      }
      return false;
    });
  }

  // --- Snapshot / Rebuild ---

  getState() {
    return {
      goals: Array.from(this._graphs.goals.entries())
    };
  }

  loadState(state) {
    if (state && state.goals) {
      this._graphs.goals = new Map(state.goals);
    }
  }

  clear() {
    this._graphs.goals.clear();
  }
}

// Singleton instantiation
const goalEngine = new GoalEngine();
projectionManager.rebuild(goalEngine);

module.exports = { GoalEngine, goalEngine };
