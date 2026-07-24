import { useEffect } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { toast } from 'sonner';
import { registerDeviceToken } from '@/lib/registerDeviceToken';

export const usePushNotifications = (userId?: string) => {
 useEffect(() => {
 if (!userId) return;

 if (!Capacitor.isNativePlatform()) {
 console.log('Push notifications only available on native platforms');
 return;
 }

 const listenerHandles: PluginListenerHandle[] = [];

 const setupPushNotifications = async () => {
 try {
 // 1. REGISTER LISTENERS FIRST (Zero-latency capture)
 listenerHandles.push(await PushNotifications.addListener('registration', async (token) => {
 const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
 console.log('Push registration success, token:', token.value.substring(0, 20) + '...');
 try {
 await registerDeviceToken(userId, token.value, platform);
 console.log('Device token saved successfully');
 } catch (error) {
 console.error('Error saving device token:', error);
 }
 }));

 listenerHandles.push(await PushNotifications.addListener('registrationError', (error) => {
 console.error('Error on registration:', error);
 }));

 listenerHandles.push(await PushNotifications.addListener('pushNotificationReceived', (notification) => {
 console.log('Push notification received:', notification);
 
 // Suppress generic toast for calling/VoIP notifications to prevent UI clutter
 const data = notification.data || {};
 const type = (data.type || data.notificationType || data.notification_type || "").toLowerCase();
 const isCall = type.includes('call') || type.includes('voice') || type.includes('video') || data.call_id || data.callId;
 if (isCall) {
 console.log('Suppressing generic toast for calling notification');
 return;
 }

 toast(notification.title || 'New notification', {
 description: notification.body,
 });
 }));

 listenerHandles.push(await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
 console.log('Push notification action performed:', notification);
 const data = notification.notification.data;

 const dispatchNav = (path: string) =>
 window.dispatchEvent(new CustomEvent('nativeNavigate', { detail: { path, source: 'push' } }));

 if (data?.click_action) {
 try {
 const url = new URL(data.click_action);
 dispatchNav(url.pathname + url.search);
 } catch {
 dispatchNav(data.click_action);
 }
 } else if (data?.conversationId || data?.conversation_id) {
 dispatchNav(`/chat/${data.conversationId || data.conversation_id}`);
 } else if (data?.notificationType === 'call' || data?.type === 'call') {
 const callId = data.callId || data.call_id;
 if (notification.actionId === 'answer' && callId) {
 dispatchNav(`/#/chat?answerCall=${callId}`);
 } else {
 dispatchNav('/call-history');
 }
 } else {
 dispatchNav('/notifications');
 }
 }));

 // 2. NOW REQUEST PERMISSIONS AND SETUP CHANNELS
 if (Capacitor.getPlatform() === 'android') {
 await PushNotifications.createChannel({
 id: 'calls',
 name: 'Calls',
 description: 'Incoming call notifications',
 importance: 5,
 sound: 'ringtone.mp3',
 vibration: true,
 visibility: 1,
 });

 await PushNotifications.createChannel({
 id: 'messages',
 name: 'Messages',
 description: 'Chat message notifications',
 importance: 4,
 sound: 'notification.mp3',
 vibration: true,
 visibility: 1,
 });
 }

 const permission = await PushNotifications.requestPermissions();
 if (permission.receive === 'granted') {
 await PushNotifications.register();
 }
 } catch (error) {
 console.error('Error setting up push notifications:', error);
 }
 };

 void setupPushNotifications();

 return () => {
 void Promise.all(listenerHandles.map((handle) => handle.remove()));
 };
 }, [userId]);
};
