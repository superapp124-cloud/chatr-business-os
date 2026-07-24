export interface Intent {
  id: string;
  rawText: string;
  confidence: number;
  semanticEntities: Record<string, string | number | boolean>;
  timestamp: number;
  source: 'voice' | 'text' | 'system' | 'vision';
}

export interface IntentParser {
  parse(rawText: string, context?: any): Promise<Intent>;
}
