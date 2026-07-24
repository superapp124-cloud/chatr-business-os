'use strict';

/**
 * CHATR Kernel — Provider Session Service
 * Platform Milestone P1.3
 *
 * The kernel's single authority for all provider session state.
 * Connectors execute authentication flows — they never own identity.
 *
 * Session State Machine:
 *
 *   UNKNOWN
 *     │
 *     ▼ checkSession()
 *   CHECKING
 *     │
 *     ├──(vault hit, valid)──► AUTHENTICATED
 *     │
 *     ├──(vault hit, expired)──► REFRESHING ──► AUTHENTICATED
 *     │                                    └──► LOGIN_REQUIRED
 *     │
 *     └──(no vault entry)──► LOGIN_REQUIRED
 *                                │
 *                                ▼ authenticate()
 *                           AUTHENTICATED
 *
 * ABI: chatr.provider_session.v0_9_rc
 */

const ABI_VERSION = 'chatr.provider_session.v0_9_rc';

// Session State constants
const SESSION_STATE = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  CHECKING: 'CHECKING',
  AUTHENTICATED: 'AUTHENTICATED',
  EXPIRED: 'EXPIRED',
  REFRESHING: 'REFRESHING',
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
});

class ProviderSessionService {
  constructor(options = {}) {
    this._vault = options.vault;
    this._bus = options.bus;
    // state: provider -> current SESSION_STATE
    this._states = new Map();
  }

  /**
   * Check session for a single provider.
   * Returns a chatr.provider_session.v0_9_rc object — no credentials.
   */
  async checkSession(provider) {
    this._setState(provider, SESSION_STATE.CHECKING);
    const startTime = Date.now();

    const entry = this._vault.read(provider);

    if (!entry.found) {
      this._setState(provider, SESSION_STATE.LOGIN_REQUIRED);
      return this._buildABI(provider, SESSION_STATE.LOGIN_REQUIRED, null, Date.now() - startTime);
    }

    if (entry.is_expired) {
      this._setState(provider, SESSION_STATE.EXPIRED);
      // Attempt silent refresh
      const refreshed = await this._refresh(provider, entry);
      if (refreshed) {
        this._setState(provider, SESSION_STATE.AUTHENTICATED);
        return this._buildABI(provider, SESSION_STATE.AUTHENTICATED, this._vault.read(provider), Date.now() - startTime, 'refresh');
      } else {
        this._setState(provider, SESSION_STATE.LOGIN_REQUIRED);
        return this._buildABI(provider, SESSION_STATE.LOGIN_REQUIRED, null, Date.now() - startTime);
      }
    }

    this._setState(provider, SESSION_STATE.AUTHENTICATED);
    return this._buildABI(provider, SESSION_STATE.AUTHENTICATED, entry, Date.now() - startTime);
  }

  /**
   * Validate all registered providers concurrently.
   * Used by Prediction Engine before user even selects a result.
   */
  async validateAll(providers) {
    const start = Date.now();
    const results = await Promise.all(
      providers.map(p => this.checkSession(p))
    );
    
    if (this._bus) {
      this._bus.publish('kernel.sessions.validated', {
        latencyMs: Date.now() - start,
        results: results.map(r => ({ provider: r.provider, status: r.status }))
      });
    }

    return results;
  }

  /**
   * Execute authentication for a provider.
   * Stores resulting credentials in Vault.
   * Connectors execute the flow — SessionService owns the result.
   */
  async authenticate(provider, connector, method = 'oauth') {
    try {
      // Connector executes the external auth flow and returns raw credentials
      const rawCredentials = await connector.authenticate({ method });

      // SessionService stores them — connector doesn't retain them
      this._vault.store(provider, {
        auth_method: method,
        access_token: rawCredentials.access_token,
        refresh_token: rawCredentials.refresh_token,
        expires_at: rawCredentials.expires_at,
      });

      this._setState(provider, SESSION_STATE.AUTHENTICATED);
      return this._buildABI(provider, SESSION_STATE.AUTHENTICATED, this._vault.read(provider), 0);
    } catch (err) {
      this._setState(provider, SESSION_STATE.LOGIN_REQUIRED);
      return this._buildABI(provider, SESSION_STATE.LOGIN_REQUIRED, null, 0);
    }
  }

  /**
   * Revoke a session immediately.
   */
  revoke(provider) {
    this._vault.revoke(provider);
    this._setState(provider, SESSION_STATE.UNKNOWN);
    if (this._bus) {
      this._bus.publish('kernel.session.revoked', { provider });
    }
  }

  /**
   * Get current state for a provider (non-async, from cache).
   */
  getState(provider) {
    return this._states.get(provider) || SESSION_STATE.UNKNOWN;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  async _refresh(provider, entry) {
    this._setState(provider, SESSION_STATE.REFRESHING);
    // In production: call connector's token refresh endpoint using _refresh_token
    // For P1.3 POC: simulate a successful refresh
    await new Promise(resolve => setTimeout(resolve, 50));

    const newExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const rotated = this._vault.rotate(
      provider,
      `tok_${provider}_refreshed_${Date.now()}`,
      null,
      newExpiry
    );
    return rotated;
  }

  _setState(provider, state) {
    this._states.set(provider, state);
    if (this._bus) {
      this._bus.publish('kernel.session.state_changed', { provider, state });
    }
  }

  /**
   * Build the frozen ABI object — only safe fields exposed.
   */
  _buildABI(provider, status, vaultEntry, latencyMs, source = 'check') {
    return {
      abi: ABI_VERSION,
      provider,
      status,
      auth_method: vaultEntry?.auth_method || null,
      expires_at: vaultEntry?.expires_at || null,
      last_verified: new Date().toISOString(),
      confidence: status === SESSION_STATE.AUTHENTICATED ? 1.0 : 0.0,
      latency_ms: latencyMs,
      source,
      // ─── NEVER include: access_token, refresh_token, cookies ───
    };
  }
}

let _instance = null;
function getProviderSessionService(options = {}) {
  if (!_instance) _instance = new ProviderSessionService(options);
  return _instance;
}

module.exports = { ProviderSessionService, SESSION_STATE, getProviderSessionService };
