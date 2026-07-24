'use strict';

/**
 * CHATR Kernel v2.0 — Food Connector
 *
 * Implements food delivery search and ordering via Swiggy & Zomato.
 * Realistic simulation with restaurants, ratings, and ETAs.
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const MANIFEST = require('./manifest.json');

// ── Simulation data pools ────────────────────────────────────────────────────

const RESTAURANTS = {
  default: [
    { name: 'Biryani Blues', cuisine: 'North Indian, Biryani', rating: 4.3, deliveryTime: 35, minOrder: 149, priceForTwo: 450 },
    { name: 'Pizza Hut',     cuisine: 'Italian, Pizza',        rating: 4.1, deliveryTime: 40, minOrder: 199, priceForTwo: 600 },
    { name: 'Burger King',   cuisine: 'American, Burgers',     rating: 4.2, deliveryTime: 25, minOrder: 99,  priceForTwo: 350 },
    { name: 'Mainland China', cuisine: 'Chinese, Pan-Asian',   rating: 4.4, deliveryTime: 45, minOrder: 250, priceForTwo: 800 },
    { name: 'Saravana Bhavan', cuisine: 'South Indian',        rating: 4.5, deliveryTime: 30, minOrder: 100, priceForTwo: 300 },
    { name: 'Haldirams',     cuisine: 'North Indian, Sweets',  rating: 4.3, deliveryTime: 20, minOrder: 149, priceForTwo: 400 }
  ],
  pizza: [
    { name: 'Dominos Pizza', cuisine: 'Pizza, Italian',        rating: 4.2, deliveryTime: 30, minOrder: 199, priceForTwo: 500 },
    { name: 'Pizza Hut',     cuisine: 'Italian, Pizza',        rating: 4.1, deliveryTime: 35, minOrder: 199, priceForTwo: 600 },
    { name: 'La Pino\'z',   cuisine: 'Pizza, Italian',        rating: 4.0, deliveryTime: 40, minOrder: 149, priceForTwo: 450 }
  ],
  biryani: [
    { name: 'Biryani Blues',     cuisine: 'Biryani, Mughlai',  rating: 4.3, deliveryTime: 35, minOrder: 149, priceForTwo: 450 },
    { name: 'Paradise Biryani',  cuisine: 'Hyderabadi, Biryani', rating: 4.4, deliveryTime: 40, minOrder: 149, priceForTwo: 500 },
    { name: 'Behrouz Biryani',   cuisine: 'Biryani, Mughlai',  rating: 4.5, deliveryTime: 45, minOrder: 199, priceForTwo: 600 }
  ],
  chinese: [
    { name: 'Mainland China', cuisine: 'Chinese, Pan-Asian',   rating: 4.4, deliveryTime: 45, minOrder: 250, priceForTwo: 800 },
    { name: 'Yo! China',      cuisine: 'Chinese',              rating: 4.0, deliveryTime: 35, minOrder: 199, priceForTwo: 550 },
    { name: 'Wok Express',    cuisine: 'Chinese, Thai',        rating: 4.2, deliveryTime: 30, minOrder: 149, priceForTwo: 450 }
  ],
  'south indian': [
    { name: 'Saravana Bhavan', cuisine: 'South Indian',        rating: 4.5, deliveryTime: 30, minOrder: 100, priceForTwo: 300 },
    { name: 'Dosa Plaza',      cuisine: 'South Indian',        rating: 4.1, deliveryTime: 25, minOrder: 99,  priceForTwo: 250 },
    { name: 'Udupi Palace',    cuisine: 'South Indian',        rating: 4.3, deliveryTime: 35, minOrder: 99,  priceForTwo: 280 }
  ]
};

const PROVIDERS = ['swiggy', 'zomato'];

function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _uuid()        { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

class FoodConnector {
  constructor() {
    this.id   = MANIFEST.id;
    this.name = MANIFEST.name;
  }

  getManifest()  { return MANIFEST; }
  getProviders() { return MANIFEST.providers; }

  /**
   * Search for food delivery restaurants.
   * @param {{ location: string, cuisine?: string }} params
   * @returns {Promise<{ restaurants: object[] }>}
   */
  async search(params) {
    log.info(`[FoodConnector] Searching restaurants near '${params.location}' cuisine='${params.cuisine || 'any'}'`);
    return { options: this.simulateSearch(params) };
  }

  /**
   * Place a food order.
   * @param {{ restaurantId: string, items: object[] }} params
   * @param {object} [session]
   * @returns {Promise<object>}
   */
  async order(params, session = null) {
    log.info(`[FoodConnector] Placing order at restaurant '${params.restaurantId}'`);
    return this.simulateOrder(params);
  }

  /**
   * Generate realistic restaurant results.
   * @param {{ location: string, cuisine?: string }} params
   * @returns {object[]}
   */
  simulateSearch(params) {
    const cuisineKey  = (params.cuisine || '').toLowerCase();
    const pool        = RESTAURANTS[cuisineKey] || RESTAURANTS.default;
    const provider    = PROVIDERS[_rnd(0, 1)];

    return pool.map((r, i) => {
      const eta = r.deliveryTime + _rnd(-5, 10);
      return {
        optionId:      `${provider}_rest_${_uuid()}`,
        provider,
        providerName:  provider === 'swiggy' ? 'Swiggy' : 'Zomato',
        title:         r.name,
        subtitle:      `${r.cuisine} · ⭐ ${r.rating}`,
        price:         r.priceForTwo,
        currency:      'INR',
        eta:           eta,
        durationMinutes: eta,
        availability:  'available',
        confidence:    _rnd(85, 99),
        badges:        i === 0 ? ['BEST_VALUE'] : i === 1 ? ['FASTEST'] : [],
        
        // Original fields for internal processing
        restaurantId:  `${provider}_rest_${_uuid()}`,
        name:          r.name,
        cuisine:       r.cuisine,
        rating:        r.rating,
        reviewCount:   _rnd(200, 5000),
        deliveryTime:  eta,
        minOrder:      r.minOrder,
        priceForTwo:   r.priceForTwo,
        deliveryFee:   _rnd(20, 50),
        offer:         i === 0 ? `${_rnd(10, 30)}% off on first order` : null,
        veg:           Math.random() > 0.5,
        open:          true,
      };
    });
  }

  /**
   * Generate realistic order confirmation.
   * @param {{ restaurantId: string, items: object[] }} params
   * @returns {object}
   */
  simulateOrder(params) {
    const items   = params.items || [{ name: 'Combo Meal', qty: 1, price: 249 }];
    const subtotal = items.reduce((s, it) => s + (it.price || 249) * (it.qty || 1), 0);
    const tax     = Math.round(subtotal * 0.05);
    const delivery = _rnd(20, 50);

    return {
      orderId:      `ORD${Date.now()}`,
      restaurantId: params.restaurantId,
      status:       'confirmed',
      items,
      subtotal,
      tax,
      deliveryFee:  delivery,
      total:        subtotal + tax + delivery,
      currency:     'INR',
      eta:          _rnd(25, 50),
      placedAt:     new Date().toISOString(),
      trackingUrl:  `https://track.swiggy.com/order/${Date.now()}`
    };
  }

  simulateTask(task, parameters) {
    if (task === 'food.search') return { options: this.simulateSearch(parameters) };
    if (task === 'food.order')  return this.simulateOrder(parameters);
    return { simulated: true, task, parameters };
  }
}

const foodConnector = new FoodConnector();
module.exports = { foodConnector, FoodConnector };
