'use strict';

/**
 * CHATR Kernel — Provider Manifest Loader
 * Platform Milestone C — ABI v0.9 RC
 *
 * Loads and validates ProviderManifest JSON files at boot.
 * Rejects invalid manifests. Enforces universal capability catalog compliance.
 *
 * ABI: chatr.provider_manifest.v0_9_rc
 */

const fs = require('fs');
const path = require('path');

const ABI = 'chatr.provider_manifest.v0_9_rc';

// For simplicity, we load the valid universal capability names from a constant.
// In a full implementation, we might import this from the Capability Registry.
const VALID_CAPABILITIES = new Set([
  'DISCOVER', 'FETCH', 'COMPARE', 'SELECT', 'AUTHENTICATE',
  'AUTHORIZE', 'COLLECT_INPUT', 'PAY', 'TRANSFER', 'EXECUTE',
  'OBSERVE', 'RECONCILE', 'RECOVER', 'TRACK', 'VERIFY',
  'SUSPEND', 'RESUME', 'CANCEL', 'COMMUNICATE', 'SCHEDULE',
  'STORE', 'NOTIFY', 'LEARN'
]);

class ManifestLoader {
  constructor(options = {}) {
    // Default to the project root `provider-manifests` directory
    this._manifestsDir = options.manifestsDir || path.resolve(__dirname, '../../../provider-manifests');
    this._manifests = new Map();
    this._loaded = false;
  }

  loadAll() {
    if (this._loaded) return this.getAll();

    this._manifests.clear();
    
    if (!fs.existsSync(this._manifestsDir)) {
      this._loaded = true;
      return [];
    }

    const files = fs.readdirSync(this._manifestsDir);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const fullPath = path.join(this._manifestsDir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const manifest = JSON.parse(content);
        
        validateManifest(manifest);
        
        // Make it completely immutable
        deepFreeze(manifest);
        this._manifests.set(manifest.provider_id, manifest);
      } catch (err) {
        console.error(`[ManifestLoader] Failed to load ${file}:`, err.message);
      }
    }

    this._loaded = true;
    return this.getAll();
  }

  getManifest(providerId) {
    if (!this._loaded) this.loadAll();
    return this._manifests.get(providerId) || null;
  }

  getAll() {
    if (!this._loaded) this.loadAll();
    return Array.from(this._manifests.values());
  }

  reload() {
    this._loaded = false;
    return this.loadAll();
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateManifest(m) {
  if (!m || typeof m !== 'object') throw new Error('Manifest must be a JSON object');
  if (m.abi !== ABI) throw new Error(`Invalid ABI: expected ${ABI}, got ${m.abi}`);
  
  if (!m.provider_id || typeof m.provider_id !== 'string') {
    throw new Error('Manifest missing provider_id');
  }
  if (!m.provider_version || typeof m.provider_version !== 'string') {
    throw new Error('Manifest missing provider_version');
  }
  if (!Array.isArray(m.capabilities) || m.capabilities.length === 0) {
    throw new Error('Manifest must define at least one capability');
  }

  for (const cap of m.capabilities) {
    if (!VALID_CAPABILITIES.has(cap.capability)) {
      throw new Error(`Invalid capability: ${cap.capability}. Must be a universal catalog ID.`);
    }
    if (!cap.capability_contract_version) {
      throw new Error(`Capability ${cap.capability} missing capability_contract_version`);
    }
    if (!Array.isArray(cap.execution_modes) || cap.execution_modes.length === 0) {
      throw new Error(`Capability ${cap.capability} missing execution_modes`);
    }
    if (!Array.isArray(cap.strategy_support) || cap.strategy_support.length === 0) {
      throw new Error(`Capability ${cap.capability} missing strategy_support`);
    }
    if (!cap.authentication || typeof cap.authentication !== 'object') {
      throw new Error(`Capability ${cap.capability} missing explicit authentication`);
    }
    if (!cap.reliability || typeof cap.reliability.declared_success_rate !== 'number') {
      throw new Error(`Capability ${cap.capability} missing reliability.declared_success_rate`);
    }
  }

  return true;
}

function deepFreeze(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const nested of Object.values(v)) deepFreeze(nested);
  return v;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _default = null;

function getManifestLoader() {
  if (!_default) _default = new ManifestLoader();
  return _default;
}

const exported = {
  ABI,
  ManifestLoader,
  validateManifest,
  getManifestLoader,
};

Object.defineProperty(exported, 'manifestLoader', {
  enumerable: true,
  get: getManifestLoader,
});

module.exports = exported;
