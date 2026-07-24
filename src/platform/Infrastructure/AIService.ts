export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ToolCall {
  name: string;
  arguments: any;
}

export class AIService {
  private static readonly API_BASE = 'http://localhost:3000/api/v1/conversation';

  /**
   * Generates a standard chat response.
   */
  static async generate(messages: AIMessage[], options: AIGenerationOptions = {}): Promise<string> {
    const response = await fetch(`${this.API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, options }),
    });

    if (!response.ok) {
      throw new Error(`AI Service Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  }

  /**
   * Streams a response token-by-token using Server-Sent Events.
   */
  static async stream(
    messages: AIMessage[],
    onToken: (token: string) => void,
    onToolExecution?: (toolCall: ToolCall) => Promise<any>,
    options: AIGenerationOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      fetch(`${this.API_BASE}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, options }),
      }).then(async (response) => {
        if (!response.ok || !response.body) {
          throw new Error('Failed to start stream');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') {
                resolve();
                return;
              }

              try {
                const data = JSON.parse(dataStr);
                
                if (data.error) {
                  reject(new Error(data.error));
                  return;
                }

                if (data.token) {
                  onToken(data.token);
                }

                // UI Tool Execution Framework Hook
                if (data.tool_call && onToolExecution) {
                  const result = await onToolExecution(data.tool_call);
                  // The UI would handle appending this tool result and re-triggering the stream
                  // For now, we just invoke the callback.
                }
              } catch (e) {
                // Ignore malformed JSON chunks during streaming
              }
            }
          }
        }
        resolve();
      }).catch(reject);
    });
  }

  /**
   * Check the health of the AI API.
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/health`);
      const data = await response.json();
      return data.status === 'healthy';
    } catch {
      return false;
    }
  }
}
