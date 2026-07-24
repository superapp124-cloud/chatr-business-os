'use strict';

/**
 * CHATR Browser Runtime — Failure Classifier
 * Sprint 1.1
 *
 * Every Browser Runtime failure is classified into a structured recovery proposal.
 * The kernel receives a typed failure, not a raw error string.
 *
 * Failure taxonomy:
 *   TIMEOUT              — Step exceeded allowed time
 *   SELECTOR_MISSING     — Expected DOM element not found
 *   AUTH_REQUIRED        — Page requires authentication before proceeding
 *   RATE_LIMITED         — Provider is throttling requests
 *   NAVIGATION_FAILED    — Page failed to load (404, 500, network error)
 *   EXTRACTION_EMPTY     — Extract step returned zero results
 *   VERIFICATION_FAILED  — Semantic outcome did not match expectation
 *   UNKNOWN              — Unclassified error
 */

const FAILURE_TYPE = Object.freeze({
  TIMEOUT:             'TIMEOUT',
  SELECTOR_MISSING:    'SELECTOR_MISSING',
  AUTH_REQUIRED:       'AUTH_REQUIRED',
  RATE_LIMITED:        'RATE_LIMITED',
  NAVIGATION_FAILED:   'NAVIGATION_FAILED',
  EXTRACTION_EMPTY:    'EXTRACTION_EMPTY',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  UNKNOWN:             'UNKNOWN',
});

// Recovery actions the connector can propose in response to each failure type
const RECOVERY_SUGGESTION = {
  [FAILURE_TYPE.TIMEOUT]:             'retry_with_backoff',
  [FAILURE_TYPE.SELECTOR_MISSING]:    'update_manifest_selector',
  [FAILURE_TYPE.AUTH_REQUIRED]:       'trigger_authentication_flow',
  [FAILURE_TYPE.RATE_LIMITED]:        'wait_and_retry',
  [FAILURE_TYPE.NAVIGATION_FAILED]:   'check_provider_health',
  [FAILURE_TYPE.EXTRACTION_EMPTY]:    'fallback_to_api',
  [FAILURE_TYPE.VERIFICATION_FAILED]: 're_extract_and_verify',
  [FAILURE_TYPE.UNKNOWN]:             'escalate_to_human_assist',
};

class FailureClassifier {
  /**
   * Classify an error into a structured failure proposal.
   * @param {Error|string} error
   * @param {string} stepType  The step type that failed (navigate/observe/extract...)
   * @param {object} context   Additional context (url, selector, etc.)
   * @returns {object}  Structured failure proposal
   */
  classify(error, stepType, context = {}) {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

    let type = FAILURE_TYPE.UNKNOWN;

    if (message.includes('timeout') || message.includes('timed out')) {
      type = FAILURE_TYPE.TIMEOUT;
    } else if (message.includes('not found') || message.includes('selector') || message.includes('no element')) {
      type = FAILURE_TYPE.SELECTOR_MISSING;
    } else if (message.includes('login') || message.includes('auth') || message.includes('sign in') || message.includes('unauthorized')) {
      type = FAILURE_TYPE.AUTH_REQUIRED;
    } else if (message.includes('rate limit') || message.includes('too many') || message.includes('429')) {
      type = FAILURE_TYPE.RATE_LIMITED;
    } else if (message.includes('navigation') || message.includes('net::') || message.includes('failed to load') || message.includes('404') || message.includes('500')) {
      type = FAILURE_TYPE.NAVIGATION_FAILED;
    } else if (message.includes('empty') || message.includes('no results') || message.includes('zero')) {
      type = FAILURE_TYPE.EXTRACTION_EMPTY;
    } else if (stepType === 'verify') {
      type = FAILURE_TYPE.VERIFICATION_FAILED;
    }

    return {
      failure_type: type,
      step_type: stepType,
      recovery_suggestion: RECOVERY_SUGGESTION[type],
      message: error instanceof Error ? error.message : String(error),
      context,
      classified_at: new Date().toISOString(),
      retryable: [FAILURE_TYPE.TIMEOUT, FAILURE_TYPE.RATE_LIMITED, FAILURE_TYPE.NAVIGATION_FAILED].includes(type),
    };
  }
}

module.exports = { FailureClassifier, FAILURE_TYPE, RECOVERY_SUGGESTION };
