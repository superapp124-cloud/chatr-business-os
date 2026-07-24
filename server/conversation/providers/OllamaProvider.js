import { AIProvider } from './AIProvider.js';

/**
 * Ollama implementation of the IAIProvider interface.
 * Defaults to localhost:11434
 */
export class OllamaProvider extends AIProvider {
  constructor(baseUrl = 'http://localhost:11434', defaultModel = 'llama3') {
    super();
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async generate(messages, options = {}) {
    const model = options.model || this.defaultModel;
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n'),
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.max_tokens ?? 2048,
        }
      })
    });
    
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const data = await response.json();
    return data.response ?? data.message?.content ?? '';
  }

  async stream(messages, options = {}, onToken) {
    const model = options.model || this.defaultModel;
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n'),
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.max_tokens ?? 2048,
        }
      })
    });

    if (!response.ok) throw new Error(`Ollama streaming error: ${response.statusText}`);
    if (!response.body) throw new Error('No response body from Ollama');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            onToken(parsed.response);
          } else if (parsed.message?.content) {
            onToken(parsed.message.content);
          }
        } catch (e) {
          // Ignore JSON parse errors for split chunks
        }
      }
    }
  }

  async embeddings(text) {
    // Requires nomic-embed-text or mxbai-embed-large model
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text', // Or configure via ai_settings
        prompt: text
      })
    });
    if (!response.ok) throw new Error(`Ollama embeddings error: ${response.statusText}`);
    const data = await response.json();
    return data.embedding;
  }

  async health() {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`);
      return response.ok;
    } catch (e) {
      return false;
    }
  }
}
