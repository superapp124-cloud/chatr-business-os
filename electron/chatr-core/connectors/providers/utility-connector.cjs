'use strict';

const { BaseConnector } = require('../base-connector.cjs');

/**
 * Utility Connector
 * Covers electricity, gas, water, broadband, and mobile recharge.
 * Entity types: 'utility_bill'
 */
class UtilityConnector extends BaseConnector {
  constructor() {
    super('utility', '1.0');
  }

  capabilities() {
    return ['DISCOVER', 'FETCH_BILL', 'CHECKOUT'];
  }

  sla() { return 250; }

  async health() { return 'healthy'; }

  async discover(context) {
    const lower = (context || '').toLowerCase();
    const isUtility = lower.includes('electricity') || lower.includes('bill') || lower.includes('recharge');
    if (!isUtility) return [];

    await new Promise(resolve => setTimeout(resolve, 90));

    return [
      { id: 'bescom_001', title: 'BESCOM Electricity Bill', price: 1840, rating: 4.5, eta: 0, confidence: 0.99, due_date: '2026-07-25', account_number: 'XXXX-1234' },
      { id: 'bses_001', title: 'BSES Rajdhani Bill', price: 2100, rating: 4.4, eta: 0, confidence: 0.97, due_date: '2026-07-22', account_number: 'XXXX-5678' },
    ];
  }
}

module.exports = { UtilityConnector };
