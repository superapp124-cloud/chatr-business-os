'use strict';

const { BaseConnector }  = require('../base-connector.cjs');
const { BrowserRuntime } = require('../../browser-runtime/browser-runtime.cjs');
const { ManifestLoader } = require('../../browser-runtime/manifest-loader.cjs');
const { FAILURE_TYPE }   = require('../../browser-runtime/failure-classifier.cjs');

/**
 * IRCTC Connector v2
 * Sprint 2 — Maturity: Experimental (Gate 1)
 *
 * Fundamentally different from ZomatoConnector:
 *   - Multi-step search forms (not a URL query)
 *   - Stateful navigation (form → results → seat selection)
 *   - CAPTCHA detection → Human Assist fallback
 *   - Seat availability states (AVAILABLE / WL / RAC)
 *   - Multi-page checkout workflow
 *
 * Demonstrates: same BrowserRuntime, same ManifestLoader, same BaseConnector interface,
 * same frozen kernel — different provider, different domain, zero architectural changes.
 */

const REALITY_LEVEL     = 2;
const MATURITY          = 'experimental';
const CONNECTOR_VERSION = '2.0';

class IRCTCConnector extends BaseConnector {
  constructor(options = {}) {
    super('irctc', CONNECTOR_VERSION);
    this._bus     = options.bus;
    this._loader  = new ManifestLoader();
    this._runtimeOptions = options.runtimeOptions || { mode: 'synthetic' };
  }

  capabilities() {
    return ['DISCOVER', 'FETCH_SCHEDULE', 'AUTHENTICATE', 'CHECKOUT', 'TRACK'];
  }

  sla() { return 600; } // IRCTC is slower than food delivery — honest SLA

  realityLevel() { return REALITY_LEVEL; }

  maturity() { return MATURITY; }

  async health() { return 'healthy'; }

  // ─── Execution Mode Selector ──────────────────────────────────────────────

  _selectMode() {
    return 'browser'; // Phase 1: BrowserRuntime always
  }

  _getRuntime(fixture = null) {
    return new BrowserRuntime({
      ...this._runtimeOptions,
      bus: this._bus,
      fixture,
    });
  }

  // ─── Relevance check ─────────────────────────────────────────────────────

  _isRelevantQuery(context) {
    if (!context) return false;
    const lower = context.toLowerCase();
    return lower.includes('train') || lower.includes('rail') || lower.includes('irctc')
      || lower.includes('ticket') || lower.includes('journey');
  }

  // ─── discover ─────────────────────────────────────────────────────────────

  async discover(context) {
    if (!this._isRelevantQuery(context)) return [];
    return this._discoverViaBrowser(context);
  }

  async _discoverViaBrowser(context) {
    const { manifest } = this._loader.load('irctc');
    const flow = manifest.flows.discover_trains;

    // Build a fixture that simulates multi-step form results
    const fixture = this._buildDiscoveryFixture();
    const rt = this._getRuntime(fixture);

    const vars = {
      origin: this._extractOrigin(context),
      destination: this._extractDestination(context),
    };

    // Multi-step form execution — fundamentally different from Zomato's single-page discovery
    await rt.navigate(flow[0].url, {});
    await rt.observe(flow[1].selector);
    await rt.act(flow[2].action, flow[2].target);
    await rt.act(flow[3].action, flow[3].target, vars.origin);
    await rt.observe(flow[4].selector);
    await rt.act(flow[5].action, flow[5].target);    // Select autocomplete
    await rt.act(flow[6].action, flow[6].target);    // Click dest field
    await rt.act(flow[7].action, flow[7].target, vars.destination);
    await rt.observe(flow[8].selector);
    await rt.act(flow[9].action, flow[9].target);    // Select dest
    await rt.act(flow[10].action, flow[10].target);  // Submit form
    await rt.observe(flow[11].selector, flow[11].timeout_ms);

    const extracted = await rt.extract(flow[12].selector, flow[12].schema);
    await rt.verify(flow[13].condition, extracted);

    return extracted.items.map((item, i) => ({
      id: `irctc_train_${i}`,
      name: item.train_name || item.train_number || `Train ${i + 1}`,
      price: this._parsePrice(item.price),
      rating: 4.2,  // IRCTC trains don't have user ratings — use reliability score
      eta: 0,        // For trains, eta means nothing; travel_time is in the title
      fee: 0,
      offers: item.availability ? [`Status: ${item.availability}`] : [],
      confidence: extracted.confidence,
      source: 'browser_runtime',
      metadata: {
        train_number: item.train_number,
        departure:    item.departure,
        arrival:      item.arrival,
        duration:     item.duration,
        availability: item.availability,
      },
    }));
  }

  // ─── fetch ────────────────────────────────────────────────────────────────

  async fetch(entityId) {
    const fixture = {
      '.quota-availability': [
        { '.quota-name': 'GENERAL', '.available-count': '42', '.class-name': 'SL', '.total-fare': '₹395' },
        { '.quota-name': 'TATKAL',  '.available-count': '8',  '.class-name': 'SL', '.total-fare': '₹780' },
      ],
      '.AVAILABLE': [{}],
    };
    const { manifest } = this._loader.load('irctc');
    const rt = this._getRuntime(fixture);

    await rt.observe(manifest.flows.check_seat_availability[0].selector);
    const seats = await rt.extract(
      manifest.flows.check_seat_availability[1].selector,
      manifest.flows.check_seat_availability[1].schema
    );
    await rt.verify(manifest.flows.check_seat_availability[2].condition, seats);

    return { entity_id: entityId, quotas: seats.items, confidence: seats.confidence };
  }

  // ─── authenticate ─────────────────────────────────────────────────────────

  async authenticate(credentials = {}) {
    const { manifest } = this._loader.load('irctc');
    const flow = manifest.flows.authenticate;

    const loginSel   = flow[1].selector;
    const captchaSel = flow[3].selector;
    // No captcha in synthetic mode
    const fixture = { [loginSel]: [{}] };
    const rt = this._getRuntime(fixture);

    await rt.navigate(flow[0].url, {});
    await rt.observe(loginSel);
    await rt.act(flow[2].action, flow[2].target);

    // CAPTCHA detection — unique to IRCTC, absent in Zomato
    // If detected: classify as AUTH_REQUIRED and fall back to Human Assist
    let captchaDetected = false;
    try {
      await rt.observe(captchaSel, 100);
      captchaDetected = true;
    } catch {
      // No captcha — proceed normally
    }

    if (captchaDetected) {
      // Structured failure proposal — Human Assist recovery
      return {
        authenticated: false,
        session_evidence: null,
        captcha_required: true,
        recovery_suggestion: 'human_assist',
        provider: 'irctc',
      };
    }

    const evidence = await rt.extractSessionEvidence();
    return {
      authenticated: evidence.authenticated,
      session_evidence: evidence,
      captcha_required: false,
      provider: 'irctc',
      extracted_at: new Date().toISOString(),
    };
  }

  // ─── checkout ─────────────────────────────────────────────────────────────

  async checkout(cart) {
    // Multi-page checkout — IRCTC requires passenger details, berth preference, etc.
    return {
      provider: 'irctc',
      cart,
      checkout_initiated: true,
      requires_payment: true,
      requires_passenger_details: true,  // Domain-specific metadata, not kernel state
      payment_methods: ['upi', 'card', 'irctc_wallet'],
      estimated_total: cart.fare ?? 0,
    };
  }

  // ─── track ────────────────────────────────────────────────────────────────

  async track(orderId) {
    return {
      order_id: orderId,
      provider: 'irctc',
      status: 'ORDER_PLACED',
      pnr: `PNR${Date.now().toString().slice(-8)}`,
      train_number: '12301',
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  _extractOrigin(context) {
    if (context.toLowerCase().includes('delhi')) return 'NDLS';
    if (context.toLowerCase().includes('mumbai')) return 'CSMT';
    return 'NDLS';
  }

  _extractDestination(context) {
    if (context.toLowerCase().includes('mumbai')) return 'CSMT';
    if (context.toLowerCase().includes('chennai')) return 'MAS';
    if (context.toLowerCase().includes('bangalore') || context.toLowerCase().includes('bengaluru')) return 'SBC';
    return 'MAS';
  }

  _parsePrice(raw) {
    if (!raw) return 0;
    const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  _buildDiscoveryFixture() {
    const formSelector    = 'input[placeholder=\'From Station\'], #origin';
    const autoSelector    = '.ui-autocomplete li, .ng-autocomplete-items li';
    const resultsSelector = '.train-list, .train-details, app-train-avl-enq';
    const extractSelector = '.train-list app-train-avl-enq, .train-details';

    return {
      [formSelector]:    [{}],
      [autoSelector]:    [{}],
      [resultsSelector]: [{}],
      [extractSelector]: [
        { '.trainNo': '12301', '.trainName': 'Rajdhani Express',  '.departTime': '06:00', '.arrivTime': '22:00', '.duration': '16h', '.AVAILABLE': 'AVAILABLE', '.fare': '₹1,250' },
        { '.trainNo': '12309', '.trainName': 'Shatabdi Express',  '.departTime': '07:15', '.arrivTime': '18:30', '.duration': '11h 15m', '.WL':  'WL-4',     '.fare': '₹980'  },
        { '.trainNo': '12951', '.trainName': 'Mumbai Rajdhani',   '.departTime': '17:00', '.arrivTime': '08:35', '.duration': '15h 35m', '.RAC': 'RAC-12',   '.fare': '₹1,195' },
      ],
      'input[placeholder=\'To Station\'], #destination': [{}],
      'button[type=\'submit\'], .search-btn, #search-train': [{}],
    };
  }
}

module.exports = { IRCTCConnector };
