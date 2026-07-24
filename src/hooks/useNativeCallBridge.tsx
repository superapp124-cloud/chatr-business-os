import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Bridges native Android/iOS call actions to the web app.
 *
 * NOTE: The nativeCallAction event is handled centrally by GlobalCallListener.tsx
 * to avoid duplicate database updates and network contention during call setup.
 * This hook handles direct notification reply action (nativeReply) and app pre-warming.
 */
export const useNativeCallBridge = () => {
 useEffect(() => {
 if (!Capacitor.isNativePlatform()) return;

 console.log('[NativeCallBridge] Active');

 const handleNativeReply = async (event: CustomEvent) => {
 const { conversationId, message } = event.detail || {};
 if (!conversationId || !message) return;

 try {
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) return;

 const { error } = await supabase.from('messages').insert({
 conversation_id: conversationId,
 sender_id: user.id,
 content: message,
 message_type: 'text',
 });

 if (error) {
 console.error('[NativeCallBridge] Reply error:', error);
 }
 } catch (err) {
 console.error('[NativeCallBridge] Reply error:', err);
 }
 };

 window.addEventListener('nativeReply', handleNativeReply as EventListener);

 try {
 (window as any).ChatrNativeRuntime?.markWebAppReady?.();
 } catch (error) {
 console.error('[NativeCallBridge] Failed to mark web app ready:', error);
 }

 return () => {
 window.removeEventListener('nativeReply', handleNativeReply as EventListener);
 };
 }, []);
};

export default useNativeCallBridge;
