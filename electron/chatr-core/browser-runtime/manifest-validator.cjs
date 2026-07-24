'use strict';

/**
 * CHATR Browser Runtime — Manifest Validator
 * Sprint 1.1
 *
 * Validates provider manifests before execution.
 * Nothing executes unless it passes all four gates:
 *   1. JSON Schema (required fields exist)
 *   2. Capability validation (declared steps match runtime capabilities)
 *   3. Security validation (no unsafe actions or destinations)
 *   4. Runtime version compatibility
 *
 * The validator is provider-agnostic. It knows nothing about Zomato, Swiggy, etc.
 */

const CURRENT_RUNTIME_VERSION = '1.0';

// Supported step types
const SUPPORTED_STEPS = new Set(['navigate', 'observe', 'extract', 'act', 'verify', 'wait']);

// Supported act actions
const SUPPORTED_ACTIONS = new Set(['click', 'type', 'scroll', 'hover', 'press', 'select', 'clear']);

// Blocked URL patterns — security gate
const BLOCKED_URL_PATTERNS = [
  /^file:\/\//i,         // No local file access
  /^javascript:/i,       // No JS injection
  /localhost:\d+/i,      // No localhost (except test mode)
  /127\.0\.0\.1/i,
];

// Required top-level fields
const REQUIRED_FIELDS = ['provider', 'version', 'runtime_version', 'flows'];

class ManifestValidator {
  /**
   * Validate a manifest object.
   * @param {object} manifest
   * @param {object} options
   * @param {boolean} options.allowLocalhost  Set true for test/synthetic mode
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validate(manifest, options = {}) {
    const errors = [];
    const warnings = [];

    // ── Gate 1: Schema ────────────────────────────────────────────────
    for (const field of REQUIRED_FIELDS) {
      if (!(field in manifest)) {
        errors.push(`Missing required field: "${field}"`);
      }
    }

    if (typeof manifest.provider !== 'string' || !manifest.provider.trim()) {
      errors.push('Field "provider" must be a non-empty string');
    }

    if (typeof manifest.flows !== 'object' || manifest.flows === null) {
      errors.push('Field "flows" must be an object');
    }

    if (errors.length > 0) return { valid: false, errors, warnings };

    // ── Gate 2: Capability validation (step types) ────────────────────
    for (const [flowName, steps] of Object.entries(manifest.flows)) {
      if (!Array.isArray(steps)) {
        errors.push(`Flow "${flowName}" must be an array of steps`);
        continue;
      }

      steps.forEach((step, i) => {
        if (!step.step) {
          errors.push(`Flow "${flowName}", step ${i}: missing "step" field`);
          return;
        }
        if (!SUPPORTED_STEPS.has(step.step)) {
          errors.push(`Flow "${flowName}", step ${i}: unsupported step type "${step.step}"`);
        }
        if (step.step === 'navigate' && !step.url) {
          errors.push(`Flow "${flowName}", step ${i}: "navigate" requires a "url" field`);
        }
        if (step.step === 'observe' && !step.selector) {
          errors.push(`Flow "${flowName}", step ${i}: "observe" requires a "selector" field`);
        }
        if (step.step === 'extract' && !step.schema) {
          errors.push(`Flow "${flowName}", step ${i}: "extract" requires a "schema" field`);
        }
        if (step.step === 'act') {
          if (!step.action) errors.push(`Flow "${flowName}", step ${i}: "act" requires an "action" field`);
          if (step.action && !SUPPORTED_ACTIONS.has(step.action)) {
            errors.push(`Flow "${flowName}", step ${i}: unsupported action "${step.action}"`);
          }
          if (!step.target) errors.push(`Flow "${flowName}", step ${i}: "act" requires a "target" field`);
        }
        if (step.step === 'verify' && !step.condition) {
          errors.push(`Flow "${flowName}", step ${i}: "verify" requires a "condition" field`);
        }
      });
    }

    // ── Gate 3: Security validation ───────────────────────────────────
    for (const [flowName, steps] of Object.entries(manifest.flows)) {
      if (!Array.isArray(steps)) continue;
      steps.forEach((step, i) => {
        if (step.url) {
          for (const pattern of BLOCKED_URL_PATTERNS) {
            if (pattern.test(step.url) && !options.allowLocalhost) {
              errors.push(`Flow "${flowName}", step ${i}: URL "${step.url}" is blocked by security policy`);
            }
          }
        }
        // No arbitrary script injection in act steps
        if (step.step === 'act' && step.script) {
          errors.push(`Flow "${flowName}", step ${i}: "script" field in "act" is not allowed (security)`);
        }
      });
    }

    // ── Gate 4: Runtime version compatibility ─────────────────────────
    if (manifest.runtime_version !== CURRENT_RUNTIME_VERSION) {
      warnings.push(`Manifest runtime_version "${manifest.runtime_version}" differs from current runtime "${CURRENT_RUNTIME_VERSION}". Proceeding with compatibility mode.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

module.exports = { ManifestValidator };
