'use strict';

const { bus } = require('../events/bus.cjs');
const { worldModel } = require('../world-model/world-model.cjs');
const { goalEngine } = require('./goal-engine.cjs');

/**
 * CHATR Intelligence Platform — Opportunity Engine
 * Phase 5
 *
 * Proactive executive assistant subsystem.
 * Scans the UWM to find ways to accelerate goals or optimize resources.
 */

class OpportunityEngine {
  constructor() {
    // For Phase 5, we trigger opportunity scans when UWM changes,
    // specifically when a goal is updated or a person's status changes.
    bus.subscribe('intelligence.goal.created', () => this.scanForDelegation());
    bus.subscribe('intelligence.goal.updated', () => this.scanForDelegation());
    bus.subscribe('intelligence.goal.milestone.added', () => this.scanForDelegation());
    bus.subscribe('intelligence.goal.milestone.updated', () => this.scanForDelegation());
    bus.subscribe('kernel.observation.created', (e) => {
      if (e.payload && e.payload.entity_type === 'person') {
        this.scanForDelegation();
      }
    });
  }

  scanForDelegation() {
    const activeGoals = goalEngine.getActiveGoals('user_1');
    const relationships = worldModel.getRelationships('user_1');
    
    // Find people in the social graph who have high availability/energy
    const availablePeople = [];
    for (const rel of relationships) {
      // Assuming social graph nodes link to person entities
      const personId = rel.to === 'user_1' ? rel.from : rel.to;
      const personNode = worldModel.getPerson(personId);
      
      if (personNode && personNode.availability === 'high') {
        availablePeople.push({ rel, personNode, personId });
      }
    }

    if (availablePeople.length === 0) return;

    // Find stalled or slipping goals
    for (const goal of activeGoals) {
      // If a goal has low progress but high priority, it's a delegation candidate
      if (goal.priority === 'critical' && goal.progress_score <= 50) {
        
        // Match with the first available person (in a real system, we'd match skills)
        const candidate = availablePeople[0];
        
        const opportunityId = `opp_${Date.now()}_${goal.id}`;
        console.log(`[OpportunityEngine] Delegation opportunity found for goal '${goal.id}': Delegate to ${candidate.personNode.name} (${candidate.rel.type}).`);
        
        bus.publish('intelligence.opportunity.identified', {
          id: opportunityId,
          type: 'delegation',
          goal_id: goal.id,
          target_person_id: candidate.personId,
          recommendation: `Delegate stalled tasks for '${goal.title}' to ${candidate.personNode.name}, who currently has high availability.`
        });
      }
    }
  }
}

const opportunityEngine = new OpportunityEngine();

module.exports = { OpportunityEngine, opportunityEngine };
