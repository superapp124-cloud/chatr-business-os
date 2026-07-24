import { IService } from '../../Shared/Types';
import { supabase } from '@/integrations/supabase/client';
import { EventBus } from '../../Infrastructure/EventBus';
import { Logger } from '../../Infrastructure/Logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  userId?: string;
  actorName?: string;
  actorAvatar?: string;
  entityType: string;   // 'message' | 'task' | 'meeting' | 'file' | 'system'
  entityId?: string;
  action: string;       // human-readable: "sent a message", "completed a task"
  description: string;  // full description text
  metadata: Record<string, any>;
  createdAt: string;
}

export type ActivityFilter = 'all' | 'messages' | 'tasks' | 'meetings' | 'files' | 'ai';

// ─── Service ──────────────────────────────────────────────────────────────────

class ActivityServiceClass implements IService {
  name = 'ActivityService';
  dependencies = ['EventBus'];

  private listeners: Set<(item: ActivityItem) => void> = new Set();
  private realtimeChannel: any = null;
  private currentWorkspaceId: string | null = null;

  async initialize(): Promise<void> {
    Logger.info('[ActivityService] Initializing...');

    // Subscribe to EventBus to write activity records for platform events
    EventBus.subscribe('MessageSent', async (event) => {
      const { message, roomId } = event.payload;
      await this.writeActivity({
        entityType: 'message',
        entityId: message.id,
        action: 'sent_message',
        description: `Sent a message`,
        metadata: { roomId, preview: (message.content || '').slice(0, 100) },
        userId: message.senderId,
      });
    });

    EventBus.subscribe('TaskCreated', async (event) => {
      const { task } = event.payload;
      await this.writeActivity({
        entityType: 'task',
        entityId: task.id,
        action: 'created_task',
        description: `Created task: ${task.title}`,
        metadata: { priority: task.priority, listId: task.listId },
        userId: task.createdBy,
      });
    });

    EventBus.subscribe('TaskCompleted', async (event) => {
      const { task } = event.payload;
      await this.writeActivity({
        entityType: 'task',
        entityId: task.id,
        action: 'completed_task',
        description: `Completed: ${task.title}`,
        metadata: {},
        userId: task.createdBy,
      });
    });

    EventBus.subscribe('MeetingScheduled', async (event) => {
      const { event: calEvent } = event.payload;
      await this.writeActivity({
        entityType: 'meeting',
        entityId: calEvent.id,
        action: 'scheduled_meeting',
        description: `Scheduled: ${calEvent.title}`,
        metadata: { startAt: calEvent.startAt },
        userId: calEvent.organizerId,
      });
    });

    // Resolve workspace and start realtime subscription
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: memberRows } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1);
        this.currentWorkspaceId = memberRows?.[0]?.workspace_id ?? null;
        if (this.currentWorkspaceId) this.subscribeToActivityUpdates();
      }
    } catch (err) {
      Logger.warn('[ActivityService] Could not resolve workspace for realtime', err);
    }

    Logger.info('[ActivityService] Ready');
  }

  private subscribeToActivityUpdates(): void {
    this.realtimeChannel = supabase
      .channel('activity_logs_global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          const item = this.mapActivityLog(payload.new as any);
          this.listeners.forEach(cb => cb(item));
        }
      )
      .subscribe();
  }

  private mapActivityLog(row: any): ActivityItem {
    return {
      id: row.id,
      userId: row.user_id,
      entityType: row.entity_type || 'system',
      entityId: row.entity_id,
      action: row.action,
      description: row.action,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }

  private async writeActivity(input: {
    entityType: string;
    entityId?: string;
    action: string;
    description: string;
    metadata: Record<string, any>;
    userId?: string;
  }): Promise<void> {
    try {
      const entityTypeMap: Record<string, string> = {
        message: 'system',
        task: 'system',
        meeting: 'system',
        file: 'system',
        system: 'system',
        candidate: 'candidate',
        requisition: 'requisition',
        call: 'call',
        project: 'project',
      };
      const safeEntityType = entityTypeMap[input.entityType] || 'system';

      await supabase.from('activity_logs').insert({
        user_id: input.userId || null,
        entity_type: safeEntityType,
        entity_id: input.entityId || null,
        action: input.description,
        metadata: { ...input.metadata, originalType: input.entityType },
      });
    } catch (err) {
      Logger.warn('[ActivityService] writeActivity failed (non-critical)', err);
    }
  }

  async getRecentActivity(limit = 30, filter?: ActivityFilter): Promise<ActivityItem[]> {
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filter && filter !== 'all') {
        // Filter by metadata.originalType
        query = query.contains('metadata', { originalType: filter === 'messages' ? 'message' : filter.slice(0, -1) });
      }

      const { data, error } = await query;
      if (error) { 
        // Suppress known 404s/403s on fresh workspaces to avoid log spam
        if (error.code !== 'PGRST116') {
          // Logger.warn('[ActivityService] getRecentActivity error', error); 
        }
        return []; 
      }
      return (data || []).map(this.mapActivityLog);
    } catch (err) {
      Logger.error('[ActivityService] getRecentActivity failed', err);
      return [];
    }
  }

  onNewActivity(callback: (item: ActivityItem) => void): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  async shutdown(): Promise<void> {
    if (this.realtimeChannel) supabase.removeChannel(this.realtimeChannel);
  }
}

export const ActivityService = new ActivityServiceClass();
