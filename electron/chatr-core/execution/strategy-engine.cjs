'use strict';

/**
 * CHATR Kernel v2.0 — Strategy Engine
 *
 * Selects the optimal execution strategy for a capability + connector set.
 *
 * Priority order:
 *   1. Browser automation with a valid session (fastest real-world execution)
 *   2. API connector (direct REST/GraphQL, no browser overhead)
 *   3. Local executor (file system / local machine tasks)
 *   4. Simulation mode (no connector available — generate realistic mock data)
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class StrategyEngine {
  /**
   * Select the best execution strategy for the given capability and connector list.
   *
   * @param {string}  capabilityId
   * @param {Array}   connectors       - result from discoveryEngine.discover()
   * @param {object}  credentialVault  - vault instance for session checks
   * @returns {{ executor: string, connector: string|null, provider: string|null, reason: string }}
   */
  selectStrategy(capabilityId, connectors = [], credentialVault = null) {
    // ── (1) Browser session ───────────────────────────────────────────────
    for (const c of connectors) {
      if (c.sessionAvailable) {
        const bestProvider = c.providers && c.providers[0];
        log.info(`[StrategyEngine] '${capabilityId}' → browser (session available on '${c.connectorId}')`);
        return {
          executor:  'browser',
          connector: c.connectorId,
          provider:  bestProvider ? bestProvider.id : null,
          reason:    `Active browser session found for connector '${c.connectorId}'.`
        };
      }
    }

    // ── (2) API connector ─────────────────────────────────────────────────
    for (const c of connectors) {
      if (c.manifest && c.manifest.authMethod === 'api_key') {
        const creds = credentialVault ? credentialVault.load(c.connectorId) : null;
        if (creds && creds.type === 'api_key') {
          log.info(`[StrategyEngine] '${capabilityId}' → api (key available for '${c.connectorId}')`);
          return {
            executor:  'api',
            connector: c.connectorId,
            provider:  null,
            reason:    `API key available for connector '${c.connectorId}'.`
          };
        }
      }
    }

    // ── (3) Local executor ────────────────────────────────────────────────
    const localCapabilities = [
      'document.analyze',
      'background.schedule'
    ];

    if (localCapabilities.includes(capabilityId)) {
      log.info(`[StrategyEngine] '${capabilityId}' → local`);
      return {
        executor:  'local',
        connector: null,
        provider:  null,
        reason:    'Capability is handled natively on the local machine.'
      };
    }

    // ── (3.5) Anonymous Browser Session ───────────────────────────────────
    for (const c of connectors) {
      if (c.manifest && c.manifest.executionMethods && c.manifest.executionMethods.includes('browser')) {
        const bestProvider = c.providers && c.providers[0];
        log.info(`[StrategyEngine] '${capabilityId}' → browser (anonymous execution on '${c.connectorId}')`);
        return {
          executor:  'browser',
          connector: c.connectorId,
          provider:  bestProvider ? bestProvider.id : null,
          reason:    `Browser execution supported by '${c.connectorId}'.`
        };
      }
    }

    // ── (4) Simulation ────────────────────────────────────────────────────
    // Use first available connector for context (helps simulator return realistic data)
    const firstConnector = connectors.length > 0 ? connectors[0].connectorId : null;
    log.info(`[StrategyEngine] '${capabilityId}' → simulation (no active session or API key)`);
    return {
      executor:  'simulation',
      connector: firstConnector,
      provider:  null,
      reason:    'No active session or API credentials found. Running in simulation mode.'
    };
  }
}

const strategyEngine = new StrategyEngine();
module.exports = { strategyEngine, StrategyEngine };
