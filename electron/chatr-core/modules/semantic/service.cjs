'use strict';

/**
 * CHATR Kernel — Semantic Engine
 *
 * The Semantic Engine orchestrates understanding.
 * It listens to CLASSIFICATION.CREATED, routes through local Knowledge
 * and Time resolvers, and only if confidence remains low, delegates to the LLM.
 *
 * Implements Progressive Certainty.
 */

const { ChatrModule } = require('../../kernel/module-interface.cjs');
const { bus } = require('../../events/bus.cjs');
const { INTELLIGENCE } = require('../../events/events.cjs');

// Require the local resolvers (these act as Kernel Services for the Semantic Engine)
const { service: knowledgeService } = require('../knowledge/service.cjs');
const { service: timeService } = require('../time/service.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class SemanticModule extends ChatrModule {
  async observe() {
    bus.subscribe(INTELLIGENCE.CLASSIFICATION_CREATED, async (payload) => {
      const { requestId, conversationId, classifications } = payload;
      
      for (const classification of classifications) {
        await this.understand({ requestId, conversationId, classification });
      }
    });
  }

  async understand(payload) {
    const { requestId, conversationId, classification: understanding } = payload;
    
    // 1. Knowledge Resolver
    const kMeta = await knowledgeService.classify(understanding);

    // 2. Time Resolver
    const tMeta = await timeService.classify(understanding);

    // Store resolver metadata
    understanding.enrichments.push(kMeta);
    understanding.enrichments.push(tMeta);

    // Publish CONTEXT.RESOLVED after local resolvers finish
    bus.publish(INTELLIGENCE.CONTEXT_RESOLVED, { requestId, conversationId, understanding });

    // 3. LLM Fallback (if meaning confidence is still too low)
    if (understanding.confidence.meaning < 0.7) {
      if (process.env.CHATR_DEV_MOCK_MODE === 'true') {
        understanding.addEntity('people', 'Unknown LLM Person', {
          source: 'llm',
          verified: false,
          resolver: 'SemanticLLM'
        });
        understanding.confidence.meaning = 0.75;
        understanding.enrichments.push({ resolved: true, resolver: 'SemanticLLM', durationMs: 0 });
      } else {
        understanding.enrichments.push({ resolved: false, resolver: 'SemanticLLM', durationMs: 0 });
      }
    }

    // 4. Enrichment complete. Ready for UI suggestion updates.
    understanding.readyForSuggestion = true;
    bus.publish(INTELLIGENCE.UNDERSTANDING_ENRICHED, { requestId, conversationId, understanding });

    log.info(`[SemanticEngine] Enriched understanding ${understanding.id} (${understanding.type}). Confidence: ${understanding.confidence.meaning.toFixed(2)}`);
    return understanding;
  }
}

const semanticModule = new SemanticModule();

// Start observing on require
semanticModule.observe();

module.exports = { semanticModule, service: semanticModule };
