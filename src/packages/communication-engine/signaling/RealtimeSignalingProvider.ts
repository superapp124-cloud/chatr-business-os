import { SignalingProvider, SignalingMessage, CallLifecycleMessage } from '../interfaces/SignalingProvider';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Future high-performance transport that uses purely Realtime Broadcast.
 * Skips the database entirely for signaling, but still requires a way 
 * to notify offline users (Push) or update call history.
 */
export class RealtimeSignalingProvider implements SignalingProvider {
  private inboundChannel: RealtimeChannel | null = null;
  private onSignalCallback: ((callId: string, message: SignalingMessage) => void) | null = null;
  private onCallStateCallback: ((state: CallLifecycleMessage) => void) | null = null;
  private supabaseClient: any;
  private userId: string = '';

  constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient;
  }

  public async connect(userId: string): Promise<void> {
    this.userId = userId;

    // Each user subscribes to their own personal signaling channel
    this.inboundChannel = this.supabaseClient.channel(`signaling:${userId}`, {
      config: { broadcast: { self: false } },
    });

    this.inboundChannel
      .on('broadcast', { event: 'webrtc-signal' }, (payload: { payload: { callId: string, message: SignalingMessage } }) => {
        console.log('[RealtimeSignaling] Received signal:', payload.payload?.message?.type);
        if (this.onSignalCallback && payload.payload) {
          this.onSignalCallback(payload.payload.callId, payload.payload.message);
        }
      })
      .on('broadcast', { event: 'call-lifecycle' }, (payload: { payload: CallLifecycleMessage }) => {
        console.log('[RealtimeSignaling] Received lifecycle:', payload.payload?.status);
        if (this.onCallStateCallback && payload.payload) {
          this.onCallStateCallback(payload.payload);
        }
      })
      .subscribe((status: string) => {
        console.log(`[RealtimeSignaling] ${userId} subscribed: ${status}`);
      });
  }

  public onSignal(callback: (callId: string, message: SignalingMessage) => void) {
    this.onSignalCallback = callback;
  }

  public onCallState(callback: (state: CallLifecycleMessage) => void): void {
    this.onCallStateCallback = callback;
  }

  public async sendSignal(targetUserId: string, callId: string, message: SignalingMessage): Promise<void> {
    if (!this.supabaseClient) return;

    console.log('[RealtimeSignaling] Sending signal to', targetUserId, ':', message.type);

    const outboundChannel = this.supabaseClient.channel(`signaling:${targetUserId}`, {
      config: { broadcast: { self: false } },
    });

    await new Promise<void>((resolve) => {
      outboundChannel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await outboundChannel.send({
            type: 'broadcast',
            event: 'webrtc-signal',
            payload: { callId, message },
          });
          await this.supabaseClient.removeChannel(outboundChannel);
          resolve();
        }
      });
    });
  }

  public async updateCallState(callId: string, callerId: string, receiverId: string, status: CallLifecycleMessage['status']): Promise<void> {
    const targetUserId = this.userId === callerId ? receiverId : callerId;
    
    const outboundChannel = this.supabaseClient.channel(`signaling:${targetUserId}`, {
      config: { broadcast: { self: false } },
    });

    await new Promise<void>((resolve) => {
      outboundChannel.subscribe(async (subStatus: string) => {
        if (subStatus === 'SUBSCRIBED') {
          await outboundChannel.send({
            type: 'broadcast',
            event: 'call-lifecycle',
            payload: { callId, status },
          });
          await this.supabaseClient.removeChannel(outboundChannel);
          resolve();
        }
      });
    });
  }

  public disconnect() {
    if (this.inboundChannel) {
      this.supabaseClient.removeChannel(this.inboundChannel);
      this.inboundChannel = null;
    }
  }
}
