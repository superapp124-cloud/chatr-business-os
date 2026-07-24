'use strict';

const { BaseConnector } = require('../base-connector.cjs');

/**
 * Passport Seva Connector
 * Covers passport renewal and appointment booking via Passport Seva Portal.
 * Entity types: 'government_service'
 */
class PassportSevaConnector extends BaseConnector {
  constructor() {
    super('passport_seva', '1.0');
  }

  capabilities() {
    return ['DISCOVER', 'FETCH_SLOTS', 'CHECKOUT'];
  }

  sla() { return 500; }

  async health() { return 'healthy'; }

  async discover(context) {
    const lower = (context || '').toLowerCase();
    const isPassport = lower.includes('passport') || lower.includes('renew');
    if (!isPassport) return [];

    await new Promise(resolve => setTimeout(resolve, 200));

    return [
      { id: 'psp_noida_1', title: 'Passport Seva Kendra — Noida', price: 1500, rating: 4.2, eta: 0, confidence: 0.98, appointment_date: '2026-07-30', slots_available: 6, service_type: 'Renewal (Normal)' },
      { id: 'psp_noida_tatkal', title: 'Passport Seva Kendra — Noida (Tatkal)', price: 3500, rating: 4.2, eta: 0, confidence: 0.98, appointment_date: '2026-07-22', slots_available: 2, service_type: 'Renewal (Tatkal)' },
    ];
  }
}

module.exports = { PassportSevaConnector };
