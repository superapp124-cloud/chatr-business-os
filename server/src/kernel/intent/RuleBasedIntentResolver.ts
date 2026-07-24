import { IIntentResolver } from './IIntentResolver.js';
import { ResolvedIntent } from '../../types.js';
import { CapabilityRuntime } from '../CapabilityRuntime.js';
import { Normalizer } from './Normalizer.js';
import { AliasExpander } from './IntentDictionary.js';

export class RuleBasedIntentResolver implements IIntentResolver {
  async resolve(request: string): Promise<ResolvedIntent | null> {
    const normalized = Normalizer.normalize(request);
    const expanded = AliasExpander.expand(normalized);
    
    const capabilities = CapabilityRuntime.getAll();
    
    // Simplistic heuristic: Find the first registered Noun and Verb in the expanded string
    for (const manifest of capabilities) {
      for (const noun of manifest.nouns) {
        for (const verb of manifest.verbs) {
          const nounRegex = new RegExp(`\\b${noun}\\b`, 'i');
          const verbRegex = new RegExp(`\\b${verb}\\b`, 'i');
          
          if (nounRegex.test(expanded) && verbRegex.test(expanded)) {
            
            // Very naive entity extraction: grab everything after the noun
            // In a real system, you might have light regexes for emails, names, etc.
            const entities: Record<string, any> = {};
            
            return {
              action: `${verb.charAt(0).toUpperCase() + verb.slice(1)}${noun.charAt(0).toUpperCase() + noun.slice(1)}`, // e.g., CreateLead
              entities,
              confidence: 0.85, // Rule-based is fairly confident if both exist
              ambiguity: false,
              reasoning: `Rule match on canonical verb '${verb}' and noun '${noun}'`,
              sourceResolver: 'RuleBased'
            };
          }
        }
      }
    }
    
    return null; // Fallback to Ollama if no strict rule match
  }
}
