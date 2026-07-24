/**
 * CHATR AI Service
 *
 * Single entry point for all AI generation in CHATR.
 *
 * Routing priority:
 *   1. CHATR Kernel (port 8087) — desktop with kernel running
 *   2. Electron IPC (ollama.cjs) — desktop without kernel
 *   3. Ollama REST API (localhost:11434) — browser with local Ollama
 *   4. Gemini API (via env var) — cloud fallback
 *   5. OpenAI API (via env var) — cloud fallback
 *   6. Supabase Edge Function (ai-chat-assistant) — managed fallback
 *
 * Genesis v2.0 — Phase 1: Cloud AI fallback added
 */

import { conversation } from '@/core/conversation/ConversationSDK';
import { supabase } from '@/integrations/supabase/client';

interface GenerateOptions {
  prompt: string;
  conversationId?: string;
  userId?: string;
  systemPrompt?: string;
  preferLocal?: boolean;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const value = err as { message?: unknown; error?: unknown };
    if (typeof value.message === 'string') return value.message;
    if (typeof value.error === 'string') return value.error;
  }
  return 'Unknown AI error';
}

/**
 * Check whether CHATR Kernel is available (desktop app only).
 */
async function isKernelAvailable(): Promise<boolean> {
  try {
    return await conversation.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Path 3: Ollama REST API (browser — no Electron required)
 */
async function tryOllama(prompt: string): Promise<string | null> {
  try {
    const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (ollamaResponse.ok) {
      const json = await ollamaResponse.json();
      if (json?.response) return json.response as string;
    } else if (ollamaResponse.status === 404) {
      // Model not found, let's trigger a pull in the background so it works later
      fetch('http://localhost:11434/api/pull', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name: 'llama3.2' })
      }).catch(() => {});
      
      const fallback = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'mistral', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (fallback.ok) {
        const json2 = await fallback.json();
        if (json2?.response) return json2.response as string;
      } else if (fallback.status === 404) {
         fetch('http://localhost:11434/api/pull', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: 'mistral' })
         }).catch(() => {});
         throw new Error('Ollama AI engine is warming up in the background. Please wait a moment and try again.');
      }
    }
  } catch (err: any) {
    if (err.message?.includes('downloading')) throw err;
    // Ollama not running — fall through
  }
  return null;
}

/**
 * Path 4: Google Gemini REST API
 * Requires VITE_GEMINI_API_KEY env var.
 */
async function tryGemini(prompt: string, systemPrompt?: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const contents = systemPrompt
      ? [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I will follow those instructions.' }] },
          { role: 'user', parts: [{ text: prompt }] },
        ]
      : [{ role: 'user', parts: [{ text: prompt }] }];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: AbortSignal.timeout(30000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text as string;
    }
  } catch {
    // Gemini unavailable — fall through
  }
  return null;
}

/**
 * Path 5: OpenAI REST API
 * Requires VITE_OPENAI_API_KEY env var.
 */
async function tryOpenAI(prompt: string, systemPrompt?: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.7 }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) return text as string;
    }
  } catch {
    // OpenAI unavailable — fall through
  }
  return null;
}

/**
 * Path 6: Supabase Edge Function (ai-chat-assistant)
 * Managed fallback requiring user to be authenticated.
 */
async function trySupabaseEdge(prompt: string, systemPrompt?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-chat-assistant', {
      body: { prompt, system_prompt: systemPrompt, mode: 'generate' },
    });
    if (!error && data?.response) return data.response as string;
  } catch {
    // Edge function unavailable — fall through
  }
  return null;
}

/**
 * @deprecated For OS-level intents, use KernelClient.dispatchIntent() instead.
 * 
 * Generate an AI response.
 *
 * Routing priority:
 *   1. CHATR Kernel (desktop, port 8087)
 *   2. Electron IPC (desktop, ollama.cjs)
 *   3. Ollama REST (browser, localhost:11434)
 *   4. Gemini API (cloud, requires VITE_GEMINI_API_KEY)
 *   5. OpenAI API (cloud, requires VITE_OPENAI_API_KEY)
 *   6. Supabase Edge Function (managed cloud)
 */
export async function generate({
  prompt,
  conversationId = 'local',
  userId = 'local-user',
  systemPrompt,
  preferLocal = true,
}: GenerateOptions): Promise<string> {
  // ── Path 1: CHATR Kernel ─────────────────────────────────────────────────
  if (preferLocal && await isKernelAvailable()) {
    try {
      return await conversation.send({ conversationId, message: prompt, userId });
    } catch (err) {
      throw new Error(`[CHATR AI Kernel] ${getErrorMessage(err)}`);
    }
  }

  // ── Path 2: Electron IPC fallback ────────────────────────────────────────
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.ai;
  if (preferLocal && isElectron) {
    try {
      const status = await window.electronAPI!.ai!.status();
      const warmingPhases = ['checking', 'downloading', 'installing', 'starting', 'pulling'];
      if (status && warmingPhases.includes(status.phase)) {
        throw new Error(`CHATR AI is still starting up (${status.phase}). Please wait 20–30 seconds.`);
      }
      if (status?.phase === 'ready') {
        const result = await window.electronAPI!.ai!.ask(prompt);
        if (result && typeof result === 'object') {
          const r = result as { text?: string; error?: string; message?: string };
          if (r.error) throw new Error(r.message || r.error);
          if (r.text) return r.text;
        }
        if (typeof result === 'string') return result;
      }
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg.startsWith('CHATR AI')) throw err;
      // Fall through to cloud
    }
  }

  // ── Path 3: Local Ollama REST ─────────────────────────────────────────────
  if (preferLocal) {
    const ollamaResult = await tryOllama(prompt);
    if (ollamaResult) return ollamaResult;
  }

  // ── Privacy Gate ──────────────────────────────────────────────────────────
  // If we reach here, local execution failed. 
  // By default, CHATR is a desktop-first privacy product.
  // We do NOT silently send data to the cloud unless explicitly allowed.
  const strictPrivacyMode = true; // In the future, read this from user settings via Kernel

  if (strictPrivacyMode) {
    throw new Error(
      '[CHATR AI Policy] Strict Privacy Mode is enabled. Local AI is currently unavailable or warming up, and cloud fallback is blocked. \n' +
      'Options:\n' +
      '• Wait for local Ollama to finish starting.\n' +
      '• Disable Strict Privacy Mode in Settings to allow cloud fallback.'
    );
  }

  // ── Path 4: Gemini API (cloud) ────────────────────────────────────────────
  const geminiResult = await tryGemini(prompt, systemPrompt);
  if (geminiResult) return geminiResult;

  // ── Path 5: OpenAI API (cloud) ────────────────────────────────────────────
  const openAIResult = await tryOpenAI(prompt, systemPrompt);
  if (openAIResult) return openAIResult;

  // ── Path 6: Supabase Edge Function ───────────────────────────────────────
  if (!preferLocal) {
    const edgeResult = await trySupabaseEdge(prompt, systemPrompt);
    if (edgeResult) return edgeResult;
  }

  // ── No AI available ───────────────────────────────────────────────────────
  throw new Error(
    '[CHATR AI] No AI provider available. Options:\n' +
    '• Start Ollama locally: https://ollama.ai\n' +
    '• Add VITE_GEMINI_API_KEY to your .env\n' +
    '• Add VITE_OPENAI_API_KEY to your .env\n' +
    '• Open the CHATR Desktop app'
  );
}

