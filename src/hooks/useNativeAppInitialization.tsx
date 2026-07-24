import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceFingerprint, getDeviceName, getDeviceType } from '@/utils/deviceFingerprint';
import { initDeepLinkListener } from '@/utils/deepLinkHandler';
import { persistDeviceCapabilities } from '@/utils/deviceCapabilities';

/**
 * Comprehensive native app initialization
 * Handles all native features, permissions, and device setup
 */
export const useNativeAppInitialization = (userId?: string) => {
 useEffect(() => {
 if (!Capacitor.isNativePlatform()) return;

 let deepLinkCleanup: (() => void) | undefined;
 let cancelled = false;
 let deferredInitTimer: number | undefined;
 let networkListener: PluginListenerHandle | undefined;
 let appStateListener: PluginListenerHandle | undefined;
 let backButtonListener: PluginListenerHandle | undefined;

 const isCallActive = typeof window !== 'undefined' &&
 (!!(window as any).__CALL_STATE__ || 
 window.location.hash.includes('call') || 
 window.location.search.includes('call'));

 const waitForFirstPaint = () => new Promise<void>((resolve) => {
 deferredInitTimer = window.setTimeout(resolve, isCallActive ? 8000 : 2500);
 });

 // 1. Register event listeners immediately and keep handles for cleanup.
 const listenerSetup = (async () => {
 networkListener = await Network.addListener('networkStatusChange', (status) => {
 if (status.connected) {
 toast.success('Back online', { duration: 2000 });
 } else {
 toast.error('No internet connection', { duration: 3000 });
 }
 });

 appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
 console.log('App state changed. Active:', isActive);
 if (isActive && userId) {
 supabase.from('profiles').update({
 last_seen_at: new Date().toISOString()
 }).eq('id', userId).then(() => {
 console.log('✅ Updated last seen');
 });
 }
 });

 if (Capacitor.getPlatform() === 'android') {
 backButtonListener = await App.addListener('backButton', ({ canGoBack }) => {
 if (!canGoBack) {
 if (confirm('Exit Chatr?')) {
 App.exitApp();
 }
 } else {
 window.history.back();
 }
 });
 }

 if (cancelled) {
 networkListener?.remove();
 appStateListener?.remove();
 backButtonListener?.remove();
 }
 })().catch((error) => {
 console.warn('Native listener setup failed:', error);
 });

 const initializeNativeFeatures = async () => {
 try {
 console.log('🚀 Initializing native app features...');

 // 2. Hide the native splash immediately
 await SplashScreen.hide().catch(() => {});

 // 3. Configure status bar
 if (Capacitor.getPlatform() !== 'web') {
 const isAndroid = Capacitor.getPlatform() === 'android';
 await StatusBar.setStyle({ style: isAndroid ? Style.Dark : Style.Light });
 await StatusBar.setBackgroundColor({ color: isAndroid ? '#f4efff' : '#00000000' });
 await StatusBar.setOverlaysWebView({ overlay: !isAndroid });
 }

 // 4. Deep linking support (CRITICAL: Immediate registration)
 initDeepLinkListener().then(cleanup => {
 deepLinkCleanup = cleanup;
 });

 // 5. Wait for heavier background tasks to prevent UI jank
 await waitForFirstPaint();
 if (cancelled) return;

 console.log('Initializing deferred native app features...');

 // 6. Register device session
 if (userId) {
 try {
 const fingerprint = await getDeviceFingerprint();
 const deviceName = await getDeviceName();
 const deviceType = await getDeviceType();

 await supabase.from('device_sessions').upsert([{
 device_fingerprint: fingerprint,
 device_name: deviceName,
 device_type: deviceType,
 is_active: true,
 last_active: new Date().toISOString(),
 user_id: userId,
 expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
 session_token: crypto.randomUUID(),
 }], {
 onConflict: 'device_fingerprint'
 });

 console.log('✅ Device session registered');
 
 // Subscribe to device_sessions changes to auto-logout if session is revoked
 supabase.channel(`device-session-${fingerprint}`)
 .on(
 'postgres_changes',
 {
 event: 'UPDATE',
 schema: 'public',
 table: 'device_sessions',
 filter: `device_fingerprint=eq.${fingerprint}`
 },
 (payload) => {
 if (payload.new && payload.new.is_active === false) {
 console.log('Device session was revoked remotely. Logging out...');
 supabase.auth.signOut().then(() => {
 window.location.href = '/auth';
 });
 }
 }
 )
 .subscribe();

 persistDeviceCapabilities().catch(() => {});
 } catch (err) {
 console.log('Device session registration skipped');
 }
 }

 // 7. Request critical permissions
 await requestPermissions();

 console.log('✅ Native app initialization complete');

 } catch (error) {
 console.error('❌ Native initialization error:', error);
 }
 };

 const requestPermissions = async () => {
 try {
 console.log('📱 Native permissions ready');
 } catch (error) {
 console.error('Permission setup error:', error);
 }
 };

 initializeNativeFeatures();

 return () => {
 cancelled = true;
 if (deferredInitTimer) {
 window.clearTimeout(deferredInitTimer);
 }
 
 // Clean up all registered listeners immediately and safely
 listenerSetup.then(() => {
 networkListener?.remove();
 appStateListener?.remove();
 backButtonListener?.remove();
 }).catch(e => console.warn('Error cleanup native listeners:', e));
 deepLinkCleanup?.();
 };
 }, [userId]);
};
