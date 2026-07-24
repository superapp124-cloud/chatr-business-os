/**
 * ChatrAI - Clean and smooth AI chat
 * 6 Specialized Agents | Minimal | Fast
 */

import { useState, useRef, useEffect } from 'react';
import { 
 ArrowLeft, Send, Sparkles, Loader2, Brain, 
 Mic, MicOff, Copy, Check, ShieldCheck, ShieldAlert,
 PhoneCall, FileText, BriefcaseBusiness, HeartPulse,
 Pill, CalendarClock, Languages, LockKeyhole, Wifi,
 Activity, Users, CreditCard, MessageSquareWarning,
 ChevronRight, BellRing, Siren, ListTodo, CloudOff,
 Radio, Eye, Clock3, Sun, Moon, Zap, Fingerprint,
 Waves, type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useChatrBrain } from '@/hooks/useChatrBrain';
import { motion, AnimatePresence } from 'framer-motion';
import { kernelBus } from '@/kernel/core/EventBus';
import '@/kernel/core/index'; // Initialize Kernel Services
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import chatrIntelligenceIcon from '@/assets/chatr-intelligence-icon.jpeg';
import { chatrAIToolRegistry } from '@/platform/ai';
import type { ChatrAIToolDefinition } from '@/platform/ai';
import { WorkflowRenderer } from '@/components/workflow-ui/WorkflowRenderer';
import { triggerCabBooking } from '@/core/capabilities/travel/CabBookingWorkflow';
import { triggerCalendarMeeting } from '@/core/capabilities/calendar/CalendarMeetingWorkflow';
import { triggerFoodOrdering } from '@/core/capabilities/commerce/FoodOrderingWorkflow';
import { triggerFlightBooking } from '@/core/capabilities/travel/FlightBookingWorkflow';
import { triggerEnterpriseApproval } from '@/core/capabilities/enterprise/EnterpriseApprovalWorkflow';

interface ChatMessage {
 id: string;
 role: 'user' | 'assistant';
 content: string;
 timestamp: Date;
 isStreaming?: boolean;
 followUp?: string[];
 sources?: string[];
 confidence?: number;
 runtimeLabel?: string;
 privacy?: string;
 /** If set, renders a WorkflowRenderer below this message bubble */
 workflowId?: string;
}

interface IntelligenceStat {
 label: string;
 value: string;
 icon: LucideIcon;
 className: string;
}

interface IntelligenceInsight {
 id: string;
 title: string;
 detail: string;
 action: string;
 prompt: string;
 icon: LucideIcon;
 accentClass: string;
 meta: string;
}

interface AgentTile {
 name: string;
 status: string;
 icon: LucideIcon;
 className: string;
}

interface QuickAction {
 label: string;
 prompt: string;
 icon: LucideIcon;
}

interface AmbientMoment {
 phase: string;
 signal: string;
 detail: string;
 prompt: string;
 icon: LucideIcon;
 className: string;
}

interface LivePulse {
 title: string;
 detail: string;
 time: string;
 prompt: string;
 icon: LucideIcon;
 className: string;
}

interface MemorySignal {
 label: string;
 detail: string;
 value: number;
 icon: LucideIcon;
 className: string;
}

interface OrbMode {
 label: string;
 feeling: string;
 detail: string;
 prompt: string;
 icon: LucideIcon;
 coreClass: string;
 ringClass: string;
 auraClass: string;
 badgeClass: string;
}

interface DayContext {
 phase: string;
 headline: string;
 detail: string;
}

const quickActions: QuickAction[] = [
 {
 label: 'Check scam text',
 prompt: 'I will paste a suspicious SMS, caller note, or payment link. Check only that evidence and explain the risk.',
 icon: MessageSquareWarning,
 },
 {
 label: 'Check fake recruiter',
 prompt: 'I will paste a recruiter message or job offer. Tell me what evidence you need before scoring it.',
 icon: ShieldAlert,
 },
 {
 label: 'Summarize notes',
 prompt: 'I will paste call notes or a transcript. Summarize only what I provide and create follow-up tasks.',
 icon: FileText,
 },
 {
 label: 'Practice interview',
 prompt: 'Run a voice-first interview practice for my next job call',
 icon: BriefcaseBusiness,
 },
 {
 label: 'Plan medicine alert',
 prompt: 'Help me plan a medicine reminder after I provide the person, medicine, dosage, and time.',
 icon: Pill,
 },
 {
 label: 'Plan from notes',
 prompt: 'Build a realistic plan using only the tasks, calls, reminders, bills, or family notes I provide here.',
 icon: ListTodo,
 },
];

const readinessModes: Record<'ready' | 'listening' | 'thinking' | 'private', OrbMode> = {
 ready: {
 label: 'Ready mode',
 feeling: 'Waiting for evidence',
 detail: 'No live alerts are shown until CHATR receives real phone data or text that you provide.',
 prompt: 'Tell me what you want checked, summarized, planned, or drafted.',
 icon: Waves,
 coreClass: 'from-indigo-600 via-violet-600 to-fuchsia-500',
 ringClass: 'border-violet-500/35',
 auraClass: 'shadow-violet-500/30',
 badgeClass: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-200',
 },
 listening: {
 label: 'Listening mode',
 feeling: 'Mic active',
 detail: 'Speech input is active. CHATR will act only on what you say in this session.',
 prompt: 'Start a voice-first ChatrAI session for calls, reminders, and tasks',
 icon: Mic,
 coreClass: 'from-sky-500 via-indigo-600 to-violet-600',
 ringClass: 'border-sky-500/35',
 auraClass: 'shadow-sky-500/30',
 badgeClass: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-200',
 },
 thinking: {
 label: 'Thinking mode',
 feeling: 'Working on your request',
 detail: 'CHATR is processing the current prompt. It will not invent calls, SMS, reminders, or alerts.',
 prompt: 'Show the current ChatrAI runtime status',
 icon: Brain,
 coreClass: 'from-purple-600 via-indigo-600 to-cyan-500',
 ringClass: 'border-cyan-500/35',
 auraClass: 'shadow-cyan-500/30',
 badgeClass: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200',
 },
 private: {
 label: 'Private mode',
 feeling: 'Local first',
 detail: 'Private checks stay local when the native route is available; otherwise CHATR clearly falls back.',
 prompt: 'Show my private AI status and what is available on this device',
 icon: ShieldCheck,
 coreClass: 'from-emerald-500 via-teal-500 to-indigo-600',
 ringClass: 'border-emerald-500/40',
 auraClass: 'shadow-emerald-500/35',
 badgeClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
 },
};

const getDayContext = (): DayContext => {
 const hour = new Date().getHours();
 if (hour >= 5 && hour < 12) {
 return {
 phase: 'Morning readiness',
 headline: 'Good morning. CHATR is ready when you ask.',
 detail: 'No calls, SMS, reminders, or jobs are shown here unless they are real data from this session or the phone.',
 };
 }
 if (hour < 17) {
 return {
 phase: 'Afternoon readiness',
 headline: 'Good afternoon. CHATR is ready when you ask.',
 detail: 'The screen stays quiet until you paste evidence, speak, or a real connected feature provides data.',
 };
 }
 if (hour < 23) {
 return {
 phase: 'Evening readiness',
 headline: 'Good evening. CHATR is ready when you ask.',
 detail: 'No fake morning briefings, alerts, confidence scores, or timelines are shown without real input.',
 };
 }
 return {
 phase: 'Night readiness',
 headline: 'Good night. CHATR is ready for urgent checks.',
 detail: 'Only real prompts, connected device data, or saved reminders should create alerts on this screen.',
 };
};

const getToolStateLabel = (tool: ChatrAIToolDefinition) => {
 if (tool.requiresApproval) return 'Approval';
 if (tool.status === 'metadata_only') return 'Bounded';
 return 'Ready';
};

export default function AIChat() {
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 const [input, setInput] = useState('');
 const [isListening, setIsListening] = useState(false);
 const [copiedId, setCopiedId] = useState<string | null>(null);
 const [dayContext, setDayContext] = useState(getDayContext);
 
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLTextAreaElement>(null);
 const recognitionRef = useRef<any>(null);
 const navigate = useNavigate();
 
 const { query, isProcessing, isReady, error, runtimeStatus } = useChatrBrain();
 const registeredTools = chatrAIToolRegistry.list();
 const visibleTools = registeredTools.filter((tool) => tool.status !== 'disabled').slice(0, 6);
 const approvalToolCount = registeredTools.filter((tool) => tool.requiresApproval).length;

 const runtimeLabel = runtimeStatus?.label || (isReady ? 'ChatrAI ready' : 'Starting ChatrAI...');
 const runtimeDetail = runtimeStatus?.detail || 'Preparing private AI runtime.';
 const RuntimeStatusIcon = runtimeStatus?.isOffline
 ? LockKeyhole
 : runtimeStatus?.mode === 'cloud'
 ? Wifi
 : Activity;
 const localMode = runtimeStatus?.privacy !== 'cloud';
 const confirmedNativeAi = Boolean(runtimeStatus?.isNative);
 const activeOrbMode = isListening
 ? readinessModes.listening
 : isProcessing
 ? readinessModes.thinking
 : localMode
 ? readinessModes.private
 : readinessModes.ready;
 const aiRouteLabel = runtimeStatus?.mode === 'cloud'
 ? 'Cloud fallback'
 : confirmedNativeAi
 ? 'Native route'
 : 'Local fallback';
 const displayRuntimeLabel = runtimeStatus?.mode === 'cloud'
 ? runtimeLabel
 : confirmedNativeAi
 ? runtimeLabel
 : 'Private local fallback';
 const quietReasons = [
 { label: 'Real caller or SMS evidence', value: 'None loaded' },
 { label: 'Priority interruption', value: 'Not earned' },
 { label: 'Background alert creation', value: 'Off' },
 ];
 const confidenceRules = [
 { label: 'Confidence score', value: 'Hidden until evidence' },
 { label: 'Weak signal', value: 'No alert' },
 { label: 'Unverified context', value: 'Ask first' },
 ];
 const trustLayer = [
 { label: 'Cloud uploads', value: localMode ? '0 this session' : 'Only when labeled' },
 { label: 'Route visibility', value: aiRouteLabel },
 { label: 'Tool registry', value: `${registeredTools.length} registered` },
 { label: 'Memory signals', value: 'Not shown as fact' },
 ];

 useEffect(() => {
 const interval = window.setInterval(() => {
 setDayContext(getDayContext());
 }, 60000);

 return () => window.clearInterval(interval);
 }, []);

 // Auto-scroll only while an actual chat thread is active.
 useEffect(() => {
 if (messages.length > 0) {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 } else if (scrollContainerRef.current) {
 scrollContainerRef.current.scrollTop = 0;
 }
 }, [messages]);

 // Initialize speech recognition
 useEffect(() => {
 if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
 const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
 recognitionRef.current = new SpeechRecognition();
 recognitionRef.current.continuous = false;
 recognitionRef.current.interimResults = true;
 recognitionRef.current.lang = 'en-US';

 recognitionRef.current.onresult = (event: any) => {
 const transcript = Array.from(event.results)
 .map((result: any) => result[0].transcript)
 .join('');
 setInput(transcript);
 };

 recognitionRef.current.onend = () => setIsListening(false);
 recognitionRef.current.onerror = () => {
 setIsListening(false);
 toast.error('Voice recognition failed');
 };
 }
 }, []);

 const toggleVoiceInput = () => {
 if (!recognitionRef.current) {
 toast.error('Voice input not supported');
 return;
 }

 if (isListening) {
 recognitionRef.current.stop();
 setIsListening(false);
 } else {
 recognitionRef.current.start();
 setIsListening(true);
 }
 };

 const copyToClipboard = async (text: string, id: string) => {
 await navigator.clipboard.writeText(text);
 setCopiedId(id);
 toast.success('Copied!');
 setTimeout(() => setCopiedId(null), 2000);
 };

 const sendPrompt = async (prompt: string) => {
 if (!prompt.trim() || isProcessing || !isReady) return;

 const conversationId = `conv-${Date.now()}`;
 const userMessage: ChatMessage = {
 id: conversationId,
 role: 'user',
 content: prompt.trim(),
 timestamp: new Date(),
 };

 setMessages(prev => [...prev, userMessage]);
 const currentInput = prompt.trim();
 setInput('');

 // --- KERNEL v0.1: DUMB CLIENT ARCHITECTURE ---
 // The UI contains no business logic or routing. It blindly emits an IntentSubmitted event.
 
 // We append a placeholder message so the WorkflowRenderer mounts.
 const assistantMsg: ChatMessage = {
 id: (Date.now() + 1).toString(),
 role: 'assistant',
 content: "Sending intent to OS Kernel...",
 timestamp: new Date(),
 workflowId: conversationId,
 runtimeLabel: 'CHATR Kernel',
 privacy: 'local',
 };

 setMessages(prev => [...prev, assistantMsg]);

 // Publish to the Kernel
 await kernelBus.publish({
 eventId: `ui_req_${Date.now()}`,
 type: 'IntentSubmitted',
 timestamp: Date.now(),
 sourceService: 'UI',
 authority: 'User.Local',
 payload: { input: currentInput, intentId: conversationId },
 version: '1.0'
 });

 return;
 };


 const handleSend = async () => {
 await sendPrompt(input);
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSend();
 }
 };

 const handleInstantAction = (text: string) => {
 void sendPrompt(text);
 };

 const renderEmptyState = () => (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="mx-auto flex w-full max-w-md flex-col gap-5 pb-4"
 >
 <section className="relative overflow-hidden px-1 pb-2 pt-3 text-center">
 <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
 {[0, 1, 2].map((ring) => (
 <motion.span
 key={ring}
 className={cn(
 'absolute rounded-full border',
 activeOrbMode.ringClass,
 ring === 0 && 'h-24 w-24 opacity-80',
 ring === 1 && 'h-32 w-32 opacity-55',
 ring === 2 && 'h-40 w-40 opacity-35'
 )}
 animate={{
 scale: activeOrbMode.label === 'Scam detection' ? [0.84, 1.16, 0.84] : [0.88, 1.08, 0.88],
 opacity: activeOrbMode.label === 'Scam detection' ? [0.25, 0.9, 0.25] : [0.22, 0.72, 0.22],
 }}
 transition={{
 duration: activeOrbMode.label === 'Scam detection' ? 1.15 : activeOrbMode.label === 'Family alert' ? 1.6 : 3.6,
 repeat: Infinity,
 delay: ring * 0.45,
 ease: 'easeInOut',
 }}
 />
 ))}

 <motion.button
 type="button"
 onClick={() => handleInstantAction(activeOrbMode.prompt)}
 className={cn(
 'relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br shadow-2xl ring-1 ring-white/30',
 activeOrbMode.coreClass,
 activeOrbMode.auraClass
 )}
 animate={{
 y: [0, -3, 0],
 scale: activeOrbMode.label === 'Family alert' ? [1, 1.04, 1] : [1, 1.02, 1],
 }}
 transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
 aria-label={`Open ${activeOrbMode.label}`}
 >
 <img
 src={chatrIntelligenceIcon}
 alt="ChatrAI"
 className="h-16 w-16 rounded-full object-cover"
 />
 <motion.span
 className={cn('absolute -right-1 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background', activeOrbMode.badgeClass)}
 animate={{ scale: activeOrbMode.label === 'Listening mode' ? [1, 1.25, 1] : [1, 1.14, 1] }}
 transition={{ duration: activeOrbMode.label === 'Scam detection' ? 0.9 : 1.4, repeat: Infinity }}
 >
 <activeOrbMode.icon className="h-3.5 w-3.5" />
 </motion.span>
 </motion.button>
 </div>

 <motion.div
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 className="mx-auto -mt-1 max-w-[320px]"
 >
 <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
 {dayContext.phase}
 </p>
 <button
 type="button"
 onClick={() => handleInstantAction(activeOrbMode.prompt)}
 className={cn(
 'mx-auto mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-label font-semibold',
 activeOrbMode.badgeClass
 )}
 >
 <activeOrbMode.icon className="h-3.5 w-3.5 shrink-0" />
 <span className="truncate">{activeOrbMode.label}</span>
 <span className="text-muted-foreground">-</span>
 <span className="truncate opacity-80">{activeOrbMode.feeling}</span>
 </button>
 <h2 className="mt-2 text-page tracking-normal">
 {dayContext.headline}
 </h2>
 <p className="mt-2 text-secondary text-muted-foreground">
 {dayContext.detail}
 </p>
 </motion.div>

 <div className="mt-4 grid grid-cols-3 gap-2 text-left">
 {[
 { label: 'Cloud uploads', icon: CloudOff, value: localMode ? '0 this session' : 'Connected' },
 { label: 'AI route', icon: Fingerprint, value: aiRouteLabel },
 { label: 'Live alerts', icon: Radio, value: 'None yet' },
 ].map((item) => (
 <div
 key={item.label}
 className="rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 shadow-sm"
 >
 <item.icon className="mb-1.5 h-4 w-4 text-primary" />
 <p className="text-[10px] font-medium leading-tight text-muted-foreground">{item.label}</p>
 <p className="mt-0.5 text-label font-semibold ">{item.value}</p>
 </div>
 ))}
 </div>
 </section>

 <section className="rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm">
 <div className="flex items-start gap-3">
 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
 <ShieldCheck className="h-5 w-5" />
 </span>
 <div className="min-w-0 flex-1 text-left">
 <div className="flex items-center justify-between gap-2">
 <p className="text-label font-semibold uppercase tracking-[0.14em] text-muted-foreground">
 Live status
 </p>
 <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
 Idle
 </span>
 </div>
 <h3 className="mt-2 text-body font-semibold ">No live alerts yet</h3>
 <p className="mt-1 text-secondary text-muted-foreground">
 Caller warnings, SMS risk, reminders, and job checks will appear only after real device data is connected or you provide text in this chat.
 </p>
 </div>
 </div>
 </section>

 <section className="rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm">
 <div className="flex items-start gap-3">
 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
 <Activity className="h-5 w-5" />
 </span>
 <div className="min-w-0 flex-1 text-left">
 <p className="text-secondary font-semibold">Session activity</p>
 <div className="mt-3 grid gap-2 text-label text-muted-foreground">
 <div className="flex items-center justify-between rounded-lg bg-muted/45 px-3 py-2">
 <span>Caller or SMS evidence</span>
 <span className="font-semibold text-foreground">None loaded</span>
 </div>
 <div className="flex items-center justify-between rounded-lg bg-muted/45 px-3 py-2">
 <span>Call notes or transcript</span>
 <span className="font-semibold text-foreground">None loaded</span>
 </div>
 <div className="flex items-center justify-between rounded-lg bg-muted/45 px-3 py-2">
 <span>Private memory signals</span>
 <span className="font-semibold text-foreground">Not shown</span>
 </div>
 </div>
 </div>
 </div>
 </section>

 <section className="rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm">
 <div className="flex items-start gap-3">
 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
 <Eye className="h-5 w-5" />
 </span>
 <div className="min-w-0 flex-1 text-left">
 <p className="text-secondary font-semibold">Why CHATR stayed quiet</p>
 <p className="mt-1 text-secondary text-muted-foreground">
 Silence is the default until a real signal deserves attention.
 </p>
 <div className="mt-3 grid gap-2 text-label text-muted-foreground">
 {quietReasons.map((reason) => (
 <div key={reason.label} className="flex items-center justify-between rounded-lg bg-muted/45 px-3 py-2">
 <span>{reason.label}</span>
 <span className="font-semibold text-foreground">{reason.value}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </section>

 <section className="grid gap-3 sm:grid-cols-2">
 <div className="rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm">
 <div className="flex items-start gap-3">
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
 <Activity className="h-4.5 w-4.5" />
 </span>
 <div className="min-w-0 flex-1 text-left">
 <p className="text-secondary font-semibold">Confidence rules</p>
 <div className="mt-3 grid gap-2 text-label text-muted-foreground">
 {confidenceRules.map((rule) => (
 <div key={rule.label} className="flex items-center justify-between gap-3">
 <span>{rule.label}</span>
 <span className="text-right font-semibold text-foreground">{rule.value}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 <div className="rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm">
 <div className="flex items-start gap-3">
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
 <LockKeyhole className="h-4.5 w-4.5" />
 </span>
 <div className="min-w-0 flex-1 text-left">
 <p className="text-secondary font-semibold">Trust layer</p>
 <div className="mt-3 grid gap-2 text-label text-muted-foreground">
 {trustLayer.map((item) => (
 <div key={item.label} className="flex items-center justify-between gap-3">
 <span>{item.label}</span>
 <span className="text-right font-semibold text-foreground">{item.value}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 </section>

 <section className="rounded-lg border border-border/70 bg-card/70 p-4 shadow-sm">
 <div className="flex items-start gap-3">
 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
 <Brain className="h-5 w-5" />
 </span>
 <div className="min-w-0 flex-1 text-left">
 <div className="flex items-center justify-between gap-2">
 <p className="text-secondary font-semibold">ChatrAI tool registry</p>
 <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
 {approvalToolCount} approval gates
 </span>
 </div>
 <div className="mt-3 grid gap-2 sm:grid-cols-2">
 {visibleTools.map((tool) => (
 <div
 key={tool.id}
 className="rounded-lg border border-border/60 bg-background/75 px-3 py-2"
 >
 <div className="flex items-center justify-between gap-2">
 <span className="truncate text-label font-semibold">{tool.name}</span>
 <span
 className={cn(
 'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
 tool.requiresApproval
 ? 'bg-amber-500/10 text-amber-600'
 : 'bg-emerald-500/10 text-emerald-600'
 )}
 >
 {getToolStateLabel(tool)}
 </span>
 </div>
 <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
 {tool.description}
 </p>
 </div>
 ))}
 </div>
 </div>
 </div>
 </section>

 <section className="space-y-3">
 <div className="flex items-center justify-between px-1">
 <h3 className="text-secondary font-semibold">Act now</h3>
 <span className="flex items-center gap-1 text-label text-muted-foreground">
 <RuntimeStatusIcon className="h-3 w-3" />
 {runtimeStatus?.isOffline ? 'Offline fallback' : aiRouteLabel}
 </span>
 </div>

 <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
 {quickActions.map((action) => (
 <button
 key={action.label}
 onClick={() => handleInstantAction(action.prompt)}
 className="flex min-h-[46px] shrink-0 items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-left text-secondary font-medium shadow-sm transition-colors hover:bg-muted/60"
 >
 <action.icon className="h-4 w-4 shrink-0 text-primary" />
 <span className="whitespace-nowrap leading-tight">{action.label}</span>
 </button>
 ))}
 </div>
 </section>

 <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
 <div className="flex items-start gap-2">
 <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
 <p className="text-label text-muted-foreground">
 ChatrAI will not invent alerts. It needs pasted evidence, connected phone data, or saved reminders before showing risk, family, money, job, or call activity.
 </p>
 </div>
 </section>
 </motion.div>
 );

 const renderMessage = (message: ChatMessage) => {
 const isUser = message.role === 'user';
 
 return (
 <motion.div
 key={message.id}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 className={cn("flex gap-2 mb-3", isUser ? "justify-end" : "justify-start")}
 >
 {!isUser && (
 <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
 <motion.span
 className="absolute inset-0 rounded-full border border-primary/30"
 animate={{ scale: [1, 1.22, 1], opacity: [0.35, 0.8, 0.35] }}
 transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
 />
 {message.isStreaming ? (
 <Loader2 className="h-4 w-4 animate-spin text-primary" />
 ) : (
 <img src={chatrIntelligenceIcon} alt="ChatrAI" className="h-6 w-6 rounded-full object-cover" />
 )}
 </div>
 )}
 
 <div className={cn("max-w-[75%] group", isUser && "order-first")}>
 <div className={cn(
 "px-4 py-2.5 rounded-2xl text-secondary",
 isUser 
 ? "bg-primary text-primary-foreground rounded-br-md" 
 : "bg-muted rounded-bl-md"
 )}>
 {message.isStreaming ? (
 <div className="flex gap-1">
 {[0, 1, 2].map((i) => (
 <motion.span
 key={i}
 className="w-1.5 h-1.5 rounded-full bg-current opacity-60"
 animate={{ y: [0, -4, 0] }}
 transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
 />
 ))}
 </div>
 ) : (
 <>
 <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

 {!isUser && (
 <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
 <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
 <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1">
 <CloudOff className="h-3 w-3 text-emerald-600" />
 {message.privacy === 'cloud' ? 'Connected AI' : 'Processed locally'}
 </span>
 {message.confidence !== undefined && (
 <span className="rounded-full bg-background/70 px-2 py-1">
 {Math.round(message.confidence * 100)}% confidence
 </span>
 )}
 {message.runtimeLabel && (
 <span className="max-w-full truncate rounded-full bg-background/70 px-2 py-1">
 {message.runtimeLabel}
 </span>
 )}
 </div>

 {message.followUp?.length ? (
 <div className="flex flex-wrap gap-1.5">
 {message.followUp.slice(0, 3).map((followUp) => (
 <button
 key={followUp}
 type="button"
 onClick={() => handleInstantAction(followUp)}
 className="rounded-full border border-border/60 bg-background/75 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
 >
 {followUp}
 </button>
 ))}
 </div>
 ) : null}
 </div>
 )}
 </>
 )}
 </div>
 
 {/* Copy button - only for assistant messages */}
 {!isUser && !message.isStreaming && (
 <button
 onClick={() => copyToClipboard(message.content, message.id)}
 className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-label text-muted-foreground hover:text-foreground flex items-center gap-1"
 >
 {copiedId === message.id ? (
 <Check className="h-3 w-3 text-emerald-500" />
 ) : (
 <Copy className="h-3 w-3" />
 )}
 {copiedId === message.id ? 'Copied' : 'Copy'}
 </button>
 )}
 {/* Workflow Widget Stack — rendered below assistant message when active */}
 {!isUser && message.workflowId && (
 <div className="mt-3 w-full">
 <WorkflowRenderer workflowId={message.workflowId} />
 </div>
 )}
 </div>
 </motion.div>
 );
 };

 return (
 <div className="h-screen flex flex-col bg-background">
 {/* Header */}
 <header className="flex items-center gap-3 border-b border-border/40 bg-background/90 px-4 py-3 backdrop-blur-md">
 <Button 
 size="icon" 
 variant="ghost" 
 onClick={() => navigate(-1)}
 className="h-9 w-9"
 >
 <ArrowLeft className="h-5 w-5" />
 </Button>
 
 <div className="flex flex-1 items-center gap-2.5">
 <div className="relative flex h-10 w-10 items-center justify-center">
 <motion.span
 className="absolute inset-0 rounded-full border border-primary/25"
 animate={{ scale: [0.92, 1.18, 0.92], opacity: [0.35, 0.85, 0.35] }}
 transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
 />
 <img 
 src={chatrIntelligenceIcon} 
 alt="ChatrAI" 
 className="relative h-9 w-9 rounded-full object-cover shadow-sm"
 />
 {isReady && (
 <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
 )}
 </div>
 <div className="min-w-0">
 <h1 className="text-body font-semibold ">ChatrAI</h1>
 <p className="truncate text-label text-muted-foreground">
 {localMode ? `${displayRuntimeLabel} - 0 uploads` : displayRuntimeLabel}
 </p>
 </div>
 </div>
 </header>

 {/* Messages */}
 <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
 {messages.length === 0 ? renderEmptyState() : (
 <AnimatePresence mode="popLayout">
 {messages.map(renderMessage)}
 </AnimatePresence>
 )}
 <div ref={messagesEndRef} />
 </div>

 {/* Input - Clean */}
 <div className="px-4 pb-4 pt-2 bg-background border-t border-border/30">
 <div className="flex items-end gap-2 bg-muted/50 rounded-xl p-1.5 border border-border/50 focus-within:border-primary/40 transition-colors">
 <Button
 variant="ghost"
 size="icon"
 className={cn(
 "h-9 w-9 rounded-lg shrink-0",
 isListening && "bg-red-500/15 text-red-500"
 )}
 onClick={toggleVoiceInput}
 >
 {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
 </Button>
 
 <textarea
 ref={inputRef}
 placeholder="Ask ChatrAI or tap mic to speak..."
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={handleKeyDown}
 disabled={isProcessing || !isReady}
 rows={1}
 className="flex-1 bg-transparent border-0 resize-none focus:outline-none py-2 px-1 text-secondary min-h-[36px] max-h-[100px]"
 onInput={(e) => {
 const target = e.target as HTMLTextAreaElement;
 target.style.height = 'auto';
 target.style.height = Math.min(target.scrollHeight, 100) + 'px';
 }}
 />
 
 <Button 
 size="icon" 
 className="h-9 w-9 rounded-lg shrink-0"
 onClick={handleSend}
 disabled={!input.trim() || isProcessing || !isReady}
 >
 {isProcessing ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <Send className="h-4 w-4" />
 )}
 </Button>
 </div>
 
 {error && (
 <p className="text-label text-destructive mt-2 text-center">{error}</p>
 )}
 </div>
 </div>
 );
}
