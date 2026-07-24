import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(follow up|follow-up|followup)\s+/i, '');
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
        label: 'When should I follow up?',
        type: 'choice',
        options: ['Tomorrow', 'Next Week', 'In a month']
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Set Follow-up',
      lines: [
        { label: 'Follow up', value: entities.title || '' },
        { label: 'When', value: entities.time || 'TBD' }
      ],
      cta: 'Confirm',
      icon: '🔄'
    };
  }
};
