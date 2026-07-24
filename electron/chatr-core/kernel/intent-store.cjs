'use strict';

const crypto = require('crypto');
const { Projection, projectionManager } = require('./projection-manager.cjs');
const { bus } = require('../events/bus.cjs');

/**
 * CHATR Kernel — Intent Store (Projection)
 *
 * The Intent Store holds the full semantic lifecycle of all user intents.
 * Built entirely from `kernel.intent.*` events. No direct DB access.
 *
 * Every intent in an Intent OS is more than a task—it is a goal-bearing,
 * context-aware semantic object with:
 *  - A Goal it serves
 *  - Constraints it must satisfy
 *  - Risk and Confidence estimates
 *  - Success Criteria for verification
 *  - Estimated Cost and Duration
 *  - Evidence produced by execution
 */

const INTENT_STATUS = Object.freeze({
  DISCOVERED: 'DISCOVERED',         // Parser extracted raw intent
  CLARIFYING: 'CLARIFYING',         // Awaiting user constraints
  PLANNING: 'PLANNING',             // Building goal/execution graph
  DECIDING: 'DECIDING',             // Decision Engine evaluating timing, split, defer
  AWAITING_APPROVAL: 'AWAITING_APPROVAL', // Requires human authorization
  EXECUTING: 'EXECUTING',
  VERIFYING: 'VERIFYING',           // Evidence being validated
  COMPLETED: 'COMPLETED',
  DEFERRED: 'DEFERRED',             // Decision Engine chose to defer
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

/**
 * Build the canonical, fully-typed Intent object from raw data.
 * All new fields have safe defaults so existing callers don't break.
 */
function _buildIntent(intentData, timestamp) {
  return {
    // --- Core Identity ---
    id: intentData.intent_id || intentData.id,
    owner: intentData.owner || 'user',
    intent_type: intentData.intent_type || intentData.semantic_type || 'unknown',
    raw_text: intentData.raw_text || '',
    status: intentData.status || INTENT_STATUS.DISCOVERED,

    // --- Goal Graph Semantics (Phase 4) ---
    goal: intentData.goal || null,               // Parent goal this intent serves
    priority: intentData.priority || 'normal',   // 'low' | 'normal' | 'high' | 'critical'
    deadline: intentData.deadline || null,        // ISO timestamp
    dependencies: intentData.dependencies || [],  // Other intent IDs that must complete first

    // --- Constraints & Planning ---
    constraints: intentData.constraints || {},
    execution_graph: null,                        // Set after Decision Engine resolves

    // --- Intelligence Metadata ---
    confidence: intentData.confidence || null,    // 0.0 - 1.0
    risk: intentData.risk || 'unknown',           // 'low' | 'medium' | 'high'
    estimated_cost: intentData.estimated_cost || null,
    estimated_duration_ms: intentData.estimated_duration_ms || null,

    // --- Success & Evidence ---
    success_criteria: intentData.success_criteria || [],
    evidence: [],                                 // Immutable list, appended by VerificationEngine

    // --- Audit ---
    created_at: intentData.created_at || timestamp,
    updated_at: intentData.updated_at || timestamp,
    metadata: intentData.metadata || {}
  };
}

class IntentStore extends Projection {
  constructor() {
    super('IntentStore', '*'); // Global projection of all intents
    this._intents = new Map();
    
    // Subscribe to bus for real-time updates after boot
    bus.subscribe('kernel.intent.created', (envelope) => this.applyEvent(envelope));
    bus.subscribe('kernel.intent.updated', (envelope) => this.applyEvent(envelope));
    bus.subscribe('kernel.intent.completed', (envelope) => this.applyEvent(envelope));
    bus.subscribe('kernel.intent.failed', (envelope) => this.applyEvent(envelope));
    
    // Legacy support for older event namespaces
    bus.subscribe('INTENT.CREATED', (envelope) => this.applyEvent(envelope));
    bus.subscribe('INTENT.STATUS_CHANGED', (envelope) => this.applyEvent(envelope));
  }

  // --- Projection Interface ---

  applyEvent(envelope) {
    const payload = envelope.payload || {};
    
    if (envelope.event_type === 'kernel.intent.created' || envelope.event_type === 'INTENT.CREATED') {
      const intentData = payload.intent || payload; // Support both flat payload and nested { intent }
      const intentId = intentData.intent_id || intentData.id;
      this._intents.set(intentId, _buildIntent(intentData, envelope.timestamp));
    } else if (
      envelope.event_type === 'kernel.intent.updated' ||
      envelope.event_type === 'INTENT.STATUS_CHANGED' ||
      envelope.event_type === 'kernel.intent.completed' ||
      envelope.event_type === 'kernel.intent.failed'
    ) {
      const intentData = payload.intent || payload;
      const intentId = intentData.intent_id || intentData.id || payload.intent_id;
      const intent = this._intents.get(intentId);
      
      if (intent) {
        // Apply any scalar overrides cleanly
        const UPDATABLE = ['status','priority','deadline','risk','confidence','estimated_cost',
                           'estimated_duration_ms','execution_graph','goal'];
        for (const key of UPDATABLE) {
          if (intentData[key] !== undefined) intent[key] = intentData[key];
          else if (payload[key] !== undefined) intent[key] = payload[key];
        }
        // Merge maps
        if (intentData.constraints || payload.constraints)
          intent.constraints = { ...intent.constraints, ...(intentData.constraints || payload.constraints) };
        if (intentData.metadata || payload.metadata)
          intent.metadata = { ...intent.metadata, ...(intentData.metadata || payload.metadata) };
        if (intentData.success_criteria)
          intent.success_criteria = intentData.success_criteria;
        // Append evidence (immutable — never overwrite)
        if (Array.isArray(payload.evidence)) {
          intent.evidence = [...(intent.evidence || []), ...payload.evidence];
        }
        intent.updated_at = envelope.timestamp;
      }
    }
  }

  getState() {
    return {
      intents: Array.from(this._intents.entries())
    };
  }

  loadState(state) {
    if (state && state.intents) {
      this._intents = new Map(state.intents);
    }
  }

  clear() {
    this._intents.clear();
  }

  // --- Public API for Kernel / Adapters ---

  /**
   * Create a new intent durably. (Publishes event, which builds projection)
   */
  create(intentType, constraints, metadata = {}) {
    const intentId = `intent_${crypto.randomUUID()}`;
    const now = Date.now();
    
    bus.publish('kernel.intent.created', {
      intent_id: intentId,
      intent_type: intentType,
      constraints: constraints || {},
      status: 'CREATED',
      metadata: metadata,
      created_at: now,
      updated_at: now
    }, { correlationId: intentId });

    return this.get(intentId);
  }

  update(intentId, status, metadata = {}) {
    return this.transition(intentId, status, metadata);
  }

  transition(intentId, status, metadata = {}) {
    const intent = this._intents.get(intentId);
    if (!intent) throw new Error(`Intent ${intentId} not found`);

    bus.publish('kernel.intent.updated', {
      intent_id: intentId,
      status,
      metadata
    }, { correlationId: intentId });

    return this.get(intentId);
  }

  get(intentId) {
    return this._intents.get(intentId) || null;
  }
  
  getActive() {
    return Array.from(this._intents.values()).filter(i => 
      i.status !== 'COMPLETED' && 
      i.status !== 'FAILED' && 
      i.status !== 'CANCELLED'
    ).sort((a, b) => b.created_at - a.created_at);
  }

  getByType(intentType, limit = 20) {
    return Array.from(this._intents.values())
      .filter(i => i.intent_type === intentType)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
  }

  getRecent(limit = 50) {
    return Array.from(this._intents.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
  }

  cancel(intentId, reason) {
    return this.update(intentId, 'CANCELLED', { cancelReason: reason });
  }
}

// Singleton instantiation
const intentStore = new IntentStore();
// Register and rebuild on boot
projectionManager.rebuild(intentStore);

module.exports = { IntentStore, intentStore, INTENT_STATUS };
