'use strict';

/**
 * CHATR Kernel v2.1 — Discovery Engine (Phase 5.1)
 *
 * Changes from v2.0:
 * - Reads declarative providers.json from category connectors
 * - Geographic filtering: country → region → mode → capability
 * - World Model preference integration
 * - Connector Store pipeline stub (local → remote → AI-generated)
 */

const path = require('path');
const fs   = require('fs');

let _app;
try { const { app } = require('electron'); _app = app; } catch {}

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const CORE_CONNECTORS_DIR = path.join(__dirname, '..', 'connectors');

class DiscoveryEngine {
  constructor() {
    /** @type {Map<string, object>} providerId -> provider descriptor */
    this._providers = new Map();
    this.dynamicConnectorsDir = _app
      ? path.join(_app.getPath('userData'), 'connectors')
      : path.join(__dirname, '..', '..', '..', 'data', 'connectors');
    this.reload();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Scan a directory for category connector folders.
   * Each folder may have manifest.json (for legacy) OR providers.json (for Phase 5.1+).
   */
  _scanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;

    let loaded = 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const folderPath = path.join(dirPath, entry.name);

      // Phase 5.1: declarative providers.json
      const providersPath = path.join(folderPath, 'providers.json');
      if (fs.existsSync(providersPath)) {
        try {
          const providers = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
          for (const provider of providers) {
            if (!provider.id) continue;
            this._providers.set(provider.id, provider);
            loaded++;
          }
          continue;
        } catch (err) {
          log.error(`[DiscoveryEngine] Failed to load providers.json at ${providersPath}:`, err.message);
        }
      }

      // Legacy: manifest.json (Phase 4 / single connector)
      const manifestPath = path.join(folderPath, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const id = manifest.id || entry.name;
          manifest.id = id;

          // Normalize legacy manifest to provider descriptor shape
          const provider = {
            id,
            name:               manifest.name || id,
            category:           manifest.category || entry.name,
            supports:           manifest.capabilities || [],
            modes:              manifest.modes || [],
            countries:          manifest.country || manifest.countries || [],
            regions:            manifest.regions || ['*'],
            requiresLogin:      manifest.authMethod !== 'none',
            authentication:     manifest.authMethod || 'browser-session',
            executionMethods:   manifest.executionMethods || ['browser', 'simulation'],
            permissions:        manifest.permissions || [],
            confidence:         manifest.confidence || 70,
            priority:           manifest.priority || 50,
            estimatedLatencyMs: manifest.estimatedLatencyMs || 3000,
            // Keep original manifest for backward-compat
            _legacyManifest: manifest,
          };

          this._providers.set(id, provider);
          loaded++;
        } catch (err) {
          log.error(`[DiscoveryEngine] Failed to load manifest at ${manifestPath}:`, err.message);
        }
      }
    }
    return loaded;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  reload() {
    this._providers.clear();
    const coreLoaded    = this._scanDirectory(CORE_CONNECTORS_DIR);
    const dynamicLoaded = this._scanDirectory(this.dynamicConnectorsDir);
    log.info(`[DiscoveryEngine] Reload: ${coreLoaded} core providers, ${dynamicLoaded} dynamic providers.`);
  }

  registerConnector(manifest) {
    if (!manifest?.id) throw new Error('[DiscoveryEngine] registerConnector: manifest must have an id field.');
    this._providers.set(manifest.id, manifest);
  }

  getConnectors() {
    return Array.from(this._providers.values());
  }

  /**
   * Geographic + capability + mode discovery with intelligent ranking.
   *
   * Filtering pipeline:
   *   1. country filter  (context.location.country)
   *   2. mode filter     (constraints.mode)
   *   3. capability filter (capabilityId)
   *   4. rank: auth → worldModel preference → priority → success rate → latency
   *
   * @param {string} capabilityId   e.g. 'transport.book'
   * @param {object} [context]      { credentialVault, executionMemory, location, constraints, worldModel }
   * @returns {Array}
   */
  discover(capabilityId, context = {}) {
    const vault       = context.credentialVault;
    const memory      = context.executionMemory;
    const worldModel  = context.worldModel;
    const userCountry = context.location?.country || null;
    const userRegion  = context.location?.region  || null;
    const mode        = context.constraints?.mode  || null;

    // World Model preferred connector
    let preferredConnectorId = null;
    if (worldModel) {
      try {
        const prefs = worldModel.getPreferences(capabilityId);
        preferredConnectorId = prefs?.preferredConnector?.value || null;
      } catch {}
    }

    const results = [];

    for (const provider of this._providers.values()) {
      const supports = provider.supports || provider.capabilities || [];

      // ① Capability filter
      if (!supports.includes(capabilityId)) continue;

      // ② Geographic filter — if provider declares countries, check match
      if (userCountry && provider.countries && provider.countries.length > 0) {
        const geoMatch = provider.countries.some(c => c === '*' || c === userCountry);
        if (!geoMatch) continue;
      }

      // ③ Mode filter — if constraint has a mode and provider declares modes
      if (mode && provider.modes && provider.modes.length > 0) {
        const modeMatch = provider.modes.some(m => m === '*' || m === mode);
        if (!modeMatch) continue;
      }

      // Check session availability
      let sessionAvailable = false;
      if (vault) {
        try { sessionAvailable = vault.has(provider.id); } catch {}
      }

      // Fetch execution stats from memory
      let stats = { successRate: provider.confidence || 50, avgLatency: provider.estimatedLatencyMs || 5000 };
      if (memory) {
        try {
          const stored = memory.getConnectorStats(provider.id);
          if (stored) stats = stored;
        } catch {}
      }

      results.push({
        connectorId: provider.id,
        manifest: provider._legacyManifest || provider,
        provider,
        sessionAvailable,
        stats,
        isPreferred: provider.id === preferredConnectorId,
      });
    }

    // ── Ranking ──────────────────────────────────────────────────────────────
    // auth → world model preference → declared priority → success rate → latency
    results.sort((a, b) => {
      // 1. Auth
      if (a.sessionAvailable && !b.sessionAvailable) return -1;
      if (!a.sessionAvailable && b.sessionAvailable) return 1;

      // 2. World Model preference (learned from user behaviour)
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;

      // 3. Declared priority
      const priorityDiff = (b.provider.priority || 50) - (a.provider.priority || 50);
      if (priorityDiff !== 0) return priorityDiff;

      // 4. Success Rate
      if (a.stats.successRate !== b.stats.successRate) {
        return b.stats.successRate - a.stats.successRate;
      }

      // 5. Latency
      return a.stats.avgLatency - b.stats.avgLatency;
    });

    // ── Explainability (Principle 9) ─────────────────────────────────────────
    // Attach human-readable reasons to the top-ranked connector
    if (results.length > 0) {
      const top = results[0];
      const reasons = [];

      if (top.isPreferred)              reasons.push('Preferred by you');
      if (top.sessionAvailable)         reasons.push('Already logged in');
      if (top.provider.priority >= 85)  reasons.push(`High reliability score (${top.provider.priority})`);
      if (top.stats.successRate >= 90)  reasons.push(`${top.stats.successRate}% success rate`);
      if (top.stats.avgLatency < 2000)  reasons.push(`Fast response (~${Math.round(top.stats.avgLatency)}ms)`);
      if (top.provider.cost === 'free') reasons.push('No additional cost');
      if (userCountry && top.provider.countries?.includes(userCountry)) reasons.push(`Available in your region`);
      if (mode && top.provider.modes?.includes(mode)) reasons.push(`Supports ${mode} bookings`);

      top.explanation = reasons.length > 0
        ? reasons
        : [`Best available connector for ${capabilityId}`];

      log.info(`[DiscoveryEngine] Top connector: '${top.connectorId}' — ${top.explanation.join(' · ')}`);
    }

    log.info(`[DiscoveryEngine] Discovered & ranked ${results.length} provider(s) for '${capabilityId}'${mode ? ` mode=${mode}` : ''}${userCountry ? ` country=${userCountry}` : ''}.`);
    return results;
  }
}

const discoveryEngine = new DiscoveryEngine();
module.exports = { discoveryEngine, DiscoveryEngine };
