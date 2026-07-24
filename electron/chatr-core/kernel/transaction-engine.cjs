'use strict';

const crypto = require('crypto');
const { TransactionAuditLog } = require('./transaction-audit-log.cjs');
const { ledger } = require('../events/ledger.cjs');
const { bus } = require('../events/bus.cjs');

/**
 * CHATR Kernel — Transaction Engine (Refounded)
 * Platform Milestone P1.4 -> OS Refoundation
 *
 * The single authority for transaction lifecycle.
 * Now fully EVENT-SOURCED. All state rebuilt exclusively via replay.
 * State is projected in memory, but sourced durably from the Event Ledger.
 */

const ABI_VERSION = 'chatr.transaction.v0_9_rc';

const TRANSACTION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_RETRYABLE: 'PAYMENT_RETRYABLE',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  VERIFIED: 'VERIFIED',
  TRACKING: 'TRACKING',
  COMPLETED: 'COMPLETED',
});

// Legal state transitions — enforced strictly
const LEGAL_TRANSITIONS = {
  [TRANSACTION_STATUS.PENDING]:            [TRANSACTION_STATUS.PAYMENT_PENDING, TRANSACTION_STATUS.PAYMENT_CANCELLED],
  [TRANSACTION_STATUS.PAYMENT_PENDING]:    [TRANSACTION_STATUS.PAYMENT_CONFIRMED, TRANSACTION_STATUS.PAYMENT_FAILED, TRANSACTION_STATUS.PAYMENT_RETRYABLE],
  [TRANSACTION_STATUS.PAYMENT_CONFIRMED]:  [TRANSACTION_STATUS.VERIFIED],
  [TRANSACTION_STATUS.PAYMENT_RETRYABLE]: [TRANSACTION_STATUS.PAYMENT_PENDING, TRANSACTION_STATUS.PAYMENT_CANCELLED],
  [TRANSACTION_STATUS.PAYMENT_FAILED]:     [TRANSACTION_STATUS.PAYMENT_CANCELLED],
  [TRANSACTION_STATUS.VERIFIED]:           [TRANSACTION_STATUS.TRACKING],
  [TRANSACTION_STATUS.TRACKING]:           [TRANSACTION_STATUS.COMPLETED],
  [TRANSACTION_STATUS.PAYMENT_CANCELLED]:  [],
  [TRANSACTION_STATUS.COMPLETED]:          [],
};

class TransactionEngine {
  constructor(options = {}) {
    this._bus = options.bus || bus;
    this._auditLog = options.auditLog || new TransactionAuditLog();
    
    // Projections (Rebuilt via replay. Persistence handled by ledger.append via bus)
    this._transactions = new Map();
    this._idempotencyKeys = new Map();
    
    // Subscribe to rebuild events in real-time
    this._bus.subscribe('kernel.transaction.created', (envelope) => this._applyEvent(envelope));
    this._bus.subscribe('kernel.transaction.state_changed', (envelope) => this._applyEvent(envelope));
  }

  /**
   * REBUILD PROJECTION FROM LEDGER
   * Replays all transaction events to rebuild the in-memory state.
   */
  rebuildFromLedger() {
    this._transactions.clear();
    this._idempotencyKeys.clear();
    
    const events = ledger.readAll();
    for (const envelope of events) {
      if (envelope.event_type.startsWith('kernel.transaction.')) {
        this._applyEvent(envelope);
      }
    }
  }

  /**
   * Internal projection logic: applies an event to the local in-memory Map
   */
  _applyEvent(envelope) {
    const payload = envelope.payload || {};
    
    if (envelope.event_type === 'kernel.transaction.created') {
      this._transactions.set(payload.transaction_id, { ...payload });
      if (payload.idempotency_key) {
        this._idempotencyKeys.set(payload.idempotency_key, payload.transaction_id);
      }
    } else if (envelope.event_type === 'kernel.transaction.state_changed') {
      const tx = this._transactions.get(payload.transaction_id);
      if (tx) {
        tx.status = payload.status;
        tx.updated_at = payload.updated_at;
        tx.retry_count = payload.retry_count;
      }
    }
  }

  /**
   * Create a new transaction.
   */
  create(params) {
    const {
      goalId,
      provider,
      amount,
      currency = 'INR',
      entityType = 'unknown',
      paymentRequired = true,
    } = params;

    const idempotencyKey = params.idempotencyKey || `${goalId}_${provider}_${amount}`;
    if (this._idempotencyKeys.has(idempotencyKey)) {
      const existingId = this._idempotencyKeys.get(idempotencyKey);
      const existing = this._transactions.get(existingId);
      return existing;
    }

    const transactionId = `txn_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const transactionPayload = {
      abi: ABI_VERSION,
      transaction_id: transactionId,
      idempotency_key: idempotencyKey,
      goal_id: goalId,
      provider,
      status: TRANSACTION_STATUS.PENDING,
      amount,
      currency,
      entity_type: entityType,
      payment_required: paymentRequired,
      created_at: now,
      updated_at: now,
      retry_count: 0,
    };

    // We no longer set the Map directly here. We publish to the bus.
    // The bus will append to the ledger, then emit back, which triggers _applyEvent.
    this._bus.publish('kernel.transaction.created', transactionPayload, {
      correlationId: transactionId
    });

    this._auditLog.append(transactionId, 'CREATED', { provider, amount, entityType });

    // Since pub/sub is synchronous in EventEmitter, this._transactions will have it now
    return this._transactions.get(transactionId) || transactionPayload;
  }

  /**
   * Transition a transaction to a new status.
   */
  transition(transactionId, newStatus, metadata = {}) {
    const tx = this._transactions.get(transactionId);
    if (!tx) throw new Error(`Transaction ${transactionId} not found`);

    const allowed = LEGAL_TRANSITIONS[tx.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal transition: ${tx.status} → ${newStatus} for transaction ${transactionId}`);
    }

    const payload = {
      transaction_id: transactionId,
      status: newStatus,
      updated_at: new Date().toISOString(),
      retry_count: newStatus === TRANSACTION_STATUS.PAYMENT_RETRYABLE ? tx.retry_count + 1 : tx.retry_count,
      metadata
    };

    // Emit event -> hits ledger -> emitted -> _applyEvent updates Map
    this._bus.publish('kernel.transaction.state_changed', payload, {
      correlationId: transactionId
    });

    this._auditLog.append(transactionId, `STATUS_CHANGED_TO_${newStatus}`, metadata);

    return this._transactions.get(transactionId);
  }

  /**
   * Get a transaction ABI by ID.
   */
  get(transactionId) {
    return this._transactions.get(transactionId) || null;
  }

  /**
   * Return the audit trail for a transaction.
   */
  auditTrail(transactionId) {
    return this._auditLog.forTransaction(transactionId);
  }
}

let _instance = null;
function getTransactionEngine(options = {}) {
  if (!_instance) {
    _instance = new TransactionEngine(options);
    // Boot: replay history to rebuild projection
    _instance.rebuildFromLedger();
  }
  return _instance;
}

module.exports = { TransactionEngine, TRANSACTION_STATUS, LEGAL_TRANSITIONS, getTransactionEngine };
