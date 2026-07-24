'use strict';

/**
 * CHATR Kernel - Policy Registry
 * Loads the base declarative policies.
 */

const fs = require('fs');
const path = require('path');

class PolicyRegistry {
  constructor() {
    this.policies = {};
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies.json'), 'utf8'));
      this.policies = data.policies;
    } catch (err) {
      console.warn('[PolicyRegistry] Failed to load policies.json:', err.message);
    }
  }

  getPolicy(level) {
    return this.policies[level] || {};
  }
}

const policyRegistry = new PolicyRegistry();
module.exports = { policyRegistry, PolicyRegistry };
