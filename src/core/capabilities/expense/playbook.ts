import { CapabilityPlaybook, ExtractedEntities, ResolvedEntities, MissingField, CommitmentPreview } from '../types';

export const playbook: CapabilityPlaybook = {
  extract(rawText: string): ExtractedEntities {
    const text = rawText;
    let amountMatch = text.match(/\$?([0-9]+\.?[0-9]*)/);
    let amount = amountMatch ? amountMatch[1] : null;
    let description = text.replace(/^(log expense|expense|add expense)\s+/i, '');
    return { description, amount };
  },

  async resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities> {
    return { ...entities, _resolved: true };
  },

  getMissingFields(entities: ResolvedEntities): MissingField[] {
    const missing: MissingField[] = [];
    if (!entities.amount) {
      missing.push({
        key: 'amount',
        label: 'How much was it?',
        type: 'text'
      });
    }
    if (!entities.description) {
      missing.push({
        key: 'description',
        label: 'What was the expense for?',
        type: 'text'
      });
    }
    return missing;
  },

  buildPreview(entities: ResolvedEntities): CommitmentPreview {
    return {
      title: 'Log Expense',
      lines: [
        { label: 'Description', value: entities.description || '' },
        { label: 'Amount', value: entities.amount ? `$${entities.amount}` : '' }
      ],
      cta: 'Save',
      icon: '💵'
    };
  }
};
