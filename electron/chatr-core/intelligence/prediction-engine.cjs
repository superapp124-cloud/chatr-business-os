'use strict';

const { bus } = require('../events/bus.cjs');
const { goalEngine } = require('./goal-engine.cjs');

/**
 * CHATR Intelligence Platform — Prediction Engine
 * Phase 3
 *
 * Replaces the legacy UI-speculative engine. 
 * This engine focuses on cognitive forecasting: predicting future states, 
 * resource depletion, and goal trajectories based on current velocity.
 */

class PredictionEngine {
  constructor() {
    // Re-calculate forecasts when goals change
    bus.subscribe('intelligence.goal.created', (e) => this.forecastAllActiveGoals());
    bus.subscribe('intelligence.goal.updated', (e) => this.forecastAllActiveGoals());
    bus.subscribe('intelligence.goal.milestone.added', (e) => this.forecastAllActiveGoals());
    bus.subscribe('intelligence.goal.milestone.updated', (e) => this.forecastAllActiveGoals());
  }

  /**
   * Evaluates all active goals to predict if they will hit deadlines.
   */
  forecastAllActiveGoals() {
    const activeGoals = goalEngine.getActiveGoals('user_1');
    
    for (const goal of activeGoals) {
      this.forecastGoalTrajectory(goal);
    }
  }

  /**
   * Simple linear extrapolation to predict goal success.
   */
  forecastGoalTrajectory(goal) {
    if (!goal.deadline || goal.progress_score === 100) return null;

    const now = Date.now();
    const createdAt = new Date(goal.created_at).getTime();
    const deadlineAt = new Date(goal.deadline).getTime();
    
    const timeElapsed = now - createdAt;
    const totalTimeAllocated = deadlineAt - createdAt;
    
    // Avoid division by zero
    if (timeElapsed <= 0 || totalTimeAllocated <= 0) return null;

    const timeRemaining = deadlineAt - now;
    
    // Linear velocity: % progress per ms
    const velocity = goal.progress_score / timeElapsed;
    
    // Expected progress at deadline if current velocity continues
    const expectedFinalProgress = goal.progress_score + (velocity * timeRemaining);
    
    let prediction = 'on_track';
    let risk_factor = 'low';

    if (expectedFinalProgress < 100) {
      prediction = 'miss_deadline';
      risk_factor = expectedFinalProgress < 50 ? 'critical' : 'high';
      
      // Emit prediction event for Decision/Reasoning Engine to handle
      bus.publish('intelligence.prediction.forecast', {
        goal_id: goal.id,
        prediction,
        risk_factor,
        expected_progress: Math.min(Math.round(expectedFinalProgress), 99),
        reason: `Current velocity (${goal.progress_score}% in ${Math.round(timeElapsed/86400000)} days) is insufficient.`
      });
      
      console.log(`[PredictionEngine] FORECAST WARNING for goal ${goal.id}: Expected to reach only ${Math.round(expectedFinalProgress)}% by deadline.`);
    }

    return {
      prediction,
      expectedFinalProgress: Math.min(Math.round(expectedFinalProgress), 100),
      risk_factor
    };
  }
}

const predictionEngine = new PredictionEngine();

module.exports = { PredictionEngine, predictionEngine };
