'use strict';

/**
 * CHATR Kernel — Sense Module (Service)
 *
 * Implements the standard ChatrModule interface.
 * Observes raw text, classifies it using high-precision deterministic patterns,
 * and publishes CLASSIFICATION.CREATED into the intelligence pipeline.
 */

const { ChatrModule } = require('../../kernel/module-interface.cjs');
const { Understanding } = require('../../kernel/objects.cjs');
const { bus } = require('../../events/bus.cjs');
const { INTELLIGENCE } = require('../../events/events.cjs');
const { detectIntents } = require('./patterns.cjs');
const { randomUUID } = require('crypto');

const contextRuntime = require('../../context/runtime.cjs');
const policyEngine = require('../../context/policy.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class SenseModule extends ChatrModule {
  constructor() {
    super();
    this._store = new Map();
  }

  async observe(payload) {
    const { messageText, conversationId, requestId, workspaceId = 'default' } = payload;
    
    // Publish INPUT.RECEIVED and OBSERVATION.CREATED
    bus.publish('KERNEL.INPUT.RECEIVED', { requestId, conversationId, messageText, correlationId: requestId });
    bus.publish('KERNEL.OBSERVATION.CREATED', { requestId, conversationId, messageText, correlationId: requestId });
    
    // Immediately classify (regex runs in <5ms)
    return this.classify({ messageText, conversationId, requestId, workspaceId });
  }

  async classify(observation) {
    const { messageText, conversationId, requestId, workspaceId } = observation;
    let intents = detectIntents(messageText);

    if (intents.length === 0) return [];

    // --- CONTEXT PIPELINE STAGE ---
    const activeContext = contextRuntime.resolveContext(conversationId, workspaceId);
    
    intents = intents.map(intent => {
      // If the classifier detected a continuity reference (e.g. "Create a task from that")
      if (intent.reference === 'ACTIVE_CONTEXT') {
        if (activeContext && activeContext.confidence > 0.6) {
          log.info(`[SenseModule] Context Continuity triggered: reference matched to ${activeContext.type}`);
          bus.publish('KERNEL.CONTEXT.RESOLVED', { id: activeContext.id, score: activeContext.arbitrationScore });
          
          return {
            type: intent.type, // e.g. TASK_CREATE
            confidence: intent.confidence * activeContext.confidence,
            evidence: intent.evidence,
            contextRef: activeContext.id,
            inheritedEntities: activeContext.entities,
            detectedAt: Date.now()
          };
        } else {
          log.info(`[SenseModule] Context Continuity blocked: Confidence too low or no active context.`);
          return null;
        }
      }
      return intent;
    }).filter(Boolean); // Remove nulls where continuity failed

    if (intents.length === 0) return [];

    const understandings = await Promise.all(intents.map(async intent => {
      const u = new Understanding({
        id: randomUUID(),
        type: intent.type,
        source: 'regex',
        temporalState: 'unknown'
      });
      u._rawText = messageText; // For local resolvers to scan
      u.confidence.observation = intent.confidence;
      u.confidence.meaning = 0.3; 
      
      // Inherit entities from context graph
      if (intent.inheritedEntities) {
        if (intent.inheritedEntities.people) u.entities.people.push(...intent.inheritedEntities.people);
        if (intent.inheritedEntities.dates) u.entities.dates.push(...intent.inheritedEntities.dates);
        if (intent.inheritedEntities.locations) u.entities.locations.push(...intent.inheritedEntities.locations);
      }
      
      // --- POLICY PIPELINE STAGE ---
      return await policyEngine.evaluate(u, activeContext);
    }));

    // Emit standard Understanding for legacy
    bus.publish('KERNEL.UNDERSTANDING.CREATED', {
      requestId,
      conversationId,
      classifications: understandings,
      correlationId: requestId
    });

    // Emit Canonical Outcome for Outcome Engine (v1.0)
    bus.publish('KERNEL.OUTCOME.DETECTED', {
      requestId,
      conversationId,
      outcomes: intents, // The raw canonical Outcome objects from the classifier
      correlationId: requestId,
      scope: 'global'
    });

    // Store in memory for diagnostic/history purposes
    const existing = this._store.get(conversationId) || [];
    existing.push({ requestId, messageText, classifications: understandings, observedAt: Date.now() });
    if (existing.length > 20) existing.shift();
    this._store.set(conversationId, existing);

    bus.publish(INTELLIGENCE.CLASSIFICATION_CREATED, {
      requestId,
      conversationId,
      classifications: understandings,
      correlationId: requestId
    });

    log.info(`[SenseModule] Created ${understandings.length} classification(s) for ${conversationId}`);
    return understandings;
  }

  getHistory(conversationId) {
    return this._store.get(conversationId) || [];
  }
}

const senseModule = new SenseModule();

module.exports = { 
  senseModule,
  // Export old functions for backwards compatibility with router during refactor
  observe: (payload) => senseModule.observe(payload),
  getHistory: (id) => senseModule.getHistory(id)
};
