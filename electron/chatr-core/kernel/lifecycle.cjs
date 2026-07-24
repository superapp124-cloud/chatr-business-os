'use strict';

/**
 * CHATR Kernel — Request Lifecycle
 *
 * The canonical stages every request passes through.
 * Every module uses this lifecycle. Every event maps to a stage.
 *
 * Genesis v1.0
 *
 * Lifecycle:
 *   RECEIVE → NORMALIZE → RESOLVE_CONTEXT → RESOLVE_IDENTITY (future)
 *   → RESOLVE_TRUST (future) → RESOLVE_PROVIDER → EXECUTE
 *   → PERSIST → VERIFY (future) → PUBLISH_EVENTS → COMPLETE
 */

const STAGES = {
  RECEIVE:          'receive',
  NORMALIZE:        'normalize',
  RESOLVE_CONTEXT:  'resolve_context',
  RESOLVE_IDENTITY: 'resolve_identity',   // Reserved — future
  RESOLVE_TRUST:    'resolve_trust',       // Reserved — future
  RESOLVE_PROVIDER: 'resolve_provider',
  EXECUTE:          'execute',
  PERSIST:          'persist',
  VERIFY:           'verify',              // Reserved — future
  PUBLISH_EVENTS:   'publish_events',
  COMPLETE:         'complete',
  FAILED:           'failed',
  CANCELLED:        'cancelled',
};

/**
 * Create a lifecycle tracker for a single request.
 * @param {string} requestId
 * @param {object} clock - KernelClock handle
 */
function createLifecycle(requestId, clock) {
  let currentStage = STAGES.RECEIVE;
  const history = [{ stage: currentStage, at: Date.now() }];

  return {
    advance(stage) {
      currentStage = stage;
      clock.mark(stage);
      history.push({ stage, at: Date.now() });
    },
    current() { return currentStage; },
    history() { return [...history]; },
    isTerminal() {
      return [STAGES.COMPLETE, STAGES.FAILED, STAGES.CANCELLED].includes(currentStage);
    },
  };
}

module.exports = { STAGES, createLifecycle };
