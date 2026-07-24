import { ExecutionContext } from '../../types.js';
import { CapabilityRuntime } from '../CapabilityRuntime.js';

export interface IMatcher {
  match(text: string): { intent: string; confidence: number; ambiguity: boolean; reasoning: string; capabilityId: string; action: string } | null;
}

export class RegexMatcher implements IMatcher {
  match(text: string) {
    const lower = text.toLowerCase();
    
    // Dynamically iterate the O(1) graph (or array for this slice) of capabilities
    const capabilities = CapabilityRuntime.getAll();
    
    for (const manifest of capabilities) {
      // Check if the text contains one of the capability's nouns and verbs
      for (const noun of manifest.nouns) {
        for (const verb of manifest.verbs) {
          if (lower.includes(noun) && lower.includes(verb)) {
            return {
              intent: `${noun}.${verb}`,
              capabilityId: manifest.id,
              action: `${verb}_${noun}`,
              confidence: 0.95,
              ambiguity: false,
              reasoning: `Dynamic Regex match on verb "${verb}" and noun "${noun}" for Capability ${manifest.id}`
            };
          }
        }
      }
    }
    
    return null;
  }
}

export class SystemIntentParser {
  private matcher: IMatcher;

  constructor(matcher?: IMatcher) {
    this.matcher = matcher || new RegexMatcher();
  }

  async parse(context: ExecutionContext): Promise<ExecutionContext> {
    console.log(`[IntentParser] Parsing request: "${context.rawInput}"`);
    context.state = 'Parsed';
    
    const match = this.matcher.match(context.rawInput);
    if (!match) {
      throw new Error(`IntentParser could not understand: "${context.rawInput}"`);
    }

    context.resolvedIntent = {
      intent: match.intent,
      capability: match.capabilityId, // Temporarily stored here for the resolver
      action: match.action,
      payload: {}, // Resolved in Extractor step
      confidence: match.confidence,
      ambiguity: match.ambiguity,
      reasoning: match.reasoning
    };

    return context;
  }
}

export const IntentParser = new SystemIntentParser();
