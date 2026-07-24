'use strict';

/**
 * CHATR Kernel — Provider Registry
 * 
 * Manages plugin bindings. Providers register their manifests detailing
 * the capabilities they fulfill, along with operational metadata.
 * It enforces the Zero-Mock Production invariant by selectively loading
 * from 'production', 'certification', and 'development' registries based
 * on CHATR_ENV.
 */

const fs = require('fs');
const path = require('path');
const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class ProviderRegistry {
  constructor(environment = process.env.CHATR_ENV || 'production') {
    this.environment = environment; // 'production', 'development', 'certification'
    this._providers = new Map(); // providerId -> Manifest
    this._capabilityMap = new Map(); // capabilityId -> Set<providerId>
    
    const baseRegistry = path.join(__dirname, '../providers/registry');
    
    // Always load Core and Certified from production
    this._loadProvidersFromDir(path.join(baseRegistry, 'production'));
    
    if (this.environment === 'development') {
      this._loadProvidersFromDir(path.join(baseRegistry, 'development'));
    } else if (this.environment === 'certification') {
      this._loadProvidersFromDir(path.join(baseRegistry, 'certification'));
    }
  }

  _loadProvidersFromDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      try { fs.mkdirSync(dirPath, { recursive: true }); } catch (e) {}
      return;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'));
        const manifest = data.manifest || data;
        this.register(manifest);
        if (log && log.info) {
          log.info(`[ProviderRegistry] Loaded provider '${manifest.id}' from ${dirPath}`);
        }
      } catch (err) {
        if (log && log.error) {
          log.error(`[ProviderRegistry] Failed to load provider from ${file}: ${err.message}`);
        }
      }
    }
  }

  /**
   * Register a new provider manifest.
   */
  register(manifest) {
    if (!manifest.id || !manifest.identity) {
       // Support old format or new format
       if (!manifest.id && manifest.identity && manifest.identity.id) {
           manifest.id = manifest.identity.id;
       } else if (!manifest.id) {
           throw new Error('Provider must have an id');
       }
    }
    
    this._providers.set(manifest.id, manifest);

    // Map capabilities to this provider
    // In new format, it's just an array of strings in manifest.capabilities
    // In old format, it's an array of objects: { id: '...', supported: true }
    const caps = manifest.capabilities || [];
    for (const cap of caps) {
      const capId = typeof cap === 'string' ? cap : cap.id;
      if (!this._capabilityMap.has(capId)) {
        this._capabilityMap.set(capId, new Set());
      }
      this._capabilityMap.get(capId).add(manifest.id);
    }
  }

  /**
   * Get all providers that can fulfill a specific capability.
   */
  findProvidersFor(capabilityId) {
    const providerIds = this._capabilityMap.get(capabilityId);
    if (!providerIds) return [];
    
    return Array.from(providerIds)
      .map(id => this._providers.get(id))
      .filter(Boolean); // Filter out nulls if a provider was removed
  }

  /**
   * Get a specific provider manifest.
   */
  getManifest(providerId) {
    return this._providers.get(providerId) || null;
  }
}

const providerRegistry = new ProviderRegistry();
module.exports = { ProviderRegistry, providerRegistry };
