'use strict';

/**
 * CHATR Kernel — Time Module (Stub)
 *
 * Genesis Milestone 4. Resolves temporal context without hallucinations.
 */

const { ChatrModule } = require('../../kernel/module-interface.cjs');

class TimeModule extends ChatrModule {
  async classify(understanding) {
    // This is a stub for the Kernel Service lookup approach.
    // Semantic module will pass the understanding object here to be enriched.
    const text = (understanding._rawText || '').toLowerCase();
    
    let resolvedDate = null;
    if (text.includes('tomorrow')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      resolvedDate = d.toISOString().split('T')[0];
      understanding.temporalState = 'tomorrow';
    } else if (text.includes('today')) {
      resolvedDate = new Date().toISOString().split('T')[0];
      understanding.temporalState = 'today';
    } else if (text.includes('next week')) {
      understanding.temporalState = 'next_week';
    }

    if (resolvedDate) {
      understanding.addEntity('dates', resolvedDate, {
        source: 'time',
        verified: true,
        resolver: 'TimeModule'
      });
      // Boost meaning confidence slightly
      understanding.confidence.meaning += 0.2;
      return { resolved: true, resolver: 'TimeModule', durationMs: 0 };
    }

    return { resolved: false, resolver: 'TimeModule', durationMs: 0 };
  }
}

const timeModule = new TimeModule();

module.exports = { timeModule, service: timeModule };
