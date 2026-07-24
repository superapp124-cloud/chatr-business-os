/**
 * GroupCallManager — P2P Mesh Group Call Orchestrator
 *
 * Architecture overview
 * ─────────────────────
 * For an N-person group call every participant keeps (N-1) separate
 * CommunicationSessions — one per peer.  This is the classic "full mesh"
 * topology: no SFU or MCU is required.
 *
 * Hard limit: 10 participants (9 peers + self).  Beyond that WebRTC
 * bandwidth becomes impractical for a mobile messenger.
 *
 * Signaling flow
 * ──────────────
 * • joinRoom() is called by the local user after they obtain a MediaStream.
 * • HOST: calls joinRoom() with shouldInitiate=true. Creates a CommunicationSession
 *   per peer and calls session.initiate() → sends SDP offer → creates `calls` row.
 * • CALLEE (Desktop): may receive the offer BEFORE they call joinRoom() (because the
 *   ringing notification takes a few seconds to be seen+clicked). The offer is buffered
 *   in pendingOffers. When the callee eventually calls joinRoom(), buffered offers are
 *   replayed immediately, creating a session and sending back an SDP answer.
 * • CALLEE (Mobile): receives the ringing notification via the `calls` table INSERT and
 *   fetches the pre-inserted offer from `webrtc_signals` on answer — fully compatible.
 * • Incoming offers from peers arrive via the shared SignalingProvider.onSignal
 *   callback wired up inside the constructor.
 * • When any session's WebRTC engine fires REMOTE_STREAM_READY we emit
 *   ROOM_PARTICIPANT_JOINED so the UI can render the participant tile.
 * • When leaveRoom() is called every session is terminated gracefully.
 */

import { CommunicationSession, SessionCapabilities } from './CommunicationSession';
import { SignalingProvider, SignalingMessage } from '../interfaces/SignalingProvider';
import { EventBus, CommunicationEvent } from './EventBus';
import { getTurnConfig } from '@/utils/webrtcSignaling';

/** Maximum number of participants in a single room (including self). */
const MAX_ROOM_PARTICIPANTS = 10;

export interface RoomParticipantJoinedPayload {
  userId: string;
  stream: MediaStream;
}

export interface RoomParticipantLeftPayload {
  userId: string;
}

export interface GroupRoomState {
  roomId: string;
  localStream: MediaStream;
  participants: string[];
  capabilities: Partial<SessionCapabilities>;
  rtcConfig?: RTCConfiguration;
}

/** Buffered offer that arrived before joinRoom() was called. */
interface PendingOffer {
  callId: string;
  message: SignalingMessage;
}

export class GroupCallManager {
  private currentUserId: string;
  private signaling: SignalingProvider;

  /**
   * roomSessions: roomId -> Map<participantUserId, CommunicationSession>
   */
  private roomSessions: Map<string, Map<string, CommunicationSession>> = new Map();

  /**
   * Per-room state stored so late-joining peers can be handled symmetrically.
   */
  private roomState: Map<string, GroupRoomState> = new Map();

  /** EventBus unsubscribe handles per room — cleaned up in leaveRoom. */
  private eventUnsubs: Map<string, Array<() => void>> = new Map();

  /**
   * Buffer for SDP offers that arrive before joinRoom() is called.
   * Key = peerId (from_user). These are replayed in joinRoom().
   */
  private pendingOffers: Map<string, PendingOffer[]> = new Map();

  /**
   * Buffer for ICE candidates that arrive before the session is created.
   * Key = `${callId}:${peerId}`
   */
  private pendingIce: Map<string, SignalingMessage[]> = new Map();

  constructor(currentUserId: string, signalingProvider: SignalingProvider) {
    this.currentUserId = currentUserId;
    this.signaling = signalingProvider;

    /**
     * Global inbound-signal handler.
     *
     * DatabaseSignalingProvider.connect() subscribes to `webrtc_signals`
     * filtered by  to_user = currentUserId  — so ALL signals sent to this
     * user arrive here, regardless of sender.  This is correct for the
     * full-mesh topology: each peer sends SDP/ICE directly to every other
     * peer using their own individual rows in webrtc_signals.
     */
    this.signaling.onSignal(async (callId: string, message: SignalingMessage) => {
      if (
        message.type !== 'offer' &&
        message.type !== 'answer' &&
        message.type !== 'ice' &&
        message.type !== 'end'
      ) {
        return;
      }

      const peerId = message.from;
      let targetRoomId =
        message.roomId ||
        message.rawPayload?.room_id ||
        message.rawPayload?.signal_data?.__chatr?.roomId ||
        callId;
      let isRoomActive = this.roomState.has(targetRoomId);

      // 1. Already have a session for this peer
      for (const [roomId, peers] of this.roomSessions.entries()) {
        if (peers.has(peerId)) {
          targetRoomId = roomId;
          isRoomActive = true;
          break;
        }
      }

      // 2. Room state exists but session not yet created (late-join offer)
      if (!isRoomActive && (message.type === 'offer' || message.type === 'ice')) {
        for (const [roomId, state] of this.roomState.entries()) {
          if (state.participants.includes(peerId)) {
            targetRoomId = roomId;
            isRoomActive = true;
            break;
          }
        }
      }

      // ── No room state yet: buffer the signal ──────────────────────────────
      if (!isRoomActive) {
        if (message.type === 'offer') {
          // Buffer offer — will be replayed when joinRoom() is called
          const existing = this.pendingOffers.get(peerId) || [];
          existing.push({ callId, message });
          this.pendingOffers.set(peerId, existing);
          console.log(`[GroupCallManager] Buffered offer from ${peerId} (callId: ${callId})`);
        } else if (message.type === 'ice') {
          // Buffer ICE candidates linked to call+peer
          const key = `${callId}:${peerId}`;
          const existing = this.pendingIce.get(key) || [];
          existing.push(message);
          this.pendingIce.set(key, existing);
          console.log(`[GroupCallManager] Buffered ICE from ${peerId}`);
        } else {
          console.warn(
            `[GroupCallManager] Received ${message.type} from unknown peer ${peerId} — ignoring.`
          );
        }
        return;
      }

      // ── Session doesn't exist yet but room does (inbound offer path) ──────
      let session = this.roomSessions.get(targetRoomId)?.get(peerId);

      if (!session && message.type === 'offer') {
        const state = this.roomState.get(targetRoomId);
        if (!state) return;

        session = this._createSession(targetRoomId, peerId, callId, state.rtcConfig);
        await session.handleIncomingSignal(message);
        await session.accept(state.localStream, state.capabilities);

        // Drain any buffered ICE for this call+peer
        const iceKey = `${callId}:${peerId}`;
        const bufferedIce = this.pendingIce.get(iceKey) || [];
        for (const ice of bufferedIce) {
          await session.handleIncomingSignal(ice);
        }
        this.pendingIce.delete(iceKey);
        return;
      } else if (!session && message.type === 'ice') {
        // Buffer ICE candidate if session isn't created yet (arrived before offer)
        const iceKey = `${callId}:${peerId}`;
        const bufferedIce = this.pendingIce.get(iceKey) || [];
        bufferedIce.push(message);
        this.pendingIce.set(iceKey, bufferedIce);
        console.log(`[GroupCallManager] Buffered out-of-order ICE from ${peerId}`);
        return;
      }

      if (session) {
        await session.handleIncomingSignal(message);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Join (or create) a group call room.
   *
   * @param roomId       Unique room identifier (stored in session_rooms table).
   * @param participants Array of remote user-IDs (must not include self, max 9).
   * @param localStream  Already-acquired local MediaStream.
   * @param capabilities Negotiation options (default: audio + video).
   * @param shouldInitiate When true (default), sends SDP offers to all peers.
   *                       Pass false if you only want to set up state and wait for
   *                       inbound offers (useful if you know peers will initiate).
   */
  public async joinRoom(
    roomId: string,
    participants: string[],
    localStream: MediaStream,
    capabilities: Partial<SessionCapabilities> = { audio: true, video: true },
    shouldInitiate: boolean = true,
    peerCallIds?: Record<string, string>
  ): Promise<void> {
    const peers = participants.filter(uid => uid !== this.currentUserId);
    const totalParticipants = peers.length + 1; // +1 for self

    if (totalParticipants > MAX_ROOM_PARTICIPANTS) {
      throw new Error(
        `[GroupCallManager] Room "${roomId}" exceeds the ${MAX_ROOM_PARTICIPANTS}-participant limit. ` +
        `Attempted ${peers.length} peers + self = ${totalParticipants}.`
      );
    }

    if (this.roomSessions.has(roomId)) {
      console.warn(`[GroupCallManager] Already in room "${roomId}". Call leaveRoom() first.`);
      return;
    }

    // Fetch robust STUN/TURN configurations from the edge function cache
    let rtcConfig: RTCConfiguration | undefined = undefined;
    try {
      const iceServers = await getTurnConfig();
      if (iceServers && iceServers.length > 0) {
        rtcConfig = { iceServers };
        console.log(`[GroupCallManager] Using dynamic ICE servers for room ${roomId}`);
      }
    } catch (e) {
      console.warn('[GroupCallManager] Failed to fetch dynamic ICE servers, falling back to WebRTCEngine default', e);
    }

    this.roomSessions.set(roomId, new Map());
    this.eventUnsubs.set(roomId, []);
    this.roomState.set(roomId, { roomId, localStream, participants: peers, capabilities, rtcConfig });

    console.log(`[GroupCallManager] Joining room "${roomId}" with ${peers.length} peer(s). shouldInitiate=${shouldInitiate}`);

    EventBus.getInstance().emit(CommunicationEvent.LOCAL_STREAM_READY, { stream: localStream });

    // ── Replay buffered offers from peers that arrived before joinRoom() ────
    // This handles the Desktop-to-Desktop race: the offer arrived while the
    // user was reading the incoming call notification. Now that we have room
    // state, we can process it.
    for (const peerId of peers) {
      const buffered = this.pendingOffers.get(peerId);
      if (buffered && buffered.length > 0) {
        const { callId, message } = buffered[0]; // Process the first (most recent) offer
        console.log(`[GroupCallManager] Replaying buffered offer from ${peerId}`);

        const session = this._createSession(roomId, peerId, callId, rtcConfig);
        await session.handleIncomingSignal(message);
        await session.accept(localStream, capabilities);

        // Drain buffered ICE for this call+peer
        const iceKey = `${callId}:${peerId}`;
        const bufferedIce = this.pendingIce.get(iceKey) || [];
        for (const ice of bufferedIce) {
          await session.handleIncomingSignal(ice);
        }
        this.pendingIce.delete(iceKey);
        this.pendingOffers.delete(peerId);
        // Don't initiate to this peer — we already answered their offer
        continue;
      }

      // No buffered offer — initiate if required
      if (shouldInitiate) {
        const sessionCallId = peerCallIds?.[peerId] || roomId;
        const session = this._createSession(roomId, peerId, sessionCallId, rtcConfig);
        try {
          await session.initiate(localStream, capabilities, capabilities.video ? 'video' : 'audio');
        } catch (err) {
          console.error(`[GroupCallManager] Failed to initiate session with ${peerId}:`, err);
        }
      }
    }

    // If shouldInitiate=false and no peers have pending offers, just wait passively
    if (!shouldInitiate) {
      console.log(`[GroupCallManager] Waiting passively for offers in room "${roomId}".`);
    }
  }

  /**
   * Leave a room — terminates all peer sessions and cleans up subscriptions.
   */
  public async leaveRoom(roomId: string): Promise<void> {
    const peers = this.roomSessions.get(roomId);
    if (!peers) {
      console.warn(`[GroupCallManager] Not in room "${roomId}".`);
      return;
    }

    console.log(`[GroupCallManager] Leaving room "${roomId}".`);

    const terminations = Array.from(peers.entries()).map(async ([peerId, session]) => {
      try {
        await session.terminate(true);
      } catch (err) {
        console.error(`[GroupCallManager] Error terminating session with ${peerId}:`, err);
      }
      EventBus.getInstance().emit(CommunicationEvent.ROOM_PARTICIPANT_LEFT, {
        userId: peerId,
      } as RoomParticipantLeftPayload);
    });

    await Promise.allSettled(terminations);

    const unsubs = this.eventUnsubs.get(roomId) ?? [];
    unsubs.forEach(fn => fn());

    this.roomSessions.delete(roomId);
    this.roomState.delete(roomId);
    this.eventUnsubs.delete(roomId);
  }

  /**
   * Add a single new peer to an existing room and initiate an offer to them.
   * Use this when inviting participants mid-call.
   *
   * @param roomId  The existing room to add the peer to.
   * @param peerId  The new participant's user ID.
   * @param callId  The calls-table row ID to use for WebRTC signaling (must match what mobile expects).
   */
  public async addPeer(roomId: string, peerId: string, callId: string): Promise<void> {
    const state = this.roomState.get(roomId);
    if (!state) {
      console.warn(`[GroupCallManager] addPeer: not in room "${roomId}"`);
      return;
    }

    if (this.roomSessions.get(roomId)?.has(peerId)) {
      console.warn(`[GroupCallManager] addPeer: already have a session with ${peerId}`);
      return;
    }

    // Register the peer in room state so inbound signals can be routed
    if (!state.participants.includes(peerId)) {
      state.participants.push(peerId);
    }

    const session = this._createSession(roomId, peerId, callId, state.rtcConfig);
    try {
      await session.initiate(state.localStream, state.capabilities, state.capabilities.video ? 'video' : 'audio');
      console.log(`[GroupCallManager] addPeer: offer sent to ${peerId} on callId ${callId}`);
    } catch (err) {
      console.error(`[GroupCallManager] addPeer: failed to initiate with ${peerId}:`, err);
    }
  }

  /**
   * Subscribe to a CommunicationEvent.
   * Returns an unsubscribe function.
   */
  public on(event: CommunicationEvent, callback: (payload: any) => void): () => void {
    return EventBus.getInstance().subscribe(event, callback);
  }

  /**
   * Destroy this manager — leaves all rooms and disconnects signaling.
   */
  public async destroy(): Promise<void> {
    const leaveAll = Array.from(this.roomSessions.keys()).map(roomId =>
      this.leaveRoom(roomId)
    );
    await Promise.allSettled(leaveAll);
    this.signaling.disconnect();
  }

  /**
   * Returns the live session map for a room (useful for diagnostics).
   */
  public getRoomSessions(roomId: string): Map<string, CommunicationSession> | undefined {
    return this.roomSessions.get(roomId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a CommunicationSession for a peer, wire room-level events, and
   * store it in roomSessions.
   */
  private _createSession(
    roomId: string,
    peerId: string,
    existingCallId?: string,
    rtcConfig?: RTCConfiguration
  ): CommunicationSession {
    const session = new CommunicationSession(
      peerId,
      this.currentUserId,
      this.signaling,
      existingCallId,
      rtcConfig,
      roomId
    );

    /**
     * REMOTE_STREAM_READY is emitted by WebRTCEngine.ontrack.
     * Because the EventBus is a singleton and ALL sessions share it,
     * we guard against cross-contamination by checking the room map
     * before re-emitting as ROOM_PARTICIPANT_JOINED.
     */
    const streamUnsub = EventBus.getInstance().subscribe(
      CommunicationEvent.REMOTE_STREAM_READY,
      (payload: { userId?: string; stream: MediaStream; track?: MediaStreamTrack }) => {
        if (payload.userId !== peerId) return;
        const roomPeers = this.roomSessions.get(roomId);
        if (!roomPeers?.has(peerId)) return;

        EventBus.getInstance().emit(CommunicationEvent.ROOM_PARTICIPANT_JOINED, {
          userId: peerId,
          stream: payload.stream,
        } as RoomParticipantJoinedPayload);
      }
    );

    /** Wire CALL_ENDED so a peer disconnect removes them from the room map. */
    const endUnsub = EventBus.getInstance().subscribe(
      CommunicationEvent.CALL_ENDED,
      (payload: { callId?: string }) => {
        if (payload?.callId === session.callId) {
          const roomPeers = this.roomSessions.get(roomId);
          if (roomPeers?.has(peerId)) {
            roomPeers.delete(peerId);
            EventBus.getInstance().emit(CommunicationEvent.ROOM_PARTICIPANT_LEFT, {
              userId: peerId,
            } as RoomParticipantLeftPayload);
          }
        }
      }
    );

    this.eventUnsubs.get(roomId)?.push(streamUnsub, endUnsub);
    this.roomSessions.get(roomId)!.set(peerId, session);

    return session;
  }
}
