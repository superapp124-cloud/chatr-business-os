'use strict';

/**
 * CHATR Kernel v2.0 — Background Scheduler
 * 
 * Manages workflows that survive application restarts.
 * Handles event-driven execution and delayed intents.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class BackgroundScheduler {
  constructor() {
    this._jobs = new Map();
    this._persistPath = path.join(process.cwd(), '.chatr', 'background_jobs.json');
    this._init();
    
    // Poll every 1 minute to check for delayed/scheduled jobs
    setInterval(() => this._tick(), 60 * 1000);
  }

  _init() {
    try {
      if (!fs.existsSync(path.dirname(this._persistPath))) {
        fs.mkdirSync(path.dirname(this._persistPath), { recursive: true });
      }
      if (fs.existsSync(this._persistPath)) {
        const data = fs.readFileSync(this._persistPath, 'utf8');
        const parsed = JSON.parse(data);
        for (const [id, job] of Object.entries(parsed)) {
          this._jobs.set(id, job);
        }
      }
    } catch (err) {
      log.warn('[BackgroundScheduler] Failed to load persisted jobs', err);
    }
  }

  _persist() {
    try {
      const obj = Object.fromEntries(this._jobs);
      fs.writeFileSync(this._persistPath, JSON.stringify(obj, null, 2));
    } catch (err) {
      log.error('[BackgroundScheduler] Failed to persist jobs', err);
    }
  }

  /**
   * Schedule an intent to be executed later or on an event trigger.
   */
  scheduleJob(intentId, executeAtMs, payload = {}) {
    const jobId = crypto.randomUUID();
    const job = {
      jobId,
      intentId,
      executeAtMs,
      payload,
      status: 'pending'
    };
    this._jobs.set(jobId, job);
    log.info(`[BackgroundScheduler] Scheduled job ${jobId} for intent ${intentId} at ${new Date(executeAtMs).toISOString()}`);
    this._persist();
    return jobId;
  }

  /**
   * Register a persistent watch event.
   */
  watchEvent(eventId, triggerCallback) {
    // Example: Watch for file changes, external webhooks
    log.info(`[BackgroundScheduler] Registered watcher for event: ${eventId}`);
    // Stubbed watcher
  }

  _tick() {
    const now = Date.now();
    for (const [jobId, job] of this._jobs.entries()) {
      if (job.status === 'pending' && now >= job.executeAtMs) {
        log.info(`[BackgroundScheduler] Triggering job ${jobId} (intent: ${job.intentId})`);
        job.status = 'triggered';
        this._persist();
        
        // Push back into the Execution Engine
        // This avoids circular requires
        try {
          // const { intentLifecycleManager } = require('../kernel/intent-lifecycle.cjs');
          // const { workflowEngine } = require('./workflow-engine.cjs');
          // Start the workflow here...
        } catch (e) {
          log.error(`[BackgroundScheduler] Failed to trigger job ${jobId}`, e);
        }
      }
    }
  }
}

const backgroundScheduler = new BackgroundScheduler();
module.exports = { backgroundScheduler, BackgroundScheduler };
