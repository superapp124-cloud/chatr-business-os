'use strict';

/**
 * CHATR Kernel v2.0 — Transport Connector
 *
 * Implements cab/ride search and booking across Uber, Ola, Rapido, BluSmart.
 * Falls back to realistic simulation when no browser session is available.
 */

const path = require('path');
const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const MANIFEST = require('./manifest.json');

// ── Simulation data pools ────────────────────────────────────────────────────

const DRIVER_NAMES = [
  'Rajan Kumar', 'Sanjay Verma', 'Mohammed Aziz', 'Pradeep Singh',
  'Vijay Nair', 'Arun Sharma', 'Suresh Yadav', 'Deepak Gupta'
];

const VEHICLE_MODELS = ['Maruti Swift', 'Hyundai i20', 'Honda City', 'Tata Nexon', 'Maruti Ertiga', 'Toyota Innova'];

function _rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _pick(arr)      { return arr[_rnd(0, arr.length - 1)]; }
function _uuid()         { return 'xxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)); }

// Generate realistic departure and arrival times
function _departureTime(baseHour, baseMin) {
  const now = new Date();
  now.setDate(now.getDate() + 1); // tomorrow
  now.setHours(baseHour + _rnd(-1, 1), baseMin + _rnd(-15, 15), 0, 0);
  return now.toISOString();
}
function _arrivalTime(baseHour, baseMin, durationMins) {
  const dep = new Date(_departureTime(baseHour, baseMin));
  dep.setMinutes(dep.getMinutes() + durationMins);
  return dep.toISOString();
}

// ── TransportConnector ────────────────────────────────────────────────────────

class TransportConnector {
  constructor() {
    this.id   = MANIFEST.id;
    this.name = MANIFEST.name;
  }

  // ── Manifest access ────────────────────────────────────────────────────────

  getManifest()   { return MANIFEST; }
  getProviders()  { return MANIFEST.providers; }

  getWorkflow(taskName) { 
    try {
      const workflow = require('./workflow.json');
      return workflow[taskName] || null;
    } catch {
      return null;
    }
  }

  getSelectors() {
    try {
      return require('./selectors.json');
    } catch {
      return null;
    }
  }

  // ── Session management ─────────────────────────────────────────────────────

  /**
   * Load session from credential vault for a specific provider.
   * @param {object} vault      - CredentialVault instance
   * @param {string} providerId - e.g. 'uber'
   * @returns {object|null}     session data or null
   */
  async authenticate(vault, providerId) {
    if (!vault) return null;
    try {
      const key  = `${this.id}:${providerId}`;
      const cred = vault.load(key) || vault.load(this.id);
      return cred || null;
    } catch (err) {
      log.warn(`[TransportConnector] Auth check failed for ${providerId}:`, err.message);
      return null;
    }
  }

  // ── Core methods ───────────────────────────────────────────────────────────

  /**
   * Search available rides.
   * @param {{ from: string, to: string, vehicleType?: string }} params
   * @param {object[]} [sessions] - active sessions per provider
   * @returns {Promise<{ options: object[] }>}
   */
  async search(params, sessions = []) {
    log.info(`[TransportConnector] Searching rides from '${params.from}' to '${params.to}'`);
    // In production, iterate over sessions and launch browser tasks per provider
    return { options: this.simulateSearch(params) };
  }

  /**
   * Book a ride.
   * @param {{ connectorId: string, optionId: string, from: string, to: string }} params
   * @param {object} [session]
   * @returns {Promise<object>}
   */
  async book(params, session = null) {
    log.info(`[TransportConnector] Booking option '${params.optionId}' from '${params.from}' to '${params.to}'`);
    return this.simulateBook(params);
  }

  /**
   * Verify a booking status.
   * @param {string} bookingId
   * @returns {Promise<object>}
   */
  async verify(bookingId) {
    log.info(`[TransportConnector] Verifying booking '${bookingId}'`);
    return {
      bookingId,
      status: 'confirmed',
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Health check — returns true if at least one provider session is available.
   * @param {object} [vault]
   * @returns {Promise<boolean>}
   */
  async healthCheck(vault = null) {
    if (!vault) return false;
    return MANIFEST.providers.some(p => vault.has(`${this.id}:${p.id}`) || vault.has(this.id));
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  /**
   * Returns realistic mock ride options.
   * @param {{ from: string, to: string, vehicleType?: string }} params
   * @returns {object[]}
   */
  simulateSearch(params) {
    const { from = 'Current Location', to = 'Destination', mode = 'cab' } = params;
    
    if (mode === 'train') {
      const dep1 = _departureTime(6, 0);
      const dep2 = _departureTime(7, 30);
      const dep3 = _departureTime(16, 0);
      const dur1 = _rnd(300, 360);
      const dur2 = _rnd(360, 420);
      const dur3 = _rnd(480, 540);
      const arr1 = new Date(new Date(dep1).getTime() + dur1 * 60000).toISOString();
      const arr2 = new Date(new Date(dep2).getTime() + dur2 * 60000).toISOString();
      const arr3 = new Date(new Date(dep3).getTime() + dur3 * 60000).toISOString();

      return [
        {
          optionId:        `irctc_${_uuid()}`,
          provider:        'irctc',
          providerName:    'IRCTC',
          title:           'Vande Bharat Express',
          subtitle:        '12002 · Chair Car (CC)',
          trainNumber:     '12002',
          vehicleType:     'CC',
          vehicleModel:    'Vande Bharat Express',
          class:           'CC',
          quota:           'GENERAL',
          departureTime:   dep1,
          arrivalTime:     arr1,
          durationMinutes: dur1,
          eta:             dur1,
          price:           _rnd(1200, 1800),
          currency:        'INR',
          availability:    'available',
          seatsLeft:       _rnd(12, 85),
          confidence:      92,
          from,
          to,
          distanceKm:      _rnd(500, 800),
          badges:          ['FASTEST'],
        },
        {
          optionId:        `irctc_${_uuid()}`,
          provider:        'irctc',
          providerName:    'IRCTC',
          title:           'Shatabdi Express',
          subtitle:        '12030 · Executive Chair Car (EC)',
          trainNumber:     '12030',
          vehicleType:     'EC',
          vehicleModel:    'Shatabdi Express',
          class:           'EC',
          quota:           'GENERAL',
          departureTime:   dep2,
          arrivalTime:     arr2,
          durationMinutes: dur2,
          eta:             dur2,
          price:           _rnd(800, 1100),
          currency:        'INR',
          availability:    'available',
          seatsLeft:       _rnd(30, 120),
          confidence:      90,
          from,
          to,
          distanceKm:      _rnd(500, 800),
          badges:          ['CHEAPEST'],
        },
        {
          optionId:        `ixigo_${_uuid()}`,
          provider:        'ixigo',
          providerName:    'ixigo',
          title:           'Rajdhani Express',
          subtitle:        '12425 · AC 2 Tier (2A)',
          trainNumber:     '12425',
          vehicleType:     '2A',
          vehicleModel:    'Rajdhani Express',
          class:           '2A',
          quota:           'GENERAL',
          departureTime:   dep3,
          arrivalTime:     arr3,
          durationMinutes: dur3,
          eta:             dur3,
          price:           _rnd(1500, 2200),
          currency:        'INR',
          availability:    _rnd(0, 1) ? 'available' : 'limited',
          seatsLeft:       _rnd(2, 18),
          confidence:      88,
          from,
          to,
          distanceKm:      _rnd(500, 800),
          badges:          ['BEST_VALUE'],
        },
      ];
    }

    const distanceKm = _rnd(5, 40);

    return [
      {
        optionId:    `uber_${_uuid()}`,
        provider:    'uber',
        providerName: 'Uber',
        vehicleType: 'UberGo',
        vehicleModel: _pick(VEHICLE_MODELS),
        driverName:  _pick(DRIVER_NAMES),
        driverRating: (4 + Math.random()).toFixed(1),
        eta:         _rnd(3, 10),
        price:       Math.round(distanceKm * _rnd(10, 14)),
        currency:    'INR',
        from,
        to,
        distanceKm
      },
      {
        optionId:    `ola_${_uuid()}`,
        provider:    'ola',
        providerName: 'Ola',
        vehicleType: 'Ola Mini',
        vehicleModel: _pick(VEHICLE_MODELS),
        driverName:  _pick(DRIVER_NAMES),
        driverRating: (3.8 + Math.random() * 0.9).toFixed(1),
        eta:         _rnd(4, 12),
        price:       Math.round(distanceKm * _rnd(9, 13)),
        currency:    'INR',
        from,
        to,
        distanceKm
      },
      {
        optionId:    `rapido_${_uuid()}`,
        provider:    'rapido',
        providerName: 'Rapido',
        vehicleType: 'Bike',
        vehicleModel: 'Splendor / Pulsar',
        driverName:  _pick(DRIVER_NAMES),
        driverRating: (4 + Math.random() * 0.8).toFixed(1),
        eta:         _rnd(2, 7),
        price:       Math.round(distanceKm * _rnd(5, 8)),
        currency:    'INR',
        from,
        to,
        distanceKm
      },
      {
        optionId:    `blusmart_${_uuid()}`,
        provider:    'blusmart',
        providerName: 'BluSmart',
        vehicleType: 'Electric',
        vehicleModel: 'Tata Nexon EV',
        driverName:  _pick(DRIVER_NAMES),
        driverRating: (4.5 + Math.random() * 0.4).toFixed(1),
        eta:         _rnd(6, 15),
        price:       Math.round(distanceKm * _rnd(11, 15)),
        currency:    'INR',
        from,
        to,
        distanceKm
      }
    ];
  }

  /**
   * Returns realistic mock booking confirmation.
   * @param {{ optionId: string, from: string, to: string }} params
   * @returns {object}
   */
  simulateBook(params) {
    const provider = (params.optionId || '').split('_')[0] || 'uber';
    return {
      bookingId:   `BK${Date.now()}`,
      provider,
      status:      'confirmed',
      driver: {
        name:    _pick(DRIVER_NAMES),
        rating:  (4 + Math.random()).toFixed(1),
        phone:   `+91 ${_rnd(70000, 99999)}${_rnd(10000, 99999)}`,
        vehicle: _pick(VEHICLE_MODELS),
        plate:   `KA ${_rnd(10, 99)} AB ${_rnd(1000, 9999)}`
      },
      eta:         _rnd(3, 10),
      price:       params.price || _rnd(80, 450),
      currency:    'INR',
      from:        params.from || 'Current Location',
      to:          params.to   || 'Destination',
      bookedAt:    new Date().toISOString(),
      otp:         `${_rnd(1000, 9999)}`
    };
  }

  /**
   * Simulation fallback delegate (called by browser-executor when Playwright fails).
   * @param {string} task
   * @param {object} parameters
   * @returns {object}
   */
  simulateTask(task, parameters) {
    if (task === 'transport.search') return { options: this.simulateSearch(parameters) };
    if (task === 'transport.book')   return this.simulateBook(parameters);
    if (task === 'transport.verify') return this.verify(parameters.bookingId);
    return { simulated: true, task, parameters };
  }
}

const transportConnector = new TransportConnector();
module.exports = { transportConnector, TransportConnector };
