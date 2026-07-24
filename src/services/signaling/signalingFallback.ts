import { supabase } from '@/integrations/supabase/client';
import { emitSignalingTelemetry } from './signalingTelemetry';

export type FallbackSignalType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'hangup'
  | 'video-request'
  | 'video-accept'
  | 'video-reject'
  | 'video-enable';

export interface FallbackSignalMessage {
  id?: string;
  type: FallbackSignalType;
  callId: string;
  from: string;
  to: string;
  data: unknown;
}

export class SupabaseSignalingFallback {
  private channel: ReturnType<typeof supabase.channel> | null = null;

  constructor(
    private readonly callId: string,
    private readonly userId: string,
    private readonly onMessage: (message: FallbackSignalMessage) => void
  ) {}

  async send(message: FallbackSignalMessage): Promise<boolean> {
    const startedAt = performance.now();
    const { error } = await supabase
      .from('webrtc_signals')
      .insert([{
        call_id: message.callId,
        from_user: message.from,
        to_user: message.to,
        signal_type: message.type,
        signal_data: message.data,
      }]);

    if (error) {
      emitSignalingTelemetry({
        event: 'fallback_send_failed',
        level: 'error',
        transport: 'supabase',
        reason: error.message,
      });
      return false;
    }

    emitSignalingTelemetry({
      event: 'fallback_send_succeeded',
      level: 'debug',
      transport: 'supabase',
      latencyMs: Math.round(performance.now() - startedAt),
      metadata: { type: message.type, callId: message.callId },
    });
    return true;
  }

  subscribe(): void {
    if (this.channel) return;

    this.channel = supabase
      .channel(`webrtc-fallback-${this.callId}-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `call_id=eq.${this.callId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            signal_type: FallbackSignalType;
            signal_data: unknown;
            call_id: string;
            from_user: string;
            to_user: string;
          };

          if (row.to_user !== this.userId) return;

          this.onMessage({
            id: row.id,
            type: row.signal_type,
            callId: row.call_id,
            from: row.from_user,
            to: row.to_user,
            data: row.signal_data,
          });
        }
      )
      .subscribe((status) => {
        emitSignalingTelemetry({
          event: 'fallback_subscription_status',
          level: status === 'SUBSCRIBED' ? 'debug' : 'warn',
          transport: 'supabase',
          metadata: { status, callId: this.callId },
        });
      });
  }

  async close(): Promise<void> {
    if (!this.channel) return;
    await supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
