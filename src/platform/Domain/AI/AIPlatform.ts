import { IService } from '../../Shared/Types';
import { Logger } from '../../Infrastructure/Logger';
import { EventBus } from '../../Infrastructure/EventBus';
import { providerManager, ChatMessage, ChatOptions } from './ProviderManager';
import { semanticMemory } from '@/core/services/SemanticMemory';
import { streamingManager } from './StreamingManager';

// ──────────────────────────────────────────────────────────────────────────────
// AIPlatformService — thin orchestrator that delegates to sub-managers
// ──────────────────────────────────────────────────────────────────────────────

class AIPlatformService implements IService {
  name = 'AIPlatform';
  dependencies = ['Configuration', 'Metrics'];

  async initialize(): Promise<void> {
    Logger.info('[AIPlatform] Initialising sub-managers: ProviderManager, MemoryManager, StreamingManager…');
    // Sub-managers are singletons and initialise lazily; nothing async to await here.
    Logger.info('[AIPlatform] Ready.');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Simple one-shot chat
  // ────────────────────────────────────────────────────────────────────────────

  async chat(
    prompt: string,
    contextId = 'default',
    userId = 'anonymous'
  ): Promise<string> {
    Logger.debug(`[AIPlatform] chat contextId=${contextId} userId=${userId}`);

    // Build message array: system context + history + new user turn
    const messages = await semanticMemory.buildSystemContext(userId, contextId);
    messages.push({ role: 'user', content: prompt });

    const response = await providerManager.chat(messages);

    // Persist both turns
    await semanticMemory.store('chat', prompt, { role: 'user', contextId });
    await semanticMemory.store('chat', response, { role: 'assistant', contextId });

    await EventBus.publish('ai.chat.completed', { userId, contextId, prompt, response });
    return response;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Streaming chat — delivers chunks via callbacks
  // ────────────────────────────────────────────────────────────────────────────

  async chatStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    onComplete: (full: string) => void,
    contextId = 'default',
    userId = 'anonymous',
    options?: ChatOptions
  ): Promise<void> {
    Logger.debug(`[AIPlatform] chatStream contextId=${contextId} userId=${userId}`);

    const messages = await semanticMemory.buildSystemContext(userId, contextId);
    messages.push({ role: 'user', content: prompt });

    await semanticMemory.store('chat', prompt, { role: 'user', contextId });

    await streamingManager.streamToState(
      messages,
      onChunk,
      async (full) => {
        await semanticMemory.store('chat', full, { role: 'assistant', contextId });
        EventBus.publish('ai.stream.completed', { userId, contextId, prompt, full });
        onComplete(full);
      },
      (err) => {
        Logger.error('[AIPlatform] Streaming error', err);
        EventBus.publish('ai.stream.error', { userId, contextId, error: err.message });
      },
      options
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Chat with an explicit, caller-supplied message history
  // ────────────────────────────────────────────────────────────────────────────

  async chatWithHistory(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    Logger.debug('[AIPlatform] chatWithHistory — forwarding to ProviderManager');
    const response = await providerManager.chat(messages, options);
    await EventBus.publish('ai.history.chat.completed', { messageCount: messages.length });
    return response;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // History management helpers
  // ────────────────────────────────────────────────────────────────────────────

  async clearHistory(userId: string, contextId = 'default'): Promise<void> {
    await semanticMemory.clearHistory(userId, contextId);
  }
}

export const AIPlatform = new AIPlatformService();
