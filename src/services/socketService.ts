/**
 * Singleton Socket.IO client service.
 *
 * Socket.IO remains a fast path for messaging and WebRTC signaling. It is now
 * selected through the shared signaling resolver so unreachable LAN endpoints
 * cannot silently break production, preview, native, or automation runtimes.
 * Supabase Realtime remains the durable fallback path.
 */

import { io, Socket } from 'socket.io-client';
import {
  SignalingTransportManager,
  emitSignalingTelemetry,
  type SignalingEndpointResolution,
} from '@/services/signaling';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export interface SocketMessage {
  id: string;
  conversationId: string;
  content: string;
  senderId: string;
  messageType?: string;
  mediaUrl?: string | null;
  replyToId?: string | null;
  timestamp: number;
  status: string;
}

export interface PresenceUpdate {
  userId: string;
  isOnline: boolean;
  timestamp: number;
}

export interface CallIncoming {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerPhone?: string;
  callType: 'audio' | 'video';
  conversationId: string;
  timestamp: number;
}

export interface CallProgressEvent {
  callId: string;
  fromUserId?: string;
  toUserId?: string;
  reason?: 'busy' | 'rejected' | 'timeout' | 'network' | 'ice' | 'ended' | string;
  timestamp: number;
}

export interface MessageBatch {
  conversationId: string;
  messages: SocketMessage[];
  timestamp: number;
}

export type SocketEventMap = {
  'new_message': (message: SocketMessage) => void;
  'message_batch': (batch: MessageBatch) => void;
  'message': (message: SocketMessage) => void;
  'presence_update': (update: PresenceUpdate) => void;
  'online_users': (data: { userIds: string[]; timestamp: number }) => void;
  'call_incoming': (call: CallIncoming) => void;
  'CALL_RINGING': (event: CallProgressEvent) => void;
  'CALL_BUSY': (event: CallProgressEvent) => void;
  'CALL_REJECTED': (event: CallProgressEvent) => void;
  'CALL_TIMEOUT': (event: CallProgressEvent) => void;
  'CALL_RECONNECTING': (event: CallProgressEvent) => void;
  'CALL_CONNECTED': (event: CallProgressEvent) => void;
  'CALL_FAILED': (event: CallProgressEvent) => void;
  'CALL_ENDED': (event: CallProgressEvent) => void;
  'typing_start': (data: { userId: string; conversationId: string }) => void;
  'typing_stop': (data: { userId: string; conversationId: string }) => void;
  'message_delivered': (data: { messageId: string; userId: string; timestamp: number }) => void;
  'message_read': (data: { messageId: string; userId: string; timestamp: number }) => void;
  'reaction_added': (data: { messageId: string; userId: string; emoji: string }) => void;
  'rate_limited': (data: { event: string; message: string; retryAfter: number }) => void;
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'connect_error': (err: Error) => void;
  'call-offer': (data: any) => void;
  'call-answer': (data: any) => void;
  'call-candidate': (data: any) => void;
  'call-end': (data: any) => void;
  'voip-call': (data: any) => void;
};

interface QueuedEvent {
  event: string;
  data: any;
  ack?: (response: any) => void;
  queuedAt: number;
}

const MAX_QUEUE_SIZE = 100;
const QUEUE_TTL_MS = 5 * 60 * 1000;

class SocketService {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private offlineQueue: QueuedEvent[] = [];
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private deferredHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();
  private signalingManager = new SignalingTransportManager();
  private reconnectAttempts = 0;

  get isEnabled(): boolean {
    return this.signalingManager.getEndpoint().socketEnabled;
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  get isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  get diagnostics(): SignalingEndpointResolution {
    return this.signalingManager.getEndpoint();
  }

  connect(token: string, userId: string): void {
    const endpoint = this.signalingManager.resolve();

    if (!endpoint.socketEnabled || !endpoint.socketIoUrl) {
      console.info(`[SocketService] Primary socket disabled (${endpoint.reason}). Using Supabase Realtime fallback.`);
      this.signalingManager.setState('fallback-active', endpoint.reason);
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    const startedAt = performance.now();
    this.signalingManager.setState('connecting');

    this.socket = io(endpoint.socketIoUrl, {
      auth: { token, userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: endpoint.reconnectBudget,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: endpoint.timeoutMs,
      forceNew: false,
    });

    this.attachCoreListeners(startedAt);
    this.attachDeferredHandlers();
    console.info(`[SocketService] Connecting to ${endpoint.socketIoUrl}...`);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.signalingManager.setState('disconnected');
    this.setConnectionState('disconnected');
    this.offlineQueue = [];
    this.reconnectAttempts = 0;
    console.info('[SocketService] Disconnected');
  }

  emit<K extends string>(
    event: K,
    data: any,
    ack?: (response: any) => void
  ): void {
    if (!this.isEnabled) return;

    if (this.signalingManager.shouldUseFallback()) {
      emitSignalingTelemetry({
        event: 'socket_emit_skipped_for_fallback',
        level: 'debug',
        transport: 'socket.io',
        metadata: { socketEvent: event },
      });
      return;
    }

    if (this.socket?.connected) {
      if (ack) {
        this.socket.emit(event, data, ack);
      } else {
        this.socket.emit(event, data);
      }
      return;
    }

    if (this.offlineQueue.length >= MAX_QUEUE_SIZE) {
      this.offlineQueue.shift();
    }

    this.offlineQueue.push({ event, data, ack, queuedAt: Date.now() });
    console.debug(`[SocketService] Queued offline event: ${event} (queue size: ${this.offlineQueue.length})`);
  }

  on<K extends keyof SocketEventMap>(
    event: K,
    handler: SocketEventMap[K]
  ): () => void {
    if (!this.isEnabled) return () => {};

    const eventName = event as string;
    const registeredHandler = handler as (...args: any[]) => void;
    const handlers = this.deferredHandlers.get(eventName) ?? new Set<(...args: any[]) => void>();

    handlers.add(registeredHandler);
    this.deferredHandlers.set(eventName, handlers);

    if (this.socket) {
      this.socket.on(eventName, registeredHandler);
    }

    return () => this.off(event, handler);
  }

  off<K extends keyof SocketEventMap>(event: K, handler?: SocketEventMap[K]): void {
    const eventName = event as string;

    if (handler) {
      const registeredHandler = handler as (...args: any[]) => void;
      this.deferredHandlers.get(eventName)?.delete(registeredHandler);
      this.socket?.off(eventName, registeredHandler);
      return;
    }

    this.deferredHandlers.delete(eventName);
    this.socket?.removeAllListeners(eventName);
  }

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  joinConversation(conversationId: string): void {
    this.emit('join_conversation', conversationId, (ack) => {
      if (ack?.status !== 'ok') {
        console.warn('[SocketService] Failed to join conversation:', conversationId, ack);
      }
    });
  }

  leaveConversation(conversationId: string): void {
    this.emit('leave_conversation', conversationId);
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.stateListeners.forEach(listener => listener(state));
  }

  private attachCoreListeners(startedAt: number): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.info(`[SocketService] Connected (id: ${this.socket?.id})`);
      this.reconnectAttempts = 0;
      this.signalingManager.recordPrimarySuccess(Math.round(performance.now() - startedAt));
      this.signalingManager.setState('connected');
      this.setConnectionState('connected');
      this.flushOfflineQueue();
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[SocketService] Disconnected - ${reason}`);
      if (reason === 'io server disconnect') {
        this.signalingManager.setState('disconnected', reason);
        this.setConnectionState('disconnected');
      } else {
        this.signalingManager.setState('reconnecting', reason);
        this.setConnectionState('reconnecting');
      }
    });

    this.socket.on('connect_error', (err) => {
      this.reconnectAttempts++;
      console.warn(`[SocketService] Connection error (attempt ${this.reconnectAttempts}):`, err.message);
      this.signalingManager.recordPrimaryFailure(err.message);
      this.setConnectionState('reconnecting');

      if (this.signalingManager.shouldUseFallback()) {
        emitSignalingTelemetry({
          event: 'primary_socket_exhausted',
          level: 'warn',
          transport: 'socket.io',
          reason: err.message,
          metadata: { attempts: this.reconnectAttempts },
        });
        this.socket?.disconnect();
        this.setConnectionState('disconnected');
      }
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      this.signalingManager.setState('reconnecting', `attempt-${attempt}`);
      this.setConnectionState('reconnecting');
    });

    this.socket.on('rate_limited', (data) => {
      console.warn('[SocketService] Rate limited:', data);
    });
  }

  private attachDeferredHandlers(): void {
    if (!this.socket) return;

    this.deferredHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.socket?.on(event, handler);
      });
    });
  }

  private flushOfflineQueue(): void {
    if (this.offlineQueue.length === 0) return;

    const now = Date.now();
    const fresh = this.offlineQueue.filter(e => now - e.queuedAt < QUEUE_TTL_MS);
    const stale = this.offlineQueue.length - fresh.length;

    if (stale > 0) {
      console.info(`[SocketService] Discarded ${stale} stale queued events (TTL exceeded)`);
    }

    console.info(`[SocketService] Flushing ${fresh.length} queued events...`);

    fresh.forEach(({ event, data, ack }) => {
      if (this.socket?.connected) {
        if (ack) {
          this.socket.emit(event, data, ack);
        } else {
          this.socket.emit(event, data);
        }
      }
    });

    this.offlineQueue = [];
  }
}

export const socketService = new SocketService();
