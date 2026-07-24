'use strict';

/**
 * CHATR Kernel — Recovery Manager
 *
 * Reserved in Milestone 1. Activated in Milestone 2.
 *
 * Responsibility:
 *   On kernel restart, detect interrupted requests and either
 *   resume them or mark them as FAILED in Supabase.
 *
 * Genesis v1.0 — Milestone 2
 */

const { bus }  = require('../events/bus.cjs');
const { CORE } = require('../events/events.cjs');
const { SqliteIntentProvider } = require('../providers/sqlite-intent.cjs');
const { ledger } = require('../ledger/event-ledger.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const RECOVERY_STORE_KEY = 'chatr_kernel_recovery_v1';

class RecoveryManager {
  constructor() {
    this._store    = new Set();
    this._isReady  = false;
  }

  /**
   * Register a request as in-progress.
   * Called by Orchestrator at EXECUTE stage.
   */
  track(requestId, { conversationId, userId, stage }) {
    ledger.append({
      event_type: 'INTENT_TRACKING_STARTED',
      correlation_id: requestId,
      payload: { requestId, conversationId, userId, stage, startedAt: Date.now() }
    });
    this._store.add(requestId);
  }

  /**
   * Unregister a completed or failed request.
   */
  untrack(requestId) {
    ledger.append({
      event_type: 'INTENT_TRACKING_COMPLETED',
      correlation_id: requestId,
      payload: { requestId, completedAt: Date.now() }
    });
    this._store.delete(requestId);
  }

  /**
   * On kernel boot, scan for interrupted requests from last session.
   * Replays ALL ledger entries, looking for intent tracking starts without corresponding completions.
   */
  async recover() {
    log.info('[RecoveryManager] Scanning for interrupted requests...');

    try {
      const events = ledger.replay();
      const started = new Map();
      const completed = new Set();

      for (const e of events) {
        if (e.event_type === 'INTENT_TRACKING_STARTED') {
          started.set(e.payload.requestId, e.payload);
        } else if (e.event_type === 'INTENT_TRACKING_COMPLETED') {
          completed.add(e.payload.requestId);
        }
      }

      let interruptedCount = 0;
      for (const [requestId, payload] of started.entries()) {
        if (!completed.has(requestId)) {
          interruptedCount++;
          ledger.append({
            event_type: 'INTENT_RECOVERY_FAILED',
            correlation_id: requestId,
            payload: { requestId, reason: 'Interrupted by kernel restart' }
          });
          
          bus.publish(CORE.REQUEST_FAILED, {
            requestId: requestId,
            error: 'Interrupted by kernel restart.',
          });
          log.info(`[RecoveryManager] Job ${requestId} marked as Failed due to interruption.`);
        }
      }

      if (interruptedCount === 0) {
        log.info('[RecoveryManager] No interrupted requests found.');
      } else {
        log.warn(`[RecoveryManager] Found ${interruptedCount} interrupted job(s) from previous session.`);
      }
    } catch (err) {
      log.error(`[RecoveryManager] Failed to run crash recovery:`, err.message);
    }

    this._isReady = true;
    bus.publish(CORE.RECOVERY_COMPLETED, { recoveredCount: 0 });
    log.info('[RecoveryManager] Recovery complete. Kernel accepting requests.');
  }

  /**
   * Get current recovery status (for /health endpoint).
   */
  status() {
    return {
      ready:   this._isReady,
      tracked: this._store.size,
    };
  }
}

const recoveryManager = new RecoveryManager();

module.exports = { RecoveryManager, recoveryManager };
