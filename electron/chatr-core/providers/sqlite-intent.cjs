'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');
const { Job } = require('../kernel/objects.cjs');

class SqliteIntentProvider {
  constructor() {
    this.name = 'SqliteIntentProvider';
    
    // Ensure data directory exists
    const userDataPath = app ? app.getPath('userData') : path.join(require('os').tmpdir(), 'chatr-mock');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    this.dbPath = path.join(userDataPath, 'intent.db');
    this.db = new Database(this.dbPath);
    
    // Initialize schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        goal TEXT,
        state TEXT,
        metrics JSON,
        fullData JSON
      );
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        label TEXT,
        goal TEXT,
        fullData JSON
      );
    `);
  }

  async recordActivity(intentId, context) {
    const jobData = context.job;
    if (jobData) {
      const stmt = this.db.prepare(`
        INSERT INTO jobs (id, goal, state, metrics, fullData) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(id) DO UPDATE SET 
          state=excluded.state, 
          metrics=excluded.metrics, 
          fullData=excluded.fullData
      `);
      stmt.run(
        jobData.id, 
        jobData.goal, 
        jobData.state, 
        JSON.stringify(jobData.metrics), 
        JSON.stringify(jobData)
      );
    }
    return true;
  }

  async getTimeline(timeRange) {
    // For V1 we just return recent jobs sorted by startTime
    const stmt = this.db.prepare(`SELECT fullData FROM jobs ORDER BY json_extract(metrics, '$.startTime') DESC LIMIT 100`);
    const rows = stmt.all();
    return rows.map(r => JSON.parse(r.fullData));
  }

  /**
   * Used for Crash Recovery on Boot
   */
  async getIncompleteJobs() {
    const stmt = this.db.prepare(`SELECT fullData FROM jobs WHERE state IN ('Running', 'Waiting')`);
    const rows = stmt.all();
    return rows.map(r => JSON.parse(r.fullData));
  }

  /**
   * Replays an intent by hydrating its past state and dispatching to workflow runtime.
   */
  async replayIntent(intentId) {
    const stmt = this.db.prepare(`SELECT fullData FROM jobs WHERE id = ?`);
    const row = stmt.get(intentId);
    if (!row) throw new Error(`Cannot replay unknown intent: ${intentId}`);
    
    const pastJob = JSON.parse(row.fullData);
    
    // Create new job from past goal/intent
    const newJob = new Job({ id: `job_replay_${Date.now()}`, goal: pastJob.goal });
    newJob.intent = pastJob.intent;
    
    return newJob;
  }

  /**
   * Saves a successful execution graph as a parameterized template.
   */
  async bookmarkIntent(intentId, label) {
    const stmt = this.db.prepare(`SELECT fullData FROM jobs WHERE id = ?`);
    const row = stmt.get(intentId);
    if (!row) throw new Error(`Cannot bookmark unknown intent: ${intentId}`);
    
    const pastJob = JSON.parse(row.fullData);
    const templateId = `tmpl_${Date.now()}`;
    
    const template = {
      templateId,
      label,
      goal: pastJob.goal,
      intent: pastJob.intent,
      executionGraph: pastJob.executionGraph
    };
    
    const insert = this.db.prepare(`INSERT INTO templates (id, label, goal, fullData) VALUES (?, ?, ?, ?)`);
    insert.run(templateId, label, pastJob.goal, JSON.stringify(template));
    
    return templateId;
  }
}

module.exports = { SqliteIntentProvider };
