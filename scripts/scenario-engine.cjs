'use strict';

/**
 * CHATR Intelligence Platform — Scenario Engine
 *
 * Generates realistic end-to-end testing scenarios (e.g., Startup Founder).
 * Populates the Event Ledger and Event Bus with observations, goals, constraints,
 * relationships, and history, giving the Unified World Model (UWM) rich
 * semantic data to reason over.
 */

const crypto = require('crypto');
const { bus } = require('../electron/chatr-core/events/bus.cjs');

class ScenarioEngine {
  constructor() {
    this.scenarios = {
      'startup_founder': this._buildStartupFounderScenario.bind(this)
    };
  }

  async run(scenarioName) {
    if (!this.scenarios[scenarioName]) {
      throw new Error(`Scenario '${scenarioName}' not found.`);
    }

    console.log(`[ScenarioEngine] Starting scenario: ${scenarioName}...`);
    const events = this.scenarios[scenarioName]();

    console.log(`[ScenarioEngine] Emitting ${events.length} simulated observations & goals...`);
    
    for (const ev of events) {
      // Publish to live bus for active projections (like UWM)
      bus.publish(ev.event_type, ev.payload, { correlationId: ev.payload.id || crypto.randomUUID() });
    }

    console.log(`[ScenarioEngine] Scenario '${scenarioName}' completed successfully.`);
  }

  _buildStartupFounderScenario() {
    const now = Date.now();
    const events = [];

    const publish = (eventType, payload, customTimestamp) => {
      events.push({ event_type: eventType, payload, timestamp: customTimestamp || now });
    };

    // 1. Identity & Relationships (Personal & Social Graph)
    publish('kernel.observation.created', {
      entity_type: 'person',
      entity_id: 'user_1',
      data: { name: 'Arshid Wani', role: 'CEO', attention_level: 'low', energy_level: 'medium', availability: 'low' }
    });

    publish('kernel.observation.created', {
      entity_type: 'person',
      entity_id: 'person_2',
      data: { name: 'Sarah', role: 'Co-Founder', attention_level: 'high', energy_level: 'high', availability: 'high' }
    });

    publish('kernel.observation.created', {
      entity_type: 'relationship',
      entity_id: 'rel_1',
      data: { from: 'user_1', to: 'person_2', type: 'co-founder', name: 'Sarah' }
    });

    // 2. Organizations & Business Context (Business Twin)
    publish('kernel.observation.created', {
      entity_type: 'company',
      entity_id: 'company_1',
      data: { name: 'CHATR AI', industry: 'Technology', stage: 'Seed' }
    });

    // 3. Constraints & Policies (Emitted before goals so UWM has them ready for Reasoning)
    publish('kernel.observation.created', {
      entity_type: 'constraint',
      entity_id: 'const_finance_1',
      data: { type: 'budget', limit: 5000, period: 'monthly', category: 'travel' }
    });

    // 4. Long-Term Goals (Goal Graph)
    // Backdate the funding goal 25 days ago to test Prediction Engine (Velocity will be too slow)
    const past25Days = now - (25 * 24 * 60 * 60 * 1000);
    publish('intelligence.goal.created', {
      id: 'goal_q3_funding',
      owner: 'user_1',
      title: 'Close Seed Round',
      priority: 'critical',
      deadline: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days left
      status: 'active',
      success_criteria: ['$2M committed', 'Term sheet signed']
    }, past25Days);

    publish('intelligence.goal.created', {
      id: 'goal_health',
      owner: 'user_1',
      title: 'Run 10km Marathon',
      priority: 'medium',
      deadline: new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      success_criteria: ['Finish under 60 mins']
    });

    // 4. Goal Milestones / Dependencies
    publish('intelligence.goal.milestone.added', {
      goal_id: 'goal_q3_funding',
      milestone_id: 'ms_1',
      title: 'Pitch Deck Finalized',
      status: 'completed'
    });

    publish('intelligence.goal.milestone.added', {
      goal_id: 'goal_q3_funding',
      milestone_id: 'ms_2',
      title: 'Meet with Sequoia Capital',
      status: 'pending' // Slipping!
    });

    // 5. Goal Failure (Phase 4 Trigger)
    // The goal fails because they ran out of travel budget and couldn't fly to the final partner meeting
    publish('intelligence.goal.failed', {
      id: 'goal_q3_funding',
      title: 'Close Seed Round',
      reason: 'Missed deadline. Unable to complete critical milestone: Meet with Sequoia Capital.'
    });

    return events;
  }
}

const scenarioEngine = new ScenarioEngine();

// Allow running directly from CLI
if (require.main === module) {
  const scenario = process.argv[2] || 'startup_founder';
  scenarioEngine.run(scenario).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ScenarioEngine, scenarioEngine };
