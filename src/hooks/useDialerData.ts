import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CallerIntelligence } from '@/lib/chatr-shield/types';
import {
  chooseCallerDisplayName,
  createFallbackCallerIdentity,
  dedupeCallerEvents,
  formatPhoneForDisplay,
  getPhoneLookupKey,
  hydrateCallRowsForUser,
  resolveCallerIdentities,
} from '@/utils/callerIdentityResolver';

function normalizeNativeTimestamp(value: any): string {
  const date =
    typeof value === 'number'
      ? new Date(value)
      : typeof value === 'string' && /^\d+$/.test(value)
        ? new Date(Number(value))
        : value
          ? new Date(value)
          : new Date();

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

let cachedRecents: CallerIntelligence[] | null = null;

export function useDialerData() {
  const [recents, setRecents] = useState<CallerIntelligence[]>(cachedRecents || []);
  const [loading, setLoading] = useState(!cachedRecents);

  const fetchRecents = async () => {
    try {
      if (cachedRecents) {
        setRecents(cachedRecents);
        setLoading(false);
      } else {
        setLoading(true);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRecents([]);
        return;
      }

      const [callsResult, nativeEventsResult] = await Promise.all([
        supabase
          .from('calls')
          .select('*')
          .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(50),
        (supabase as any)
          .from('native_call_events')
          .select('id, phone_number, normalized_number, contact_name, caller_name, direction, status, started_at, trust_score, spam_reports, risk_level')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(50),
      ]);

      if (callsResult.error) throw callsResult.error;
      if (nativeEventsResult.error) {
        console.warn('Native call events not available:', nativeEventsResult.error);
      }

      window.ChatrNativeRuntime?.syncNativeCallLogNow?.();

      const hydratedCalls = await hydrateCallRowsForUser(callsResult.data || [], user.id);
      const formattedCalls: CallerIntelligence[] = hydratedCalls.map((call: any) => {
        const intel = call.otherIdentity;
        return {
          ...intel,
          displayName: call.otherName,
          phoneNumber: call.otherPhone,
          avatarUrl: call.otherAvatar,
          lastActive: call.created_at,
          aiSummary: call.isOutgoing ? 'Outgoing Chatr+ Call' : intel.aiSummary,
          source: 'chatr-voip',
          direction: call.isOutgoing ? 'outgoing' : 'incoming',
          callStatus: call.status,
          callType: call.call_type,
        } as any;
      });

      const nativeEvents = nativeEventsResult.data || [];
      const nativeIdentityMap = await resolveCallerIdentities(
        nativeEvents.map((event: any) => event.normalized_number || event.phone_number),
        user.id
      );
      const formattedNativeEvents: CallerIntelligence[] = nativeEvents.map((event: any) => {
        const number = event.normalized_number || event.phone_number || '';
        const key = getPhoneLookupKey(number);
        const base = nativeIdentityMap.get(key) || createFallbackCallerIdentity(number);
        const fallbackName = chooseCallerDisplayName([event.contact_name, event.caller_name], number);
        const displayName = fallbackName || chooseCallerDisplayName([base.displayName], base.phoneNumber) || formatPhoneForDisplay(base.phoneNumber || number);
        const spamReports = Number(event.spam_reports ?? base.spamReports ?? 0);
        const trustScore = Number(event.trust_score ?? base.trustScore ?? 50);

        return {
          ...base,
          displayName,
          phoneNumber: base.phoneNumber || number,
          trustScore,
          trustBand: event.risk_level === 'spam' || spamReports >= 5 ? 'block' : base.trustBand,
          communityReportCount: Math.max(base.communityReportCount || 0, spamReports),
          lastActive: normalizeNativeTimestamp(event.started_at),
          source: 'native-call-log',
          direction: event.direction,
          callStatus: event.status,
          callType: 'carrier',
        } as any;
      });

      let allLogs = [...formattedCalls, ...formattedNativeEvents];

      // Merge the on-device SQLite cache exposed by MainActivity. This is the
      // fastest source for Recents and works before Supabase catches up.
      if (window.ChatrNativeRuntime?.getRecentNativeCalls) {
        try {
          const rawNativeLogs = window.ChatrNativeRuntime.getRecentNativeCalls(75);
          const parsedNativeLogs = JSON.parse(rawNativeLogs || '[]');
          const nativeBridgeEvents = Array.isArray(parsedNativeLogs) ? parsedNativeLogs : [];
          const bridgeIdentityMap = await resolveCallerIdentities(
            nativeBridgeEvents.map((event: any) => event.normalized_number || event.phone_number || event.caller_phone || event.receiver_phone),
            user.id
          );

          const bridgeLogs: CallerIntelligence[] = nativeBridgeEvents.map((event: any) => {
            const number = event.normalized_number || event.phone_number || event.caller_phone || event.receiver_phone || '';
            const key = getPhoneLookupKey(number);
            const base = bridgeIdentityMap.get(key) || createFallbackCallerIdentity(number);
            const nativeName = chooseCallerDisplayName([event.contact_name, event.caller_name, event.receiver_name], number);
            const displayName = nativeName || chooseCallerDisplayName([base.displayName], base.phoneNumber) || formatPhoneForDisplay(base.phoneNumber || number);
            const spamReports = Number(event.spam_reports ?? base.spamReports ?? 0);
            const trustScore = Number(event.trust_score ?? base.trustScore ?? 50);

            return {
              ...base,
              displayName,
              phoneNumber: base.phoneNumber || key || number,
              trustScore,
              trustBand: event.risk_level === 'spam' || spamReports >= 5 ? 'block' : base.trustBand,
              communityReportCount: Math.max(base.communityReportCount || 0, spamReports),
              lastActive: normalizeNativeTimestamp(event.started_at || event.created_at),
              source: 'native-call-log',
              direction: event.direction,
              callStatus: event.status,
              callType: event.call_type || 'carrier',
            } as any;
          });

          allLogs = [...allLogs, ...bridgeLogs];
        } catch (e) {
          console.warn('Native call logs not available', e);
        }
      }

      allLogs = dedupeCallerEvents(allLogs)
        .sort((a: any, b: any) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
        .slice(0, 75);

      cachedRecents = allLogs;
      setRecents(allLogs);
    } catch (err) {
      console.error('Error fetching recents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecents();

    const handleContactsSynced = () => fetchRecents();
    window.addEventListener('chatr:contacts-synced', handleContactsSynced);

    // Real-time subscription to new calls
    const channel = supabase
      .channel('public:calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, () => {
        fetchRecents();
      })
      .subscribe();

    return () => {
      window.removeEventListener('chatr:contacts-synced', handleContactsSynced);
      supabase.removeChannel(channel);
    };
  }, []);

  return { recents, loading, refresh: fetchRecents };
}
