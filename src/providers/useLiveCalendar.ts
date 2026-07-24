import { useState, useEffect, useCallback } from 'react';
import { useService } from '@/platform/Infrastructure/PlatformContext';
import { useWorkspaceSync } from '@/hooks/useWorkspaceSync';
import { toast } from 'sonner';

export const useLiveCalendar = () => {
  const { workspaceId } = useWorkspaceSync();
  const calendarService = useService<any>('CalendarService');
  
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!calendarService) return;
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      // Get events for the next 7 days
      const data = await calendarService.getUpcomingEvents(workspaceId, 10);
      setEvents(data || []);
    } catch (err: any) {
      console.error('[useLiveCalendar] Error fetching events:', err);
      setError(err);
      toast.error('Failed to load upcoming events');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, calendarService]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refresh: fetchEvents,
    isEmpty: !isLoading && events.length === 0
  };
};
