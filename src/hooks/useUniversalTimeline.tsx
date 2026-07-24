import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TimelineType = 'message' | 'call' | 'payment' | 'event';

export interface TimelineItem {
 id: string;
 timeline_type: TimelineType;
 created_at: string;
 sender_id: string;
 payload: any;
}

export const useUniversalTimeline = (conversationId: string | null, userId: string | null) => {
 const [items, setItems] = useState<TimelineItem[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [hasMore, setHasMore] = useState(true);
 const { toast } = useToast();

 const loadTimeline = useCallback(async (offset = 0, isInitial = false) => {
 if (!conversationId || !userId) return;

 if (isInitial) {
 setIsLoading(true);
 }

 try {
 const { data, error } = await supabase.rpc('get_universal_timeline', {
 p_conversation_id: conversationId,
 p_limit: 50,
 p_offset: offset
 });

 if (error) throw error;

 if (data) {
 // Reverse because timeline is ordered descending, but chat view shows oldest at top
 const reversed = [...data].reverse();
 
 if (isInitial) {
 setItems(reversed);
 } else {
 setItems(prev => [...reversed, ...prev]);
 }
 
 if (data.length < 50) {
 setHasMore(false);
 }
 }
 } catch (err: any) {
 console.error('Error loading timeline:', err);
 toast.error('Failed to load conversation history');
 } finally {
 if (isInitial) {
 setIsLoading(false);
 }
 }
 }, [conversationId, userId]);

 useEffect(() => {
 loadTimeline(0, true);

 if (!conversationId) return;

 // Real-time subscriptions for Universal Timeline
 const messagesSubscription = supabase
 .channel(`timeline_messages_${conversationId}`)
 .on(
 'postgres_changes',
 {
 event: 'INSERT',
 schema: 'public',
 table: 'messages',
 filter: `conversation_id=eq.${conversationId}`
 },
 (payload) => {
 const newItem: TimelineItem = {
 id: payload.new.id,
 timeline_type: 'message',
 created_at: payload.new.created_at,
 sender_id: payload.new.sender_id,
 payload: payload.new
 };
 setItems(prev => [...prev, newItem]);
 }
 )
 .subscribe();

 const callsSubscription = supabase
 .channel(`timeline_calls_${conversationId}`)
 .on(
 'postgres_changes',
 {
 event: 'INSERT',
 schema: 'public',
 table: 'calls',
 filter: `conversation_id=eq.${conversationId}`
 },
 (payload) => {
 const newItem: TimelineItem = {
 id: payload.new.id,
 timeline_type: 'call',
 created_at: payload.new.started_at || new Date().toISOString(),
 sender_id: payload.new.caller_id,
 payload: payload.new
 };
 setItems(prev => [...prev, newItem]);
 }
 )
 .subscribe();

 return () => {
 messagesSubscription.unsubscribe();
 callsSubscription.unsubscribe();
 };
 }, [conversationId, loadTimeline]);

 const loadMore = useCallback(() => {
 if (!isLoading && hasMore) {
 loadTimeline(items.length, false);
 }
 }, [isLoading, hasMore, items.length, loadTimeline]);

 return {
 items,
 isLoading,
 hasMore,
 loadMore
 };
};
