import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';
import { calendarService } from '../../services/CalendarService';

function resolveTimeToISO(timeExpression: string): string {
  const now = new Date();
  const lower = timeExpression.toLowerCase();

  if (lower.includes('tomorrow afternoon')) {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); return d.toISOString();
  }
  if (lower.includes('tomorrow morning')) {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString();
  }
  if (lower.includes('tomorrow')) {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString();
  }
  if (lower.includes('next week')) {
    const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(10, 0, 0, 0); return d.toISOString();
  }
  if (lower.includes('next available')) {
    const d = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    return d.toISOString();
  }
  const parsed = new Date(timeExpression);
  if (!isNaN(parsed.getTime()) && parsed > now) return parsed.toISOString();
  // Default: tomorrow 10am
  const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString();
}

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    // Extract attendee name from text
    const attendeeMatch = rawText.match(/(?:with|and)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    const attendees = attendeeMatch ? attendeeMatch[1] : null;

    // Extract time
    const timeMatch = rawText.match(/\b(tomorrow|next week|next available|monday|tuesday|wednesday|thursday|friday|at \d+(?::\d+)?\s*(?:am|pm)?)\b/i);
    const time = timeMatch ? timeMatch[0] : null;

    const title = rawText.replace(/^(schedule|set up|book|arrange)\s+(a\s+)?meeting\s*(with\s+)?/i, '').trim();

    return { title, attendees, time };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    let resolvedTime: string | null = null;
    if (entities.time) {
      resolvedTime = resolveTimeToISO(entities.time);
    }
    return { ...entities, resolvedTime, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.attendees) {
      missing.push({ key: 'attendees', label: 'Who should I invite?', type: 'text' });
    }
    if (!entities.time) {
      missing.push({
        key: 'time',
        label: 'When should we meet?',
        type: 'choice',
        options: ['Tomorrow Morning', 'Tomorrow Afternoon', 'Next Available', 'Next Week']
      });
    }
    return missing;
  },

  requiresSearch(entities: ResolvedEntities): boolean {
    return true; // Always fetch real calendar slots
  },

  buildSearchQuery(entities: ResolvedEntities): any {
    return {
      attendees: entities.attendees,
      timeframe: entities.time,
      resolvedTime: entities.resolvedTime,
    };
  },

  formatSearchResults(results: any[]): any[] {
    return results; // CalendarService already returns TimeSlot[]
  },

  buildPreview(entities: ResolvedEntities, selectedResult?: any): CommitmentPreview {
    if (selectedResult) {
      return {
        title: 'Schedule Meeting',
        lines: [
          { label: 'With', value: entities.attendees || 'Team' },
          { label: 'Time', value: selectedResult.timeSlot || selectedResult.startDateTime },
          { label: 'Duration', value: selectedResult.duration || '30 minutes' },
          { label: 'Calendar', value: selectedResult._provider || 'Local' },
        ],
        cta: 'Send Invites',
        icon: '🗓️',
      };
    }
    return {
      title: 'Schedule Meeting',
      lines: [
        { label: 'With', value: entities.attendees || 'Team' },
        { label: 'Time', value: entities.time || 'To be selected' },
      ],
      cta: 'Find Times',
      icon: '🗓️',
    };
  },

  searchConfiguration: {
    primaryActionLabel: 'Select This Time',
    columns: [
      { key: 'timeSlot', label: 'Time Slot' },
      { key: 'duration', label: 'Duration' },
      { key: 'status', label: 'Availability' },
      { key: '_provider', label: 'Calendar' },
    ],
  },
};
