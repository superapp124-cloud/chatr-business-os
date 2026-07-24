/**
 * CHATR Intent OS — Global Intent Context (React)
 *
 * Single React Context that wraps the entire DesktopLayout.
 * Any component on any page calls useCHATROS() to get:
 * - Current page context (AI mode, label, suggestions)
 * - Extracted knowledge (people, dates, intents from conversation)
 * - Active commitments
 * - OSScheduler entries for timeline
 *
 * This is the "one shared runtime" the architecture demands.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { pageContextEngine, PageContext, PageAIMode } from './PageContextEngine';
import { knowledgeEngine, ExtractedKnowledge, KnowledgeEngine } from './KnowledgeEngine';
import { osScheduler, ScheduleEntry } from '../services/OSSchedulerService';
import { Commitment } from '../capabilities/types';
import { eventBus } from '@/core/runtime/EventBus';
import { kernelAPI } from '@/core/runtime/KernelAPI';
import { kernel } from '../runtime/Kernel';
import { conversationStateEngine } from '../services/ConversationStateEngine';
import { usePlatform } from '@/App';
import { BootScreen } from './startup/BootScreen';
import { AvatarEngine } from './startup/AvatarEngine';
import { greetingEngine } from './startup/GreetingEngine';
import { voiceRuntime } from './startup/VoiceRuntime';
import { motion, AnimatePresence } from 'framer-motion';

const EMPTY_KNOWLEDGE: ExtractedKnowledge = {
 people: [], dates: [], dateLabels: [], topics: [],
 companies: [], intents: [], rawText: '',
 confidence: 0, extractedAt: new Date().toISOString(),
};

export interface CHATROSState {
 // Page context
 pageContext: PageContext;
 aiMode: PageAIMode;

 // Extracted knowledge from current conversation
 knowledge: ExtractedKnowledge;
 observeText: (text: string) => void; // Call this on every message
 clearKnowledge: () => void;

 // Commitments (active in current session)
 commitments: Commitment[];

 // Timeline entries from OSScheduler
 scheduleEntries: ScheduleEntry[];
 scheduledToday: ScheduleEntry[];
 scheduledUpcoming: ScheduleEntry[];

 // Global intent submission (works from ANY page)
 submitIntent: (text: string) => void;
 lastIntent: string | null;
}

export const CHATROSContext = createContext<CHATROSState | null>(null);

interface GlobalIntentProviderProps {
 children: React.ReactNode;
 commitments?: Commitment[];
 onIntentSubmit?: (text: string) => void;
}

export const GlobalIntentProvider: React.FC<GlobalIntentProviderProps> = ({
 children,
 commitments = [],
 onIntentSubmit,
}) => {
 const location = useLocation();
 const [knowledge, setKnowledge] = useState<ExtractedKnowledge>(EMPTY_KNOWLEDGE);
 const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
 const [lastIntent, setLastIntent] = useState<string | null>(null);
 const knowledgeRef = useRef<ExtractedKnowledge>(EMPTY_KNOWLEDGE);

 // Re-compute page context whenever route changes
 const pageContext = pageContextEngine.getContextForRoute(location.pathname);

 // Boot Kernel v2
 useEffect(() => {
 kernel.boot().catch(console.error);
 }, []);

 // Load schedule entries and subscribe to updates
 useEffect(() => {
 const load = () => setScheduleEntries(osScheduler.getAll());
 load();
 window.addEventListener('chatr:outcome-executed', load);
 window.addEventListener('chatr:notification-delivered', load);
 window.addEventListener('chatr:schedule-updated', load);
 return () => {
 window.removeEventListener('chatr:outcome-executed', load);
 window.removeEventListener('chatr:notification-delivered', load);
 window.removeEventListener('chatr:schedule-updated', load);
 };
 }, []);

 // Clear knowledge on route change (start fresh per conversation)
 useEffect(() => {
 knowledgeRef.current = EMPTY_KNOWLEDGE;
 setKnowledge(EMPTY_KNOWLEDGE);
 }, [location.pathname]);

 // Observe a message — extract knowledge and accumulate
 const observeText = useCallback((text: string) => {
 if (!text || text.trim().length < 3) return;
 const extracted = knowledgeEngine.extract(text);
 const merged = knowledgeEngine.merge(knowledgeRef.current, extracted);
 knowledgeRef.current = merged;
 setKnowledge({ ...merged });

 // Publish to event bus so any service can also react
 eventBus.publish('chatr:knowledge-extracted', { knowledge: extracted, route: location.pathname }, 'GlobalIntentProvider');
 }, [location.pathname]);

 const clearKnowledge = useCallback(() => {
 knowledgeRef.current = EMPTY_KNOWLEDGE;
 setKnowledge(EMPTY_KNOWLEDGE);
 }, []);

 const submitIntent = useCallback(async (text: string) => {
 setLastIntent(text);
 
 const handledInline = await conversationStateEngine.processInput(text);
 if (handledInline) {
 console.log(`[CHATR OS] Input absorbed by ConversationStateEngine.`);
 return;
 }

 observeText(text);
 onIntentSubmit?.(text);

 if ((window as any).electronAPI?.invoke) {
 // ── Send to actual CHATR Kernel Backend ──
 try {
 const response = await (window as any).electronAPI.invoke('kernel:intent:parse', text);
 if (response && response.ok) {
 // Map Backend Capability ID to Frontend UI Component ID
 let uiCapability = response.intent;
 if (response.intent === 'travel.flight.book') uiCapability = 'core.flight_booking';
 else if (response.intent === 'hotel.search') uiCapability = 'core.hotel_booking';
 
 const mockCommitment = {
 id: response.intentId || crypto.randomUUID(),
 title: text,
 capability: uiCapability,
 status: 'suggested',
 entities: response.constraints || {},
 confidence: 0.95
 };
 window.dispatchEvent(new CustomEvent('chatr:outcomes-detected', { detail: [mockCommitment] }));
 }
 } catch (err) {
 console.error('[CHATR OS] Kernel execution failed:', err);
 }
 } else {
 // Fallback only if running in pure browser mode without Electron
 let capability = 'system.search';
 const textLower = text.toLowerCase();
 if (textLower.includes('flight')) capability = 'travel.flight.book';
 else if (textLower.includes('hotel')) capability = 'hotel.search';
 else if (textLower.includes('meeting')) capability = 'core.meeting';

 const mockCommitment = {
 id: crypto.randomUUID(),
 title: text,
 capability: capability,
 status: 'suggested',
 entities: {},
 confidence: 0.95
 };
 window.dispatchEvent(new CustomEvent('chatr:outcomes-detected', { detail: [mockCommitment] }));
 }
 }, [observeText, onIntentSubmit]);

 // Derived schedule views
 const today = new Date().toISOString().split('T')[0];
 const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

 const scheduledToday = scheduleEntries.filter(e =>
 e.scheduledFor.startsWith(today) && e.status !== 'cancelled'
 );
 const scheduledUpcoming = scheduleEntries.filter(e =>
 !e.scheduledFor.startsWith(today) && e.status !== 'cancelled'
 );

 const value: CHATROSState = {
 pageContext,
 aiMode: pageContext.aiMode,
 knowledge,
 observeText,
 clearKnowledge,
 commitments,
 scheduleEntries,
 scheduledToday,
 scheduledUpcoming,
 submitIntent,
 lastIntent,
 };

 // ─── 5. Handle Kernel Boot Blocking & Startup Flow ───────────────────────────────────────
 
 const [isKernelReady, setIsKernelReady] = useState(false);
 const [kernelFailed, setKernelFailed] = useState(false);
 const [startupState, setStartupState] = useState<'BOOT' | 'GREETING' | 'READY'>('BOOT');
 const [greetingText, setGreetingText] = useState('');

 // Inline require removed, replaced with top-level imports to fix Vite crash.

 useEffect(() => {
 setIsKernelReady(kernelAPI.state.get('runtime').kernelStatus === 'ready');
 setKernelFailed(kernelAPI.state.get('runtime').kernelStatus === 'crashed');
 return kernelAPI.state.subscribe('runtime', (state) => {
 setIsKernelReady(state.kernelStatus === 'ready');
 setKernelFailed(state.kernelStatus === 'crashed');
 });
 }, []);

 useEffect(() => {
 if (startupState === 'BOOT') {
 const bootTimer = setTimeout(() => {
 setStartupState('GREETING');
 
 // Force app open after max 150ms regardless of greeting engine success
 const readyTimer = setTimeout(() => setStartupState('READY'), 150);
 
 // Prepare greeting asynchronously
 greetingEngine.generateGreeting()
 .then((greetingPayload) => {
 setGreetingText(greetingPayload.text);
 voiceRuntime.speak(greetingPayload.text, { 
 pitch: greetingPayload.pitch, 
 rate: greetingPayload.rate 
 });
 })
 .catch((err) => {
 console.error('[GreetingEngine] Failed to generate greeting', err);
 });
 }, 50);

 return () => clearTimeout(bootTimer);
 }
 }, [startupState]);

 if (kernelFailed) {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200">
 <div className="w-12 h-12 flex items-center justify-center rounded-full bg-rose-500/20 mb-4">
 <span className="text-page">⚠️</span>
 </div>
 <h1 className="text-workspace font-bold tracking-tight text-rose-400">Kernel Boot Failed</h1>
 <p className="text-slate-400 text-secondary mt-2 max-w-md text-center">
 The CHATR Operating System encountered a critical error during boot. Please check the console logs for details.
 </p>
 <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md font-medium text-secondary transition-colors border border-slate-700">
 Reboot System
 </button>
 </div>
 );
 }

 if (startupState === 'BOOT') {
 return <BootScreen />;
 }

 if (startupState === 'GREETING') {
 return (
 <AnimatePresence mode="wait">
 <motion.div
 key="greeting"
 className="flex flex-col items-center justify-center h-screen w-full bg-slate-900 text-slate-200"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 >
 <div className="w-48 h-48 mb-8">
 <AvatarEngine state="speaking" />
 </div>
 <motion.h1 
 className="text-display font-light text-center px-8"
 initial={{ y: 20, opacity: 0 }}
 animate={{ y: 0, opacity: 1 }}
 >
 {greetingText}
 </motion.h1>
 </motion.div>
 </AnimatePresence>
 );
 }

 return (
 <CHATROSContext.Provider value={value}>
 <AnimatePresence mode="wait">
 <motion.div 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 1 }} 
 transition={{ duration: 1 }}
 className="w-full h-full"
 >
 {children}
 </motion.div>
 </AnimatePresence>
 </CHATROSContext.Provider>
 );
};

/** Use on any page or component to access the global CHATR OS state */
export function useCHATROS(): CHATROSState {
 const ctx = useContext(CHATROSContext);
 if (!ctx) {
 // Graceful fallback so pages don't crash if not inside provider
 const route = typeof window !== 'undefined' ? window.location.pathname : '/';
 const pageContext = pageContextEngine.getContextForRoute(route);
 return {
 pageContext,
 aiMode: pageContext.aiMode,
 knowledge: EMPTY_KNOWLEDGE,
 observeText: () => {},
 clearKnowledge: () => {},
 commitments: [],
 scheduleEntries: [],
 scheduledToday: [],
 scheduledUpcoming: [],
 submitIntent: () => {},
 lastIntent: null,
 };
 }
 return ctx;
}
