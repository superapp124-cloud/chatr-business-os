'use strict';

/**
 * CHATR Kernel — Conversation Module Service
 *
 * Orchestrates the Conversation request lifecycle.
 * Delegates provider execution to the Kernel Orchestrator to ensure
 * all KERNEL.md contracts are strictly enforced.
 *
 * Genesis v1.0 — Milestone 2
 */

const { bus }              = require('../../events/bus.cjs');
const { CORE }             = require('../../events/events.cjs');
const { clock }            = require('../../kernel/clock.cjs');
const { createLifecycle, STAGES } = require('../../kernel/lifecycle.cjs');
const { executeGenerate, executeStream } = require('../../kernel/orchestrator.cjs');
const { recoveryManager }  = require('../../kernel/recovery.cjs');
const { resolveContext }   = require('../../context/resolver.cjs');
const { createSSESession } = require('../../transport/sse.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// ── Supabase client (lazy) ────────────────────────────────────────────────────
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const { createClient } = require('@supabase/supabase-js');
  _supabase = createClient(url, key);
  return _supabase;
}

// ── Persistence Callback ──────────────────────────────────────────────────────
async function persistMessageCallback(conversationId, userId, text) {
  const supabase = getSupabase();
  if (!supabase) {
    log.warn('[Conversation] Supabase not configured — message not persisted.');
    return null;
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id:       userId,
      content:         text,
      message_type:    'ai',
    })
    .select('id')
    .single();

  if (error) {
    log.warn('[Conversation] Failed to persist message:', error.message);
    return null;
  }
  return data?.id;
}

// ── One-shot Chat ─────────────────────────────────────────────────────────────
async function chat({ conversationId, message, userId, requestId }) {
  const requestClock = clock.start(requestId);
  const lifecycle    = createLifecycle(requestId, requestClock);

  bus.publish(CORE.REQUEST_STARTED, { requestId, conversationId, userId });

  try {
    // Stage: Normalize
    lifecycle.advance(STAGES.NORMALIZE);
    if (!conversationId || !message || !userId) {
      throw Object.assign(new Error('Missing required fields: conversationId, message, userId'), { code: 'INVALID_REQUEST' });
    }

    // Stage: Resolve Context
    lifecycle.advance(STAGES.RESOLVE_CONTEXT);
    bus.publish(CORE.CONTEXT_RESOLVING, { requestId, conversationId });
    const { messages, metadata } = await resolveContext({ conversationId, message, userId });
    bus.publish(CORE.CONTEXT_RESOLVED, { requestId, ...metadata });
    requestClock.mark(STAGES.RESOLVE_CONTEXT);

    // Track for recovery
    recoveryManager.track(requestId, { conversationId, userId, stage: STAGES.EXECUTE });

    // Delegate to Orchestrator (handles EXECUTE → PERSIST → COMPLETE)
    const { text, latencyMs } = await executeGenerate({
      requestId,
      messages,
      contextMetadata: metadata,
      persist: (generatedText) => persistMessageCallback(conversationId, userId, generatedText),
    });

    recoveryManager.untrack(requestId);

    return { text, latencyMs, requestId };

  } catch (err) {
    lifecycle.advance(STAGES.FAILED);
    recoveryManager.untrack(requestId);
    // Note: Orchestrator already publishes FAILED events if it failed during EXECUTE/PERSIST.
    // We publish here if it failed during NORMALIZE or RESOLVE_CONTEXT.
    if (lifecycle.currentStage === STAGES.NORMALIZE || lifecycle.currentStage === STAGES.RESOLVE_CONTEXT) {
      bus.publish(CORE.REQUEST_FAILED, { requestId, error: err.message });
    }
    throw err;
  }
}

// ── Streaming Chat ────────────────────────────────────────────────────────────
async function stream({ conversationId, message, userId, requestId }, res) {
  const requestClock = clock.start(requestId);
  const lifecycle    = createLifecycle(requestId, requestClock);
  const sse          = createSSESession(res);

  bus.publish(CORE.REQUEST_STARTED, { requestId, conversationId, userId });

  try {
    // Stage: Normalize
    lifecycle.advance(STAGES.NORMALIZE);
    if (!conversationId || !message || !userId) {
      sse.send('conversation.error', { code: 'INVALID_REQUEST', message: 'Missing required fields.' });
      sse.close();
      return;
    }

    // Stage: Resolve Context
    lifecycle.advance(STAGES.RESOLVE_CONTEXT);
    bus.publish(CORE.CONTEXT_RESOLVING, { requestId, conversationId });
    const { messages, metadata } = await resolveContext({ conversationId, message, userId });
    bus.publish(CORE.CONTEXT_RESOLVED, { requestId, ...metadata });
    requestClock.mark(STAGES.RESOLVE_CONTEXT);

    // Initial stream event
    sse.send('conversation.started', { requestId, contextMessages: metadata.contextMessageCount });

    // Track for recovery
    recoveryManager.track(requestId, { conversationId, userId, stage: STAGES.EXECUTE });

    // Delegate to Orchestrator (handles EXECUTE → PERSIST → COMPLETE)
    const { totalTokens, latencyMs } = await executeStream({
      requestId,
      messages,
      contextMetadata: metadata,
      onToken: (token) => {
        sse.send('conversation.delta', { token });
      },
      persist: (fullText) => persistMessageCallback(conversationId, userId, fullText),
    });

    recoveryManager.untrack(requestId);
    sse.send('conversation.completed', { requestId, totalTokens, latencyMs });

  } catch (err) {
    lifecycle.advance(STAGES.FAILED);
    recoveryManager.untrack(requestId);
    log.error('[Conversation.stream] Failed:', err.message);
    sse.send('conversation.error', { code: err.code || 'STREAM_ERROR', message: err.message });
    
    // Publish FAILED events if it failed before orchestrator took over
    if (lifecycle.currentStage === STAGES.NORMALIZE || lifecycle.currentStage === STAGES.RESOLVE_CONTEXT) {
      bus.publish(CORE.STREAM_FAILED, { requestId, error: err.message });
      bus.publish(CORE.REQUEST_FAILED, { requestId, error: err.message });
    }
  } finally {
    sse.close();
  }
}

module.exports = { chat, stream };
