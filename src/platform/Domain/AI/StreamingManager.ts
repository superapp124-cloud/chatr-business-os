import { ChatMessage, ChatOptions } from './ProviderManager';
import { providerManager } from './ProviderManager';
import { Logger } from '../../Infrastructure/Logger';

// ──────────────────────────────────────────────────────────────────────────────
// StreamingManager — bridges provider streaming to React state callbacks
// ──────────────────────────────────────────────────────────────────────────────

export class StreamingManager {
  /**
   * Streams an AI response to the supplied callbacks.
   *
   * @param messages    Full messages array (system + history + new user msg)
   * @param onChunk     Called with each incremental chunk as it arrives
   * @param onComplete  Called once with the fully-assembled response string
   * @param onError     Called if the stream fails at any point
   * @param options     Optional ChatOptions forwarded to the active provider
   */
  async streamToState(
    messages: ChatMessage[],
    onChunk: (partial: string) => void,
    onComplete: (full: string) => void,
    onError: (err: Error) => void,
    options?: ChatOptions
  ): Promise<void> {
    Logger.debug('[StreamingManager] Starting stream…');

    let accumulated = '';

    try {
      await providerManager.chatStream(
        messages,
        (chunk: string) => {
          accumulated += chunk;
          onChunk(chunk);
        },
        options
      );

      Logger.debug(`[StreamingManager] Stream complete. Total chars: ${accumulated.length}`);
      onComplete(accumulated);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      Logger.error('[StreamingManager] Stream failed', error);
      onError(error);
    }
  }
}

export const streamingManager = new StreamingManager();
