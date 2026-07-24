import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
export { supabase };

export type OSEventCallback = (payload: any) => void;

/**
 * The core Realtime Hook for the Business OS.
 * Instead of subscribing directly to Domain tables (like 'exec_decisions'),
 * the UI subscribes exclusively to Business Events from the Event Bus ('os_events').
 * 
 * This ensures the UI is entirely decoupled from the database schema.
 */
export function useOSRealtime(eventType: string, callback: OSEventCallback) {
  useEffect(() => {
    if (!supabase) {
      console.warn(`[OS Realtime] Supabase not configured. Cannot subscribe to event: ${eventType}`);
      return;
    }

    console.log(`[OS Realtime] Subscribing to business event: ${eventType}`);

    const channel = supabase
      .channel(`os_events_${eventType}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'os_events',
          filter: `event_type=eq.${eventType}`,
        },
        (payload) => {
          console.log(`[OS Realtime] Received Event: ${eventType}`, payload.new);
          
          // payload.new is the row inserted into os_events
          // The actual business data is inside payload.new.payload
          const businessEventPayload = payload.new.payload;
          callback(businessEventPayload);
        }
      )
      .subscribe();

    return () => {
      console.log(`[OS Realtime] Unsubscribing from: ${eventType}`);
      supabase.removeChannel(channel);
    };
  }, [eventType, callback]);
}
