'use strict';

/**
 * CHATR Kernel — Canonical Objects
 *
 * Genesis Milestone 4 introduces canonical objects that flow between modules.
 * Instead of passing arbitrary JSON, all intelligence modules understand
 * these strictly defined structures.
 */

class Understanding {
  /**
   * @param {object} params
   * @param {string} params.id
   * @param {string} params.type - "meeting" | "task" | "reminder" | "contact"
   * @param {string} params.source - "regex" | "knowledge" | "semantic" | "llm"
   * @param {string} params.temporalState - "now" | "today" | "tomorrow" | "next_week" | "unknown"
   */
  constructor({ id, type, source = 'regex', temporalState = 'unknown' }) {
    this.id = id;
    this.type = type;
    
    // Confidence is split. Intelligence becomes more certain over time.
    this.confidence = {
      observation: 0,
      meaning: 0,
      execution: 0
    };
    
    this.entities = {
      people: [], // Array of { value, provenance: { source, verified, resolver, timestamp } }
      dates: [],
      locations: [],
      organizations: []
    };
    
    this.temporalState = temporalState;
    this.source = source;
    this.enrichments = [];
    this.readyForSuggestion = false;
  }

  /**
   * Helper to add a verified entity with proper provenance
   */
  addEntity(type, value, provenance) {
    if (this.entities[type]) {
      this.entities[type].push({
        value,
        provenance: {
          source: provenance.source || 'llm',
          verified: provenance.verified || false,
          resolver: provenance.resolver || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      confidence: this.confidence,
      entities: this.entities,
      temporalState: this.temporalState,
      source: this.source,
      enrichments: this.enrichments,
      readyForSuggestion: this.readyForSuggestion
    };
  }
}

class Job {
  /**
   * @param {object} params
   * @param {string} params.id - Unique job identifier
   * @param {string} params.goal - High level description of the job
   */
  constructor({ id, goal }) {
    this.id = id;
    this.goal = goal;
    this.intent = null;
    this.executionGraph = null;
    
    // Lifecycle: Created -> Planned -> Waiting -> Running -> Approval Needed -> Completed -> Failed -> Cancelled -> Replay
    this.state = 'Created';
    
    this.outputs = {};
    this.memories = [];
    this.entities = [];
    this.metrics = {
      startTime: Date.now(),
      endTime: null,
      durationMs: 0,
      retryCount: 0
    };
  }

  transitionTo(newState) {
    const validStates = ['Created', 'Planned', 'Waiting', 'Running', 'Approval Needed', 'Completed', 'Failed', 'Cancelled', 'Replay'];
    if (validStates.includes(newState)) {
      this.state = newState;
      if (['Completed', 'Failed', 'Cancelled'].includes(newState)) {
        this.metrics.endTime = Date.now();
        this.metrics.durationMs = this.metrics.endTime - this.metrics.startTime;
      }
    } else {
      throw new Error(`Invalid Job state transition: ${newState}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      goal: this.goal,
      intent: this.intent,
      executionGraph: this.executionGraph,
      state: this.state,
      outputs: this.outputs,
      memories: this.memories,
      entities: this.entities,
      metrics: this.metrics
    };
  }
}

module.exports = { Understanding, Job };
