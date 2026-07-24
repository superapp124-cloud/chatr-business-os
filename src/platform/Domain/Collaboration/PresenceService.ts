import { IService } from '../../Shared/Types';
import { supabase } from '@/integrations/supabase/client';
import { EventBus } from '../../Infrastructure/EventBus';
import { Logger } from '../../Infrastructure/Logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  status: PresenceStatus;
  currentPage?: string;
  entityType?: string;    // 'task' | 'file' | 'room' — what they're viewing
  entityId?: string;
  lastSeenAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class PresenceServiceClass implements IService {
  name = 'PresenceService';
  dependencies = [];

  private presenceChannel: any = null;
  private workspaceChannel: any = null;
  private currentUserId: string | null = null;
  private currentWorkspaceId: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // In-memory roster of online users: userId → UserPresence
  private roster: Map<string, UserPresence> = new Map();
  private listeners: Set<(roster: UserPresence[]) => void> = new Set();

  async initialize(): Promise<void> {
    Logger.info('[PresenceService] Initializing...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Logger.warn('[PresenceService] No user — skipping presence setup'); return; }
      this.currentUserId = user.id;

      // Resolve workspace
      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1);

      this.currentWorkspaceId = memberRows?.[0]?.workspace_id ?? null;
      if (this.currentWorkspaceId) {
        await this.connectPresenceChannel();
        await this.upsertPresenceRecord('online', window.location.pathname);
        this.startHeartbeat();
      }
    } catch (err) {
      Logger.error('[PresenceService] Initialize failed', err);
    }

    Logger.info('[PresenceService] Ready');
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.currentUserId) {
      await this.upsertPresenceRecord('offline');
    }
    if (this.presenceChannel) supabase.removeChannel(this.presenceChannel);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async connectPresenceChannel(): Promise<void> {
    if (!this.currentWorkspaceId || !this.currentUserId) return;

    // Use Supabase Realtime Presence API for the workspace
    this.presenceChannel = supabase.channel(`presence:${this.currentWorkspaceId}`, {
      config: { presence: { key: this.currentUserId } },
    });

    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel.presenceState();
        this.updateRosterFromState(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        if (newPresences?.[0]) {
          this.updateUserPresence(key, newPresences[0]);
          EventBus.publish('UserJoined', { userId: key }, { priority: 'low' });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }: any) => {
        this.roster.delete(key);
        this.notifyListeners();
        EventBus.publish('UserLeft', { userId: key }, { priority: 'low' });
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED' && this.currentUserId) {
          // Broadcast our own presence
          await this.presenceChannel.track({
            userId: this.currentUserId,
            status: 'online',
            currentPage: window.location.pathname,
            lastSeenAt: new Date().toISOString(),
          });
        }
      });
  }

  private updateRosterFromState(state: Record<string, any[]>): void {
    this.roster.clear();
    for (const [userId, presences] of Object.entries(state)) {
      if (presences?.[0]) {
        this.updateUserPresence(userId, presences[0]);
      }
    }
    this.notifyListeners();
  }

  private updateUserPresence(userId: string, data: any): void {
    this.roster.set(userId, {
      userId,
      status: data.status || 'online',
      currentPage: data.currentPage,
      entityType: data.entityType,
      entityId: data.entityId,
      lastSeenAt: data.lastSeenAt || new Date().toISOString(),
    });
  }

  private async upsertPresenceRecord(status: PresenceStatus, currentPage?: string): Promise<void> {
    if (!this.currentUserId) return;
    try {
      await supabase.from('presence_sessions').upsert(
        {
          user_id: this.currentUserId,
          workspace_id: this.currentWorkspaceId,
          status,
          current_page: currentPage || null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      Logger.warn('[PresenceService] upsertPresenceRecord failed', err);
    }
  }

  private startHeartbeat(): void {
    // Update last_seen_at every 30 seconds to confirm user is still active
    this.heartbeatTimer = setInterval(async () => {
      await this.upsertPresenceRecord('online', window.location.pathname);
    }, 30_000);
  }

  private notifyListeners(): void {
    const roster = this.getRoster();
    this.listeners.forEach(cb => cb(roster));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Subscribe to presence roster changes. Returns unsubscribe function. */
  onRosterChange(callback: (roster: UserPresence[]) => void): () => void {
    this.listeners.add(callback);
    // Immediately deliver current roster
    callback(this.getRoster());
    return () => { this.listeners.delete(callback); };
  }

  /** Get current online roster */
  getRoster(): UserPresence[] {
    return Array.from(this.roster.values());
  }

  /** Get presence of a specific user */
  getUserPresence(userId: string): UserPresence | undefined {
    return this.roster.get(userId);
  }

  /** Update current user's status */
  async setStatus(status: PresenceStatus): Promise<void> {
    if (!this.presenceChannel || !this.currentUserId) return;
    await this.presenceChannel.track({
      userId: this.currentUserId,
      status,
      currentPage: window.location.pathname,
      lastSeenAt: new Date().toISOString(),
    });
    await this.upsertPresenceRecord(status);
  }

  /** Update what the user is currently viewing (for collaboration awareness) */
  async setViewingEntity(entityType: string, entityId: string): Promise<void> {
    if (!this.presenceChannel || !this.currentUserId) return;
    await this.presenceChannel.track({
      userId: this.currentUserId,
      status: 'online',
      currentPage: window.location.pathname,
      entityType,
      entityId,
      lastSeenAt: new Date().toISOString(),
    });
  }

  /** Broadcast a typing event (ephemeral, no DB write) */
  broadcastTyping(roomId: string): void {
    if (!this.currentUserId) return;
    supabase.channel(`typing:${roomId}`)
      .send({ type: 'broadcast', event: 'typing', payload: { userId: this.currentUserId } })
      .catch(() => {});
  }

  /** Subscribe to typing events in a room */
  onTyping(roomId: string, callback: (userId: string) => void): () => void {
    const channel = supabase
      .channel(`typing:${roomId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== this.currentUserId) callback(payload.userId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }
}

export const PresenceService = new PresenceServiceClass();
