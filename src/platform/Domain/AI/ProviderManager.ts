import { Logger } from '../../Infrastructure/Logger';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions
  ): Promise<void>;
}

const OLLAMA_BASES = ['http://127.0.0.1:3717', 'http://localhost:3717', 'http://127.0.0.1:11434', 'http://localhost:11434'];

function hasElectronAI(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.ai;
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getReachableOllamaBase(): Promise<string | null> {
  for (const base of OLLAMA_BASES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/tags`, {}, 1500);
      if (res.ok) return base;
    } catch {
      // Try the next local endpoint.
    }
  }
  return null;
}

function messagesToPrompt(messages: ChatMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');
}

const ollamaProvider: AIProvider = {
  name: 'ollama',

  async isAvailable(): Promise<boolean> {
    if (hasElectronAI()) {
      try {
        const status = await window.electronAPI!.ai!.status();
        return status.phase === 'ready' && status.readyModels.length > 0;
      } catch {
        return false;
      }
    }

    return (await getReachableOllamaBase()) !== null;
  },

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (hasElectronAI()) {
      const result = await window.electronAPI!.ai!.ask(messagesToPrompt(messages), {
        model: options?.model,
      });

      if (typeof result === 'string') return result;
      if (result?.error) throw new Error(result.message || result.error);
      return result?.text || '';
    }

    const base = await getReachableOllamaBase();
    if (!base) {
      throw new Error('ProviderUnavailable: Local Ollama is not running.');
    }

    const model = options?.model ?? 'llama3.2:3b';
    const res = await fetchWithTimeout(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: messagesToPrompt(messages),
        stream: false,
        options: {
          temperature: options?.temperature,
          num_predict: options?.maxTokens,
        },
      }),
    }, 30000);

    if (!res.ok) {
      throw new Error(`[OllamaProvider] HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as { message?: { content?: string }; response?: string };
    return data.response ?? data.message?.content ?? '';
  },

  async chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions
  ): Promise<void> {
    if (hasElectronAI()) {
      onChunk(await ollamaProvider.chat(messages, options));
      return;
    }

    const base = await getReachableOllamaBase();
    if (!base) {
      throw new Error('ProviderUnavailable: Local Ollama is not running.');
    }

    const model = options?.model ?? 'llama3.2:3b';
    const res = await fetchWithTimeout(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: messagesToPrompt(messages),
        stream: true,
        options: {
          temperature: options?.temperature,
          num_predict: options?.maxTokens,
        },
      }),
    }, 30000);

    if (!res.ok || !res.body) {
      throw new Error(`[OllamaProvider] HTTP ${res.status}: ${await res.text()}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as { response?: string; message?: { content?: string } };
          if (parsed.response) onChunk(parsed.response);
          else if (parsed.message?.content) onChunk(parsed.message.content);
        } catch {
          // Skip partial JSON fragments until the next chunk arrives.
        }
      }
    }
  },
};

export class ProviderManager {
  private readonly providers: AIProvider[] = [ollamaProvider];

  async getActiveProvider(): Promise<AIProvider> {
    for (const provider of this.providers) {
      const available = await provider.isAvailable();
      if (available) {
        Logger.debug(`[ProviderManager] Using provider: ${provider.name}`);
        return provider;
      }
    }
    throw new Error('ProviderUnavailable: Local Ollama is not running.');
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const provider = await this.getActiveProvider();
    Logger.debug(`[ProviderManager] chat -> ${provider.name}`);
    return provider.chat(messages, options);
  }

  async chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions
  ): Promise<void> {
    const provider = await this.getActiveProvider();
    Logger.debug(`[ProviderManager] chatStream -> ${provider.name}`);
    return provider.chatStream(messages, onChunk, options);
  }
}

export const providerManager = new ProviderManager();
