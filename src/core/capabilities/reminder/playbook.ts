import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

/**
 * Resolves a natural language time expression to an ISO timestamp.
 * This is the "Context Resolution" step — it converts human time into machine time.
 */
function resolveTimeToISO(timeExpression: string): string {
  const now = new Date();
  const lower = timeExpression.toLowerCase();

  if (lower.includes('10 minutes') || lower.includes('10min')) {
    return new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  }
  if (lower.includes('30 minutes') || lower.includes('30min')) {
    return new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  }
  if (lower.includes('1 hour') || lower.includes('an hour')) {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }
  if (lower.includes('tonight') || lower.includes('this evening')) {
    const tonight = new Date(now);
    tonight.setHours(20, 0, 0, 0);
    if (tonight < now) tonight.setDate(tonight.getDate() + 1);
    return tonight.toISOString();
  }
  if (lower.includes('tomorrow morning')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString();
  }
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString();
  }
  if (lower.includes('next week')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(9, 0, 0, 0);
    return nextWeek.toISOString();
  }
  if (lower.includes('monday')) {
    const d = new Date(now);
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  // Try parsing as a date string directly
  const parsed = new Date(timeExpression);
  if (!isNaN(parsed.getTime()) && parsed > now) {
    return parsed.toISOString();
  }

  // Default: 1 hour from now
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
}

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(remind me to|set a reminder to|remind me about|reminder:)\s+/i, '');

    // Try to extract time from the text itself (e.g. "at 2pm", "tomorrow")
    const timeMatch = text.match(/\b(at \d{1,2}(:\d{2})?\s*(am|pm)?|tomorrow|tonight|next week|in \d+ (minutes?|hours?))\b/i);
    const extractedTime = timeMatch ? timeMatch[0] : null;

    // If time was in the title, strip it
    if (extractedTime) {
      title = title.replace(extractedTime, '').trim().replace(/\s+/g, ' ');
    }

    return { title, time: extractedTime || null };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    // If we have a time expression, resolve it to an ISO timestamp right here
    // This populates commitment.entities.resolvedTime which the executor can use
    if (entities.time) {
      const resolvedISO = resolveTimeToISO(entities.time);
      return { ...entities, resolvedTime: resolvedISO, _resolved: true };
    }
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.time) {
      missing.push({
        key: 'time',
        label: 'When should I remind you?',
        type: 'choice',
        options: ['In 10 minutes', 'In 30 minutes', 'Tomorrow morning', 'Tonight at 8 PM']
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    // Format the resolved time for display
    let displayTime = entities.time || 'TBD';
    if (entities.resolvedTime) {
      try {
        displayTime = new Date(entities.resolvedTime).toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit'
        });
      } catch { /* use raw time */ }
    }

    return {
      title: 'Set Reminder',
      lines: [
        { label: 'Reminder', value: entities.title || '' },
        { label: 'When', value: displayTime }
      ],
      cta: 'Set Reminder',
      icon: '🔔'
    };
  }
};
