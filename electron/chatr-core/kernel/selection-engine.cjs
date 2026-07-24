'use strict';

/**
 * CHATR Kernel - Selection Engine
 * Takes Top 5 candidates, checks installation status, picks a winner,
 * and delegates downloads to ModelLifecycleManager if necessary.
 */

const { bus } = require('../events/bus.cjs');
const { modelLifecycleManager } = require('../services/model-lifecycle.cjs');

class SelectionEngine {
  constructor() {
    this.name = 'SelectionEngine';
  }

  selectWinner(candidates) {
    if (!candidates || candidates.length === 0) {
      return { winner: null, fallbackTriggered: false, error: 'No candidates provided' };
    }

    // Iterate through ranked candidates to find the first one that is INSTALLED
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      
      // Cloud models are always considered "installed" / ready
      if (candidate.model.cloud || candidate.model.installationStatus === 'installed') {
        
        // If we picked a fallback, trigger a download for the better options we skipped
        let fallbackTriggered = false;
        if (i > 0) {
          fallbackTriggered = true;
          const skipped = candidates[0].model;
          bus.publish('MODEL_FALLBACK', {
            requested: skipped.id,
            selected: candidate.model.id,
            reason: `${skipped.id} not installed`
          });
          // Queue the best model for download in background
          modelLifecycleManager.enqueue(skipped.id);
        }

        bus.publish('MODEL_SELECTED', {
          modelId: candidate.model.id,
          score: candidate.score
        });

        return {
          winner: candidate.model,
          fallbackTriggered,
          confidence: candidate.score / 100 // Rough confidence heuristic
        };
      }
    }

    // If none are installed, we have a hard failure. 
    // In a mature system, we would block and download the top one here.
    const top = candidates[0].model;
    modelLifecycleManager.enqueue(top.id);
    return { winner: null, fallbackTriggered: false, error: 'No capable models are installed. Download initiated.' };
  }
}

const selectionEngine = new SelectionEngine();
module.exports = { selectionEngine, SelectionEngine };
