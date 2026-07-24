import { IIntentResolver } from './IIntentResolver.js';
import { ResolvedIntent } from '../../types.js';
import { Normalizer } from './Normalizer.js';
import { CapabilityRuntime } from '../CapabilityRuntime.js';

export class OllamaIntentResolver implements IIntentResolver {
  private ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  
  async resolve(request: string): Promise<ResolvedIntent | null> {
    const normalized = Normalizer.normalize(request);
    
    // Build context of what the system can do
    const capabilities = CapabilityRuntime.getAll();
    const actions = capabilities.flatMap(c => 
      c.verbs.flatMap(v => c.nouns.map(n => `${v.charAt(0).toUpperCase() + v.slice(1)}${n.charAt(0).toUpperCase() + n.slice(1)}`))
    );

    const systemPrompt = `You are a strict JSON intent parser for an enterprise system.
Valid Actions: ${actions.join(', ')}
You MUST extract the action and any named entities (e.g. name, company, email) from the user request.
Respond ONLY with a JSON object matching this schema:
{
  "action": "ExtractedAction",
  "entities": { "key": "value" },
  "confidence": 0.95
}
If you cannot determine the action, set action to "Unknown" and confidence to 0.1.`;

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3', // or mistral, depending on local setup
          prompt: `${systemPrompt}\n\nUser Request: ${normalized}`,
          stream: false,
          format: 'json',
          options: { temperature: 0.1 }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const data = await response.json();
      const parsed = JSON.parse(data.response);
      
      return {
        action: parsed.action,
        entities: parsed.entities || {},
        confidence: parsed.confidence || 0.8,
        ambiguity: parsed.confidence < 0.75,
        reasoning: 'Ollama LLM inference',
        sourceResolver: 'Ollama'
      };

    } catch (err: any) {
      console.error(`[OllamaIntentResolver] Failed to call Ollama: ${err.message}`);
      return null;
    }
  }
}
