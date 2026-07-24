import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useCallActiveState } from '@/hooks/useModuleNotifications';
import { conversationApi } from '@/platform/apis/conversation';
import type { PlatformConversationSummary } from '@/platform/apis/conversation';

export interface ChatConversation {
 id: string;
 name: string;
 avatar_url: string | null;
 lastMessage: string;
 lastMessageTime: string;
 is_online: boolean;
 unread_count: number;
 is_group: boolean;
}

export const useChatConversations = (userId: string) => {
 const [conversations, setConversations] = useState<ChatConversation[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const isCallActive = useCallActiveState();

 const toChatConversation = useCallback(
 (conversation: PlatformConversationSummary): ChatConversation => ({
 id: conversation.id,
 name: conversation.name,
 avatar_url: conversation.avatarUrl,
 lastMessage: conversation.lastMessagePreview,
 lastMessageTime: conversation.lastMessageAt
 ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false })
 : '',
 is_online: conversation.isOnline,
 unread_count: conversation.unreadCount,
 is_group: conversation.isGroup,
 }),
 []
 );

 const loadConversations = useCallback(async () => {
 if (!userId) {
 setConversations([]);
 setIsLoading(false);
 return;
 }
 
 try {
 const platformConversations = await conversationApi.listForUser({ userId });
 setConversations(platformConversations.map(toChatConversation));
 } catch (error) {
 console.error('[useChatConversations] Error loading:', error);
 } finally {
 setIsLoading(false);
 }
 }, [toChatConversation, userId]);

 // Initial load
 useEffect(() => {
 loadConversations();
 }, [loadConversations]);

 // Realtime subscription for new messages
 useEffect(() => {
 if (!userId) return;

 if (isCallActive) {
 console.log('[Performance] Deferring conversations-updates channel subscription - call active/initiating');
 return;
 }

 return conversationApi.subscribeToUpdates({ userId }, () => {
 loadConversations();
 });
 }, [userId, loadConversations, isCallActive]);

 return {
 conversations,
 isLoading,
 refresh: loadConversations,
 };
};
