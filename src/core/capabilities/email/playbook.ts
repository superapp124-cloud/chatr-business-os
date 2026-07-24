import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let contact = text.replace(/^(email|send email to|mail)\s+/i, '');
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
        label: 'Who should I email?',
        type: 'text'
      });
    }
    if (!entities.content) {
      missing.push({
        key: 'content',
        label: 'What should I say?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: `Email ${entities.contact}`,
      lines: [{ label: 'Message', value: entities.content || 'Draft email' }],
      cta: 'Send Email',
      icon: '✉️'
    };
  }
};
