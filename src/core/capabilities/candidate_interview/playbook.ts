import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let candidate = text.replace(/^(schedule interview with|interview|schedule interview)\s+/i, '');
    return { candidate };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.candidate) {
      missing.push({
        key: 'candidate',
        label: 'Who is the candidate?',
        type: 'text'
      });
    }
    if (!entities.time) {
      missing.push({
        key: 'time',
        label: 'When is the interview?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Schedule Interview',
      lines: [
        { label: 'Candidate', value: entities.candidate || '' },
        { label: 'When', value: entities.time || 'TBD' }
      ],
      cta: 'Schedule',
      icon: '👔'
    };
  }
};
