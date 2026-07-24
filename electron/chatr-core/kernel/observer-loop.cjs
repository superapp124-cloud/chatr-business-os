'use strict';

/**
 * CHATR Kernel — Observer Loop (v0.9 RC)
 * 
 * Contract:
 * - A reality capture service. Converts external signals into immutable ObservationFrames.
 * - NEVER interprets meaning (e.g. "payment successful").
 * - NEVER modifies execution state, retries, schedules, or verifies.
 * - Preserves arrival order and emits duplicates.
 * - Exposes a pluggable Adapter architecture.
 */

const crypto = require('crypto');
const ABI = 'chatr.observation_frame.v0_9_rc';
const MAX_QUEUE_SIZE = 50000; // Bounded memory

class ObserverLoop {
  constructor(options = {}) {
    this.bus = options.bus || { publish: () => {} };
    this.now = options.now || (() => new Date().toISOString());
    this.adapters = new Map();
    this.sequenceCounter = 0;
    
    // Backpressure queue
    this.observationQueue = [];
    this.isProcessing = false;
  }

  /**
   * Register a pluggable adapter.
   * e.g., 'browser', 'api', 'webhook'
   */
  registerAdapter(sourceName, adapterFunction) {
    this.adapters.set(sourceName, adapterFunction);
  }

  /**
   * Ingest raw reality from a source.
   * Preserves exact arrival order. Applies backpressure if flooded.
   */
  ingest(sourceName, rawEvent) {
    if (this.observationQueue.length >= MAX_QUEUE_SIZE) {
      // Load shedding to prevent OOM
      console.warn(`[ObserverLoop] Backpressure threshold reached. Shedding load from ${sourceName}`);
      return false;
    }

    const arrivalTime = performance.now();
    
    this.observationQueue.push({
      sourceName,
      rawEvent,
      arrivalTime,
      seq: ++this.sequenceCounter
    });

    this._drainQueue();
    return true;
  }

  async _drainQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Drain synchronously to guarantee arrival order and maximize throughput
    while (this.observationQueue.length > 0) {
      const batch = this.observationQueue.splice(0, 5000); // Process in batches
      
      for (const item of batch) {
        const adapter = this.adapters.get(item.sourceName);
        if (!adapter) {
          console.warn(`[ObserverLoop] Dropping event: No adapter registered for source '${item.sourceName}'`);
          continue;
        }

        try {
          // Adapter translates raw event into standardized payload fields
          const parsed = adapter(item.rawEvent);
          
          if (!parsed || !parsed.goal_id) continue;

          const frame = {
            abi: ABI,
            observation_id: crypto.randomUUID(),
            goal_id: parsed.goal_id,
            workflow_step: parsed.workflow_step || 'unknown',
            sequence: item.seq,
            timestamp: this.now(),
            source: item.sourceName,
            observation_type: parsed.observation_type || 'raw',
            confidence: parsed.confidence || 1.0,
            payload: parsed.payload || {},
            metadata: {
              latency_ms: performance.now() - item.arrivalTime,
              ...parsed.metadata
            }
          };

          // Freeze to guarantee immutability (Observer never modifies past this point)
          Object.freeze(frame);
          Object.freeze(frame.payload);
          Object.freeze(frame.metadata);

          // Emit the canonical kernel event
          this.bus.publish('kernel.observation.created', frame);
        } catch (err) {
          console.error(`[ObserverLoop] Adapter error for ${item.sourceName}:`, err);
        }
      }
    }

    this.isProcessing = false;
  }
}

module.exports = { ObserverLoop };
