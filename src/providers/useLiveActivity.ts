import { useState, useEffect, useCallback } from 'react';
import { useService } from '@/platform/Infrastructure/PlatformContext';

export const useLiveActivity = (limit = 30) => {
  const activityService = useService<any>('ActivityService');
  
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!activityService) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await activityService.getRecentActivity(limit);
      setActivities(data || []);
    } catch (err: any) {
      console.error('[useLiveActivity] Error fetching activities:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [activityService, limit]);

  useEffect(() => {
    fetchActivities();
    
    if (activityService && activityService.onNewActivity) {
      const unsubscribe = activityService.onNewActivity((newItem: any) => {
        setActivities(prev => [newItem, ...prev].slice(0, limit));
      });
      return () => unsubscribe();
    }
  }, [fetchActivities, activityService, limit]);

  return {
    activities,
    isLoading,
    error,
    refresh: fetchActivities,
    isEmpty: !isLoading && activities.length === 0
  };
};
