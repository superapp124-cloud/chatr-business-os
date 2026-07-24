import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceSync } from './useWorkspaceSync';
import { toast } from 'sonner';

export type WorkspaceTaskType = 'reply' | 'quotation' | 'appointment' | 'payment' | 'reminder' | 'document';
export type WorkspaceTaskState = 'waiting_for_you' | 'prepared_by_ai' | 'in_progress' | 'quick_win';
export type WorkspaceTaskStatus = 'pending' | 'completed' | 'skipped';

export interface WorkspaceTask {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  task_type: WorkspaceTaskType;
  state: WorkspaceTaskState;
  status: WorkspaceTaskStatus;
  metadata: any;
  estimated_time_seconds: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export const useWorkspaceTasks = () => {
  const { workspaceId } = useWorkspaceSync();
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    
    fetchTasks();

    // Subscribe to task updates
    const channel = supabase
      .channel('workspace_tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_tasks',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const fetchTasks = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_tasks')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist yet, this is a fallback for development
          console.warn("workspace_tasks table does not exist. Please apply the migration.");
        } else {
          console.error("Error fetching tasks:", error);
        }
        return;
      }

      setTasks(data || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const completeTask = async (taskId: string) => {
    // Optimistic update
    setTasks(prev => prev.filter(t => t.id !== taskId));
    
    try {
      const { error } = await supabase
        .from('workspace_tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);
        
      if (error) {
        toast.error("Failed to complete task");
        // Revert optimistic update
        fetchTasks();
      }
    } catch (err) {
      console.error("Error completing task:", err);
      fetchTasks();
    }
  };

  return {
    tasks,
    isLoading,
    fetchTasks,
    completeTask,
    
    // Selectors
    quickWins: tasks.filter(t => t.state === 'quick_win'),
    waitingForYou: tasks.filter(t => t.state === 'waiting_for_you'),
    preparedByAi: tasks.filter(t => t.state === 'prepared_by_ai'),
    inProgress: tasks.filter(t => t.state === 'in_progress'),
    
    // Aggregate metrics
    totalPending: tasks.length,
    estimatedTotalTime: tasks.reduce((acc, t) => acc + (t.estimated_time_seconds || 60), 0)
  };
};
