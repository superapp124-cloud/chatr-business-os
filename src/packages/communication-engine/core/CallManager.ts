import { DeviceManager } from '../device/DeviceManager';
import { CommunicationSession, SessionCapabilities } from './CommunicationSession';
import { SignalingProvider } from '../interfaces/SignalingProvider';
import { EventBus, CommunicationEvent } from './EventBus';
import { DeviceAdapter } from '../interfaces/DeviceAdapter';

/**
 * The unified Communication Engine facade (One API).
 * Manages active sessions and routes signaling.
 */
export class CallManager {
  private deviceManager: DeviceManager;
  private signaling: SignalingProvider;
  private currentUserId: string;
  private activeSessions: Map<string, CommunicationSession> = new Map();

  constructor(
    currentUserId: string,
    deviceAdapter: DeviceAdapter,
    signalingProvider: SignalingProvider
  ) {
    this.currentUserId = currentUserId;
    this.deviceManager = new DeviceManager(deviceAdapter);
    
    // Inject the pluggable signaling provider
    this.signaling = signalingProvider;
    this.signaling.connect(this.currentUserId);

    // Route incoming signals to the correct session
    this.signaling.onSignal(async (callId, message) => {
      let session = this.activeSessions.get(callId);
      
      if (!session && message.type === 'offer') {
        // Incoming call creates a new session
        session = new CommunicationSession(message.from, this.currentUserId, this.signaling, callId);
        this.activeSessions.set(callId, session);
        EventBus.getInstance().emit(CommunicationEvent.CALL_RINGING, { fromUserId: message.from, callId });
      }

      if (session) {
        await session.handleIncomingSignal(message);
      }
    });

    // Handle lifecycle changes from the signaling layer
    this.signaling.onCallState((state) => {
      // In the future, this can trigger UI changes even if the SDP hasn't arrived yet
      if (state.status === 'ended' || state.status === 'missed' || state.status === 'failed') {
        const session = this.activeSessions.get(state.callId);
        if (session) {
          session.terminate(false);
          this.activeSessions.delete(state.callId);
        }
      }
    });
  }

  public async startCall(targetUserId: string, capabilities: Partial<SessionCapabilities> = { video: true, audio: true }, sessionGoal?: string) {
    const hasPermission = await this.deviceManager.initialize();
    if (!hasPermission) {
      console.error('[CallManager] Permissions denied');
      return;
    }

    const stream = capabilities.video 
      ? await this.deviceManager.getVideoStream()
      : await this.deviceManager.getAudioStream();

    if (!stream) {
      console.error('[CallManager] Failed to get media stream');
      return;
    }

    EventBus.getInstance().emit(CommunicationEvent.LOCAL_STREAM_READY, { stream });

    const session = new CommunicationSession(targetUserId, this.currentUserId, this.signaling);
    this.activeSessions.set(session.callId, session);
    
    await session.initiate(stream, capabilities, sessionGoal);
    return session.callId;
  }

  public async answerCall(callId: string, capabilities: Partial<SessionCapabilities> = { video: true, audio: true }) {
    const session = this.activeSessions.get(callId);
    if (!session) {
      console.error('[CallManager] Call session not found for answering');
      return;
    }

    const hasPermission = await this.deviceManager.initialize();
    if (!hasPermission) return;

    const stream = capabilities.video 
      ? await this.deviceManager.getVideoStream()
      : await this.deviceManager.getAudioStream();

    if (!stream) return;

    EventBus.getInstance().emit(CommunicationEvent.LOCAL_STREAM_READY, { stream });
    await session.accept(stream, capabilities);
  }

  public async endCall(callId?: string) {
    // If no callId specified, end all active sessions
    if (!callId) {
      for (const [id, session] of this.activeSessions.entries()) {
        await session.terminate();
        this.activeSessions.delete(id);
      }
      return;
    }

    const session = this.activeSessions.get(callId);
    if (session) {
      await session.terminate();
      this.activeSessions.delete(callId);
    }
  }

  public on(event: CommunicationEvent, callback: (payload: any) => void): () => void {
    return EventBus.getInstance().subscribe(event, callback);
  }

  public destroy() {
    this.endCall();
    this.signaling.disconnect();
  }
}
