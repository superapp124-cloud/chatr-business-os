/**
 * CHATR Core — Conversation SDK Types
 * Genesis v1.0
 */

export interface ConversationRequest {
  conversationId: string;
  message: string;
  userId: string;
}

export interface ConversationResponse {
  text: string;
  latencyMs: number;
  requestId: string;
}

// Normalized event types — UI only ever sees these
export type ConversationEventType =
  | 'conversation.started'
  | 'conversation.delta'
  | 'conversation.completed'
  | 'conversation.error'
  | 'conversation.cancelled';

export interface ConversationEvent {
  type: ConversationEventType;
  // conversation.started
  requestId?: string;
  contextMessages?: number;
  // conversation.delta
  token?: string;
  // conversation.completed
  totalTokens?: number;
  latencyMs?: number;
  // conversation.error
  code?: string;
  message?: string;
}

export type ConversationEventHandler = (event: ConversationEvent) => void;

export interface HealthResponse {
  core: string;
  conversation: string;
  provider: string;
  model: string;
  readyModels: string[];
  version: string;
  codename: string;
  latencyMs: number;
  modules: Array<{ name: string; version: string; status: string }>;
  providerOk: boolean;
  providerError: string | null;
}

export interface Model {
  name: string;
  size: number;
}
