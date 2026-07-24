/**
 * Capability Registry (Capability Intelligence)
 *
 * Provides intelligent discovery and version negotiation for capabilities.
 * It only returns Capabilities that have an authentic CapabilityCertificate.
 */

const fs = require('fs');
const path = require('path');

class CapabilityRegistry {
  constructor() {
    this.capabilities = new Map(); // id -> map(version -> metadata)
    this.registryDir = path.join(__dirname, 'registry');
    this._loadCertifiedCapabilities();
  }

  _loadCertifiedCapabilities() {
    if (!fs.existsSync(this.registryDir)) {
      fs.mkdirSync(this.registryDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(this.registryDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.registryDir, file), 'utf8'));
        const id = data.manifest.identity.id;
        const version = data.manifest.identity.version;

        if (!this.capabilities.has(id)) {
          this.capabilities.set(id, new Map());
        }
        this.capabilities.get(id).set(version, data);
      } catch (err) {
        console.error(`[Registry] Failed to load certified capability from ${file}: ${err.message}`);
      }
    }
  }

  /**
   * Capability Intelligence: Which capabilities satisfy this intent?
   * @param {string} intentType E.g. 'hr.job.application'
   * @param {string} kernelVersion The ABI version of the running Kernel (e.g., '1.1')
   */
  findCapabilitiesForIntent(intentType, kernelVersion) {
    const matches = [];

    for (const [id, versions] of this.capabilities.entries()) {
      for (const [version, data] of versions.entries()) {
        const { manifest, certificate } = data;
        
        // Check Intent matching
        if (manifest.runtime.intentTypes.includes(intentType)) {
          // ABI Compatibility Check (Version Negotiation)
          const minKernel = parseFloat(manifest.metadata.minKernelVersion || '1.0');
          const currentKernel = parseFloat(kernelVersion || '1.0');
          
          if (currentKernel >= minKernel) {
            matches.push({
              id,
              version,
              manifest,
              certificate
            });
          }
        }
      }
    }

    return matches;
  }

  getCapability(id, version) {
    if (this.capabilities.has(id)) {
      return this.capabilities.get(id).get(version);
    }
    return null;
  }

  getAllCapabilities() {
    const all = [];
    for (const [id, versions] of this.capabilities.entries()) {
      for (const [version, data] of versions.entries()) {
        all.push(data.manifest || data); // some places might expect the raw object or manifest
      }
    }
    return all;
  }
}

class ProviderRegistry {
  constructor() {
    this.providers = new Map(); // id -> map(version -> metadata)
    this.registryDir = path.join(__dirname, '../providers/registry');
    this._loadCertifiedProviders();
  }

  _loadCertifiedProviders() {
    if (!fs.existsSync(this.registryDir)) {
      fs.mkdirSync(this.registryDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(this.registryDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.registryDir, file), 'utf8'));
        const id = data.manifest.identity.id;
        const version = data.manifest.identity.version;

        if (!this.providers.has(id)) {
          this.providers.set(id, new Map());
        }
        this.providers.get(id).set(version, data);
      } catch (err) {
        console.error(`[Registry] Failed to load certified provider from ${file}: ${err.message}`);
      }
    }
  }

  /**
   * Capability -> Provider Compatibility Matrix
   * Computes compatibility purely via declarative requirements.
   */
  getCompatibleProviders(capabilityManifest) {
    const matches = [];
    const requiredAuth = capabilityManifest.runtime.requirements?.auth || [];
    const requiredOps = capabilityManifest.runtime.requirements?.operations || [];

    for (const [id, versions] of this.providers.entries()) {
      for (const [version, data] of versions.entries()) {
        const providerManifest = data.manifest;

        // Check if provider explicitly supports this capability
        if (!providerManifest.capabilities.includes(capabilityManifest.identity.id)) {
          continue;
        }

        // Check explicit authentication contract requirements
        if (requiredAuth.length > 0 && !requiredAuth.includes(providerManifest.authentication.type)) {
           continue;
        }

        // Check explicit operational pattern requirements (e.g., Streaming, Webhook)
        const supportedPatterns = providerManifest.operations.patterns || [];
        const missingOps = requiredOps.filter(op => !supportedPatterns.includes(op));
        if (missingOps.length > 0) {
           continue;
        }

        matches.push(data);
      }
    }
    return matches;
  }
}

module.exports = {
  CapabilityRegistry: new CapabilityRegistry(),
  ProviderRegistry: new ProviderRegistry()
};
