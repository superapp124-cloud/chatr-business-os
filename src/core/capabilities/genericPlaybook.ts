import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from './types';

export const genericPlaybook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    return {
      title: rawText
    };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    return [];
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      icon: '⚡',
      title: String(entities.title),
      lines: [],
      cta: 'Confirm'
    };
  }
};
