import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(schedule event|new event|add to calendar|create event)\s+/i, '');
    return { title };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.time) {
      missing.push({
        key: 'time',
        label: 'When is this event?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Add to Calendar',
      lines: [
        { label: 'Event', value: entities.title || '' },
        { label: 'When', value: entities.time || 'TBD' }
      ],
      cta: 'Save Event',
      icon: '📅'
    };
  }
};
