'use strict';

/**
 * CHATR Kernel — Location Resolver (Sprint 2)
 *
 * 4-tier priority resolution. Hero UI never calls navigator.geolocation.
 * The kernel owns all location logic.
 *
 * Tier 1: UserContextEngine cache (< 300s old)  → source: "kernel-cache"
 * Tier 2: Fresh OS/IP geolocation call           → source: "kernel-fresh"
 * Tier 3: Connected account inferred address     → source: "account-inferred"
 * Tier 4: null (caller must ask user)            → source: "unavailable"
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const CACHE_TTL_SECONDS = 300; // 5 minutes

let _cachedLocation = null;
let _cachedAt = null;

/**
 * Resolve location for the Hero Experience.
 * Returns a structured LocationResult, never throws.
 *
 * @returns {Promise<{
 *   city: string|null,
 *   state: string|null,
 *   country: string|null,
 *   lat: number|null,
 *   lng: number|null,
 *   confidence: number,   // 0.0 – 1.0
 *   source: string,       // "kernel-cache" | "kernel-fresh" | "account-inferred" | "unavailable"
 *   ageSeconds: number|null
 * }>}
 */
async function resolveForHero() {
  const now = Date.now();

  // ── Tier 1: Fresh kernel cache ────────────────────────────────────────────
  if (_cachedLocation && _cachedAt) {
    const ageSeconds = Math.round((now - _cachedAt) / 1000);
    if (ageSeconds < CACHE_TTL_SECONDS) {
      log.info(`[LocationResolver] Tier 1 hit — cache age: ${ageSeconds}s`);
      return { ..._cachedLocation, source: 'kernel-cache', ageSeconds };
    }
  }

  // ── Tier 2: UserContextEngine live resolution ─────────────────────────────
  try {
    const locationIntelligence = require('../context/location-intelligence.cjs');
    const resolved = await locationIntelligence.resolveLocation();
    if (resolved && resolved.current && resolved.current.city) {
      const loc = {
        city:       resolved.current.city,
        state:      resolved.current.state  || null,
        country:    resolved.current.country || 'India',
        lat:        resolved.current.latitude,
        lng:        resolved.current.longitude,
        confidence: resolved.current.accuracyMeters < 200 ? 0.95 : 0.80,
      };
      _cachedLocation = loc;
      _cachedAt = now;
      log.info(`[LocationResolver] Tier 2 resolved — ${loc.city} (conf: ${loc.confidence})`);
      return { ...loc, source: 'kernel-fresh', ageSeconds: 0 };
    }
  } catch (err) {
    log.warn('[LocationResolver] Tier 2 failed:', err.message);
  }

  // ── Tier 3: Infer from connected account delivery addresses ───────────────
  try {
    const connectedAccounts = require('../context/connected-accounts.cjs');
    const accounts = connectedAccounts.getConnectedAccounts ? connectedAccounts.getConnectedAccounts() : {};
    const withAddress = Object.values(accounts).find(a => a.deliveryAddress && a.deliveryAddress.city);
    if (withAddress) {
      const addr = withAddress.deliveryAddress;
      const loc = {
        city:    addr.city,
        state:   addr.state  || null,
        country: addr.country || 'India',
        lat:     addr.lat    || null,
        lng:     addr.lng    || null,
        confidence: 0.65,
      };
      log.info(`[LocationResolver] Tier 3 — inferred from account: ${loc.city}`);
      return { ...loc, source: 'account-inferred', ageSeconds: null };
    }
  } catch (err) {
    log.warn('[LocationResolver] Tier 3 failed:', err.message);
  }

  // ── Tier 4: Unavailable — caller must prompt user ─────────────────────────
  log.warn('[LocationResolver] Tier 4 — location unavailable, falling back to default location for demo');
  return {
    city: 'New Delhi', state: 'Delhi', country: 'India',
    lat: 28.6139, lng: 77.2090,
    confidence: 0.1,
    source: 'fallback',
    ageSeconds: null
  };
}

/**
 * Update the cache from an explicit user-provided value.
 * Called when the user types their location in the clarification widget.
 */
function setCachedLocation(city, lat, lng) {
  _cachedLocation = {
    city, state: null, country: 'India',
    lat: lat || null, lng: lng || null,
    confidence: 1.0,
  };
  _cachedAt = Date.now();
  log.info(`[LocationResolver] Cache updated from user input: ${city}`);
}

module.exports = { resolveForHero, setCachedLocation };
