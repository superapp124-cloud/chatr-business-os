/**
 * socketMessagingBridge.ts — Dual-Write Bridge for Sub-100ms Delivery
 *
 * After saving a message to Supabase (the persistent store), call
 * socketMessagingBridge.emit() to immediately push the message to all
 * conversation participants via Socket.IO.
 *
 * This achieves:
 *   1. Persistence via Supabase INSERT (guaranteed)
 *   2. Instant delivery via Socket.IO (<100ms)
 *   3. Supabase CDC as async confirmation / fallback
 *
 * The recipient's useRealtimeMessages hook deduplicates by message ID,
 * so they only render the message once regardless of which path arrives first.
 */

import { socketService, SocketMessage } from '@/services/socketService';

export interface BridgeMessagePayload {
  /** UUID from Supabase INSERT — used for deduplication */
  id: string;
  conversationId: string;
  content: string;
  senderId: string;
  messageType?: string;
  mediaUrl?: string | null;
  replyToId?: string | null;
  timestamp?: number;
}

export interface BridgeResult {
  /** Whether the socket emit was attempted */
  socketEmitted: boolean;
  /** Server ACK status (only meaningful if socketEmitted is true) */
  ackStatus?: 'ok' | 'error' | 'timeout';
  ackMessageId?: string;
}

const ACK_TIMEOUT_MS = 5000;

class SocketMessagingBridge {
  /**
   * Emit a message over Socket.IO immediately after Supabase INSERT.
   *
   * @param payload  The message payload (id should be the real Supabase UUID)
   * @returns        BridgeResult indicating what happened
   */
  emit(payload: BridgeMessagePayload): Promise<BridgeResult> {
    if (!socketService.isEnabled || !socketService.isConnected) {
      return Promise.resolve({ socketEmitted: false });
    }

    return new Promise<BridgeResult>((resolve) => {
      const message: SocketMessage = {
        id: payload.id,
        conversationId: payload.conversationId,
        content: payload.content,
        senderId: payload.senderId,
        messageType: payload.messageType || 'text',
        mediaUrl: payload.mediaUrl ?? null,
        replyToId: payload.replyToId ?? null,
        timestamp: payload.timestamp || Date.now(),
        status: 'SENT',
      };

      // Set up ACK timeout
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn('[SocketBridge] ACK timeout for message:', message.id);
          resolve({ socketEmitted: true, ackStatus: 'timeout', ackMessageId: message.id });
        }
      }, ACK_TIMEOUT_MS);

      socketService.emit('send_message', message, (ack) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (ack?.status === 'ok') {
          resolve({
            socketEmitted: true,
            ackStatus: 'ok',
            ackMessageId: ack.messageId,
          });
        } else {
          console.warn('[SocketBridge] Send ACK error:', ack);
          resolve({ socketEmitted: true, ackStatus: 'error' });
        }
      });
    });
  }

  /**
   * Notify that a user is typing in a conversation.
   */
  sendTypingStart(conversationId: string): void {
    socketService.emit('typing_start', { conversationId }, (ack) => {
      if (ack?.status !== 'ok') console.warn('[SocketBridge] typing_start ACK failed:', ack);
    });
  }

  /**
   * Notify that a user stopped typing.
   */
  sendTypingStop(conversationId: string): void {
    socketService.emit('typing_stop', { conversationId }, (ack) => {
      if (ack?.status !== 'ok') console.warn('[SocketBridge] typing_stop ACK failed:', ack);
    });
  }

  /**
   * Mark messages as read via socket for instant peer feedback.
   */
  markRead(conversationId: string, messageIds: string[]): void {
    if (!messageIds.length) return;
    socketService.emit('mark_read', { conversationId, messageIds }, (ack) => {
      if (ack?.status !== 'ok') console.warn('[SocketBridge] mark_read ACK failed:', ack);
    });
  }

  /**
   * Mark a single message as delivered.
   */
  markDelivered(conversationId: string, messageId: string): void {
    socketService.emit('mark_delivered', { conversationId, messageId }, (ack) => {
      if (ack?.status !== 'ok') console.warn('[SocketBridge] mark_delivered ACK failed:', ack);
    });
  }

  /**
   * Signal an incoming call to the receiver (complements FCM push).
   * Only useful when the receiver is already connected via socket.
   */
  signalCallIncoming(params: {
    receiverId: string;
    callId: string;
    callerName: string;
    callerAvatar?: string;
    callerPhone?: string;
    callType: 'audio' | 'video';
    conversationId: string;
  }): void {
    socketService.emit('call_incoming', {
      receiverId: params.receiverId,
      callId: params.callId,
      callerName: params.callerName,
      callerAvatar: params.callerAvatar,
      callerPhone: params.callerPhone,
      callType: params.callType,
      conversationId: params.conversationId,
    }, (ack) => {
      if (ack?.status !== 'ok') console.warn('[SocketBridge] call_incoming ACK failed:', ack);
    });
  }
}

export const socketMessagingBridge = new SocketMessagingBridge();
