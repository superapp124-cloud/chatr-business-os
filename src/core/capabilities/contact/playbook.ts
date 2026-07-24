import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let contactName = text.replace(/^(add contact|new contact|save contact|create contact)\s+/i, '');
    return { contactName };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.contactName) {
      missing.push({
        key: 'contactName',
        label: 'What is the name?',
        type: 'text'
      });
    }
    if (!entities.phoneNumber && !entities.emailAddress) {
      missing.push({
        key: 'phoneNumber',
        label: 'What is their phone number?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Save Contact',
      lines: [
        { label: 'Name', value: entities.contactName || '' },
        { label: 'Phone', value: entities.phoneNumber || '' }
      ],
      cta: 'Save',
      icon: '👤'
    };
  }
};
