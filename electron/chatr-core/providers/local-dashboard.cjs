'use strict';

const { SqliteIntentProvider } = require('./sqlite-intent.cjs');

/**
 * Local Dashboard Provider
 * 
 * Provides metrics and data for the React UI Dashboard and Smart Inbox.
 */
class LocalDashboardProvider {
  constructor() {
    this.name = 'LocalDashboardProvider';
    this.intentProvider = new SqliteIntentProvider();
  }

  async execute(context) {
    const { action } = context;

    if (action === 'get_status') {
      const { scheduler } = require('../services/scheduler.cjs');
      const { watchdog } = require('../health/watchdog.cjs');
      
      return {
        kernel: 'running',
        schedulerPaused: scheduler.paused,
        watchdogActive: watchdog.intervalId !== null,
        activeJobs: scheduler.schedules.size
      };
    }

    if (action === 'get_timeline') {
      const timeRange = context.timeRange || '24h';
      const jobs = await this.intentProvider.getTimeline(timeRange);
      return jobs;
    }

    if (action === 'get_intelligence_brief') {
      return {
        metrics: { emails: 12, contracts: 3, invoices: 1, meetings: 4 },
        actions: [
          { label: 'Review Contracts', action: 'review_contracts' },
          { label: 'Clear Inbox', action: 'clear_inbox' }
        ]
      };
    }

    if (action === 'search') {
      const { LocalSearchProvider } = require('./local-search.cjs');
      const searcher = new LocalSearchProvider();
      const results = await searcher.search({ query: context.query || '' });
      return results.files.map(f => ({
        id: f.path,
        time: new Date(f.timestamp).toLocaleTimeString(),
        icon: 'mail',
        title: f.name,
        detail: f.contentPreview,
        category: 'filesystem'
      }));
    }

    throw new Error(`[LocalDashboardProvider] Unknown dashboard action: ${action}`);
  }
}

module.exports = { LocalDashboardProvider };
