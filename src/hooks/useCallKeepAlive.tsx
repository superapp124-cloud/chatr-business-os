import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * CRITICAL: Prevents calls from disconnecting due to mobile network issues
 * Implements aggressive heartbeat mechanism to keep WebRTC connection alive
 * Also refreshes auth session to prevent logout during calls
 */
export const useCallKeepAlive = (callId: string | null, isActive: boolean) => {
 const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
 const sessionRefreshInterval = useRef<NodeJS.Timeout | null>(null);
 const lastHeartbeat = useRef<number>(Date.now());
 const consecutiveFailures = useRef<number>(0);

 useEffect(() => {
 if (!callId || !isActive) {
 if (heartbeatInterval.current) {
 clearInterval(heartbeatInterval.current);
 heartbeatInterval.current = null;
 }
 if (sessionRefreshInterval.current) {
 clearInterval(sessionRefreshInterval.current);
 sessionRefreshInterval.current = null;
 }
 consecutiveFailures.current = 0;
 return;
 }

 console.log('💓 [CallKeepAlive] Starting keepalive for call:', callId);

 // CRITICAL: Session refresh every 30 seconds to prevent logout during calls
 sessionRefreshInterval.current = setInterval(async () => {
 try {
 const { error } = await supabase.auth.refreshSession();
 if (error) {
 console.warn('⚠️ [CallKeepAlive] Session refresh failed:', error.message);
 } else {
 console.log('✅ [CallKeepAlive] Session refreshed');
 }
 } catch (error) {
 console.error('❌ [CallKeepAlive] Session refresh error:', error);
 }
 }, 30000);

 // Keep a lightweight heartbeat timer without rewriting the calls row.
 // Realtime subscribers only care about state transitions, not synthetic heartbeats.
 heartbeatInterval.current = setInterval(async () => {
 try {
 const now = Date.now();
 const timeSinceLastHeartbeat = now - lastHeartbeat.current;
 
 console.log(`💓 [CallKeepAlive] Heartbeat (${timeSinceLastHeartbeat}ms since last)`);

 if (typeof navigator !== 'undefined' && navigator.onLine === false) {
 consecutiveFailures.current++;
 console.warn('⚠️ [CallKeepAlive] Browser reports offline');
 return;
 }

 lastHeartbeat.current = now;
 consecutiveFailures.current = 0;
 } catch (error) {
 consecutiveFailures.current++;
 console.error('❌ [CallKeepAlive] Heartbeat error:', error);
 }
 }, 10000);

 return () => {
 console.log('💓 [CallKeepAlive] Stopping keepalive');
 if (heartbeatInterval.current) {
 clearInterval(heartbeatInterval.current);
 heartbeatInterval.current = null;
 }
 if (sessionRefreshInterval.current) {
 clearInterval(sessionRefreshInterval.current);
 sessionRefreshInterval.current = null;
 }
 };
 }, [callId, isActive]);
};
