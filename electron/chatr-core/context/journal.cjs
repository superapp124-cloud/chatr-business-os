/**
 * CHATR Kernel 1.0 — Intent Journal
 *
 * Immutable append-only event source.
 * Records the 'Execution' output. Consumed asynchronously by Learning, Analytics, Sync, and Undo.
 */
const { bus } = require('../events/bus.cjs');
const persistence = require('../db/persistence.cjs');

class IntentJournal {
  constructor() {
    // File creation handled by persistence if needed
  }

  /**
   * Append an execution event to the journal.
   * This is an immutable operation (Law 5).
   */
  async append(executedAction) {
    const entry = {
      ...executedAction,
      _journal_timestamp: Date.now()
    };

    persistence.append('journal', entry);

    // Publish event for downstream consumers (Learning, Analytics)
    bus.publish('KERNEL.JOURNAL.APPENDED', entry);
    
    return entry;
  }

  /**
   * Reads recent events (useful for Undo / Debugging)
   */
  readRecent(limit = 10) {
    // For now we assume we can read the raw JSONL file if needed, 
    // but in a real SQLite setup this would be a SELECT with LIMIT.
    try {
      const fs = require('fs');
      const path = require('path');
      const JOURNAL_PATH = path.join(process.env.APPDATA || process.env.HOME || '', '.chatr', 'journal.jsonl');
      const content = fs.readFileSync(JOURNAL_PATH, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-limit).map(l => JSON.parse(l));
    } catch {
      return [];
    }
  }
}

module.exports = new IntentJournal();
