import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
// Cloud usage remaining in this file (intentional, router-gated):
//   - generateSmartReplyTextsWithCloudFallback → ai-smart-reply (only reached when Nano unavailable)
// Cloud usage removed (converted to Tier-1 rules-based):
//   - summarizeChatWithFallback: was → summarize-chat (Lovable gateway). Now: buildExtractiveSummary()
//   - generateSmartComposeWithFallback: was → smart-compose (Lovable gateway). Now: buildStaticComposeStarters()

export const ON_DEVICE_AI_ENABLED_KEY = 'chatr.onDeviceAi.enabled';

type OnDeviceAiTask = 'general' | 'summarize' | 'smart_replies' | 'smart_compose';

interface OnDeviceAiAvailability {
  available: boolean;
  status: string;
  downloadable?: boolean;
  downloading?: boolean;
  model?: string;
  provider?: string;
  reason?: string;
  geminiOnDevice?: boolean;
}

interface OnDeviceAiGenerateOptions {
  prompt: string;
  task?: OnDeviceAiTask;
  maxInputWords?: number;
  maxOutputTokens?: number;
}

interface OnDeviceAiGenerateResult {
  text: string;
  gateBlocked?: boolean;
  tier?: string;
  task?: string;
  status?: string;
  model?: string;
  provider?: string;
  latencyMs?: number;
  jsonText?: string;
  geminiOnDevice?: boolean;
}

interface OnDeviceAiPlugin {
  checkAvailability(options?: { downloadIfNeeded?: boolean }): Promise<OnDeviceAiAvailability>;
  generate(options: OnDeviceAiGenerateOptions): Promise<OnDeviceAiGenerateResult>;
}

interface ChatMessageForAI {
  sender: string;
  content: string;
}

declare global {
  interface Window {
    ChatrNativeRuntime?: {
      geminiNanoGenerate?: (payload: string) => string;
      getDeviceGPTStatus?: () => string;
    };
  }
}

const OnDeviceAi = registerPlugin<OnDeviceAiPlugin>('OnDeviceAi');

export const isOnDeviceAIEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(ON_DEVICE_AI_ENABLED_KEY) !== 'false';
};

export const setOnDeviceAIEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ON_DEVICE_AI_ENABLED_KEY, String(enabled));
};

export const checkOnDeviceAIAvailability = async (
  downloadIfNeeded = false,
): Promise<OnDeviceAiAvailability> => {
  if (!isOnDeviceAIEnabled()) {
    return { available: false, status: 'disabled', reason: 'user_disabled' };
  }

  if (Capacitor.isNativePlatform()) {
    try {
      return await OnDeviceAi.checkAvailability({ downloadIfNeeded });
    } catch (error) {
      console.debug('[OnDeviceAI] Capacitor plugin unavailable:', error);
    }
  }

  const legacyStatus = readLegacyNativeStatus();
  if (legacyStatus?.isNative && legacyStatus?.geminiOnDevice === true) {
    return {
      available: true,
      status: 'available',
      model: legacyStatus.model,
      provider: legacyStatus.provider,
      geminiOnDevice: true,
    };
  }

  return { available: false, status: 'unavailable', reason: 'native_route_missing' };
};

export const generateOnDeviceText = async (
  options: OnDeviceAiGenerateOptions,
): Promise<OnDeviceAiGenerateResult | null> => {
  if (!isOnDeviceAIEnabled() || !options.prompt.trim()) return null;

  if (Capacitor.isNativePlatform()) {
    try {
      const availability = await OnDeviceAi.checkAvailability({ downloadIfNeeded: true });
      if (availability.available) {
        const result = await OnDeviceAi.generate(options);
        if (result.gateBlocked) {
          console.debug('[OnDeviceAI] AI Gate Blocked by StabilityConfig');
          return { gateBlocked: true, text: '' }; // Explicitly return gateBlocked state
        }
        return result;
      }
    } catch (error) {
      console.debug('[OnDeviceAI] Native generation unavailable:', error);
    }
  }

  return generateWithLegacyNativeRuntime(options);
};

export const summarizeChatWithFallback = async (messages: unknown[]): Promise<string> => {
  const formattedMessages = formatMessagesForAI(messages);
  const nativeSummary = await generateOnDeviceText({
    task: 'summarize',
    prompt: buildSummaryPrompt(formattedMessages),
    maxOutputTokens: 192,
  });

  if (nativeSummary?.gateBlocked) {
    return 'AI features coming soon.';
  }

  if (nativeSummary?.text) return nativeSummary.text;

  // Tier-1 rules-based fallback — no cloud call.
  // Returns a deterministic extractive summary from the last 5 messages.
  // Cloud AI (summarize-chat edge function) is intentionally not called here;
  // re-enable as an explicit Tier-3 opt-in if needed.
  return buildExtractiveSummary(formattedMessages);
};

export const generateSmartComposeWithFallback = async (
  messages: unknown[],
): Promise<string[]> => {
  const recentMessages = formatMessagesForAI(messages).slice(-5);
  const nativeResult = await generateNativeSuggestions(
    buildSmartRepliesPrompt(recentMessages),
    'smart_compose',
  );

  if (nativeResult.gateBlocked) return [];
  if (nativeResult.suggestions.length > 0) return nativeResult.suggestions;

  // Tier-1 rules-based fallback — no cloud call.
  // Returns static context-aware compose starters derived locally.
  // Cloud AI (smart-compose edge function) is intentionally not called here;
  // re-enable as an explicit Tier-3 opt-in if needed.
  return buildStaticComposeStarters(recentMessages);
};

export const generateSmartReplyTexts = async (
  message: string,
  conversationContext: string[] = [],
): Promise<{ gateBlocked?: boolean; replies: string[] }> => {
  const recentMessages = [
    ...conversationContext.slice(-4).map((content) => ({ sender: 'Context', content })),
    { sender: 'User', content: message },
  ];

  const nativeResult = await generateNativeSuggestions(
    buildSmartRepliesPrompt(recentMessages),
    'smart_replies',
  );

  return { gateBlocked: nativeResult.gateBlocked, replies: nativeResult.suggestions };
};

export const generateSmartReplyTextsWithCloudFallback = async (
  message: string,
  conversationContext: string[] = [],
): Promise<string[]> => {
  const nativeResult = await generateSmartReplyTexts(message, conversationContext);
  
  if (nativeResult.gateBlocked) return [];
  if (nativeResult.replies?.length) return nativeResult.replies;

  const { data, error } = await supabase.functions.invoke('ai-smart-reply', {
    body: {
      lastMessage: message,
      context: conversationContext.slice(-5),
      replyCount: 3,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return normalizeSuggestions(data?.replies);
};

const generateNativeSuggestions = async (
  prompt: string,
  task: OnDeviceAiTask,
): Promise<{ gateBlocked?: boolean; suggestions: string[] }> => {
  const result = await generateOnDeviceText({
    prompt,
    task,
    maxOutputTokens: 96,
  });

  if (result?.gateBlocked) return { gateBlocked: true, suggestions: [] };

  const suggestions = result ? normalizeSuggestions(parseJsonCandidate(result.jsonText || result.text)) : [];
  return { gateBlocked: false, suggestions };
};

const formatMessagesForAI = (messages: unknown[]): ChatMessageForAI[] => {
  return messages
    .map((message) => {
      const raw = message as Record<string, any>;
      return {
        sender: raw?.sender?.username || raw?.senderName || raw?.sender || 'User',
        content: String(raw?.content || raw?.text || '').trim(),
      };
    })
    .filter((message) => message.content.length > 0);
};

const buildSummaryPrompt = (messages: ChatMessageForAI[]) => {
  const conversationText = messages.map((msg) => `${msg.sender}: ${msg.content}`).join('\n');
  return [
    'Summarize this private chat for the user.',
    'Keep the summary under 120 words.',
    'Mention decisions, action items, and health or appointment details only if present.',
    '',
    conversationText,
  ].join('\n');
};

const buildSmartRepliesPrompt = (messages: ChatMessageForAI[]) => {
  const conversationText = messages.map((msg) => `${msg.sender}: ${msg.content}`).join('\n');
  return [
    'Generate 3 short natural replies for this conversation.',
    'Return only a JSON array of strings.',
    'Each reply must be under 10 words.',
    '',
    conversationText,
  ].join('\n');
};

/**
 * Tier-1 rules-based extractive summary.
 * Produces a human-readable summary from raw message objects without any AI call.
 * Format: "[N messages] — <sender>: <snippet>, <sender>: <snippet>, ..."
 */
const buildExtractiveSummary = (messages: ChatMessageForAI[]): string => {
  const total = messages.length;
  if (total === 0) return 'No messages to summarise.';

  const excerpts = messages
    .slice(-5)
    .map((m) => {
      const snippet = m.content.length > 60 ? m.content.slice(0, 57).trimEnd() + '…' : m.content;
      return `${m.sender}: ${snippet}`;
    })
    .join(' · ');

  return `${total} message${total === 1 ? '' : 's'} — ${excerpts}`;
};

/**
 * Tier-1 rules-based compose starters.
 * Returns 3 short reply suggestions derived locally from the last message.
 * No AI call, no external dependency.
 */
const buildStaticComposeStarters = (messages: ChatMessageForAI[]): string[] => {
  const last = messages[messages.length - 1];
  const text = last?.content?.toLowerCase() ?? '';

  // Question detection
  if (text.includes('?') || text.startsWith('how') || text.startsWith('what') || text.startsWith('when') || text.startsWith('why') || text.startsWith('can you')) {
    return ['Sure, let me check.', 'Good question — give me a moment.', "I'll get back to you shortly."];
  }

  // Gratitude detection
  if (text.includes('thank') || text.includes('thanks') || text.includes('appreciate')) {
    return ['Happy to help!', 'Of course, anytime.', 'No problem at all.'];
  }

  // Affirmation/agreement
  if (text.includes('okay') || text.includes('ok') || text.includes('sure') || text.includes('sounds good')) {
    return ['Great, let me know if anything changes.', "Perfect, I'll follow up.", 'Got it!'];
  }

  // Default starters
  return ['Got it, thanks.', 'Sure, let me know.', "I'll take a look."];
};

const readLegacyNativeStatus = () => {
  if (typeof window === 'undefined') return null;
  try {
    const status = window.ChatrNativeRuntime?.getDeviceGPTStatus?.();
    return status ? JSON.parse(status) : null;
  } catch {
    return null;
  }
};

const generateWithLegacyNativeRuntime = (
  options: OnDeviceAiGenerateOptions,
): OnDeviceAiGenerateResult | null => {
  if (typeof window === 'undefined') return null;
  const generate = window.ChatrNativeRuntime?.geminiNanoGenerate;
  if (typeof generate !== 'function') return null;

  try {
    const raw = generate(JSON.stringify({
      query: options.prompt,
      task: options.task || 'general',
      timestamp: new Date().toISOString(),
    }));
    const parsed = JSON.parse(raw);
    if (parsed.geminiOnDevice !== true) return null;

    const text = parsed.text || parsed.answer || parsed.summary || '';
    return text ? {
      text,
      task: options.task,
      status: 'available',
      model: parsed.model || 'Gemini Nano Local Pack',
      provider: parsed.provider || 'Android Gemini on-device runtime',
      latencyMs: parsed.latencyMs,
      jsonText: parsed.jsonText,
      geminiOnDevice: true,
    } : null;
  } catch (error) {
    console.debug('[OnDeviceAI] Legacy native runtime failed:', error);
    return null;
  }
};

const parseJsonCandidate = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        return [];
      }
    }
  }

  return [];
};

const normalizeSuggestions = (value: unknown): string[] => {
  const parsed = typeof value === 'string' ? parseJsonCandidate(value) : value;
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'text' in item) {
        return String((item as { text?: unknown }).text || '');
      }
      return '';
    })
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
};
