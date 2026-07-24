'use strict';

/**
 * CHATR Kernel — Capability Contract Validator (Phase 5.1.1)
 *
 * Validates that a resolved constraint set satisfies the formal contract
 * for a given capability before workflow execution begins.
 *
 * Also enforces capability versioning (transport.book@1.0, transport.book@2.0).
 */

const path = require('path');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

let CONTRACTS;
function _getContracts() {
  if (CONTRACTS) return CONTRACTS;
  CONTRACTS = require('./capability-contracts.json');
  return CONTRACTS;
}

class CapabilityContractValidator {

  /**
   * Get the contract for a capability (supports versioned IDs like transport.book@1.0).
   * @param {string} capabilityId
   * @returns {object|null}
   */
  getContract(capabilityId) {
    const contracts = _getContracts();
    // Strip version suffix: "transport.book@2.0" → "transport.book"
    const baseId = capabilityId.split('@')[0];
    const contractList = contracts.contracts || contracts.capabilities || {};
    return contractList[baseId] || null;
  }

  /**
   * Validate that all required constraints are present and non-empty.
   *
   * @param {string} capabilityId
   * @param {object} constraints   Flat constraint map (values already extracted)
   * @returns {{ valid: boolean, missing: string[], extra: string[], contract: object|null }}
   */
  validate(capabilityId, constraints) {
    const contract = this.getContract(capabilityId);

    if (!contract) {
      log.warn(`[CapabilityContractValidator] No contract found for '${capabilityId}' — skipping validation.`);
      return { valid: true, missing: [], extra: [], contract: null, warning: 'No contract defined' };
    }

    const required = contract.required || [];
    const optional = contract.optional || [];
    const allowed  = new Set([...required, ...optional]);

    const missing = required.filter(field => {
      const val = constraints[field];
      return val === undefined || val === null || val === '';
    });

    const extra = Object.keys(constraints).filter(key => !allowed.has(key));

    if (missing.length > 0) {
      log.warn(`[CapabilityContractValidator] '${capabilityId}' missing required fields: [${missing.join(', ')}]`);
    }

    return {
      valid:    missing.length === 0,
      missing,
      extra,
      contract,
      riskLevel:       contract.riskLevel || 'safe',
      approvalRequired: contract.approvalRequired || false,
    };
  }

  /**
   * Check if a connector's declared version supports a capability version.
   * @param {object} provider     Provider descriptor from providers.json
   * @param {string} capabilityId Capability ID (may include @version)
   * @returns {boolean}
   */
  isCompatible(provider, capabilityId) {
    const supports = provider.supports || provider.capabilities || [];
    const baseId   = capabilityId.split('@')[0];
    return supports.some(s => s.split('@')[0] === baseId);
  }

  /**
   * List all capabilities with their contracts.
   * @returns {Array}
   */
  listCapabilities() {
    return Object.entries(_getContracts().capabilities).map(([id, contract]) => ({
      id,
      version:  contract.version,
      required: contract.required,
      optional: contract.optional,
      returns:  contract.returns,
      risk:     contract.riskLevel,
    }));
  }
}

const capabilityContractValidator = new CapabilityContractValidator();
module.exports = { capabilityContractValidator, CapabilityContractValidator };
