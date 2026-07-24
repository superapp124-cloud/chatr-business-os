import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { App as CapacitorApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { ScreenReader } from '@capacitor/screen-reader';

/**
 * Hook for native app optimizations
 * Makes the app feel like Twitter Lite - fast, smooth, native
 */
export const useNativeOptimizations = () => {
 useEffect(() => {
 if (!Capacitor.isNativePlatform()) return;

 let keyboardShowListener: any;
 let keyboardHideListener: any;
 let networkListener: any;
 let appStateListener: any;
 let backButtonListener: any;
 let screenReaderListener: any;

 const setupNativeFeatures = async () => {
 try {
 // 1. Configure Status Bar for native feel
 await StatusBar.setStyle({ style: Style.Dark });
 await StatusBar.setBackgroundColor({ color: '#10b981' });
 
 // Hide on scroll for more screen space (like Twitter)
 await StatusBar.setOverlaysWebView({ overlay: false });

 // 2. Configure Keyboard behavior
 Keyboard.setAccessoryBarVisible({ isVisible: true });
 
 // Smooth keyboard animations
 keyboardShowListener = await Keyboard.addListener('keyboardWillShow', (info) => {
 document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
 });
 
 keyboardHideListener = await Keyboard.addListener('keyboardWillHide', () => {
 document.body.style.setProperty('--keyboard-height', '0px');
 });

 // 3. Monitor network for offline-first experience
 const status = await Network.getStatus();
 console.log('Network status:', status);

 networkListener = await Network.addListener('networkStatusChange', (status) => {
 console.log('Network status changed:', status);
 // Dispatch custom event for app-wide handling
 window.dispatchEvent(new CustomEvent('networkChange', { detail: status }));
 });

 // 4. App state management for battery optimization
 appStateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
 if (isActive) {
 // App resumed - sync data, reconnect realtime
 console.log('App resumed');
 window.dispatchEvent(new Event('appResume'));
 } else {
 // App backgrounded - pause expensive operations
 console.log('App backgrounded');
 window.dispatchEvent(new Event('appPause'));
 }
 });

 // NOTE: appUrlOpen is intentionally NOT handled here.
 // deepLinkHandler.ts owns all deep link routing via initDeepLinkListener().

 // 5. Back button handling (Android)
 backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
 if (!canGoBack) {
 CapacitorApp.exitApp();
 } else {
 window.history.back();
 }
 });

 // 6. Screen reader support for accessibility
 const isEnabled = await ScreenReader.isEnabled();
 console.log('Screen reader enabled:', isEnabled);

 screenReaderListener = await ScreenReader.addListener('stateChange', ({ value }) => {
 console.log('Screen reader state changed:', value);
 });

 } catch (error) {
 console.error('Error setting up native features:', error);
 }
 };

 setupNativeFeatures();

 // Cleanup — only remove what this hook registered
 return () => {
 keyboardShowListener?.remove();
 keyboardHideListener?.remove();
 networkListener?.remove();
 appStateListener?.remove();
 backButtonListener?.remove();
 screenReaderListener?.remove();
 };
 }, []);
};
