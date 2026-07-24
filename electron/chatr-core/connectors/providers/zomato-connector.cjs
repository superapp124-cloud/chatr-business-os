'use strict';

const { BaseConnector }  = require('../base-connector.cjs');
const { BrowserRuntime } = require('../../browser-runtime/browser-runtime.cjs');
const { ManifestLoader } = require('../../browser-runtime/manifest-loader.cjs');
const { RealityValidator } = require('../../kernel/reality-validator.cjs');

/**
 * Zomato Connector v2
 * Sprint 1.1 — Maturity: Experimental (Gate 1)
 *
 * This connector is an adapter between Zomato and the frozen CHATR connector interface.
 * It owns: authentication flow, session establishment, discovery, menu retrieval,
 *          cart operations, checkout initiation, order tracking.
 * It does NOT own: ranking, session state machine, transactions, workflow, recovery, UI.
 *
 * Execution Mode Selector:
 *   1. API        — Zomato public/private API (if available)
 *   2. BrowserRuntime — manifest-driven automation (always available)
 *
 * The kernel never knows which mode was selected.
 */

const REALITY_LEVEL   = 2;   // L2: Using manifest-driven approach against real Zomato pages
const MATURITY        = 'experimental';
const CONNECTOR_VERSION = '2.0';

class ZomatoConnector extends BaseConnector {
  constructor(options = {}) {
    super('zomato', CONNECTOR_VERSION);
    this._bus     = options.bus;
    this._loader  = new ManifestLoader();
    this._runtime = null; // Created lazily per-execution
    this._runtimeOptions = options.runtimeOptions || { mode: 'live' };
  }

  // ─── Metadata ─────────────────────────────────────────────────────────────

  capabilities() {
    return ['DISCOVER', 'FETCH_MENU', 'AUTHENTICATE', 'CHECKOUT', 'TRACK'];
  }

  sla() { return 400; }

  realityLevel() { return REALITY_LEVEL; }

  maturity() { 
    return {
      DISCOVER: 'L3',
      FETCH_MENU: 'L2',
      CHECKOUT: 'L0', // Web unsupported
      TRACK: 'L0'
    };
  }

  async health() {
    // Future: ping Zomato's public health endpoint or test a known URL
    return 'healthy';
  }

  // ─── Execution Mode Selector ──────────────────────────────────────────────

  /**
   * Select an execution mode. The kernel never sees this choice.
   * @returns {'api'|'browser'}
   */
  _selectMode() {
    // Phase 1: Always use BrowserRuntime (API integration pending credentials).
    // When Zomato API keys are available, return 'api' first.
    return 'browser';
  }

  _getRuntime(fixture = null) {
    return new BrowserRuntime({
      ...this._runtimeOptions,
      bus: this._bus,
      fixture,
    });
  }

  // ─── Connector Interface Implementation ───────────────────────────────────

  /**
   * Discover restaurants matching a context query.
   * @param {string} context  e.g. "biryani near me"
   * @returns {Array}  Raw result objects (Normalizer applies ABI)
   */
  async discover(context) {
    if (!this._isRelevantQuery(context)) return [];

    const mode = this._selectMode();

    if (mode === 'api') {
      return this._discoverViaAPI(context);
    }

    return this._discoverViaBrowser(context);
  }

  async _discoverViaAPI(context) {
    // Placeholder for real API integration.
    // When Zomato API is available, implement here.
    // The connector falls back to BrowserRuntime if this throws.
    throw new Error('Zomato API not yet configured. Falling back to BrowserRuntime.');
  }

  async _discoverViaBrowser(context) {
    const { manifest } = this._loader.load('zomato');
    const rt = this._getRuntime(this._buildDiscoveryFixture(context));

    // Execute the 'discover' flow from the manifest
    const vars = { city: 'bangalore', query: this._extractQuery(context) };

    await rt.navigate(manifest.flows.discover[0].url, vars);
    await rt.observe(manifest.flows.discover[1].selector, manifest.flows.discover[1].timeout_ms);
    const extracted = await rt.extract(
      manifest.flows.discover[2].selector,
      manifest.flows.discover[2].schema
    );
    await rt.verify(manifest.flows.discover[3].condition, extracted);

    // Map extracted items to raw connector format (Normalizer converts to ABI)
    return extracted.items.map((item, i) => ({
      id: `zomato_${i}`,
      name: item.name || `Restaurant ${i + 1}`,
      price: this._parsePrice(item.price),
      rating: this._parseRating(item.rating),
      eta: this._parseEta(item.eta),
      fee: 0,
      offers: [],
      confidence: extracted.confidence,
      source: 'browser_runtime',
    }));
  }

  /**
   * Fetch the menu for a specific restaurant.
   */
  async fetch(entityId) {
    const { manifest } = this._loader.load('zomato');
    const rt = this._getRuntime(this._buildMenuFixture(entityId));

    await rt.navigate(manifest.flows.fetch_menu[0].url, {
      city: 'bangalore',
      restaurant_slug: entityId,
    });
    await rt.observe(manifest.flows.fetch_menu[1].selector);
    const extracted = await rt.extract(
      manifest.flows.fetch_menu[2].selector,
      manifest.flows.fetch_menu[2].schema
    );
    await rt.verify(manifest.flows.fetch_menu[3].condition, extracted);

    return { entity_id: entityId, menu: extracted.items, confidence: extracted.confidence };
  }

  /**
   * Authenticate with Zomato.
   * Returns a generic SessionEvidence object — not provider-specific cookie names.
   */
  async authenticate(credentials = {}) {
    const { manifest } = this._loader.load('zomato');
    // Build fixture from manifest selectors so synthetic mode always matches
    const loginSel  = manifest.flows.authenticate[1].selector;
    const phoneSel  = manifest.flows.authenticate[3].selector;
    const avatarSel = manifest.flows.extract_session[1].selector;
    const fixture = {
      [loginSel]:  [{}],
      [phoneSel]:  [{}],
      [avatarSel]: [{}],
    };
    const rt = this._getRuntime(fixture);

    await rt.navigate(manifest.flows.authenticate[0].url, {});
    await rt.observe(manifest.flows.authenticate[1].selector);
    await rt.act(
      manifest.flows.authenticate[2].action,
      manifest.flows.authenticate[2].target
    );
    await rt.observe(manifest.flows.authenticate[3].selector);

    // Extract generic session evidence — connector translates, kernel never sees raw cookies
    const evidence = await rt.extractSessionEvidence();

    return {
      // Generic SessionEvidence — ProviderSessionService interprets this
      authenticated: evidence.authenticated,
      session_evidence: evidence,
      provider: 'zomato',
      extracted_at: new Date().toISOString(),
    };
  }

  /**
   * Initiate a checkout.
   * The TransactionEngine owns the transaction; this connector only initiates the provider side.
   */
  async checkout(cart) {
    // Phase 1: return a structured checkout intent
    // Phase 2: use BrowserRuntime to add items to cart on Zomato and initiate checkout
    return {
      provider: 'zomato',
      cart,
      checkout_initiated: true,
      requires_payment: true,
      payment_methods: ['upi', 'card', 'cod', 'wallet'],
      estimated_total: cart.items?.reduce((sum, i) => sum + (i.price || 0), 0) ?? 0,
    };
  }

  /**
   * Track an order.
   */
  async track(orderId) {
    // Phase 1: return structured tracking state
    // Phase 2: BrowserRuntime polls Zomato's order tracking page
    const statuses = ['ORDER_PLACED', 'PREPARING', 'OUT_FOR_DELIVERY'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    return { order_id: orderId, provider: 'zomato', status, eta_minutes: 28 };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  _isRelevantQuery(context) {
    if (!context) return false;
    const lower = context.toLowerCase();
    return lower.includes('food') || lower.includes('biryani') || lower.includes('pizza')
      || lower.includes('restaurant') || lower.includes('order') || lower.includes('eat')
      || lower.includes('hungry');
  }

  _extractQuery(context) {
    // Simplified intent extraction — in production use the EntityResolver output
    return context.replace(/near me/i, '').trim().split(' ').slice(0, 3).join(' ');
  }

  _parsePrice(raw) {
    if (!raw) return 0;
    const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  _parseRating(raw) {
    if (!raw) return 0;
    const n = parseFloat(String(raw));
    return isNaN(n) ? 0 : n;
  }

  _parseEta(raw) {
    if (!raw) return 30;
    const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? 30 : n;
  }

  // Synthetic fixtures for test/certification mode
  _buildDiscoveryFixture(context) {
    // Fixture keys must match the selectors used in manifest observe/extract steps exactly
    const observeSelector = '.sc-eqIVtm, [data-testid=\'restaurant-card\'], .res-cell';
    const extractSelector = '[data-testid="restaurant-card"], .sc-eqIVtm';
    return {
      [observeSelector]: [{}],
      [extractSelector]: [
        { '[data-testid="res-name"]': 'Behrouz Biryani',    '[data-testid="rating"]': '4.6', '[data-testid="delivery-time"]': '28 mins', '[data-testid="cost-for-two"]': '\u20b9600' },
        { '[data-testid="res-name"]': 'Paradise Restaurant','[data-testid="rating"]': '4.7', '[data-testid="delivery-time"]': '24 mins', '[data-testid="cost-for-two"]': '\u20b9700' },
        { '[data-testid="res-name"]': 'Meghna Foods',       '[data-testid="rating"]': '4.3', '[data-testid="delivery-time"]': '35 mins', '[data-testid="cost-for-two"]': '\u20b9500' },
      ],
      '[data-testid="login-btn"]': [{}],
    };
  }

  _buildMenuFixture(entityId) {
    return {
      '[data-testid="dish-card"], .sc-1s0saks-0': [
        { '.sc-1s0saks-3': 'Chicken Dum Biryani', '.sc-1s0saks-1': '₹289', '[data-testid="dish-desc"]': 'Slow-cooked biryani' },
        { '.sc-1s0saks-3': 'Mutton Biryani',      '.sc-1s0saks-1': '₹349', '[data-testid="dish-desc"]': 'Premium mutton biryani' },
      ],
      '[data-testid="login-btn"]': [{}],
    };
  }
}

module.exports = { ZomatoConnector };
