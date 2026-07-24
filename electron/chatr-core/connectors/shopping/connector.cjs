'use strict';

/**
 * CHATR Kernel v2.0 — Shopping Connector
 *
 * Implements shopping search and purchase across mock providers.
 */

const MANIFEST = require('./manifest.json');

function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _uuid()         { return 'xxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)); }
function _pick(arr)      { return arr[_rnd(0, arr.length - 1)]; }

class ShoppingConnector {
  constructor() {
    this.id   = MANIFEST.id;
    this.name = MANIFEST.name;
  }

  getManifest()   { return MANIFEST; }
  getProviders()  { return MANIFEST.providers; }

  async search(params) {
    return { options: this.simulateSearch(params) };
  }

  async purchase(params) {
    return this.simulatePurchase(params);
  }

  simulateSearch(params) {
    const category = params.category || 'general';
    if (category === 'grocery' || category === 'groceries') {
      return [
        {
          optionId: `zepto_${_uuid()}`,
          provider: 'zepto',
          providerName: 'Zepto',
          title: 'Weekly Grocery Essentials',
          subtitle: 'Delivered in 10 minutes',
          eta: 10,
          price: _rnd(500, 1500),
          currency: 'INR',
          availability: 'available',
          confidence: 95,
          badges: ['FASTEST']
        },
        {
          optionId: `instamart_${_uuid()}`,
          provider: 'instamart',
          providerName: 'Instamart',
          title: 'Assorted Groceries',
          subtitle: 'Delivered in 15 minutes',
          eta: 15,
          price: _rnd(600, 1600),
          currency: 'INR',
          availability: 'available',
          confidence: 92,
          badges: []
        }
      ];
    }
    return [
      {
        optionId: `amazon_${_uuid()}`,
        provider: 'amazon',
        providerName: 'Amazon',
        title: 'Generic Product',
        subtitle: 'Delivered Tomorrow',
        eta: 1440,
        price: _rnd(100, 5000),
        currency: 'INR',
        availability: 'available',
        confidence: 90,
        badges: ['BEST_VALUE']
      }
    ];
  }

  simulatePurchase(params) {
    return {
      orderId: `ORD${Date.now()}`,
      status: 'confirmed',
      total: _rnd(500, 2500),
      currency: 'INR',
      orderedAt: new Date().toISOString()
    };
  }

  simulateTask(task, parameters) {
    if (task === 'shopping.search') return { options: this.simulateSearch(parameters) };
    if (task === 'shopping.purchase') return this.simulatePurchase(parameters);
    return { simulated: true, task, parameters };
  }
}

const shoppingConnector = new ShoppingConnector();
module.exports = { shoppingConnector, ShoppingConnector };
