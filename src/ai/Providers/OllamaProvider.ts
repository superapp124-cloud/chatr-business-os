import { BaseAIProvider } from '../AIFactory';

export class OllamaProvider extends BaseAIProvider {
  providerId = 'ollama-local';

  async execute(payload: { prompt: string, model?: string }, context: any): Promise<any> {
    const model = payload.model || 'llama3';
    
    // Calls local Ollama instance
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: payload.prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json();
      return { text: data.response, provider: this.providerId };
    } catch (e: any) {
      console.error('Ollama connection failed', e);
      throw new Error(`Ollama generation failed: ${e.message}`);
    }
  }
}
