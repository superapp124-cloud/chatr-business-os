'use strict';

/**
 * CHATR Kernel — Context Resolver
 *
 * The backend owns all context. The UI sends only:
 *   { conversationId, message, userId }
 *
 * Context Resolver fetches, assembles, and returns the full context
 * the provider needs to generate a response.
 *
 * In v0.1: fetches last N messages from Supabase.
 * Future: resolves Memory, Organization, Commitments, Calendar, Files, Trust.
 *
 * Genesis v1.0
 */

const runtimeConfig  = require('../config/runtime.config.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// Lazy Supabase client — created once per kernel lifecycle
let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;

  // Read from environment (set by main.cjs before kernel boots)
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    log.warn('[ContextResolver] Supabase env vars not found — context will be empty.');
    return null;
  }

  // Dynamically require @supabase/supabase-js (available in node_modules)
  const { createClient } = require('@supabase/supabase-js');
  _supabase = createClient(url, key);
  return _supabase;
}

/**
 * Fetch recent messages from Supabase for a conversation.
 * @param {string} conversationId  - Supabase channel/conversation ID
 * @param {number} limit           - Max messages to fetch
 * @returns {Array<{role: string, content: string}>}
 */
async function fetchRecentMessages(conversationId, limit = runtimeConfig.maxContextMessages) {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('content, message_type, sender_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.warn('[ContextResolver] Supabase fetch failed:', error.message);
      return [];
    }

    // Reverse to chronological order and map to provider message format
    return (data || [])
      .reverse()
      .map(msg => ({
        role:    msg.message_type === 'ai' ? 'assistant' : 'user',
        content: msg.content || '',
      }))
      .filter(msg => msg.content.trim().length > 0);

  } catch (err) {
    log.warn('[ContextResolver] Failed to fetch context:', err.message);
    return [];
  }
}

/**
 * Resolve the full context for a request.
 *
 * @param {object} params
 * @param {string} params.conversationId
 * @param {string} params.message          - Current user message
 * @param {string} params.userId
 * @returns {object} { messages, metadata }
 */
async function resolveContext({ conversationId, message, userId }) {
  const history = await fetchRecentMessages(conversationId);

  // Append the current message as the final user turn
  const messages = [
    {
      role: 'system',
      content: 'You are CHATR, an intelligent assistant. Be concise, helpful, and precise.',
    },
    ...history,
    { role: 'user', content: message },
  ];

  const metadata = {
    contextMessageCount: history.length,
    conversationId,
    userId,
    resolvedAt: Date.now(),
    // Future fields: memory, organization, commitments, calendar, trust
  };

  log.info(`[ContextResolver] Resolved ${history.length} history messages for conversation ${conversationId}`);

  return { messages, metadata };
}

module.exports = { resolveContext };
