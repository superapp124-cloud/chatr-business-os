import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateSmartReplyTextsWithCloudFallback } from '@/lib/onDeviceAI';

interface SmartReply {
 text: string;
 tone: 'casual' | 'professional' | 'friendly' | 'concise';
}

export const useAISmartReplies = () => {
 const [loading, setLoading] = useState(false);
 const [replies, setReplies] = useState<SmartReply[]>([]);

 const generateSmartReplies = useCallback(async (
 lastMessage: string,
 conversationContext: string[] = []
 ): Promise<SmartReply[]> => {
 setLoading(true);
 try {
 // Routes through on-device router: Nano first, cloud (ai-smart-reply) only as fallback.
 const texts = await generateSmartReplyTextsWithCloudFallback(lastMessage, conversationContext);
 // Router returns plain strings; map to SmartReply shape with a neutral tone.
 const smartReplies: SmartReply[] = texts.map((text) => ({ text, tone: 'friendly' }));
 setReplies(smartReplies);
 return smartReplies;
 } catch (error) {
 console.error('Smart reply generation failed:', error);
 return [];
 } finally {
 setLoading(false);
 }
 }, []);

 const translateMessage = useCallback(async (
 text: string,
 targetLanguage: string = 'en'
 ): Promise<string | null> => {
 try {
 const { data, error } = await supabase.functions.invoke('translate-message', {
 body: { text, targetLanguage }
 });

 if (error) throw error;
 return data?.translatedText || null;
 } catch (error) {
 console.error('Translation failed:', error);
 return null;
 }
 }, []);

 const improveTone = useCallback(async (
 text: string,
 tone: 'polite' | 'casual' | 'professional' | 'friendly'
 ): Promise<string | null> => {
 try {
 // Intentional Tier-3 cloud call: tone rewriting has no on-device equivalent yet.
 // Cost impact: low (user-initiated, not automatic).
 const { data, error } = await supabase.functions.invoke('ai-smart-reply', {
 body: {
 lastMessage: text,
 tone,
 action: 'improve_tone'
 }
 });

 if (error) throw error;
 return data?.improvedText || null;
 } catch (error) {
 console.error('Tone improvement failed:', error);
 return null;
 }
 }, []);

 return {
 loading,
 replies,
 generateSmartReplies,
 translateMessage,
 improveTone
 };
};
