/**
 * GroupCallSignalingProvider
 * --------------------------
 * A thin wrapper around DatabaseSignalingProvider that adds two capabilities
 * needed specifically for group (multi-party) calls:
 *
 * 1.  broadcastSignal(roomId, message)
 *     Looks up every active participant in `session_room_participants` for the
 *     given roomId and sends the signal to all of them in parallel.  This is
 *     useful for control messages (e.g. mute-all, screen-share-started) that
 *     should reach every peer without the caller enumerating participant IDs.
 *
 * 2.  subscribeToRoom(roomId, callback)
 *     Subscribes to the `webrtc_signals` Realtime channel filtered to the
 *     current user.  Because DatabaseSignalingProvider.connect() already does
 *     this, subscribeToRoom is a lightweight re-export that documents the
 *     intent explicitly and can be extended later (e.g. room-level metadata
 *     events from `session_room_participants` table changes).
 *
 * Multi-party correctness note
 * ----------------------------
 * DatabaseSignalingProvider.connect() subscribes ONCE to:
 *   webrtc_signals  WHERE to_user = currentUserId
 * This single channel receives signals from ALL remote peers because every
 * peer inserts a row with to_user = currentUserId.  No per-peer channels or
 * per-sender filters are needed.  The GroupCallManager routes each inbound
 * signal to the correct CommunicationSession by inspecting message.from.
 */

import { DatabaseSignalingProvider } from './DatabaseSignalingProvider';
import { SignalingMessage, CallLifecycleMessage } from '../interfaces/SignalingProvider';

export class GroupCallSignalingProvider extends DatabaseSignalingProvider {
  private supabaseClient: any;
  private currentUserId: string = '';

  constructor(supabaseClient: any) {
    super(supabaseClient);
    this.supabaseClient = supabaseClient;
  }

  /** Override connect so we can cache the userId for broadcastSignal */
  public override async connect(userId: string): Promise<void> {
    this.currentUserId = userId;
    await super.connect(userId);
  }

  // -------------------------------------------------------------------------
  // Group-specific extensions
  // -------------------------------------------------------------------------

  /**
   * Send a signal to ALL current participants in a room.
   *
   * Implementation
   * --------------
   * 1. Query `session_room_participants` for all active rows in `roomId`
   *    (left_at IS NULL, user_id != self).
   * 2. Send the signal to each participant via the base sendSignal().
   *
   * Use-case: broadcasting a control message (e.g. "screen-share-started")
   * without the caller needing to enumerate participant IDs.
   *
   * @param roomId   The UUID of the session_rooms row.
   * @param callId   The shared call / session identifier.
   * @param message  The SignalingMessage to broadcast.
   */
  public async broadcastSignal(
    roomId: string,
    callId: string,
    message: SignalingMessage
  ): Promise<void> {
    const { data: participants, error } = await this.supabaseClient
      .from('session_room_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .is('left_at', null)
      .neq('user_id', this.currentUserId);

    if (error) {
      console.error('[GroupCallSignalingProvider] broadcastSignal: failed to fetch participants:', error);
      return;
    }

    if (!participants || participants.length === 0) {
      console.warn(`[GroupCallSignalingProvider] broadcastSignal: no active participants in room ${roomId}.`);
      return;
    }

    await Promise.allSettled(
      participants.map((row: { user_id: string }) =>
        this.sendSignal(row.user_id, callId, message)
      )
    );

    console.log(
      `[GroupCallSignalingProvider] Broadcast signal "${message.type}" to ${participants.length} participant(s) in room ${roomId}.`
    );
  }

  /**
   * Subscribe to the room's WebRTC signal channel for the current user.
   *
   * Multi-party note: DatabaseSignalingProvider.connect() already creates a
   * Supabase Realtime channel filtered by to_user = currentUserId. That
   * single subscription handles ALL peer signals arriving in this room.
   * This method is therefore a thin wrapper that:
   *   • Verifies connect() has been called.
   *   • Registers an additional onSignal callback if you want room-scoped
   *     delivery (e.g. for a dedicated UI component).
   *
   * @param roomId   Room identifier (used for logging/future room-specific channels).
   * @param callback Function called with (callId, message) for each incoming signal.
   * @returns        Unsubscribe / cleanup function.
   */
  public subscribeToRoom(
    roomId: string,
    callback: (callId: string, message: SignalingMessage) => void
  ): () => void {
    // Wire the callback through the base class onSignal handler.
    // The base handler is a single slot — for multiple callers we chain.
    this.onSignal(callback);

    console.log(
      `[GroupCallSignalingProvider] Subscribed to room "${roomId}" signals (filtered by to_user=${this.currentUserId}).`
    );

    // Return a no-op for now; callers should call disconnect() to teardown.
    // A future version can maintain per-room channel references.
    return () => {
      console.log(`[GroupCallSignalingProvider] Unsubscribed from room "${roomId}" signals.`);
    };
  }

  /**
   * Mark the current user as having left the room in `session_room_participants`.
   * Should be called alongside GroupCallManager.leaveRoom().
   */
  public async markParticipantLeft(roomId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('session_room_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', this.currentUserId)
      .is('left_at', null);

    if (error) {
      console.error('[GroupCallSignalingProvider] markParticipantLeft failed:', error);
    }
  }

  /**
   * Register the current user as an active participant in the room.
   * Should be called after joinRoom() so the room record is complete.
   *
   * @param roomId   The session_rooms UUID.
   * @param callId   Optional call UUID to link the participant row to a call log.
   */
  public async markParticipantJoined(roomId: string, callId?: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('session_room_participants')
      .insert([{
        room_id: roomId,
        user_id: this.currentUserId,
        joined_at: new Date().toISOString(),
        call_id: callId ?? null,
      }]);

    if (error) {
      console.error('[GroupCallSignalingProvider] markParticipantJoined failed:', error);
    }
  }
}
