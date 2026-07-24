import { IIntentResolver } from './IIntentResolver.js';
import { ResolvedIntent } from '../../types.js';
import { Normalizer } from './Normalizer.js';
import { AliasExpander } from './IntentDictionary.js';

export class MockIntentResolver implements IIntentResolver {
  async resolve(request: string): Promise<ResolvedIntent | null> {
    const normalized = Normalizer.normalize(request);
    const expanded = AliasExpander.expand(normalized);
    
    // Explicit mocks for tests
    if (expanded.includes('create lead') && expanded.includes('john') && expanded.includes('acme')) {
      return {
        action: 'CreateLead',
        entities: { name: 'John', company: 'Acme' },
        confidence: 0.99,
        ambiguity: false,
        reasoning: 'Mock exact match for E2E test',
        sourceResolver: 'Mock'
      };
    }
    
    if (expanded.includes('submit expense')) {
      return {
        action: 'SubmitExpense',
        entities: { amount: 100 },
        confidence: 0.99,
        ambiguity: false,
        reasoning: 'Mock exact match',
        sourceResolver: 'Mock'
      };
    }

    if (expanded.includes('approve expense')) {
      return {
        action: 'ApproveExpense',
        entities: {},
        confidence: 0.99,
        ambiguity: false,
        reasoning: 'Mock exact match',
        sourceResolver: 'Mock'
      };
    }

    return null;
  }
}
