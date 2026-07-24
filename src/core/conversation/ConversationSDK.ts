/**
 * CHATR Core — Conversation SDK
 *
 * The ONLY entry point for all UI components that need AI.
 * Nothing in the UI imports from transport.ts, types.ts, or any CHATR Core internal.
 * Everything flows through conversation.send() / conversation.stream().
 *
 * Genesis v1.0
 */

import type { ConversationRequest, ConversationEventHandler, HealthResponse, Model } from './types';
import { httpChat, httpStream, httpHealth, httpModels } from './transport';

// Track the active stream cancel handle
let _activeCancelFn: (() => void) | null = null;

/**
 * One-shot: send a message and wait for the full response.
 */
async function send(request: ConversationRequest): Promise<string> {
  const result = await httpChat(request);
  return result.text;
}

/**
 * Streaming: send a message and receive tokens as they arrive.
 * onEvent fires for each conversation.* event.
 * Returns a cancel function.
 */
function stream(
  request: ConversationRequest,
  onEvent: ConversationEventHandler
): () => void {
  // Cancel any previous stream
  if (_activeCancelFn) {
    _activeCancelFn();
    _activeCancelFn = null;
  }

  const { cancel } = httpStream(request, onEvent);
  _activeCancelFn = cancel;
  return cancel;
}

/**
 * Cancel the currently active stream (if any).
 */
function cancel(): void {
  if (_activeCancelFn) {
    _activeCancelFn();
    _activeCancelFn = null;
  }
}

/**
 * Check CHATR Core health.
 */
async function health(): Promise<HealthResponse> {
  return httpHealth();
}

/**
 * List available AI models.
 */
async function models(): Promise<Model[]> {
  const result = await httpModels();
  return result.models;
}

/**
 * Check if CHATR Core is reachable (quick ping).
 */
async function isAvailable(): Promise<boolean> {
  try {
    const h = await httpHealth();
    return h.providerOk;
  } catch {
    return false;
  }
}

export const conversation = { send, stream, cancel, health, models, isAvailable };
