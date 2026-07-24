'use strict';

/**
 * CHATR Kernel — Transaction Tracker
 * Platform Milestone P1.4
 *
 * Polls provider for live order status and emits updates via the event bus.
 * Works for food orders, flight check-in status, hotel confirmations, etc.
 * The kernel tracks; the UI only receives status strings.
 */

const TRACKING_STATUS = Object.freeze({
  ORDER_PLACED: 'ORDER_PLACED',
  PREPARING: 'PREPARING',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

class TransactionTracker {
  constructor(options = {}) {
    this._bus = options.bus;
    this._polls = new Map(); // transactionId -> interval handle
  }

  /**
   * Start tracking an order. Pushes status updates via the event bus.
   * @param {string} transactionId
   * @param {string} orderId  Provider-side order reference
   * @param {string} provider
   * @param {string} entityType  'restaurant_order' | 'flight_booking' | etc.
   */
  startTracking(transactionId, orderId, provider, entityType) {
    if (this._polls.has(transactionId)) return; // Already tracking

    let step = 0;
    const progressions = this._getProgressionFor(entityType);

    const tick = () => {
      if (step >= progressions.length) {
        this.stopTracking(transactionId);
        return;
      }

      const status = progressions[step++];
      if (this._bus) {
        this._bus.publish('kernel.transaction.tracking_updated', {
          transaction_id: transactionId,
          order_id: orderId,
          provider,
          status,
          updated_at: new Date().toISOString(),
        });
      }

      if (status === TRACKING_STATUS.DELIVERED || status === TRACKING_STATUS.CANCELLED) {
        this.stopTracking(transactionId);
      }
    };

    tick(); // Emit immediately
    const handle = setInterval(tick, 4000); // Poll every 4 seconds (simulation)
    this._polls.set(transactionId, handle);
  }

  stopTracking(transactionId) {
    const handle = this._polls.get(transactionId);
    if (handle) {
      clearInterval(handle);
      this._polls.delete(transactionId);
    }
  }

  stopAll() {
    for (const id of this._polls.keys()) {
      this.stopTracking(id);
    }
  }

  _getProgressionFor(entityType) {
    if (entityType === 'restaurant_order') {
      return [
        TRACKING_STATUS.ORDER_PLACED,
        TRACKING_STATUS.PREPARING,
        TRACKING_STATUS.OUT_FOR_DELIVERY,
        TRACKING_STATUS.DELIVERED,
      ];
    }
    // Hotel, flight, bills — simplified status
    return [TRACKING_STATUS.ORDER_PLACED, TRACKING_STATUS.DELIVERED];
  }
}

module.exports = { TransactionTracker, TRACKING_STATUS };
