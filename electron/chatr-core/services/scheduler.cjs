'use strict';

const { bus } = require('../events/bus.cjs');
const { JOB } = require('../events/events.cjs');
const cronParser = require('cron-parser');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class SchedulerService {
  constructor() {
    this.name = 'SchedulerService';
    this.schedules = new Map();
    this.paused = false;
    
    // The master tick loop runs every minute to evaluate cron expressions
    this.tickInterval = setInterval(() => this._tick(), 60 * 1000);
  }

  /**
   * Schedule a job to run periodically or at a specific time.
   */
  scheduleJob(scheduleId, jobTemplate, rules) {
    if (this.schedules.has(scheduleId)) {
      this.cancel(scheduleId);
    }

    if (rules.intervalMs) {
      const timerId = setInterval(() => {
        if (!this.paused) this._dispatch(jobTemplate);
      }, rules.intervalMs);
      
      this.schedules.set(scheduleId, { type: 'interval', id: timerId });
      log.info(`[SchedulerService] Job ${scheduleId} scheduled every ${rules.intervalMs}ms`);
    } 
    else if (rules.cron) {
      try {
        const interval = cronParser.parseExpression(rules.cron);
        this.schedules.set(scheduleId, { 
          type: 'cron', 
          cronExpression: rules.cron,
          jobTemplate,
          nextRun: interval.next().getTime()
        });
        log.info(`[SchedulerService] Job ${scheduleId} scheduled with cron: ${rules.cron}`);
      } catch (err) {
        throw new Error(`Invalid cron expression: ${rules.cron}`);
      }
    }
    
    return true;
  }

  cancel(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    if (schedule) {
      if (schedule.type === 'interval') clearInterval(schedule.id);
      this.schedules.delete(scheduleId);
      log.info(`[SchedulerService] Cancelled schedule ${scheduleId}`);
    }
  }

  setPaused(isPaused) {
    this.paused = isPaused;
    if (isPaused) {
      log.warn(`[SchedulerService] Scheduler paused (likely due to resource constraints).`);
    } else {
      log.info(`[SchedulerService] Scheduler resumed.`);
    }
  }

  _tick() {
    if (this.paused) return;
    
    const now = Date.now();
    for (const [scheduleId, schedule] of this.schedules.entries()) {
      if (schedule.type === 'cron' && now >= schedule.nextRun) {
        this._dispatch(schedule.jobTemplate);
        
        // Calculate next run
        const interval = cronParser.parseExpression(schedule.cronExpression);
        schedule.nextRun = interval.next().getTime();
      }
    }
  }

  _dispatch(jobTemplate) {
    const newJob = { ...jobTemplate, id: `job_${Date.now()}` };
    newJob.state = 'Created';
    
    // Emit creation event
    bus.publish(JOB.CREATED, { job: newJob });
    
    // Simulate Workflow Runtime taking over to execute it
    setTimeout(() => {
      bus.publish(JOB.RUNNING, { job: { ...newJob, state: 'Running' } });
    }, 100);
  }
}

const scheduler = new SchedulerService();
module.exports = { scheduler, SchedulerService };

