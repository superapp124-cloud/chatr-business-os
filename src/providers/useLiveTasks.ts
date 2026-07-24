import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceTasks, WorkspaceTask } from '@/hooks/useWorkspaceTasks';
import { useService } from '@/platform/Infrastructure/PlatformContext';
import { useWorkspaceSync } from '@/hooks/useWorkspaceSync';

export const useLiveTasks = () => {
  const { workspaceId } = useWorkspaceSync();
  const taskService = useService<any>('TaskService');
  
  // Note: we can either use existing `useWorkspaceTasks` which relies on Supabase realtime,
  // or `TaskService`. For now we combine them or just use `TaskService` directly for standard tasks.
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!taskService) return;
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      // Assuming TaskService has getTasks(workspaceId)
      const data = await taskService.getTasks?.(workspaceId) || [];
      setTasks(data);
    } catch (err: any) {
      console.error('[useLiveTasks] Error fetching tasks:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, taskService]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    isLoading,
    error,
    refresh: fetchTasks,
    isEmpty: !isLoading && tasks.length === 0
  };
};
