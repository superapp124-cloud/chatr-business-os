'use strict';

/**
 * CHATR Kernel v2.0 — API Executor
 *
 * Executes capability tasks via direct HTTP API calls.
 * Handles authentication headers, request signing, and response normalisation.
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// Node 18+ has built-in fetch; older versions need node-fetch
let fetchFn;
try {
  fetchFn = global.fetch || require('node-fetch');
} catch {
  fetchFn = global.fetch;
}

class ApiExecutor {
  constructor() {
    this.name = 'ApiExecutor';
  }

  /**
   * Execute a task against an API connector.
   *
   * @param {object} connector     - Connector manifest or instance with apiBaseUrl
   * @param {object} credentials   - { type: 'api_key'|'oauth'|'bearer', data: string|object }
   * @param {string} task          - capability id e.g. 'transport.search'
   * @param {object} parameters    - capability input parameters
   * @returns {Promise<object>}    structured result
   */
  async execute(connector, credentials, task, parameters) {
    const baseUrl = (connector && (connector.apiBaseUrl || (connector.manifest && connector.manifest.apiBaseUrl))) || null;

    if (!baseUrl) {
      log.warn(`[ApiExecutor] No apiBaseUrl for connector '${connector && connector.id}' — cannot execute via API.`);
      throw new Error(`[ApiExecutor] No API base URL configured for this connector.`);
    }

    const headers = this._buildAuthHeaders(credentials);

    // Build endpoint from task name (convention: 'transport.search' → '/transport/search')
    const endpoint = '/' + task.replace('.', '/');
    const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;

    log.info(`[ApiExecutor] POST ${url}`);

    try {
      const response = await fetchFn(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body:    JSON.stringify(parameters),
        signal:  AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const json = await response.json();
      log.info(`[ApiExecutor] '${task}' succeeded.`);
      return { source: 'api', task, result: json };

    } catch (err) {
      log.error(`[ApiExecutor] Error calling '${url}':`, err.message);
      throw err;
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _buildAuthHeaders(credentials) {
    if (!credentials) return {};

    switch (credentials.type) {
      case 'api_key':
        return { 'X-API-Key': credentials.data };

      case 'oauth':
      case 'bearer': {
        const token = typeof credentials.data === 'string'
          ? credentials.data
          : credentials.data && credentials.data.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      }

      case 'basic': {
        const { username, password } = credentials.data || {};
        if (username && password) {
          const encoded = Buffer.from(`${username}:${password}`).toString('base64');
          return { Authorization: `Basic ${encoded}` };
        }
        return {};
      }

      default:
        return {};
    }
  }
}

const apiExecutor = new ApiExecutor();
module.exports = { apiExecutor, ApiExecutor };
