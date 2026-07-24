import { useState, useCallback } from 'react';
import {
 checkOnDeviceAIAvailability,
 generateOnDeviceText,
 generateSmartReplyTextsWithCloudFallback,
 summarizeChatWithFallback,
} from '@/lib/onDeviceAI';

interface OnDeviceAIState {
 isLoading: boolean;
 isModelLoaded: boolean;
 isAvailable: boolean;
 progress: number;
 error: string | null;
 device: 'native' | 'webgpu' | 'wasm' | null;
 model: string | null;
 provider: string | null;
}

interface GenerateTextOptions {
 task?: 'general' | 'summarize' | 'smart_replies' | 'smart_compose';
 maxInputWords?: number;
 maxOutputTokens?: number;
 fallback?: () => Promise<string>;
}

export const useOnDeviceAI = () => {
 const [state, setState] = useState<OnDeviceAIState>({
 isLoading: false,
 isModelLoaded: false,
 isAvailable: false,
 progress: 0,
 error: null,
 device: null,
 model: null,
 provider: null,
 });

 const loadModel = useCallback(async () => {
 setState((prev) => ({ ...prev, isLoading: true, error: null }));

 try {
 const availability = await checkOnDeviceAIAvailability(true);
 setState((prev) => ({
 ...prev,
 isLoading: false,
 isModelLoaded: availability.available,
 isAvailable: availability.available,
 progress: availability.available ? 100 : 0,
 error: availability.available ? null : availability.reason || availability.status,
 device: availability.available ? 'native' : null,
 model: availability.model || null,
 provider: availability.provider || null,
 }));
 } catch (error) {
 setState((prev) => ({
 ...prev,
 isLoading: false,
 isModelLoaded: false,
 isAvailable: false,
 error: error instanceof Error ? error.message : 'On-device AI unavailable',
 }));
 }
 }, []);

 const generateText = useCallback(async (
 prompt = '',
 options: GenerateTextOptions = {},
 ): Promise<string> => {
 if (!prompt.trim() && !options.fallback) return '';
 setState((prev) => ({ ...prev, isLoading: true, error: null }));

 try {
 const nativeResult = await generateOnDeviceText({
 prompt,
 task: options.task || 'general',
 maxInputWords: options.maxInputWords,
 maxOutputTokens: options.maxOutputTokens,
 });

 if (nativeResult?.text) {
 setState((prev) => ({
 ...prev,
 isLoading: false,
 isModelLoaded: true,
 isAvailable: true,
 progress: 100,
 device: 'native',
 model: nativeResult.model || prev.model,
 provider: nativeResult.provider || prev.provider,
 }));
 return nativeResult.text;
 }

 const fallbackText = options.fallback ? await options.fallback() : '';
 setState((prev) => ({ ...prev, isLoading: false }));
 return fallbackText;
 } catch (error) {
 const fallbackText = options.fallback ? await options.fallback() : '';
 setState((prev) => ({
 ...prev,
 isLoading: false,
 error: fallbackText ? null : error instanceof Error ? error.message : 'Generation failed',
 }));
 return fallbackText;
 }
 }, []);

 const analyzeSentiment = useCallback(async () => {
 return { label: 'NEUTRAL', score: 0.5 };
 }, []);

 const summarize = useCallback(async (messagesOrText?: unknown): Promise<string> => {
 if (Array.isArray(messagesOrText)) {
 return summarizeChatWithFallback(messagesOrText);
 }

 if (typeof messagesOrText === 'string') {
 return generateText(messagesOrText, { task: 'summarize', maxOutputTokens: 192 });
 }

 return '';
 }, [generateText]);

 const getEmbeddings = useCallback(async (): Promise<number[][]> => {
 return [];
 }, []);

 const cleanup = useCallback(() => {}, []);

 return {
 ...state,
 loadModel,
 generateText,
 analyzeSentiment,
 summarize,
 getEmbeddings,
 cleanup,
 };
};

export const useSmartReplies = () => {
 const [isLoading, setIsLoading] = useState(false);

 const getSuggestedReplies = useCallback(async (
 message = '',
 conversationContext: string[] = [],
 ): Promise<string[]> => {
 setIsLoading(true);
 try {
 const suggestions = await generateSmartReplyTextsWithCloudFallback(message, conversationContext);
 return suggestions.length > 0 ? suggestions : ['Thanks!', 'Got it', 'Okay'];
 } catch {
 return ['Thanks!', 'Got it', 'Okay'];
 } finally {
 setIsLoading(false);
 }
 }, []);

 return {
 isModelLoaded: false,
 isLoading,
 device: null,
 loadModel: async () => {},
 getSuggestedReplies,
 };
};
