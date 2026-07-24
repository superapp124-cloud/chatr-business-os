'use strict';

const { BaseConnector } = require('../base-connector.cjs');

class MakeMyTripConnector extends BaseConnector {
  constructor() {
    super('makemytrip', '1.0');
  }

  capabilities() {
    return ['DISCOVER'];
  }

  sla() {
    return 400;
  }

  async health() {
    return 'healthy';
  }

  async discover(context) {
    if (!context || (!context.toLowerCase().includes('hotel') && !context.toLowerCase().includes('goa'))) {
      return []; 
    }

    await new Promise(resolve => setTimeout(resolve, 150));

    return [
      { id: 'taj_goa', title: 'Taj Exotica Resort & Spa', price: 15000, rating: 4.8, confidence: 0.96 },
      { id: 'w_goa', title: 'W Goa', price: 12500, rating: 4.5, confidence: 0.92 }
    ];
  }
}

module.exports = { MakeMyTripConnector };
