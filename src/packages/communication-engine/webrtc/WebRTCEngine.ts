import { EventBus, CommunicationEvent } from '../core/EventBus';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCEngine {
  private peerConnection: RTCPeerConnection | null = null;
  private onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  private onTrackCallback: ((stream: MediaStream, track: MediaStreamTrack) => void) | null = null;
  private onConnectionStateChangeCallback: ((state: string) => void) | null = null;
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private syntheticStream: MediaStream | null = null;

  constructor(private config?: RTCConfiguration) {}

  public setOnConnectionStateChange(callback: (state: string) => void) {
    this.onConnectionStateChangeCallback = callback;
  }

  public init() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(
      this.config || { iceServers: ICE_SERVERS }
    );

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      let stream = event.streams && event.streams[0];
      if (!stream) {
        if (!this.syntheticStream) {
          this.syntheticStream = new MediaStream();
        }
        this.syntheticStream.addTrack(event.track);
        // Create a new stream reference so UI frameworks (React) detect the update
        stream = new MediaStream(this.syntheticStream.getTracks());
        this.syntheticStream = stream;
      }
      if (this.onTrackCallback) {
        this.onTrackCallback(stream, event.track);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state:', state);
      if (state) {
        this.onConnectionStateChangeCallback?.(state);
      }
      if (state === 'connected') {
        EventBus.getInstance().emit(CommunicationEvent.CALL_CONNECTED);
      } else if (state === 'failed' || state === 'disconnected') {
        EventBus.getInstance().emit(CommunicationEvent.CALL_FAILED);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('[WebRTC] ICE Connection state:', state);
      if (state === 'connected' || state === 'completed') {
        EventBus.getInstance().emit(CommunicationEvent.CALL_CONNECTED);
      } else if (state === 'failed') {
        EventBus.getInstance().emit(CommunicationEvent.CALL_FAILED);
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.peerConnection?.iceGatheringState);
    };
  }

  public ensureInitialized() {
    if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
      this.init();
    }
  }

  public setOnIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidate = callback;
  }

  public setOnTrack(callback: (stream: MediaStream, track: MediaStreamTrack) => void) {
    this.onTrackCallback = callback;
  }

  public addStream(stream: MediaStream) {
    this.ensureInitialized();
    stream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream);
    });
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.ensureInitialized();
    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection!.setLocalDescription(offer);
    return offer;
  }

  public getSignalingState(): string {
    return this.peerConnection?.signalingState || 'closed';
  }

  public async rollback() {
    if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
      await this.peerConnection.setLocalDescription({ type: 'rollback' });
    }
  }

  public async handleRemoteOffer(offer: RTCSessionDescriptionInit) {
    this.ensureInitialized();
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
    // Drain buffered ICE candidates
    for (const c of this.iceCandidateBuffer) {
      await this.peerConnection!.addIceCandidate(new RTCIceCandidate(c));
    }
    this.iceCandidateBuffer = [];
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    this.ensureInitialized();
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    return answer;
  }

  public async handleRemoteAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) throw new Error('[WebRTC] No peer connection to handle answer');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    // Drain buffered ICE candidates
    for (const c of this.iceCandidateBuffer) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
    }
    this.iceCandidateBuffer = [];
  }

  public async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection?.remoteDescription) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Buffer until remote description is set
      this.iceCandidateBuffer.push(candidate);
    }
  }

  public close() {
    this.peerConnection?.close();
    this.peerConnection = null;
    this.iceCandidateBuffer = [];
  }
}
