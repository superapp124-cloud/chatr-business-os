import { SignalingProvider, SignalingMessage, CallLifecycleMessage } from '../interfaces/SignalingProvider';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Legacy compatibility transport that mimics SimpleWebRTCCall.
 * Writes SDP/ICE to `webrtc_signals` and lifecycle to `calls` table.
 */
export class DatabaseSignalingProvider implements SignalingProvider {
  private supabase: any;
  private userId: string = '';
  private onSignalCallback: ((callId: string, message: SignalingMessage) => void) | null = null;
  private onCallStateCallback: ((state: CallLifecycleMessage) => void) | null = null;
  
  private signalsChannel: RealtimeChannel | null = null;
  private callsChannel: RealtimeChannel | null = null;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  public async connect(userId: string): Promise<void> {
    this.userId = userId;

    /**
     * Multi-party (group call) correctness
     * ──────────────────────────────────────
     * This channel uses a single Supabase Realtime subscription filtered to
     *   webrtc_signals WHERE to_user = userId
     *
     * In a full-mesh group call every remote peer sends its SDP offer/answer
     * and ICE candidates by inserting individual rows into `webrtc_signals`
     * with  to_user = currentUserId.  Because Postgres row-filter is on the
     * receiver column, ALL those inserts arrive on this ONE channel — there
     * is no need for per-sender or per-room channels.
     *
     * GroupCallManager.constructor() calls onSignal() and routes each message
     * to the correct CommunicationSession by inspecting message.from (== from_user).
     */
    this.signalsChannel = this.supabase.channel(`webrtc-signals-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webrtc_signals', filter: `to_user=eq.${userId}` },
        (payload: any) => {
          const row = payload.new;
          if (this.onSignalCallback) {
            this.onSignalCallback(row.call_id, {
              type: row.signal_type === 'ice-candidate' ? 'ice' : row.signal_type,
              sdp: row.signal_type === 'offer' || row.signal_type === 'answer' ? row.signal_data : undefined,
              candidate: row.signal_type === 'ice-candidate' || row.signal_type === 'ice' ? row.signal_data : undefined,
              from: row.from_user,
            });
          }
        }
      )
      .subscribe();

    // Listen for call lifecycle state changes (e.g. ringing, ended) directed to me
    this.callsChannel = this.supabase.channel(`call-lifecycle-${userId}`)
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
      // Also listen if I am the caller and the receiver accepted/ended
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `caller_id=eq.${userId}` },
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

  public async sendSignal(targetUserId: string, callId: string, message: SignalingMessage): Promise<void> {
    // Translate standard engine message to legacy database format
    let signalType = message.type;
    let signalData = null;

    if (message.type === 'ice') {
      signalType = 'ice-candidate' as any; // Legacy format expected by SimpleWebRTCCall
      signalData = message.candidate;
    } else if (message.type === 'offer' || message.type === 'answer') {
      signalData = message.sdp;
    } else {
      signalData = { timestamp: Date.now() }; // End/video upgrades
    }

    const { error } = await this.supabase.from('webrtc_signals').insert([{
      call_id: callId,
      from_user: this.userId,
      to_user: targetUserId,
      signal_type: signalType,
      signal_data: signalData,
    }]);

    if (error) {
      console.error('[DatabaseSignalingProvider] Failed to insert signal:', error);
    }
  }

  public async updateCallState(callId: string, callerId: string, receiverId: string, status: CallLifecycleMessage['status'], callType: string = 'audio'): Promise<void> {
    // Legacy system uses the `calls` table for lifecycle
    const timestamp = new Date().toISOString();
    
    // Check if call exists
    const { data: existing } = await this.supabase.from('calls').select('id').eq('id', callId).maybeSingle();
    
    if (!existing && status === 'ringing') {
      try {
        // Fetch caller and receiver profiles for full hydration
        const [callerRes, receiverRes] = await Promise.all([
          this.supabase.from('profiles').select('*').eq('id', callerId).single(),
          this.supabase.from('profiles').select('*').eq('id', receiverId).single(),
        ]);

        const callerProfile = callerRes.data;
        const receiverProfile = receiverRes.data;

        // Resolve phones
        const callerPhone = callerProfile?.phone_number || '';
        const receiverPhone = receiverProfile?.phone_number || '';

        // Generate conversation_id so it links correctly in the DB
        const { data: convId } = await this.supabase.rpc('create_direct_conversation', { other_user_id: receiverId });

        await this.supabase.from('calls').insert([{
          id: callId,
          conversation_id: convId,
          caller_id: callerId,
          caller_name: callerProfile?.full_name || callerProfile?.username || 'Unknown Caller',
          caller_avatar: callerProfile?.avatar_url || '',
          caller_phone: callerPhone,
          receiver_id: receiverId,
          receiver_name: receiverProfile?.full_name || receiverProfile?.username || 'Unknown Receiver',
          receiver_avatar: receiverProfile?.avatar_url || '',
          receiver_phone: receiverPhone,
          call_type: callType,
          status: 'ringing',
          started_at: timestamp,
        }]);
      } catch (err) {
        console.error('[DatabaseSignalingProvider] Failed to hydrate new call on ringing:', err);
        // Fallback to basic insert if hydration fails
        await this.supabase.from('calls').insert([{
          id: callId,
          caller_id: callerId,
          receiver_id: receiverId,
          status: 'ringing',
          started_at: timestamp,
        }]);
      }
    } else {
      const updates: any = { status };
      if (status === 'active') updates.started_at = timestamp;
      if (status === 'ended' || status === 'missed' || status === 'failed') updates.ended_at = timestamp;
      
      await this.supabase.from('calls').update(updates).eq('id', callId);
    }
  }

  public onSignal(callback: (callId: string, message: SignalingMessage) => void): void {
    this.onSignalCallback = callback;
  }

  public onCallState(callback: (state: CallLifecycleMessage) => void): void {
    this.onCallStateCallback = callback;
  }

  public disconnect(): void {
    if (this.signalsChannel) this.supabase.removeChannel(this.signalsChannel);
    if (this.callsChannel) this.supabase.removeChannel(this.callsChannel);
    this.signalsChannel = null;
    this.callsChannel = null;
  }
}
