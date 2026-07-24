import { IService } from '../../Shared/Types';
import { supabase } from '@/integrations/supabase/client';
import { EventBus } from '../../Infrastructure/EventBus';
import { Logger } from '../../Infrastructure/Logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskList {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  ownerId: string;
  isShared: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  listId?: string;
  workspaceId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  assigneeId?: string;
  createdBy: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  sortOrder: number;
  tags: string[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  listId?: string;
  workspaceId: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  assigneeId?: string;
  description?: string;
  parentTaskId?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class TaskServiceClass implements IService {
  name = 'TaskService';
  dependencies = [];

  async initialize(): Promise<void> {
    Logger.info('[TaskService] Initialized');
  }

  private mapRow(row: any): Task {
    return {
      id: row.id,
      listId: row.list_id,
      workspaceId: row.workspace_id,
      parentTaskId: row.parent_task_id,
      title: row.title,
      description: row.description,
      assigneeId: row.assignee_id,
      createdBy: row.created_by,
      dueDate: row.due_date,
      priority: row.priority || 'medium',
      status: row.status || 'todo',
      sortOrder: row.sort_order || 0,
      tags: row.tags || [],
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getLists(workspaceId: string): Promise<TaskList[]> {
    try {
      const { data, error } = await supabase
        .from('task_lists')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) { Logger.warn('[TaskService] getLists error', error); return []; }

      return (data || []).map((row: any): TaskList => ({
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        color: row.color || '#6366f1',
        ownerId: row.owner_id,
        isShared: row.is_shared || false,
        createdAt: row.created_at,
      }));
    } catch (err) {
      Logger.error('[TaskService] getLists failed', err);
      return [];
    }
  }

  async getTasks(listId?: string, workspaceId?: string): Promise<Task[]> {
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('sort_order', { ascending: true });

      if (listId) query = query.eq('list_id', listId);
      if (workspaceId) query = query.eq('workspace_id', workspaceId);

      const { data, error } = await query;
      if (error) { Logger.warn('[TaskService] getTasks error', error); return []; }
      return (data || []).map(this.mapRow);
    } catch (err) {
      Logger.error('[TaskService] getTasks failed', err);
      return [];
    }
  }

  async createTask(input: CreateTaskInput): Promise<Task | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: input.title,
          list_id: input.listId || null,
          workspace_id: input.workspaceId,
          created_by: user.id,
          assignee_id: input.assigneeId || null,
          priority: input.priority || 'medium',
          status: 'todo',
          due_date: input.dueDate || null,
          description: input.description || null,
          parent_task_id: input.parentTaskId || null,
          sort_order: Date.now(),
        })
        .select()
        .single();

      if (error) throw error;
      const task = this.mapRow(data);

      await EventBus.publish('TaskCreated', { task }, { priority: 'high', persistent: true });
      return task;
    } catch (err) {
      Logger.error('[TaskService] createTask failed', err);
      return null;
    }
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.assigneeId !== undefined) dbUpdates.assignee_id = updates.assigneeId;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

      const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', id);
      if (error) throw error;
      await EventBus.publish('TaskUpdated', { taskId: id, updates }, { priority: 'normal' });
    } catch (err) {
      Logger.error('[TaskService] updateTask failed', err);
    }
  }

  async completeTask(id: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const task = this.mapRow(data);
      await EventBus.publish('TaskCompleted', { task }, { priority: 'high', persistent: true });
    } catch (err) {
      Logger.error('[TaskService] completeTask failed', err);
    }
  }

  async reorderTask(id: string, newSortOrder: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ sort_order: newSortOrder })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      Logger.error('[TaskService] reorderTask failed', err);
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      await EventBus.publish('TaskDeleted', { taskId: id }, { priority: 'normal' });
    } catch (err) {
      Logger.error('[TaskService] deleteTask failed', err);
    }
  }

  subscribeToTasks(workspaceId: string, onUpdate: (task: Task) => void): () => void {
    const channel = supabase
      .channel(`tasks:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.new) onUpdate(this.mapRow(payload.new));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }
}

export const TaskService = new TaskServiceClass();
