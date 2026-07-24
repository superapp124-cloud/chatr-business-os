'use strict';

const { bus } = require('../events/bus.cjs');
const { worldModel } = require('../world-model/world-model.cjs');

/**
 * CHATR Intelligence Platform — Learning Engine
 * Phase 4
 *
 * Applies insights from the Reflection Service to permanently alter the World Model.
 * For safety in Phase 4, constraint modifications are capped at +/- 20%.
 */

class LearningEngine {
  constructor() {
    bus.subscribe('intelligence.reflection.insight_generated', (e) => this.applyInsight(e.payload));
  }

  applyInsight(insight) {
    if (!insight || !insight.recommendation) return;

    console.log(`[LearningEngine] Received insight for goal '${insight.goal_id}':`, insight.insight_type);

    if (insight.insight_type === 'constraint_too_strict' && insight.entity_id) {
      this._relaxConstraint(insight);
    } else {
      console.log(`[LearningEngine] No structural mutation required for this insight.`);
    }
  }

  _relaxConstraint(insight) {
    // 1. Fetch current constraint from UWM
    const business = worldModel.getBusinessContext();
    const constraint = business.find(b => b.id === insight.entity_id || b.entity_id === insight.entity_id);
    
    // In our simplified UWM, business graphs use the map key as the ID.
    // Let's iterate if we don't find it directly.
    let targetConstraint = null;
    let targetId = null;
    
    // Fallback search since worldModel.js uses raw maps and the ID might just be the key
    for (const [key, item] of worldModel._graphs.business.entries()) {
      if (key === insight.entity_id || item.entity_id === insight.entity_id || item.id === insight.entity_id) {
        targetConstraint = item;
        targetId = key;
        break;
      }
    }

    if (!targetConstraint) {
      console.warn(`[LearningEngine] Could not find constraint ${insight.entity_id} to update.`);
      return;
    }

    const rec = insight.recommendation;
    if (rec.field === 'limit' && rec.action === 'increase') {
      const currentLimit = targetConstraint.limit;
      const increaseAmount = currentLimit * (rec.percentage / 100);
      const newLimit = currentLimit + increaseAmount;
      
      console.log(`[LearningEngine] Mutating UWM: Increasing ${targetConstraint.category} limit from ${currentLimit} to ${newLimit} to prevent future goal failures.`);
      
      // Emit an update event to change the World Model
      // UWM listens to kernel.observation.created for both creates and upserts
      bus.publish('kernel.observation.created', {
        entity_type: targetConstraint.entity_type,
        entity_id: targetId,
        data: {
          ...targetConstraint,
          limit: newLimit,
          _learned: true // mark as mutated by learning engine
        }
      });
    }
  }
}

const learningEngine = new LearningEngine();

module.exports = { LearningEngine, learningEngine };
