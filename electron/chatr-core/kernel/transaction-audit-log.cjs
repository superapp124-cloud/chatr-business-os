'use strict';

const { ledger } = require('../ledger/event-ledger.cjs');

/**
 * CHATR Kernel — Transaction Audit Log
 * Platform Milestone P1.4
 *
 * Immutable append-only record of every transaction state change.
 * Never modified after written. Used for replay, recovery, and debugging.
 */
class TransactionAuditLog {
  constructor() {
    // Persisted in the ledger
  }

  /**
   * Append an entry. Cannot be removed or modified.
   */
  append(transactionId, event, payload = {}) {
    return ledger.append({
      event_type: 'TRANSACTION_AUDIT',
      correlation_id: transactionId,
      payload: {
        transaction_id: transactionId,
        event,
        ...payload
      }
    });
  }

  /**
   * Read all entries for a transaction (read-only view).
   */
  forTransaction(transactionId) {
    return ledger.replayForCorrelation(transactionId)
      .filter(e => e.event_type === 'TRANSACTION_AUDIT')
      .map(e => e.payload);
  }

  /**
   * Return the entire log length (for metrics).
   */
  size() {
    return ledger.getMetrics().byEventType['TRANSACTION_AUDIT'] || 0;
  }
}

module.exports = { TransactionAuditLog };
