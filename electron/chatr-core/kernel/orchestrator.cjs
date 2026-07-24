'use strict';

/**
 * CHATR Kernel — Orchestrator
 *
 * The Kernel Orchestrator is the ONLY path through which modules
 * may execute provider work. No module calls a provider directly.
 *
 * It enforces the full request lifecycle, publishes all mandatory
 * CORE.* events, tracks per-stage timing via the Kernel Clock,
 * and delegates to the Lifecycle Inspector for observability.
 *
 * Genesis v1.0 — Milestone 2
 *
 * Lifecycle enforced here:
 *   NORMALIZE → RESOLVE_CONTEXT → RESOLVE_PROVIDER
 *   → EXECUTE → PERSIST → COMPLETE
 */

const { bus }              = require('../events/bus.cjs');
const { CORE }             = require('../events/events.cjs');
const { clock }            = require('./clock.cjs');
const { createLifecycle, STAGES } = require('./lifecycle.cjs');
const { providerRegistry } = require('../registry/provider-registry.cjs');
const { inspector }        = require('./inspector.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

/**
 * Execute a one-shot generation through the provider.
 *
 * @param {object} params
 * @param {string}   params.requestId
 * @param {object[]} params.messages        - Pre-resolved message array
 * @param {object}   params.contextMetadata - From Context Resolver
 * @param {Function} params.persist         - async fn(text) → messageId
 * @returns {Promise<{ text: string, latencyMs: number }>}
 */
async function executeGenerate({ requestId, messages, contextMetadata, persist }) {
  const requestClock = clock.start(requestId);
  const lifecycle    = createLifecycle(requestId, requestClock);
  const span         = inspector.startSpan(requestId);

  bus.publish(CORE.PROVIDER_RESOLVED, {
    requestId,
    provider: providerRegistry.getActiveName(),
  });

  try {
    lifecycle.advance(STAGES.EXECUTE);
    span.mark('execute_start');
    bus.publish(CORE.PROVIDER_STARTED, { requestId });

    const provider = providerRegistry.resolve();
    const text = await provider.generate(messages);

    span.mark('execute_end');
    requestClock.mark(STAGES.EXECUTE);

    // Persist
    lifecycle.advance(STAGES.PERSIST);
    span.mark('persist_start');
    bus.publish(CORE.PERSIST_STARTED, { requestId });

    const messageId = await persist(text);
    span.mark('persist_end');

    bus.publish(CORE.PERSIST_COMPLETED, { requestId, messageId });

    // Complete
    lifecycle.advance(STAGES.COMPLETE);
    const latencyMs = requestClock.total();
    span.finish({ latencyMs, provider: providerRegistry.getActiveName() });
    bus.publish(CORE.REQUEST_COMPLETED, { requestId, latencyMs });

    log.info('[Orchestrator] generate() complete', { requestId, latencyMs });
    return { text, latencyMs };

  } catch (err) {
    lifecycle.advance(STAGES.FAILED);
    span.fail(err.message);
    bus.publish(CORE.REQUEST_FAILED, { requestId, error: err.message });
    throw err;
  }
}

/**
 * Execute a streaming generation through the provider.
 *
 * @param {object} params
 * @param {string}   params.requestId
 * @param {object[]} params.messages
 * @param {object}   params.contextMetadata
 * @param {Function} params.onToken          - Called with each token string
 * @param {Function} params.persist          - async fn(fullText) → messageId
 * @returns {Promise<{ totalTokens: number, latencyMs: number }>}
 */
async function executeStream({ requestId, messages, contextMetadata, onToken, persist }) {
  const requestClock = clock.start(requestId);
  const lifecycle    = createLifecycle(requestId, requestClock);
  const span         = inspector.startSpan(requestId);

  bus.publish(CORE.PROVIDER_RESOLVED, {
    requestId,
    provider: providerRegistry.getActiveName(),
  });

  try {
    lifecycle.advance(STAGES.EXECUTE);
    span.mark('execute_start');
    bus.publish(CORE.PROVIDER_STARTED, { requestId });
    bus.publish(CORE.STREAM_STARTED,   { requestId });

    const provider   = providerRegistry.resolve();
    let fullText     = '';
    let tokenCount   = 0;
    let firstTokenAt = null;

    await provider.stream(messages, {}, (token) => {
      if (!firstTokenAt) {
        firstTokenAt = Date.now();
        span.mark('first_token');
      }
      fullText   += token;
      tokenCount += token.length;
      onToken(token);
      bus.publish(CORE.STREAM_DELTA, { requestId, token });
    });

    span.mark('execute_end');
    requestClock.mark(STAGES.EXECUTE);
    bus.publish(CORE.STREAM_COMPLETED, { requestId, tokens: tokenCount });

    // Persist
    lifecycle.advance(STAGES.PERSIST);
    span.mark('persist_start');
    bus.publish(CORE.PERSIST_STARTED, { requestId });

    const messageId = await persist(fullText);
    span.mark('persist_end');
    bus.publish(CORE.PERSIST_COMPLETED, { requestId, messageId });

    // Complete
    lifecycle.advance(STAGES.COMPLETE);
    const latencyMs = requestClock.total();
    span.finish({ latencyMs, tokens: tokenCount, provider: providerRegistry.getActiveName() });
    bus.publish(CORE.REQUEST_COMPLETED, { requestId, latencyMs });

    log.info('[Orchestrator] stream() complete', { requestId, latencyMs, tokens: tokenCount });
    return { totalTokens: tokenCount, latencyMs };

  } catch (err) {
    lifecycle.advance(STAGES.FAILED);
    span.fail(err.message);
    bus.publish(CORE.STREAM_FAILED,   { requestId, error: err.message });
    bus.publish(CORE.REQUEST_FAILED,  { requestId, error: err.message });
    throw err;
  }
}

/**
 * Cancel the active provider stream.
 */
function cancelActive() {
  try {
    providerRegistry.resolve().cancel();
  } catch { /* no active stream */ }
}

module.exports = { executeGenerate, executeStream, cancelActive };
