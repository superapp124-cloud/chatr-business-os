'use strict';

/**
 * CHATR Kernel — Intent Session Manager (Phase 5.1)
 *
 * Parks partially-resolved intents that are awaiting user clarification.
 * When the user responds, the session is resumed and execution continues.
 *
 * Lifecycle:
 *   park(session)   → stores session, returns sessionId
 *   merge(id, text) → merges new user input into parked session
 *   get(id)         → retrieves session
 *   resolve(id)     → marks session complete, removes from store
 *   expire()        → cleans up sessions older than TTL_MS
 */

const crypto = require('crypto');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

const TTL_MS = 10 * 60 * 1000; // 10 minutes

class IntentSessionManager {
  constructor() {
    /** @type {Map<string, object>} sessionId -> session */
    this._sessions = new Map();

    // Run expiry check every 2 minutes
    setInterval(() => this.expire(), 2 * 60 * 1000);
  }

  /**
   * Park a partially-resolved intent.
   * @param {object} session { intent, intentText, resolved, missing, userContext, risk }
   * @returns {string} sessionId
   */
  park(session) {
    const sessionId = crypto.randomUUID();
    this._sessions.set(sessionId, {
      ...session,
      sessionId,
      parkedAt: Date.now(),
    });
    log.info(`[IntentSessionManager] Parked session '${sessionId}' for intent='${session.intent}' missing=[${session.missing.join(',')}]`);
    return sessionId;
  }

  /**
   * Merge new user-provided constraint text into the parked session.
   * Extracts any new constraint values from the follow-up text.
   * @param {string} sessionId
   * @param {string} followUpText
   * @returns {object|null} merged session or null if not found
   */
  merge(sessionId, followUpText) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      log.warn(`[IntentSessionManager] No session found for id='${sessionId}'`);
      return null;
    }

    // Merge follow-up text into combined intent context
    session.intentText = session.intentText + ' ' + followUpText;
    session.lastActivityAt = Date.now();

    log.info(`[IntentSessionManager] Merged follow-up into session '${sessionId}'`);
    this._sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get a session by ID.
   */
  get(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  /**
   * Mark session as resolved and remove it.
   */
  resolve(sessionId) {
    const existed = this._sessions.delete(sessionId);
    if (existed) log.info(`[IntentSessionManager] Resolved session '${sessionId}'`);
    return existed;
  }

  /**
   * Remove sessions older than TTL.
   */
  expire() {
    const now = Date.now();
    for (const [id, session] of this._sessions.entries()) {
      if (now - session.parkedAt > TTL_MS) {
        this._sessions.delete(id);
        log.info(`[IntentSessionManager] Expired session '${id}'`);
      }
    }
  }

  /**
   * Get the currently active session ID (most recent).
   * Used by IPC handler when no explicit sessionId is sent.
   * @returns {string|null}
   */
  getActiveSessionId() {
    let latest = null;
    let latestTime = 0;
    for (const [id, session] of this._sessions.entries()) {
      if (session.parkedAt > latestTime) {
        latestTime = session.parkedAt;
        latest = id;
      }
    }
    return latest;
  }
}

const intentSessionManager = new IntentSessionManager();
module.exports = { intentSessionManager, IntentSessionManager };
