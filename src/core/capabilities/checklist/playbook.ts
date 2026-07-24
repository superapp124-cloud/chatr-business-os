import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let title = text.replace(/^(create a checklist|new checklist|checklist:)\s+/i, '');
    return { title, items: [] };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    return [];
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Create Checklist',
      lines: [{ label: 'Checklist', value: entities.title || '' }],
      cta: 'Save',
      icon: '☑️'
    };
  }
};
