export interface PlatformConversationSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  isOnline: boolean;
  unreadCount: number;
  isGroup: boolean;
}

export interface ListConversationsRequest {
  userId: string;
}

export type ConversationUpdateReason =
  | 'message.created'
  | 'conversation.changed';

export interface ConversationUpdateEvent {
  reason: ConversationUpdateReason;
  conversationId?: string;
  payload?: unknown;
}

export interface ConversationSubscriptionOptions {
  userId: string;
}

export interface ConversationApi {
  listForUser(request: ListConversationsRequest): Promise<PlatformConversationSummary[]>;
  subscribeToUpdates(
    options: ConversationSubscriptionOptions,
    onUpdate: (event: ConversationUpdateEvent) => void
  ): () => void;
}
