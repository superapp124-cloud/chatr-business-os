import { Intent, IntentParser } from './types';

export class RegexIntentParser implements IntentParser {
  async parse(rawText: string, context?: any): Promise<Intent> {
    const text = rawText.toLowerCase();
    
    return {
      id: `intent-${Date.now()}`,
      rawText,
      confidence: 0.9,
      semanticEntities: this.extractEntities(text),
      timestamp: Date.now(),
      source: 'text'
    };
  }

  private extractEntities(text: string): Record<string, any> {
    const entities: Record<string, any> = {};
    
    // Extract potential time
    if (text.includes('tomorrow')) entities['time'] = 'tomorrow';
    else if (text.includes('today')) entities['time'] = 'today';
    
    // Extract potential attendees
    const withMatch = text.match(/with\s+([a-zA-Z\s]+)(?:for|next|tomorrow|$)/i);
    if (withMatch) entities['attendee'] = withMatch[1].trim();

    return entities;
  }
}

export const intentParser = new RegexIntentParser();
