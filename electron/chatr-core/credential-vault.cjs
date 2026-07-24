'use strict';

/**
 * CHATR Kernel v2.0 — Credential Vault
 *
 * Unified credential store that supersedes token-vault.cjs.
 * Uses Electron's safeStorage for encryption at rest.
 * Falls back to AES-256 encryption using the machine's hostname as a key
 * when Electron is not available (e.g., in test environments).
 *
 * Supported secret types: 'cookies' | 'oauth' | 'api_key' | 'password'
 */

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const os     = require('os');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// ── Encryption helpers ──────────────────────────────────────────────────────

function _deriveKey() {
  // Deterministic key derived from machine hostname + a fixed salt
  return crypto.scryptSync(os.hostname() + 'chatr-vault-v2', 'chatrSalt2026', 32);
}

function _encrypt(plaintext) {
  // Try Electron safeStorage first
  try {
    const { safeStorage } = require('electron');
    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(plaintext);
      return { method: 'electron', data: buf.toString('base64') };
    }
  } catch { /* not in Electron context */ }

  // Fallback: AES-256-GCM
  const key = _deriveKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    method: 'aes256gcm',
    data:   Buffer.concat([iv, tag, encrypted]).toString('base64')
  };
}

function _decrypt(stored) {
  if (stored.method === 'electron') {
    try {
      const { safeStorage } = require('electron');
      return safeStorage.decryptString(Buffer.from(stored.data, 'base64'));
    } catch {
      throw new Error('Failed to decrypt with Electron safeStorage');
    }
  }

  // AES-256-GCM fallback
  const key = _deriveKey();
  const buf = Buffer.from(stored.data, 'base64');
  const iv  = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const enc = buf.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ── Vault storage location ──────────────────────────────────────────────────

function _getVaultPath() {
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'chatr-credential-vault.json');
  } catch {
    return path.join(os.homedir(), '.chatr', 'credential-vault.json');
  }
}

// ── CredentialVault class ───────────────────────────────────────────────────

class CredentialVault {
  constructor() {
    /** @type {Map<string, {method: string, data: string, type: string, savedAt: string}>} */
    this._store = new Map();
    this._vaultPath = null;
    this._loaded    = false;
    this._init();
  }

  _init() {
    try {
      this._vaultPath = _getVaultPath();
      const dir = path.dirname(this._vaultPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this._load();
    } catch (err) {
      log.error('[CredentialVault] Init error:', err.message);
    }
  }

  _load() {
    if (!this._vaultPath || !fs.existsSync(this._vaultPath)) return;
    try {
      const raw  = fs.readFileSync(this._vaultPath, 'utf8');
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        this._store.set(k, v);
      }
      this._loaded = true;
      log.info(`[CredentialVault] Loaded ${this._store.size} credential(s).`);
    } catch (err) {
      log.error('[CredentialVault] Failed to load vault:', err.message);
    }
  }

  _persist() {
    if (!this._vaultPath) return;
    try {
      const obj = {};
      for (const [k, v] of this._store.entries()) obj[k] = v;
      fs.writeFileSync(this._vaultPath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      log.error('[CredentialVault] Failed to persist vault:', err.message);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Save credentials for a connector.
   * @param {string} connectorId
   * @param {'cookies'|'oauth'|'api_key'|'password'} secretType
   * @param {object|string} data
   */
  save(connectorId, secretType, data) {
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = _encrypt(plaintext);

    this._store.set(connectorId, {
      ...encrypted,
      type:    secretType,
      savedAt: new Date().toISOString()
    });

    this._persist();
    log.info(`[CredentialVault] Saved credentials for '${connectorId}' (type: ${secretType})`);
  }

  /**
   * Load credentials for a connector.
   * @param {string} connectorId
   * @returns {{ type: string, data: any, savedAt: string }|null}
   */
  load(connectorId) {
    const entry = this._store.get(connectorId);
    if (!entry) return null;

    try {
      const plaintext = _decrypt({ method: entry.method, data: entry.data });
      let parsed;
      try { parsed = JSON.parse(plaintext); } catch { parsed = plaintext; }
      return { type: entry.type, data: parsed, savedAt: entry.savedAt };
    } catch (err) {
      log.error(`[CredentialVault] Failed to decrypt credentials for '${connectorId}':`, err.message);
      return null;
    }
  }

  /**
   * Returns true if credentials exist for the connector.
   * @param {string} connectorId
   * @returns {boolean}
   */
  has(connectorId) {
    return this._store.has(connectorId);
  }

  /**
   * Remove credentials for a connector.
   * @param {string} connectorId
   */
  clear(connectorId) {
    this._store.delete(connectorId);
    this._persist();
    log.info(`[CredentialVault] Cleared credentials for '${connectorId}'`);
  }

  /**
   * Returns array of connector IDs that have credentials.
   * @returns {string[]}
   */
  listConnected() {
    return Array.from(this._store.keys());
  }

  /**
   * Returns array of metadata objects (no decrypted data).
   * @returns {Array<{ connectorId: string, type: string, savedAt: string, hasData: boolean }>}
   */
  listAll() {
    return Array.from(this._store.entries()).map(([connectorId, entry]) => ({
      connectorId,
      type:    entry.type,
      savedAt: entry.savedAt,
      hasData: !!entry.data
    }));
  }
}

const credentialVault = new CredentialVault();
module.exports = { credentialVault, CredentialVault };
