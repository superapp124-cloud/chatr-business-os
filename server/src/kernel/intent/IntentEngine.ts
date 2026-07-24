import { IIntentResolver } from './IIntentResolver.js';
import { ResolvedIntent } from '../../types.js';
import { RuleBasedIntentResolver } from './RuleBasedIntentResolver.js';
import { OllamaIntentResolver } from './OllamaIntentResolver.js';
import { MockIntentResolver } from './MockIntentResolver.js';

export class SystemIntentEngine {
  private fastRouter: IIntentResolver;
  private slowRouter: IIntentResolver;
  private mockRouter: IIntentResolver;

  constructor() {
    this.fastRouter = new RuleBasedIntentResolver();
    this.slowRouter = new OllamaIntentResolver();
    this.mockRouter = new MockIntentResolver();
  }

  async parse(rawInput: string, testMode: boolean = false): Promise<ResolvedIntent> {
    console.log(`[IntentEngine] Processing intent: "${rawInput}"`);
    
    // 1. If testing, allow mock override
    if (testMode) {
      const mockResult = await this.mockRouter.resolve(rawInput);
      if (mockResult && mockResult.confidence >= 0.75) {
        console.log(`[IntentEngine] Resolved via Mock Fast-Path`);
        return mockResult;
      }
    }

    // 2. Fast Path (Deterministic)
    const fastResult = await this.fastRouter.resolve(rawInput);
    if (fastResult && fastResult.confidence >= 0.75) {
      console.log(`[IntentEngine] Resolved via Rule-Based Fast-Path: ${fastResult.action}`);
      return fastResult;
    }

    // 3. Slow Path (LLM)
    console.log(`[IntentEngine] Fast-Path missed. Falling back to Ollama LLM...`);
    const slowResult = await this.slowRouter.resolve(rawInput);
    if (slowResult && slowResult.confidence >= 0.75) {
      return slowResult;
    }

    // 4. Fallback Failure
    throw new Error(`[IntentEngine] Unable to resolve intent with sufficient confidence for: "${rawInput}"`);
  }
}

export const IntentEngine = new SystemIntentEngine();
