import { SignalingProvider, SignalingMessage, CallLifecycleMessage } from '../interfaces/SignalingProvider';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SharedAdapterConfig {
  subscribeByCallId?: string; // If set, listens to `call_id=eq.{callId}` instead of `to_user=eq.{userId}`
}

/**
 * A shared compatibility layer for both Desktop (GroupCallManager) and Mobile (SimpleWebRTC) stacks.
 * It normalizes protocol differences (message shapes, database schema mapping) so that both 
 * engines can interoperate without needing to modify their internal logic.
 */
export class SupabaseSignalingAdapter implements SignalingProvider {
  private supabase: any;
  private userId: string = '';
  private config: SharedAdapterConfig;
  
  private onSignalCallback: ((callId: string, message: SignalingMessage) => void) | null = null;
  private onCallStateCallback: ((state: CallLifecycleMessage) => void) | null = null;
  
  private signalsChannel: RealtimeChannel | null = null;
  private callsChannel: RealtimeChannel | null = null;

  constructor(supabaseClient: any, config: SharedAdapterConfig = {}) {
    this.supabase = supabaseClient;
    this.config = config;
  }

  public async connect(userId: string): Promise<void> {
    this.userId = userId;

    const filter = this.config.subscribeByCallId 
      ? `call_id=eq.${this.config.subscribeByCallId}`
      : `to_user=eq.${userId}`;

    // Desktop/Mobile Unified Channel Setup
    // Mobile traditionally used `webrtc-${callId}-${userId}` and Desktop used `webrtc-signals-${userId}`.
    // The channel name itself doesn't matter for Postgres changes, but keeping it standard is good.
    const channelName = this.config.subscribeByCallId 
      ? `webrtc-shared-${this.config.subscribeByCallId}-${userId}`
      : `webrtc-shared-signals-${userId}`;

    this.signalsChannel = this.supabase.channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webrtc_signals', filter },
        (payload: any) => {
          const row = payload.new;
          
          // If filtering by call_id, we MUST check that we are the intended recipient
          if (this.config.subscribeByCallId && row.to_user !== this.userId) {
            return;
          }

          if (this.onSignalCallback) {
            // Translate the DB row back into the standard SignalingMessage expected by the engine
            const type = row.signal_type === 'ice-candidate' ? 'ice' : row.signal_type;
            const sdp = row.signal_type === 'offer' || row.signal_type === 'answer' ? row.signal_data : undefined;
            const candidate = row.signal_type === 'ice-candidate' || row.signal_type === 'ice' ? row.signal_data : undefined;
            const roomId = row.room_id || row.signal_data?.__chatr?.roomId;

            this.onSignalCallback(row.call_id, {
              type: type as any,
              sdp: sdp,
              candidate: candidate,
              from: row.from_user,
              roomId,
              // We pass the raw signal data so Mobile can extract idempotency keys if needed
              rawPayload: row, 
            } as any);
          }
        }
      )
      .subscribe();

    // Listen for call lifecycle state changes (e.g. ringing, ended) directed to me
    // (Used exclusively by Desktop CallContext for now)
    this.callsChannel = this.supabase.channel(`call-lifecycle-shared-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `receiver_id=eq.${userId}` },
        (payload: any) => this.handleCallChange(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `receiver_id=eq.${userId}` },
        (payload: any) => this.handleCallChange(payload.new)
      )
      .subscribe();
  }

  private handleCallChange(row: any) {
    if (this.onCallStateCallback) {
      this.onCallStateCallback({
        callId: row.id,
        status: row.status,
      });
    }
  }

  public onSignal(callback: (callId: string, message: SignalingMessage) => void): void {
    this.onSignalCallback = callback;
  }

  public onCallState(callback: (state: CallLifecycleMessage) => void): void {
    this.onCallStateCallback = callback;
  }

  public async sendSignal(targetUserId: string, callId: string, message: any): Promise<void> {
    let signalType = message.type as string;
    let signalData: any;

    // Normalize protocol differences before DB insertion
    if (message.type === 'ice') {
      signalType = 'ice-candidate'; // Legacy format expected by SimpleWebRTCCall
      signalData = message.candidate;
    } else if (message.type === 'offer' || message.type === 'answer') {
      signalData = message.sdp;
    } else {
      signalData = message.rawPayload?.signal_data || { timestamp: Date.now() }; 
    }

    try {
      const { error } = await this.supabase.from('webrtc_signals').insert([{
        call_id: callId,
        from_user: this.userId,
        to_user: targetUserId,
        signal_type: signalType,
        signal_data: signalData
      }]);

      if (error) {
        console.error('[SharedSignalingAdapter] Failed to send signal:', error);
      }
    } catch (err) {
      console.error('[SharedSignalingAdapter] Exception while sending signal:', err);
    }
  }

  public async updateCallState(callId: string, callerId: string, receiverId: string, status: CallLifecycleMessage['status'], callType?: string): Promise<void> {
    try {
      const updateData: any = { status };
      if (callType) {
        updateData.call_type = callType;
      }
      const { error } = await this.supabase
        .from('calls')
        .update(updateData)
        .eq('id', callId);
        
      if (error) {
        console.error('[SharedSignalingAdapter] Failed to update call state:', error);
      }
    } catch (err) {
      console.error('[SharedSignalingAdapter] Exception while updating call state:', err);
    }
  }

  public disconnect(): void {
    if (this.signalsChannel) this.supabase.removeChannel(this.signalsChannel);
    if (this.callsChannel) this.supabase.removeChannel(this.callsChannel);
    this.signalsChannel = null;
    this.callsChannel = null;
  }
}
