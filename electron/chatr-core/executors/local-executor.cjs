'use strict';

/**
 * CHATR Kernel v2.0 — Local Executor
 *
 * Handles capabilities that execute entirely on the local machine:
 *   - document.analyze  (file parsing + entity extraction + summary)
 *   - background.schedule (delegates to backgroundJobs)
 */

const path = require('path');
const fs   = require('fs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class LocalExecutor {
  constructor() {
    this.name = 'LocalExecutor';
  }

  /**
   * Execute a local capability task.
   *
   * @param {string} task       - capability id
   * @param {object} parameters - capability inputs
   * @returns {Promise<object>}
   */
  async execute(task, parameters) {
    log.info(`[LocalExecutor] Executing '${task}' locally.`);

    switch (task) {
      case 'document.analyze':
        return this._analyzeDocument(parameters);

      case 'background.schedule':
        return this._scheduleJob(parameters);

      default:
        throw new Error(`[LocalExecutor] Unknown local task: '${task}'`);
    }
  }

  // ── Document Analysis ─────────────────────────────────────────────────────

  async _analyzeDocument({ filePath }) {
    if (!filePath) throw new Error('[LocalExecutor] document.analyze requires filePath.');

    const resolved = path.resolve(filePath);

    if (!fs.existsSync(resolved)) {
      throw new Error(`[LocalExecutor] File not found: ${resolved}`);
    }

    const ext  = path.extname(resolved).toLowerCase();
    const stat = fs.statSync(resolved);

    if (stat.size > 50 * 1024 * 1024) {
      throw new Error('[LocalExecutor] File too large (max 50MB).');
    }

    let text = '';

    if (['.txt', '.md', '.csv', '.json', '.xml', '.html'].includes(ext)) {
      text = fs.readFileSync(resolved, 'utf8');
    } else if (ext === '.pdf') {
      text = await this._extractPdfText(resolved);
    } else {
      // Try reading as UTF-8, ignore non-text files
      try {
        text = fs.readFileSync(resolved, 'utf8');
      } catch {
        text = `[Binary file — ${ext} — ${stat.size} bytes]`;
      }
    }

    const entities = this._extractEntities(text);
    const summary  = this._summarise(text);

    return {
      source:   'local',
      filePath: resolved,
      ext,
      sizeBytes: stat.size,
      text:     text.slice(0, 10000), // Cap output to 10k chars
      entities,
      summary
    };
  }

  async _extractPdfText(filePath) {
    // Attempt to use pdf-parse if installed
    try {
      const pdfParse = require('pdf-parse');
      const buf  = fs.readFileSync(filePath);
      const data = await pdfParse(buf);
      return data.text;
    } catch {
      // Fallback: raw binary read → extract visible ASCII strings
      const buf     = fs.readFileSync(filePath);
      const strings = buf.toString('latin1').match(/[\x20-\x7E]{4,}/g) || [];
      return strings.join(' ').slice(0, 50000);
    }
  }

  _extractEntities(text) {
    const entities = [];

    // Emails
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) || [];
    for (const e of new Set(emails)) entities.push({ type: 'email', value: e });

    // Phone numbers (basic Indian + international)
    const phones = text.match(/(?:\+?\d[\d\s\-().]{7,}\d)/g) || [];
    for (const p of new Set(phones.map(s => s.trim()))) entities.push({ type: 'phone', value: p });

    // Dates
    const dates = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/gi) || [];
    for (const d of new Set(dates)) entities.push({ type: 'date', value: d });

    // Monetary amounts
    const amounts = text.match(/(?:₹|Rs\.?|USD?|\$|EUR?|€)\s*[\d,]+(?:\.\d{1,2})?/gi) || [];
    for (const a of new Set(amounts)) entities.push({ type: 'amount', value: a });

    return entities.slice(0, 50);
  }

  _summarise(text) {
    if (!text || text.length < 100) return text;

    // Extract first 3 sentences as a heuristic summary
    const sentences = text.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).join(' ').trim().slice(0, 500) || text.slice(0, 200);
  }

  // ── Background Scheduling ─────────────────────────────────────────────────

  async _scheduleJob({ capability, params, schedule, description }) {
    if (!capability) throw new Error('[LocalExecutor] background.schedule requires capability.');

    try {
      const { backgroundJobs } = require('../background-jobs.cjs');
      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      backgroundJobs.schedule({
        id:          jobId,
        name:        description || `Scheduled: ${capability}`,
        capability,
        params:      params || {},
        schedule:    schedule || 'every_hour',
        description: description || `Auto-scheduled via LocalExecutor`
      });

      log.info(`[LocalExecutor] Scheduled job '${jobId}' for capability '${capability}'.`);
      return { source: 'local', jobId };
    } catch (err) {
      log.error('[LocalExecutor] Failed to schedule job:', err.message);
      throw err;
    }
  }
}

const localExecutor = new LocalExecutor();
module.exports = { localExecutor, LocalExecutor };
