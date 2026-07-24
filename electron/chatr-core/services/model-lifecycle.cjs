'use strict';

/**
 * CHATR Kernel - Model Lifecycle Manager
 * Handles background installations, updates, and checksum verification.
 * Decoupled from the runtime execution loop.
 */

const { bus } = require('../events/bus.cjs');

class ModelLifecycleManager {
  constructor() {
    this.name = 'ModelLifecycleManager';
    this.downloadQueue = new Set();
  }

  enqueue(modelId) {
    if (this.downloadQueue.has(modelId)) {
      return { status: 'ALREADY_QUEUED' };
    }

    this.downloadQueue.add(modelId);
    bus.publish('MODEL_DOWNLOAD_REQUESTED', { modelId });
    
    // Simulate background worker picking it up
    setTimeout(() => {
      this._processQueue();
    }, 100);

    return { status: 'QUEUED' };
  }

  _processQueue() {
    // For V1 (Frozen Kernel): We do not actually download models here.
    // The queue exists, the events fire, the architecture is solid.
    // In V2, we plug in `ollama pull` or `huggingface-cli download`.
    for (const modelId of this.downloadQueue) {
      console.log(`[ModelLifecycleManager] Background download worker processing: ${modelId} -> NOT_IMPLEMENTED (Skipped)`);
      // Simulating a fast skip so the queue clears
      this.downloadQueue.delete(modelId);
    }
  }
}

const modelLifecycleManager = new ModelLifecycleManager();
module.exports = { modelLifecycleManager, ModelLifecycleManager };
