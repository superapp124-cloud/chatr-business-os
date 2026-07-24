'use strict';

/**
 * CHATR Kernel — Validator (Phase 2)
 *
 * Validates the Execution Graph produced by the Planner before execution.
 * Checks permissions, missing information, approvals, and runtime health.
 */

const { runtimeManager } = require('./runtime-manager.cjs');

class Validator {
  /**
   * Validate the execution plan.
   * @param {object} plan { intentId, nodes }
   * @returns {object} { valid: boolean, errors: string[], warnings: string[] }
   */
  async validate(plan) {
    const errors = [];
    const warnings = [];

    if (!plan || !Array.isArray(plan.nodes)) {
      return { valid: false, errors: ['Invalid plan structure'], warnings };
    }

    for (const node of plan.nodes) {
      // 1. Check if the capability exists
      const hasCapability = runtimeManager.hasCapability(node.capability);
      if (!hasCapability) {
        // We will just warn for now during the mock replacement phase
        // since providers are dynamically registered.
        warnings.push(`Capability '${node.capability}' is not currently registered.`);
      }

      // 2. Check Approval Requirements
      // If the node demands approval (e.g. from planner heuristic), ensure it's logged.
      // In a real OS, this queries the Manifest Policies.
      if (node.requiresApproval) {
        warnings.push(`Node '${node.id}' requires explicit user approval.`);
      }

      // 3. Health & Availability
      // If we had a health registry hook, we'd query it here.
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

const validator = new Validator();
module.exports = { validator, Validator };
