'use strict';

/**
 * CHATR Kernel - Capability Registry
 * Maps high-level intent actions to specific AI requirement profiles.
 */

const fs = require('fs');
const path = require('path');

class CapabilityRegistry {
  constructor() {
    this.capabilities = new Map();
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'capabilities.json'), 'utf8'));
      for (const c of data.capabilities) {
        this.capabilities.set(c.id, c.requirements);
      }
    } catch (err) {
      console.warn('[CapabilityRegistry] Failed to load capabilities.json:', err.message);
    }
  }

  getRequirements(capabilityId) {
    return this.capabilities.get(capabilityId) || {};
  }
}

const capabilityRegistry = new CapabilityRegistry();
module.exports = { capabilityRegistry, CapabilityRegistry };
