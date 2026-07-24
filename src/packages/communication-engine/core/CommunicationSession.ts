import { WebRTCEngine } from '../webrtc/WebRTCEngine';
import { SignalingProvider, SignalingMessage, CallLifecycleMessage } from '../interfaces/SignalingProvider';
import { EventBus, CommunicationEvent } from './EventBus';
import { v4 as uuidv4 } from 'uuid';

export interface SessionCapabilities {
  audio: boolean;
  video: boolean;
  screenShare: boolean;
  clipboardSync: boolean;
  fileTransfer: boolean;
  recording: boolean;
}

export const PROTOCOL_VERSION = '1.0.0';

export class CommunicationSession {
  public readonly callId: string;
  private webrtc: WebRTCEngine;
  private signaling: SignalingProvider;
  public readonly targetUserId: string;
  private currentUserId: string;
  
  public remoteCapabilities: SessionCapabilities | null = null;
  public localCapabilities: SessionCapabilities = {
    audio: true,
    video: true,
    screenShare: false,
    clipboardSync: false,
    fileTransfer: false,
    recording: false,
  };

  private hasAccepted: boolean = false;
  private isInitiator: boolean = false;
  private roomId?: string;

  constructor(
    targetUserId: string,
    currentUserId: string,
    signaling: SignalingProvider,
    existingCallId?: string,
    rtcConfig?: RTCConfiguration,
    roomId?: string
  ) {
    this.callId = existingCallId || crypto.randomUUID();
    this.targetUserId = targetUserId;
    this.currentUserId = currentUserId;
    this.signaling = signaling;
    this.roomId = roomId;
    this.webrtc = new WebRTCEngine(rtcConfig);

    this.webrtc.setOnIceCandidate((candidate) => {
      this.signaling.sendSignal(this.targetUserId, this.callId, {
        type: 'ice',
        candidate: candidate.toJSON(),
        from: this.currentUserId,
        protocolVersion: PROTOCOL_VERSION,
        roomId: this.roomId,
      });
    });

    this.webrtc.setOnTrack((stream, track) => {
      EventBus.getInstance().emit(CommunicationEvent.REMOTE_STREAM_READY, {
        userId: this.targetUserId,
        stream,
        track,
      });
    });

    this.webrtc.setOnConnectionStateChange((state) => {
      console.log(`[CommunicationSession] WebRTC state: ${state} for peer ${this.targetUserId}`);
      if (state === 'connected') {
        console.log(`[CommunicationSession] ✅ ICE connected successfully with ${this.targetUserId}`);
      } else if (state === 'failed' || state === 'disconnected') {
        console.warn(`[CommunicationSession] ⚠️ Connection ${state} with ${this.targetUserId}`);
      }
    });
  }

  public getWebRTC() {
    return this.webrtc;
  }

  private addSdpMetadata(description: RTCSessionDescriptionInit): RTCSessionDescriptionInit {
    if (!this.roomId || !description || typeof description !== 'object') {
      return description;
    }

    const existingMeta = (description as any).__chatr || {};
    return {
      ...description,
      __chatr: {
        ...existingMeta,
        roomId: this.roomId,
      },
    } as RTCSessionDescriptionInit;
  }

  public async initiate(localStream: MediaStream, requestedCapabilities?: Partial<SessionCapabilities>, callType?: string) {
    this.hasAccepted = true;
    this.isInitiator = true;
    if (requestedCapabilities) {
      this.localCapabilities = { ...this.localCapabilities, ...requestedCapabilities };
    }

    // Add local tracks BEFORE creating offer so they're included in SDP
    this.webrtc.addStream(localStream);

    EventBus.getInstance().emit(CommunicationEvent.CALL_STARTED, { targetUserId: this.targetUserId, callId: this.callId });

    // 1. Update Call Lifecycle State to 'ringing'
    const resolvedCallType =
      callType === 'video' || callType === 'audio'
        ? callType
        : this.localCapabilities.video ? 'video' : 'audio';
    await this.signaling.updateCallState(this.callId, this.currentUserId, this.targetUserId, 'ringing', resolvedCallType);

    // 2. Send the capability-negotiation offer
    const offer = this.addSdpMetadata(await this.webrtc.createOffer());
    
    // We can inject capabilities into the SDP or send it alongside the signaling payload
    await this.signaling.sendSignal(this.targetUserId, this.callId, {
      type: 'offer',
      sdp: offer,
      from: this.currentUserId,
      protocolVersion: PROTOCOL_VERSION,
      capabilities: Object.keys(this.localCapabilities).filter(k => (this.localCapabilities as any)[k]),
      roomId: this.roomId,
    });
  }

  public async accept(localStream: MediaStream, requestedCapabilities?: Partial<SessionCapabilities>) {
    this.hasAccepted = true;  // CRITICAL: Must be set so we can auto-answer future offers
    this.isInitiator = false; // We are the callee
    if (requestedCapabilities) {
      this.localCapabilities = { ...this.localCapabilities, ...requestedCapabilities };
    }
    
    this.webrtc.addStream(localStream);

    // 1. Update Call Lifecycle State to 'active'
    const callType = this.localCapabilities.video ? 'video' : 'audio';
    await this.signaling.updateCallState(this.callId, this.targetUserId, this.currentUserId, 'active', callType);

    // 2. Create and send Answer
    const answer = this.addSdpMetadata(await this.webrtc.createAnswer());
    await this.signaling.sendSignal(this.targetUserId, this.callId, {
      type: 'answer',
      sdp: answer,
      from: this.currentUserId,
      protocolVersion: PROTOCOL_VERSION,
      capabilities: Object.keys(this.localCapabilities).filter(k => (this.localCapabilities as any)[k]),
      roomId: this.roomId,
    });
    
    console.log(`[CommunicationSession] ✅ Answered offer from ${this.targetUserId} with local tracks: audio=${localStream.getAudioTracks().length} video=${localStream.getVideoTracks().length}`);
  }

  public async handleIncomingSignal(message: SignalingMessage) {
    if (message.capabilities) {
      // Parse remote capabilities
      this.remoteCapabilities = {
        audio: message.capabilities.includes('audio'),
        video: message.capabilities.includes('video'),
        screenShare: message.capabilities.includes('screenShare'),
        clipboardSync: message.capabilities.includes('clipboardSync'),
        fileTransfer: message.capabilities.includes('fileTransfer'),
        recording: message.capabilities.includes('recording'),
      };
    }

    switch (message.type) {
      case 'offer': {
        const isPolite = !this.isInitiator;
        const offerCollision = this.webrtc.getSignalingState() !== 'stable';
        
        if (offerCollision) {
          if (!isPolite) {
            console.log('[CommunicationSession] Glare Collision: Impolite peer ignoring remote offer');
            return;
          }
          console.log('[CommunicationSession] Glare Collision: Polite peer rolling back local offer');
          await this.webrtc.rollback();
        }

        await this.webrtc.handleRemoteOffer(message.sdp);
        if (this.hasAccepted) {
          console.log(`[CommunicationSession] Auto-answering mid-call offer from ${this.targetUserId}`);
          const answer = this.addSdpMetadata(await this.webrtc.createAnswer());
          await this.signaling.sendSignal(this.targetUserId, this.callId, {
            type: 'answer',
            sdp: answer,
            from: this.currentUserId,
            protocolVersion: PROTOCOL_VERSION,
            capabilities: Object.keys(this.localCapabilities).filter(k => (this.localCapabilities as any)[k]),
            roomId: this.roomId,
          });
        }
        break;
      }

      case 'answer':
        await this.webrtc.handleRemoteAnswer(message.sdp);
        break;

      case 'ice':
        await this.webrtc.handleIceCandidate(message.candidate);
        break;

      case 'end':
        this.terminate(false);
        break;
    }
  }

  public async terminate(sendSignal: boolean = true) {
    if (sendSignal) {
      await this.signaling.sendSignal(this.targetUserId, this.callId, {
        type: 'end',
        from: this.currentUserId,
        protocolVersion: PROTOCOL_VERSION,
        roomId: this.roomId,
      });
      // Try to determine if missed or ended. For now assume ended if active, missed if ringing.
      await this.signaling.updateCallState(this.callId, this.currentUserId, this.targetUserId, 'ended');
    }
    
    this.webrtc.close();
    EventBus.getInstance().emit(CommunicationEvent.CALL_ENDED, { callId: this.callId });
  }
}
