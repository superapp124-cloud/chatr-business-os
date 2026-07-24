/**
 * The Context Runtime
 * Central pipeline stage for CHATR. Context is inferred, never assumed.
 */
const crypto = require('crypto');
const persistence = require('../db/persistence.cjs');

// Confidence Decay Rates
// 100% -> 92% (10m) -> 55% (4h) -> 18% (12h) -> 0% (24h)
const DECAY_RATE_PER_MINUTE = 0.0008; // approximate linear decay for simplicity, or we use a curve

const journal = require('./journal.cjs');
const { bus } = require('../events/bus.cjs');

class ContextRuntime {
  constructor() {
    this.activeContext = new Map(); // conversationId -> ContextAnchor
    this.sessionContext = new Map();
    this.workspaceContext = new Map();
    this.loadFromDisk();
    
    // Automatically learn context from executed actions
    bus.subscribe('KERNEL.ACTION.EXECUTED', (envelope) => {
      const { action, conversationId } = envelope.payload;
      if (envelope.payload.status === 'SUCCESS') {
        this.learn(conversationId, action.type, action.entities, envelope.payload.workspace || 'default');
      }
    });
  }

  loadFromDisk() {
    try {
      this.activeContext.clear();
      const data = persistence.retrieve('context') || {};
      
      // Restore from disk, but with a confidence penalty! SQLite is recovery, not authority.
      for (const [convId, anchor] of Object.entries(data.activeContext || {})) {
        // 40% penalty for restarting
        anchor.confidence = Math.max(0, anchor.confidence - 0.4); 
        this.activeContext.set(convId, anchor);
      }
    } catch (err) {
      console.warn('[ContextRuntime] Failed to load recovery db', err);
    }
  }

  saveToDisk() {
    try {
      const state = {
        activeContext: Object.fromEntries(this.activeContext)
      };
      persistence.store('context', state);
    } catch (err) {
      console.warn('[ContextRuntime] Failed to save recovery db', err);
    }
  }

  /**
   * Push a completed action into the context runtime as an anchor.
   */
  async learn(conversationId, type, entities, workspace = 'default') {
    const anchor = {
      id: crypto.randomUUID(),
      type,
      entities,
      source: 'execution',
      timestamp: Date.now(),
      conversationId,
      workspace,
      confidence: 1.0 // 100%
    };
    
    // Immutable Audit Trail (Law 5)
    await journal.append(anchor);

    // Scoped storage
    this.activeContext.set(anchor.id, anchor);
    this.saveToDisk();
    return anchor;
  }

  /**
   * Formal Context Arbitration (Kernel 1.0)
   * Resolves the highest confidence context candidate using weighted scoring.
   */
  resolveContext(currentConversationId, currentWorkspace, expectedType = null) {
    let bestCandidate = null;
    let highestScore = 0;

    for (const [id, anchor] of this.activeContext.entries()) {
      // 1. Recency Decay (Max 20 points)
      const minutesElapsed = (Date.now() - anchor.timestamp) / 1000 / 60;
      const decayedConfidence = Math.max(0, anchor.confidence - (minutesElapsed * DECAY_RATE_PER_MINUTE));
      
      if (decayedConfidence < 0.2) {
        this.activeContext.delete(id); // expire
        continue;
      }

      let score = decayedConfidence * 20; // Up to 20 points for recency/confidence

      // 2. Scope Match (Max 40 points)
      if (anchor.conversationId === currentConversationId) score += 40;
      else if (anchor.workspace === currentWorkspace) score += 20;

      // 3. Semantic Similarity (Max 30 points)
      if (expectedType && anchor.type === expectedType) score += 30;

      // 4. User Focus (Max 10 points - pseudo logic for active window/doc)
      if (anchor.conversationId === currentConversationId) score += 10; 

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = { ...anchor, arbitrationScore: score, confidence: decayedConfidence };
      }
    }

    return bestCandidate;
  }
}

module.exports = new ContextRuntime();
