'use strict';

/**
 * CHATR Kernel — Kernel Trace Facility (v0.9 RC)
 * 
 * Provides an immutable, human-readable trace of a Goal's lifecycle.
 * Subscribes to the Kernel Event Bus and records major transitions.
 * Useful for debugging, replay, and certification.
 */

class KernelTrace {
  constructor(bus) {
    if (!bus) throw new Error('KernelTrace requires the kernel EventBus');
    this.bus = bus;
    this.traces = new Map(); // goal_id -> Array of trace events
    this._subscribe();
  }

  _subscribe() {
    this.bus.on('kernel.goal.created', (state) => this._append(state.goal_id, 'Goal Created', state));
    this.bus.on('kernel.goal.transitioned', (state) => this._append(state.goal_id, `Goal Transitioned -> ${state.status}`, state));
    this.bus.on('kernel.goal.terminal', (state) => this._append(state.goal_id, `Goal Terminal -> ${state.status}`, state));
    
    // We can also listen to specific ABI object processing if the bus publishes them,
    // or just rely on the transitions since the GoalRuntime history records the ABI trigger.
  }

  _append(goalId, eventName, context = {}) {
    if (!this.traces.has(goalId)) {
      this.traces.set(goalId, []);
    }

    const entry = {
      event: eventName,
      timestamp: new Date().toISOString(),
      sequence: context.last_sequence !== undefined ? context.last_sequence : context.sequence,
      source: context.source || (context.history && context.history.length > 0 ? context.history[context.history.length - 1].producer : null),
      correlation_id: context.correlation_id || (context.history && context.history.length > 0 ? context.history[context.history.length - 1].correlation_id : null),
      trigger_abi: context.abi || (context.history && context.history.length > 0 ? context.history[context.history.length - 1].trigger : null),
      latency: context.latency || null,
      expected_state: context.expected_state || null,
      observed_state: context.observed_state || null,
      drift_type: context.drift_type || null,
      recovery_proposal_id: context.recovery_proposal_id || null
    };

    // If it's an observation, capture Observation # (we can infer it or use observation_id)
    if (context.abi === 'chatr.observation_frame.v0_9_rc') {
      entry.observation_id = context.observation_id;
    }

    this.traces.get(goalId).push(entry);
  }

  getTrace(goalId) {
    const trace = this.traces.get(goalId);
    if (!trace) return null;

    // Formatting for human readability (similar to the user's example)
    return trace.map((t, index) => {
      let desc = t.event;
      const details = [];
      if (t.sequence !== undefined && t.sequence !== null) details.push(`Seq: ${t.sequence}`);
      if (t.source) details.push(`Source: ${t.source}`);
      if (t.latency) details.push(`Latency: ${t.latency}ms`);
      if (t.correlation_id) details.push(`Corr: ${t.correlation_id}`);
      if (t.observation_id) details.push(`Obs #: ${t.observation_id}`);
      if (t.expected_state) details.push(`Expected: ${t.expected_state}`);
      if (t.observed_state) details.push(`Observed: ${t.observed_state}`);
      if (t.drift_type) details.push(`Drift: ${t.drift_type}`);
      if (t.recovery_proposal_id) details.push(`Proposal: ${t.recovery_proposal_id}`);
      
      if (details.length > 0) {
        desc += ` [${details.join(' | ')}]`;
      }
      return desc;
    }).join('\n  ↓\n');
  }
}

module.exports = { KernelTrace };
