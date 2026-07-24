'use strict';

/**
 * CHATR Kernel v2.0 — Background Jobs Manager
 *
 * Persistent background job scheduler using setInterval.
 * Jobs survive restarts via a JSON file in userData.
 * Publishes bus events on completion/failure.
 */

const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const crypto = require('crypto');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// ── Storage path ──────────────────────────────────────────────────────────────

function _getStoragePath() {
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'chatr-background-jobs.json');
  } catch {
    const dir = path.join(os.homedir(), '.chatr');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'background-jobs.json');
  }
}

// ── Schedule → interval in ms ─────────────────────────────────────────────────

function _scheduleToMs(schedule) {
  switch (schedule) {
    case 'every_15min': return 15 * 60 * 1000;
    case 'every_hour':  return 60 * 60 * 1000;
    case 'every_day':   return 24 * 60 * 60 * 1000;
    case 'every_week':  return 7 * 24 * 60 * 60 * 1000;
    default: {
      // Try to parse a numeric value (ms)
      const num = parseInt(schedule);
      if (!isNaN(num) && num > 0) return num;
      // Default to hourly for unknown cron-like strings
      log.warn(`[BackgroundJobs] Unknown schedule '${schedule}', defaulting to hourly.`);
      return 60 * 60 * 1000;
    }
  }
}

// ── BackgroundJobs ─────────────────────────────────────────────────────────────

class BackgroundJobs {
  constructor() {
    /** @type {Map<string, object>} jobId → jobRecord */
    this._jobs     = new Map();
    /** @type {Map<string, NodeJS.Timeout>} jobId → interval handle */
    this._timers   = new Map();
    this._storagePath = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Restore persisted jobs from disk and restart their intervals.
   * Call this once at kernel boot.
   */
  restore() {
    this._storagePath = _getStoragePath();
    if (!fs.existsSync(this._storagePath)) {
      log.info('[BackgroundJobs] No persisted jobs found.');
      return;
    }

    try {
      const raw  = fs.readFileSync(this._storagePath, 'utf8');
      const data = JSON.parse(raw);

      for (const job of (data.jobs || [])) {
        if (job.status === 'cancelled') continue;
        // Restore job record
        this._jobs.set(job.id, { ...job, status: 'active' });
        this._startTimer(job.id);
      }

      log.info(`[BackgroundJobs] Restored ${this._jobs.size} job(s) from disk.`);
    } catch (err) {
      log.error('[BackgroundJobs] Failed to restore jobs:', err.message);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Schedule a new background job.
   * @param {{ id?: string, name: string, capability: string, params: object, schedule: string, description?: string }} job
   * @returns {string} jobId
   */
  schedule(job) {
    const id = job.id || `job_${crypto.randomUUID().slice(0, 8)}`;

    if (this._jobs.has(id)) {
      log.warn(`[BackgroundJobs] Job '${id}' already exists. Cancelling before rescheduling.`);
      this.cancel(id);
    }

    const record = {
      id,
      name:        job.name || `Job: ${job.capability}`,
      capability:  job.capability,
      params:      job.params || {},
      schedule:    job.schedule || 'every_hour',
      description: job.description || '',
      status:      'active',
      createdAt:   new Date().toISOString(),
      lastRun:     null,
      nextRun:     new Date(Date.now() + _scheduleToMs(job.schedule || 'every_hour')).toISOString(),
      runCount:    0,
      lastError:   null
    };

    this._jobs.set(id, record);
    this._startTimer(id);
    this._persist();

    log.info(`[BackgroundJobs] Scheduled job '${id}' (${record.name}) — interval: ${record.schedule}`);
    return id;
  }

  /**
   * Cancel and remove a job.
   * @param {string} jobId
   */
  cancel(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) {
      log.warn(`[BackgroundJobs] cancel() — job '${jobId}' not found.`);
      return;
    }

    this._clearTimer(jobId);
    job.status   = 'cancelled';
    job.cancelledAt = new Date().toISOString();

    this._persist();
    log.info(`[BackgroundJobs] Cancelled job '${jobId}'.`);
  }

  /**
   * Returns all jobs with current status.
   * @returns {object[]}
   */
  list() {
    return Array.from(this._jobs.values()).map(j => ({ ...j }));
  }

  /**
   * Returns a single job by ID.
   * @param {string} id
   * @returns {object|null}
   */
  getJob(id) {
    return this._jobs.get(id) || null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _startTimer(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return;

    const intervalMs = _scheduleToMs(job.schedule);

    const handle = setInterval(async () => {
      await this._runJob(jobId);
    }, intervalMs);

    // Don't prevent Node from exiting
    if (handle.unref) handle.unref();
    this._timers.set(jobId, handle);
  }

  _clearTimer(jobId) {
    const handle = this._timers.get(jobId);
    if (handle) {
      clearInterval(handle);
      this._timers.delete(jobId);
    }
  }

  async _runJob(jobId) {
    const job = this._jobs.get(jobId);
    if (!job || job.status === 'cancelled') return;

    log.info(`[BackgroundJobs] Running job '${jobId}' (${job.capability})`);

    job.lastRun   = new Date().toISOString();
    job.nextRun   = new Date(Date.now() + _scheduleToMs(job.schedule)).toISOString();
    job.runCount  = (job.runCount || 0) + 1;
    job.status    = 'running';
    this._persist();

    let bus;
    try {
      const { bus: b } = require('./events/bus.cjs');
      bus = b;
    } catch { /* bus unavailable */ }

    try {
      // Delegate to ExecutionRuntime if available
      let result = null;
      try {
        const { executionRuntime } = require('./execution/execution-runtime.cjs');
        result = await executionRuntime.execute(job.capability, job.params, { background: true, jobId });
      } catch (e) {
        log.warn(`[BackgroundJobs] ExecutionRuntime unavailable for job '${jobId}': ${e.message}`);
        result = { skipped: true, reason: 'ExecutionRuntime not available' };
      }

      job.status    = 'active';
      job.lastError = null;
      this._persist();

      if (bus) {
        bus.publish('background:job_completed', { jobId, capability: job.capability, result, runCount: job.runCount });
      }

      log.info(`[BackgroundJobs] Job '${jobId}' completed successfully (run #${job.runCount}).`);
    } catch (err) {
      log.error(`[BackgroundJobs] Job '${jobId}' failed:`, err.message);

      job.status    = 'active'; // keep it scheduled
      job.lastError = err.message;
      this._persist();

      if (bus) {
        bus.publish('background:job_failed', { jobId, capability: job.capability, error: err.message });
      }
    }
  }

  _persist() {
    if (!this._storagePath) {
      try {
        this._storagePath = _getStoragePath();
      } catch { return; }
    }

    try {
      const data = { jobs: Array.from(this._jobs.values()) };
      fs.writeFileSync(this._storagePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      log.error('[BackgroundJobs] Persist error:', err.message);
    }
  }
}

const backgroundJobs = new BackgroundJobs();
module.exports = { backgroundJobs, BackgroundJobs };
