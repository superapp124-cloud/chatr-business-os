export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice' | 'end' | 'video-upgrade' | 'video-accept' | 'video-reject' | 'video-enable';
  sdp?: any;
  candidate?: any;
  from: string;
  protocolVersion?: string;
  capabilities?: string[];
  roomId?: string;
  rawPayload?: any;
}

export interface CallLifecycleMessage {
  callId: string;
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed' | 'failed' | 'active';
}

export interface SignalingProvider {
  /** Connect to the signaling transport */
  connect(userId: string): Promise<void>;
  
  /** Send a WebRTC session signal (SDP/ICE) */
  sendSignal(targetUserId: string, callId: string, message: SignalingMessage): Promise<void>;
  
  /** Update the call lifecycle state (triggers ringing, etc on remote) */
  updateCallState(callId: string, callerId: string, receiverId: string, status: CallLifecycleMessage['status'], callType?: string): Promise<void>;
  
  /** Register callback for incoming WebRTC signals */
  onSignal(callback: (callId: string, message: SignalingMessage) => void): void;
  
  /** Register callback for remote call lifecycle state changes */
  onCallState(callback: (state: CallLifecycleMessage) => void): void;
  
  /** Disconnect from transport */
  disconnect(): void;
}
