import { IService } from '../../Shared/Types';
import { supabase } from '@/integrations/supabase/client';
import { EventBus } from '../../Infrastructure/EventBus';
import { Logger } from '../../Infrastructure/Logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlatformNotification {
  id: string;
  userId: string;
  type: 'mention' | 'task_assigned' | 'meeting_reminder' | 'file_shared' | 'comment' | 'reaction' | 'system';
  title: string;
  body?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class NotificationServiceClass implements IService {
  name = 'NotificationService';
  dependencies = ['EventBus'];

  private realtimeChannel: any = null;
  private onNotificationCallbacks: Array<(n: PlatformNotification) => void> = [];

  async initialize(): Promise<void> {
    Logger.info('[NotificationService] Initializing event subscriptions...');

    // ── React to platform events ──────────────────────────────────────────────

    EventBus.subscribe('TaskCreated', async (event) => {
      const { task } = event.payload;
      // Notify assignee if different from creator
      if (task.assigneeId && task.assigneeId !== task.createdBy) {
        await this.createNotification({
          userId: task.assigneeId,
          type: 'task_assigned',
          title: `New task: ${task.title}`,
          body: task.description || 'Tap to view details',
          actionUrl: `/desktop/workspace?task=${task.id}`,
          entityType: 'task',
          entityId: task.id,
          actorId: task.createdBy,
        });
      }
    });

    EventBus.subscribe('MeetingScheduled', async (event) => {
      const { event: calEvent } = event.payload;
      // Notify all attendees
      for (const attendee of calEvent.attendees || []) {
        if (attendee.userId !== calEvent.organizerId) {
          await this.createNotification({
            userId: attendee.userId,
            type: 'meeting_reminder',
            title: `Meeting: ${calEvent.title}`,
            body: `Starts at ${new Date(calEvent.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            actionUrl: `/desktop/workspace?event=${calEvent.id}`,
            entityType: 'meeting',
            entityId: calEvent.id,
            actorId: calEvent.organizerId,
          });
        }
      }
    });

    EventBus.subscribe('MessageSent', async (event) => {
      const { message, roomId } = event.payload;
      // Parse @mentions from message content
      const mentionRegex = /@(\w+)/g;
      const mentions = [...((message.content as string) || '').matchAll(mentionRegex)].map(m => m[1]);

      for (const username of mentions) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .ilike('username', username)
            .single();

          if (profile && profile.id !== message.senderId) {
            await this.createNotification({
              userId: profile.id,
              type: 'mention',
              title: `You were mentioned`,
              body: message.content?.slice(0, 120) || '',
              actionUrl: `/desktop/chat?room=${roomId}`,
              entityType: 'message',
              entityId: message.id,
              actorId: message.senderId,
            });
          }
        } catch {
          // Username not found — ignore
        }
      }
    });

    // ── Subscribe to realtime notifications for the current user ──────────────
    this.subscribeToRealtimeNotifications();

    Logger.info('[NotificationService] Initialized');
  }

  async shutdown(): Promise<void> {
    if (this.realtimeChannel) {
      await supabase.removeChannel(this.realtimeChannel);
    }
  }

  private subscribeToRealtimeNotifications(): void {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      this.realtimeChannel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = this.mapRow(payload.new as any);
            this.onNotificationCallbacks.forEach(cb => cb(n));
          }
        )
        .subscribe();
    });
  }

  onNewNotification(callback: (n: PlatformNotification) => void): () => void {
    this.onNotificationCallbacks.push(callback);
    return () => {
      this.onNotificationCallbacks = this.onNotificationCallbacks.filter(cb => cb !== callback);
    };
  }

  private mapRow(row: any): PlatformNotification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      actionUrl: row.action_url,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actorId: row.actor_id,
      isRead: row.is_read || false,
      isArchived: row.is_archived || false,
      createdAt: row.created_at,
    };
  }

  async createNotification(input: {
    userId: string;
    type: PlatformNotification['type'];
    title: string;
    body?: string;
    actionUrl?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
  }): Promise<void> {
    try {
      await supabase.from('notifications').insert({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body || null,
        action_url: input.actionUrl || null,
        entity_type: input.entityType || null,
        entity_id: input.entityId || null,
        actor_id: input.actorId || null,
      });
    } catch (err) {
      Logger.warn('[NotificationService] createNotification failed', err);
    }
  }

  async getNotifications(userId: string, limit = 30): Promise<PlatformNotification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) { Logger.warn('[NotificationService] getNotifications error', error); return []; }
      return (data || []).map(this.mapRow);
    } catch (err) {
      Logger.error('[NotificationService] getNotifications failed', err);
      return [];
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    } catch (err) {
      Logger.warn('[NotificationService] markAsRead failed', err);
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    } catch (err) {
      Logger.warn('[NotificationService] markAllAsRead failed', err);
    }
  }

  async archiveNotification(notificationId: string): Promise<void> {
    try {
      await supabase.from('notifications').update({ is_archived: true }).eq('id', notificationId);
    } catch (err) {
      Logger.warn('[NotificationService] archive failed', err);
    }
  }
}

export const NotificationService = new NotificationServiceClass();
