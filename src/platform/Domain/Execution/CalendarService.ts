import { IService } from '../../Shared/Types';
import { supabase } from '@/integrations/supabase/client';
import { EventBus } from '../../Infrastructure/EventBus';
import { Logger } from '../../Infrastructure/Logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  organizerId: string;
  location?: string;
  meetingUrl?: string;
  color: string;
  eventType: 'meeting' | 'deadline' | 'reminder' | 'sync' | 'review' | 'other';
  attendees: EventAttendee[];
  createdAt: string;
}

export interface EventAttendee {
  userId: string;
  status: 'pending' | 'accepted' | 'declined' | 'tentative';
}

export interface CreateEventInput {
  title: string;
  workspaceId: string;
  startAt: string;
  endAt: string;
  description?: string;
  location?: string;
  meetingUrl?: string;
  color?: string;
  eventType?: CalendarEvent['eventType'];
  attendeeIds?: string[];
  isAllDay?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class CalendarServiceClass implements IService {
  name = 'CalendarService';
  dependencies = [];

  async initialize(): Promise<void> {
    Logger.info('[CalendarService] Initialized');
  }

  private mapRow(row: any, attendees: EventAttendee[] = []): CalendarEvent {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      description: row.description,
      startAt: row.start_at,
      endAt: row.end_at,
      isAllDay: row.is_all_day || false,
      organizerId: row.organizer_id,
      location: row.location,
      meetingUrl: row.meeting_url,
      color: row.color || '#6366f1',
      eventType: row.event_type || 'meeting',
      attendees,
      createdAt: row.created_at,
    };
  }

  async getEvents(workspaceId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select(`*, event_attendees(user_id, status)`)
        .eq('workspace_id', workspaceId)
        .gte('start_at', from.toISOString())
        .lte('start_at', to.toISOString())
        .order('start_at', { ascending: true });

      if (error) { Logger.warn('[CalendarService] getEvents error', error); return []; }

      return (data || []).map((row: any) =>
        this.mapRow(
          row,
          (row.event_attendees || []).map((a: any) => ({
            userId: a.user_id,
            status: a.status,
          }))
        )
      );
    } catch (err) {
      Logger.error('[CalendarService] getEvents failed', err);
      return [];
    }
  }

  async getUpcomingEvents(workspaceId: string, limit = 5): Promise<CalendarEvent[]> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('calendar_events')
        .select(`*, event_attendees(user_id, status)`)
        .eq('workspace_id', workspaceId)
        .gte('start_at', now)
        .order('start_at', { ascending: true })
        .limit(limit);

      if (error) { Logger.warn('[CalendarService] getUpcomingEvents error', error); return []; }

      return (data || []).map((row: any) =>
        this.mapRow(row, (row.event_attendees || []).map((a: any) => ({
          userId: a.user_id,
          status: a.status,
        })))
      );
    } catch (err) {
      Logger.error('[CalendarService] getUpcomingEvents failed', err);
      return [];
    }
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          workspace_id: input.workspaceId,
          title: input.title,
          description: input.description || null,
          start_at: input.startAt,
          end_at: input.endAt,
          is_all_day: input.isAllDay || false,
          organizer_id: user.id,
          location: input.location || null,
          meeting_url: input.meetingUrl || null,
          color: input.color || '#6366f1',
          event_type: input.eventType || 'meeting',
        })
        .select()
        .single();

      if (error) throw error;

      // Add attendees
      if (input.attendeeIds?.length) {
        const attendeeRows = input.attendeeIds.map(userId => ({
          event_id: data.id,
          user_id: userId,
          status: 'pending',
        }));
        await supabase.from('event_attendees').insert(attendeeRows);
      }

      const calEvent = this.mapRow(data, (input.attendeeIds || []).map(uid => ({
        userId: uid,
        status: 'pending' as const,
      })));

      await EventBus.publish('MeetingScheduled', { event: calEvent }, { priority: 'high', persistent: true });
      return calEvent;
    } catch (err) {
      Logger.error('[CalendarService] createEvent failed', err);
      return null;
    }
  }

  async updateEvent(id: string, updates: Partial<CreateEventInput>): Promise<void> {
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.title) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.startAt) dbUpdates.start_at = updates.startAt;
      if (updates.endAt) dbUpdates.end_at = updates.endAt;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.meetingUrl !== undefined) dbUpdates.meeting_url = updates.meetingUrl;

      const { error } = await supabase.from('calendar_events').update(dbUpdates).eq('id', id);
      if (error) throw error;
      await EventBus.publish('MeetingUpdated', { eventId: id }, { priority: 'normal' });
    } catch (err) {
      Logger.error('[CalendarService] updateEvent failed', err);
    }
  }

  async deleteEvent(id: string): Promise<void> {
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
      await EventBus.publish('MeetingDeleted', { eventId: id }, { priority: 'normal' });
    } catch (err) {
      Logger.error('[CalendarService] deleteEvent failed', err);
    }
  }

  async rsvp(eventId: string, status: 'accepted' | 'declined' | 'tentative'): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('event_attendees')
        .update({ status })
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (error) throw error;
      await EventBus.publish('MeetingRSVP', { eventId, userId: user.id, status }, { priority: 'normal' });
    } catch (err) {
      Logger.error('[CalendarService] rsvp failed', err);
    }
  }

  subscribeToEvents(workspaceId: string, onUpdate: () => void): () => void {
    const channel = supabase
      .channel(`calendar:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events', filter: `workspace_id=eq.${workspaceId}` },
        () => onUpdate()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }
}

export const CalendarService = new CalendarServiceClass();
