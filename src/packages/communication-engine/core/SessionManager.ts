import { WebRTCEngine } from '../webrtc/WebRTCEngine';
import { SupabaseSignaling } from '../signaling/SupabaseSignaling';
import { EventBus, CommunicationEvent } from './EventBus';

export class SessionManager {
  private webrtc: WebRTCEngine;
  private signaling: SupabaseSignaling;
  private activeTargetUserId: string | null = null;
  private currentUserId: string;

  constructor(webrtc: WebRTCEngine, signaling: SupabaseSignaling, currentUserId: string) {
    this.webrtc = webrtc;
    this.signaling = signaling;
    this.currentUserId = currentUserId;

    this.signaling.onMessage(this.handleSignalingMessage.bind(this));

    this.webrtc.setOnIceCandidate((candidate) => {
      if (this.activeTargetUserId) {
        this.signaling.sendSignal(this.activeTargetUserId, {
          type: 'ice',
          candidate: candidate.toJSON(),
          from: this.currentUserId,
        });
      }
    });
  }

  public async initiateCall(targetUserId: string, localStream: MediaStream) {
    this.activeTargetUserId = targetUserId;

    // Add local tracks BEFORE creating offer so they're included in SDP
    this.webrtc.addStream(localStream);

    EventBus.getInstance().emit(CommunicationEvent.CALL_STARTED, { targetUserId });

    const offer = await this.webrtc.createOffer();
    await this.signaling.sendSignal(targetUserId, {
      type: 'offer',
      sdp: offer,
      from: this.currentUserId,
    });
  }

  public async acceptCall(targetUserId: string, localStream: MediaStream) {
    // When callee accepts, set their local stream and send answer
    // (remote offer was already set by handleSignalingMessage when offer arrived)
    this.activeTargetUserId = targetUserId;
    this.webrtc.addStream(localStream);

    const answer = await this.webrtc.createAnswer();
    await this.signaling.sendSignal(targetUserId, {
      type: 'answer',
      sdp: answer,
      from: this.currentUserId,
    });
  }

  private async handleSignalingMessage(message: any) {
    console.log('[SessionManager] Received signal:', message.type, 'from:', message.from);

    switch (message.type) {
      case 'offer':
        // Callee side: received an incoming call offer
        // Set the sender as our target so we can answer them
        this.activeTargetUserId = message.from;
        EventBus.getInstance().emit(CommunicationEvent.CALL_RINGING, {
          fromUserId: message.from,
        });
        // Apply the remote offer immediately so ICE candidates can start buffering
        await this.webrtc.handleRemoteOffer(message.sdp);
        // Note: we do NOT send answer here — the UI waits for user to click "Answer"
        // which calls acceptCall(), which adds stream + creates answer
        break;

      case 'answer':
        // Caller side: callee accepted
        await this.webrtc.handleRemoteAnswer(message.sdp);
        break;

      case 'ice':
        await this.webrtc.handleIceCandidate(message.candidate);
        break;

      case 'end':
        this.endSession(false); // Don't send 'end' back — callee already ended
        break;
    }
  }

  public endSession(sendSignal: boolean = true) {
    if (sendSignal && this.activeTargetUserId) {
      this.signaling.sendSignal(this.activeTargetUserId, {
        type: 'end',
        from: this.currentUserId,
      });
    }
    this.webrtc.close();
    this.activeTargetUserId = null;
    EventBus.getInstance().emit(CommunicationEvent.CALL_ENDED);
  }
}
