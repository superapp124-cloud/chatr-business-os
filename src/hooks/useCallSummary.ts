import { useState } from 'react';
import { generate } from '@/services/ai';

interface UseCallSummaryArgs {
  meetingTitle: string;
  transcript: string;
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'call',
  'could', 'from', 'have', 'just', 'like', 'meeting', 'need', 'that',
  'their', 'there', 'this', 'with', 'would', 'your', 'youre', 'they',
  'them', 'then', 'than', 'were', 'what', 'when', 'where', 'which',
]);

function buildSummaryPrompt(meetingTitle: string, transcript: string): string {
  return `You are CHATR's local meeting assistant running on-device through Ollama only.
Summarize the meeting transcript below.

Meeting topic:
${meetingTitle}

Transcript:
${transcript || '(no transcript captured)'}

Return this exact structure:
Summary
- One concise paragraph covering the main outcome.

Key Points
- 3 to 5 important points.

Next Steps
- Clear action items, owners if mentioned, and follow-up timing if mentioned.

Do not mention cloud services. Do not apologize.`;
}

function cleanTranscript(transcript: string): string {
  return transcript
    .replace(/^Call:\s*/gim, '')
    .replace(/^Host:\s*/gim, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);
}

function pickKeywords(text: string): string[] {
  const counts = new Map<string, number>();
  const words = text.toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || [];
  for (const word of words) {
    const normalized = word.replace(/'s$/, '').replace(/[^a-z0-9]/g, '');
    if (normalized.length < 4 || STOP_WORDS.has(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function scoreSentence(sentence: string): number {
  const lower = sentence.toLowerCase();
  const signals = [
    'action', 'agree', 'agreed', 'blocker', 'decision', 'decided', 'follow',
    'issue', 'next', 'plan', 'risk', 'schedule', 'send', 'share', 'task',
    'update', 'review',
  ];
  return signals.reduce((score, signal) => score + (lower.includes(signal) ? 1 : 0), 0);
}

function pickKeyPoints(sentences: string[]): string[] {
  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = ranked.slice(0, 5).map((item) => item.sentence);
  return selected.length > 0 ? selected : sentences.slice(0, 3);
}

function pickActionItems(sentences: string[]): string[] {
  const actionPattern = /\b(need to|needs to|will|should|follow up|send|share|schedule|prepare|review|update|create|confirm|check|call back)\b/i;
  const actions = sentences
    .filter((sentence) => actionPattern.test(sentence))
    .slice(0, 5);

  if (actions.length > 0) return actions;
  return ['Review the transcript and confirm the next owner and follow-up date.'];
}

function buildLocalSummary(meetingTitle: string, transcript: string): string {
  const cleaned = cleanTranscript(transcript);
  if (!cleaned) {
    return [
      'Summary',
      '- No transcript has been captured yet.',
      '',
      'Key Points',
      '- Start speaking in the call to build a local transcript.',
      '',
      'Next Steps',
      '- Capture more call audio, then generate the summary again.',
    ].join('\n');
  }

  const sentences = splitSentences(cleaned);
  const keywords = pickKeywords(cleaned);
  const fallbackPoint = cleaned.slice(0, 180);
  const keyPoints = pickKeyPoints(sentences);
  const safeKeyPoints = keyPoints.length > 0 ? keyPoints : [fallbackPoint];
  const actionItems = pickActionItems(sentences);
  const topicText = keywords.length ? keywords.join(', ') : meetingTitle;

  const opening = sentences.length > 1
    ? `The call focused on ${topicText}. The main discussion covered ${safeKeyPoints[0].replace(/[.!?]$/, '')}.`
    : `The call captured a short discussion about ${topicText}.`;

  return [
    'Summary',
    `- ${opening}`,
    '',
    'Key Points',
    ...safeKeyPoints.map((point) => `- ${point.replace(/[.!?]$/, '')}.`),
    '',
    'Next Steps',
    ...actionItems.map((item) => `- ${item.replace(/[.!?]$/, '')}.`),
  ].join('\n');
}

/**
 * Generates a call summary with strict local-only behavior.
 * First tries the desktop local AI service, then falls back to deterministic
 * on-device extraction so users still get usable notes without cloud calls.
 */
export function useCallSummary({ meetingTitle, transcript }: UseCallSummaryArgs) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  async function generateSummary(overrideTranscript?: string): Promise<string | null> {
    const finalTranscript = overrideTranscript !== undefined ? overrideTranscript : transcript;
    if (!finalTranscript.trim()) {
      const fallback = buildLocalSummary(meetingTitle, finalTranscript);
      setSummary(fallback);
      return fallback;
    }

    setLoading(true);
    try {
      const prompt = buildSummaryPrompt(meetingTitle, finalTranscript);
      const raw = (await generate({ prompt, preferLocal: true })).trim();
      const result = raw || buildLocalSummary(meetingTitle, finalTranscript);
      setSummary(result);
      return result;
    } catch (err) {
      console.warn('[useCallSummary] Local AI unavailable, using extractive fallback', err);
      const fallback = buildLocalSummary(meetingTitle, finalTranscript);
      setSummary(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }

  return { summary, loading, generateSummary };
}
