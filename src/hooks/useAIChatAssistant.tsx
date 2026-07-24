import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
 generateSmartReplyTextsWithCloudFallback,
 summarizeChatWithFallback,
} from '@/lib/onDeviceAI';

export const useAIChatAssistant = () => {
 const [loading, setLoading] = useState(false);
 const [smartReplies, setSmartReplies] = useState<string[]>([]);
 const [summary, setSummary] = useState<string | null>(null);
 const [insights, setInsights] = useState<any>(null);

 const generateSummary = useCallback(async (
 messages: any[],
 // summaryType is accepted for API compatibility but the local fallback
 // produces a single extractive format regardless of type.
 _summaryType: 'brief' | 'detailed' | 'action_items' | 'meeting_notes' = 'brief'
 ) => {
 setLoading(true);
 setSummary(null);

 try {
 // Routes through on-device router: Nano first, then extractive rules — no cloud call.
 const result = await summarizeChatWithFallback(messages);
 setSummary(result);
 toast.success('Summary generated!');
 return result;
 } catch (error: any) {
 console.error('Summary generation error:', error);
 toast.error('Failed to generate summary');
 return null;
 } finally {
 setLoading(false);
 }
 }, []);

 const generateSmartReplies = useCallback(async (
 lastMessage: string,
 conversationContext: any[] = [],
 _replyCount: number = 3
 ) => {
 setLoading(true);
 setSmartReplies([]);

 try {
 // Routes through on-device router: Nano first, cloud (ai-smart-reply) only as fallback.
 const context = conversationContext
 .slice(-5)
 .map((m: any) => (typeof m === 'string' ? m : String(m?.content || '')));
 const replies = await generateSmartReplyTextsWithCloudFallback(lastMessage, context);
 setSmartReplies(replies);
 return replies;
 } catch (error: any) {
 console.error('Smart reply generation error:', error);
 toast.error('Failed to generate smart replies');
 return [];
 } finally {
 setLoading(false);
 }
 }, []);

 const analyzeMessages = useCallback(async (
 messages: any[],
 analysisType: 'sentiment' | 'topics' | 'urgency' | 'language'
 ) => {
 setLoading(true);
 setInsights(null);

 try {
 // Intentional Tier-3 cloud call (ai-message-insights / Lovable gateway).
 // No on-device equivalent. Not in any live UI surface per Jun-2026 audit.
 // Cost impact: user-initiated only, not automatic.
 const { data, error } = await supabase.functions.invoke('ai-message-insights', {
 body: { messages, analysisType }
 });

 if (error) throw error;

 if (data?.error) {
 toast.error(data.error);
 return null;
 }

 setInsights(data.insights);
 toast.success('Analysis complete!');
 return data.insights;
 } catch (error: any) {
 console.error('Message analysis error:', error);
 toast.error('Failed to analyze messages');
 return null;
 } finally {
 setLoading(false);
 }
 }, []);

 const clearSummary = useCallback(() => {
 setSummary(null);
 }, []);

 const clearSmartReplies = useCallback(() => {
 setSmartReplies([]);
 }, []);

 const clearInsights = useCallback(() => {
 setInsights(null);
 }, []);

 return {
 loading,
 summary,
 smartReplies,
 insights,
 generateSummary,
 generateSmartReplies,
 analyzeMessages,
 clearSummary,
 clearSmartReplies,
 clearInsights
 };
};
