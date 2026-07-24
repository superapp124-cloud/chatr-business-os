'use strict';

/**
 * CHATR Kernel — Knowledge Module (Stub)
 *
 * Genesis Milestone 4 establishes the Zero Mock Data principle.
 * The Knowledge Resolver stub listens to CLASSIFICATION.CREATED,
 * looks up verified information, and enhances the Understanding object.
 * It NEVER invents facts.
 */

const { ChatrModule } = require('../../kernel/module-interface.cjs');
const { bus } = require('../../events/bus.cjs');
const { INTELLIGENCE } = require('../../events/events.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class KnowledgeModule extends ChatrModule {
  constructor() {
    super();
    this._contacts = new Map();
    
    // Only load mocks if explicitly requested
    if (process.env.CHATR_DEV_MOCK_MODE === 'true') {
      this._contacts.set('john', { name: 'John', id: 'contact-001', phone: '555-0199' });
      this._contacts.set('sarah', { name: 'Sarah', id: 'contact-002', phone: '9876543210' });
      log.warn('[KnowledgeModule] Running with MOCK DATA enabled (CHATR_DEV_MOCK_MODE=true)');
    }
  }

  async observe() {
    bus.subscribe(INTELLIGENCE.CLASSIFICATION_CREATED, async (payload) => {
      const { requestId, conversationId, classifications } = payload;
      for (const classification of classifications) {
        await this.classify(classification);
      }
    });
  }

  async classify(understanding) {
    const text = (understanding._rawText || '').toLowerCase();
    
    let resolvedCount = 0;
    for (const [key, contact] of this._contacts.entries()) {
      if (text.includes(key)) {
        understanding.addEntity('people', contact.name, {
          source: 'knowledge',
          verified: true,
          resolver: 'KnowledgeModule'
        });
        resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      understanding.confidence.meaning += 0.3;
      return { resolved: true, resolver: 'KnowledgeModule', durationMs: 0 };
    }

    return { resolved: false, resolver: 'KnowledgeModule', durationMs: 0 };
  }
}

const knowledgeModule = new KnowledgeModule();

module.exports = { knowledgeModule, service: knowledgeModule };
