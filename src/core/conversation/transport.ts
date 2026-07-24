/**
 * CHATR Core — Transport Layer
 *
 * Abstracts HTTP from the SDK.
 * Swap to IPC, gRPC, or local socket without changing any UI code.
 *
 * Genesis v1.0
 */

import type {
  ConversationRequest,
  ConversationResponse,
  ConversationEventHandler,
  HealthResponse,
  Model,
} from './types';

const CHATR_CORE_URL = 'http://127.0.0.1:8087';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CHATR_CORE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${CHATR_CORE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * One-shot chat.
 */
export async function httpChat(req: ConversationRequest): Promise<ConversationResponse> {
  return post<ConversationResponse>('/conversation/chat', req);
}

/**
 * Streaming chat via Server-Sent Events.
 * Parses normalized events and calls onEvent for each.
 * Returns a cancel function.
 */
export function httpStream(
  req: ConversationRequest,
  onEvent: ConversationEventHandler
): { cancel: () => void } {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${CHATR_CORE_URL}/conversation/stream`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(req),
        signal:  controller.signal,
      });

      if (!res.ok || !res.body) {
        onEvent({ type: 'conversation.error', code: 'HTTP_ERROR', message: `HTTP ${res.status}` });
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventName = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventName) {
            try {
              const data = JSON.parse(line.slice(6));
              // Cast the normalized SSE event name to the ConversationEventType union
              onEvent({ type: eventName, ...data } as Parameters<ConversationEventHandler>[0]);
            } catch { /* malformed — skip */ }
            eventName = '';
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        onEvent({ type: 'conversation.cancelled' });
      } else {
        onEvent({ type: 'conversation.error', code: 'STREAM_ERROR', message: String(err) });
      }
    }
  })();

  return { cancel: () => controller.abort() };
}

export async function httpHealth(): Promise<HealthResponse> {
  return get<HealthResponse>('/conversation/health');
}

export async function httpModels(): Promise<{ models: Model[] }> {
  return get<{ models: Model[] }>('/conversation/models');
}
