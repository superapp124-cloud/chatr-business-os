import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { syncContacts } from '@/utils/contactSync';
import { toast } from 'sonner';

import { isCallActiveOrInitializing } from '@/utils/performanceOptimizations';

/**
 * Auto-sync contacts hook — runs on app launch, then every 12 hours.
 *
 * Delegates to syncContacts() in contactSync.ts which:
 * 1. Reads native device phonebook via Capacitor Contacts plugin
 * 2. Normalizes all numbers to E.164 format
 * 3. Upserts to Supabase via sync_user_contacts RPC (matches profiles by phone_number)
 *
 * Runs 3 seconds after mount to avoid blocking the initial render frame.
 */
export const useAutoContactSync = (userId: string | undefined) => {
 useEffect(() => {
 if (!userId) return;
 if (!Capacitor.isNativePlatform()) return;

 const SYNC_KEY = `auto_sync_${userId}`;
 const INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

 const runSync = async () => {
 try {
 if (isCallActiveOrInitializing()) {
 console.log('⏳ [ContactSync] Deferring phonebook sync — call active/initializing');
 return;
 }
 const lastSync = localStorage.getItem(SYNC_KEY);
 const now = Date.now();

 if (lastSync && now - parseInt(lastSync) < INTERVAL_MS) {
 const nextSyncMins = Math.round((INTERVAL_MS - (now - parseInt(lastSync))) / 60000);
 console.log(`⏰ [ContactSync] Next sync in ~${nextSyncMins} min`);
 return;
 }

 console.log('🔄 [ContactSync] Starting phonebook sync...');
 const count = await syncContacts(userId);
 localStorage.setItem(SYNC_KEY, Date.now().toString());
 window.dispatchEvent(new CustomEvent('chatr:contacts-synced', { detail: { count } }));
 console.log(`✅ [ContactSync] Synced ${count} contacts`);
 if (count > 0) {
 toast.success(`Synced ${count} contacts from phonebook`);
 }
 } catch (error: any) {
 // Silently handle — permission denied, no contacts, etc.
 console.log('ℹ️ [ContactSync] Skipped:', error?.message || error);
 if (error?.message?.includes('permission')) {
 toast.error('Contact permission required for sync');
 }
 }
 };

 // Small delay to let initial render complete first
 const timer = setTimeout(runSync, 3000);
 return () => clearTimeout(timer);
 }, [userId]);
};
