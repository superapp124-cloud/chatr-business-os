/**
 * Call Summary Hook - Feature #42
 * Auto-generated call summaries with action items
 */
import { useState, useCallback } from 'react';
import { generate } from '@/services/ai';

interface ActionItem {
 task: string;
 assignee?: string;
 dueDate?: string;
}

interface CallSummaryResult {
 summary: string;
 keyPoints: string[];
 actionItems: ActionItem[];
 topics: string[];
 sentiment: string;
 followUpRequired: boolean;
 nextSteps: string[];
 generatedAt: string;
}

export const useCallSummary = () => {
 const [summary, setSummary] = useState<CallSummaryResult | null>(null);
 const [isGenerating, setIsGenerating] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const generateSummary = useCallback(async (
 callId: string,
 transcript?: string,
 duration?: number,
 participants?: string[]
 ): Promise<CallSummaryResult | null> => {
 try {
 setIsGenerating(true);
 setError(null);

 const prompt = `You are CHATR's local call assistant running on Ollama only. Summarize this call as strict JSON.

Call ID: ${callId}
Duration seconds: ${duration ?? 0}
Participants: ${(participants || []).join(', ') || 'Unknown'}

Transcript:
${transcript || '(no transcript captured)'}

Return only JSON with these keys:
summary string, keyPoints string[], actionItems {task:string, assignee?:string, dueDate?:string}[], topics string[], sentiment string, followUpRequired boolean, nextSteps string[], generatedAt ISO string.`;

 const raw = await generate({ prompt, preferLocal: true });
 const clean = raw.replace(/```json|```/g, '').trim();
 const data = JSON.parse(clean);

 const result: CallSummaryResult = {
 summary: data.summary || '',
 keyPoints: data.keyPoints || [],
 actionItems: data.actionItems || [],
 topics: data.topics || [],
 sentiment: data.sentiment || 'neutral',
 followUpRequired: data.followUpRequired || false,
 nextSteps: data.nextSteps || [],
 generatedAt: data.generatedAt || new Date().toISOString(),
 };

 setSummary(result);
 return result;
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Failed to generate summary';
 setError(message);
 console.error('[useCallSummary] Error:', err);
 return null;
 } finally {
 setIsGenerating(false);
 }
 }, []);

 const clearSummary = useCallback(() => {
 setSummary(null);
 setError(null);
 }, []);

 return {
 summary,
 isGenerating,
 error,
 generateSummary,
 clearSummary,
 };
};
