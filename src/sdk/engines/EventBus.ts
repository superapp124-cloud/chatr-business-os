/**
 * CHATR OS — Transport-Agnostic Event Bus
 * 
 * Manages event publishing and subscribing across the OS.
 * Falls back to local window events if Supabase is disconnected/unreachable.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as sharedClient } from '@/integrations/supabase/client';

export type EventCallback = (payload: any) => void;

class OSEventBus {
  private supabase: SupabaseClient | null = null;
  private mode: 'supabase' | 'local' | 'initializing' = 'initializing';
  private subscriptions: Array<{ capabilityId: string; eventName: string; callback: EventCallback; id: string }> = [];

  constructor() {
    this.init();
  }

  private async init() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.warn('[EventBus] No Supabase config. Defaulting to Local Provider.');
      this.mode = 'local';
      return;
    }

    this.supabase = sharedClient;

    // Active connection check
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      
      // Ping health endpoint or run a lightweight query to test connection
      const { error } = await this.supabase.from('os_events').select('id').limit(1).abortSignal(controller.signal);
      clearTimeout(timeoutId);

      if (error) throw error;
      
      this.mode = 'supabase';
    } catch (err) {
      console.warn('[EventBus] Supabase unreachable (timeout/error). Falling back to Local Provider.', err);
      this.mode = 'local';
    }
  }

  private dispatchLocal(capabilityId: string, eventName: string, data: any) {
    if (typeof window === 'undefined') return;
    const payload = { capabilityId, eventName, data };
    const event = new CustomEvent(`os_event_${eventName}`, { detail: payload });
    window.dispatchEvent(event);
  }

  private async resolveTenantId(): Promise<string | null> {
    if (!this.supabase) return null;
    const { data } = await this.supabase.auth.getUser();
    const user = data.user;
    return (
      user?.app_metadata?.tenant_id ||
      user?.user_metadata?.tenant_id ||
      user?.id ||
      null
    );
  }

  public async publish(capabilityId: string, eventName: string, data: any): Promise<void> {
    const start = performance.now();
    if (this.mode === 'supabase' && this.supabase) {
      const payload = { capabilityId, eventName, data };
      
      this.resolveTenantId()
        .then((tenantId) => {
          if (!tenantId) {
            this.dispatchLocal(capabilityId, eventName, data);
            runtimeObservability.recordCall('event_bus', performance.now() - start, true);
            return null;
          }

          return this.supabase!.from('os_events').insert({
            tenant_id: tenantId,
            source: capabilityId,
            event_type: eventName,
            payload
          });
        })
        .then((result) => {
          if (result?.error) {
            this.dispatchLocal(capabilityId, eventName, data);
            runtimeObservability.recordCall('event_bus', performance.now() - start, false);
          } else {
            runtimeObservability.recordCall('event_bus', performance.now() - start, true);
          }
        })
        .catch(() => {
          this.dispatchLocal(capabilityId, eventName, data);
          runtimeObservability.recordCall('event_bus', performance.now() - start, false);
        });
    } else {
      this.dispatchLocal(capabilityId, eventName, data);
      runtimeObservability.recordCall('event_bus', performance.now() - start, true);
    }
  }

  public subscribe(capabilityId: string, eventName: string, callback: EventCallback): () => void {
    const id = Math.random().toString(36).substring(2);
    this.subscriptions.push({ capabilityId, eventName, callback, id });

    let supabaseChannel: any = null;

    if (this.mode === 'supabase' && this.supabase) {
      supabaseChannel = this.supabase.channel(`os_events_${eventName}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'os_events', filter: `event_type=eq.${eventName}` }, (payload) => {
           const evPayload = payload.new.payload;
           if (evPayload.capabilityId === capabilityId || capabilityId === '*') {
             callback(evPayload.data);
           }
        }).subscribe();
    } else {
      // Local listener
      const handler = (e: any) => {
        const payload = e.detail;
        if (payload.capabilityId === capabilityId || capabilityId === '*') {
          callback(payload.data);
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener(`os_event_${eventName}`, handler);
      }
      
      // Store the handler on the subscription object so we can remove it later
      (this.subscriptions.find(s => s.id === id) as any).handler = handler;
    }

    // Return unsubscribe function
    return () => {
      const sub = this.subscriptions.find(s => s.id === id) as any;
      this.subscriptions = this.subscriptions.filter(s => s.id !== id);
      if (supabaseChannel) {
        this.supabase?.removeChannel(supabaseChannel);
      } else {
        if (sub?.handler && typeof window !== 'undefined') {
          window.removeEventListener(`os_event_${eventName}`, sub.handler);
        }
      }
    };
  }
}

export const EventBus = new OSEventBus();
