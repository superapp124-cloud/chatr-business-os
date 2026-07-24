import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let contact = text.replace(/^(call|phone|ring)\s+/i, '');
    return { contact };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.contact) {
      missing.push({
        key: 'contact',
        label: 'Who should I call?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: `Call ${entities.contact}`,
      lines: [{ label: 'Action', value: 'Voice call' }],
      cta: 'Call Now',
      icon: '📞'
    };
  }
};
