import { useState, useEffect, useCallback } from 'react';

/**
 * useLocalAI - Renderer-side hook for local Ollama AI.
 *
 * Strict privacy mode: this hook only talks to the Electron Ollama IPC bridge.
 * It never falls back to Supabase or another cloud AI provider.
 */

export type AIPhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'starting'
  | 'pulling'
  | 'ready'
  | 'error'
  | 'cloud_fallback';

export interface AIStatus {
  phase: AIPhase;
  readyModels: string[];
  downloadProgress: number;
  pullProgress: number;
  error: string | null;
  currentModel?: string;
  warning?: string;
  message?: string;
}

export interface AskOptions {
  model?: string;
  systemPrompt?: string;
  /** Deprecated: ignored in strict privacy mode. */
  cloudFallback?: string;
  /** Deprecated: ignored in strict privacy mode. */
  cloudPayload?: Record<string, unknown>;
}

const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.ai;

const DEFAULT_STATUS: AIStatus = {
  phase: 'idle',
  readyModels: [],
  downloadProgress: 0,
  pullProgress: 0,
  error: null,
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const value = err as { message?: unknown; error?: unknown };
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error === 'string') return value.error;
  }
  return 'Unknown local AI error';
}

function unwrapAskResult(result: unknown): string {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return '';

  const value = result as { text?: unknown; error?: unknown; message?: unknown };
  if (value.error) throw new Error(getErrorMessage(value));
  if (typeof value.text === 'string') return value.text;
  if (typeof value.message === 'string') return value.message;
  return '';
}

export function useLocalAI() {
  const [status, setStatus] = useState<AIStatus>(DEFAULT_STATUS);
  const [supportsWebGPU] = useState(() => typeof navigator !== 'undefined' && 'gpu' in navigator);

  useEffect(() => {
    if (!isElectron) {
      setStatus({
        ...DEFAULT_STATUS,
        phase: 'error',
        error: 'Local Ollama is available only in the desktop app. Cloud AI fallback is disabled.',
      });
      return;
    }

    window.electronAPI!.ai!.status().then((s: AIStatus) => setStatus(s)).catch((err: unknown) => {
      setStatus({
        ...DEFAULT_STATUS,
        phase: 'error',
        error: getErrorMessage(err),
      });
    });

    const handler = (data: AIStatus) => setStatus(data);
    window.electronAPI!.ai!.onStatusChange(handler);

    return () => {
      window.electronAPI!.ai!.offStatusChange(handler);
    };
  }, []);

  const ask = useCallback(async (
    prompt: string,
    opts: AskOptions = {}
  ): Promise<string> => {
    if (!isElectron) {
      throw new Error('Local Ollama is available only in the desktop app. Cloud AI fallback is disabled.');
    }

    if (status.phase !== 'ready' || status.readyModels.length === 0) {
      throw new Error(`Local Ollama is not ready (${status.phase}). Cloud AI fallback is disabled.`);
    }

    const result = await window.electronAPI!.ai!.ask(prompt, {
      model: opts.model,
      systemPrompt: opts.systemPrompt,
    });
    return unwrapAskResult(result);
  }, [status.phase, status.readyModels]);

  const analyzeIntent = useCallback(async (query: string): Promise<{
    suggestedQueries: string[];
    quickAnswer: string | null;
  }> => {
    const trimmed = query.trim();
    if (!trimmed) return { suggestedQueries: [], quickAnswer: null };

    if (!isElectron || status.phase !== 'ready') {
      return {
        suggestedQueries: [trimmed],
        quickAnswer: null,
      };
    }

    try {
      const response = await ask(
        `Analyze this search query privately. Return one short helpful answer and three improved search queries as plain text.\n\nQuery: ${trimmed}`,
        { systemPrompt: 'You are a private local search assistant. Keep the response concise.' }
      );
      const lines = response.split('\n').map((line) => line.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
      return {
        quickAnswer: lines[0] || null,
        suggestedQueries: (lines.length > 1 ? lines.slice(1, 4) : [trimmed]).slice(0, 3),
      };
    } catch {
      return {
        suggestedQueries: [trimmed],
        quickAnswer: null,
      };
    }
  }, [ask, status.phase]);

  const retrySetup = useCallback(async () => {
    if (!isElectron) return;
    await window.electronAPI!.ai!.retrySetup();
  }, []);

  return {
    status,
    isLocalReady: status.phase === 'ready',
    isReady: status.phase === 'ready',
    isElectron,
    ask,
    analyzeIntent,
    supportsWebGPU,
    retrySetup,
  };
}
