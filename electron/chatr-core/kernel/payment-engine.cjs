'use strict';

/**
 * CHATR Kernel — Payment Engine
 * Platform Milestone P1.4
 *
 * Separate from the Transaction Engine.
 * Responsible only for dispatching payment and returning confirmation.
 *
 * Supports:
 *   - UPI
 *   - Wallet
 *   - Credit/Debit Card (tokenized — raw PAN never stored here)
 *   - Cash on Delivery
 *   - Corporate Billing
 *   - Zero-payment transactions
 *
 * Security rules:
 *   - Raw card numbers, CVVs never enter this engine
 *   - Tokens come from a secure payment vault (future: PCI scope)
 *   - Payment results are passed back to TransactionEngine for state transitions
 *   - This engine never directly changes transaction status
 */

const PAYMENT_METHOD = Object.freeze({
  UPI: 'upi',
  WALLET: 'wallet',
  CARD: 'card',
  COD: 'cod',
  CORPORATE: 'corporate',
  ZERO: 'zero_payment',
});

class PaymentEngine {
  constructor(options = {}) {
    this._bus = options.bus;
  }

  /**
   * Dispatch a payment for a transaction.
   * Returns a payment result — never includes raw credentials.
   *
   * @param {object} params
   * @param {string} params.transactionId
   * @param {number} params.amount
   * @param {string} params.currency
   * @param {string} params.method  One of PAYMENT_METHOD
   * @param {object} params.paymentToken  Tokenized reference (not raw card data)
   */
  async dispatch(params) {
    const { transactionId, amount, currency = 'INR', method, paymentToken } = params;
    const startTime = Date.now();

    if (this._bus) {
      this._bus.publish('kernel.payment.dispatched', { transactionId, method, amount });
    }

    // Zero-payment (e.g., COD or free items) — instant confirmation
    if (method === PAYMENT_METHOD.COD || method === PAYMENT_METHOD.ZERO) {
      return this._buildResult(transactionId, 'CONFIRMED', method, amount, currency, Date.now() - startTime, 'No payment required at dispatch');
    }

    // UPI / Wallet — simulate async payment gateway response
    // In production: call the real UPI intent or payment gateway SDK
    try {
      await new Promise(resolve => setTimeout(resolve, 180)); // Simulate gateway RTT

      // Simulate a 95% success rate for POC
      if (Math.random() < 0.95) {
        const ref = `pay_${Date.now()}`;
        return this._buildResult(transactionId, 'CONFIRMED', method, amount, currency, Date.now() - startTime, ref);
      } else {
        return this._buildResult(transactionId, 'RETRYABLE', method, amount, currency, Date.now() - startTime, 'Gateway timeout — retryable');
      }
    } catch (err) {
      return this._buildResult(transactionId, 'FAILED', method, amount, currency, Date.now() - startTime, err.message);
    }
  }

  _buildResult(transactionId, outcome, method, amount, currency, latencyMs, reference) {
    return {
      transaction_id: transactionId,
      outcome,  // 'CONFIRMED' | 'RETRYABLE' | 'FAILED'
      method,
      amount,
      currency,
      latency_ms: latencyMs,
      reference,  // Gateway reference ID or error description — never raw PAN/CVV
      processed_at: new Date().toISOString(),
    };
  }
}

module.exports = { PaymentEngine, PAYMENT_METHOD };
