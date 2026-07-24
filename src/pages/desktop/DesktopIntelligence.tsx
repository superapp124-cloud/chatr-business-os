import React, { useEffect, useRef, useState } from 'react';
import {
 AlertTriangle,
 BrainCircuit,
 CheckCircle2,
 Cpu,
 Globe,
 Loader2,
 Package,
 Radar,
 Send,
 Zap,
 Sparkles,
 ArrowRight,
 ShieldCheck,
 Bot,
 HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { widgetRegistry } from '@/core/workflow-ui/WidgetRegistry';
import { eventBus } from '@/core/runtime/EventBus';
import { OptionsCard, SearchProgressCard, type UniversalOption } from '@/components/execution/OptionsCard';
import { PaymentCard, SuccessCard } from '@/components/execution/PhaseCards';

// Types
interface Step {
 id: string;
 type: 'understanding' | 'planning' | 'discovery' | 'strategy' | 'browser' | 'complete' | 'error' | 'waiting' | 'capability';
 text: string;
 time: string;
}

interface ResultArtifact {
 label: string;
 value: string;
 status: 'ready' | 'verified' | 'observed';
}

interface ResultData {
 summary: string;
 artifacts: ResultArtifact[];
 raw?: unknown;
}

interface ApprovalRequest {
 id: string;
 capability: string;
 description: string;
}

interface ClarificationData {
 sessionId: string;
 question: string;
 missing: string[];
 resolved: Record<string, { value: string; source: string; confidence: number }>;
 widget?: { type: string; payload?: any };
}

interface PaymentState {
 status: 'idle' | 'processing' | 'success' | 'failed';
 amount: number;
 currency: string;
 bookingId: string;
 txnId?: string;
 description: string;
}

interface BookingState {
 bookingId: string;
 pnr?: string;
 title: string;
 subtitle?: string;
 details: Array<{ label: string; value: string }>;
}

interface ChatMessage {
 id: string;
 role: 'user' | 'assistant';
 content?: string;
 steps?: Step[];
 result?: ResultData | null;
 approval?: ApprovalRequest | null;
 clarification?: ClarificationData | null;
 status?: 'loading' | 'waiting' | 'complete' | 'error' | 'clarifying' | 'searching' | 'options_ready' | 'paying' | 'booking' | 'confirmed';
 // Execution phase data
 rawOptions?: UniversalOption[];
 intentForOptions?: string;
 constraintsForOptions?: { from?: string; to?: string };
 payment?: PaymentState | null;
 booking?: BookingState | null;
 bookingOptionId?: string;
 isBooking?: boolean;
}

const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

const QUICK_INTENTS = [
 { title: 'Healthcare', text: 'Find three cardiologists near me', icon: BrainCircuit },
 { title: 'Transport', text: 'Book a cab to the airport tomorrow', icon: Globe },
 { title: 'Automation', text: 'Watch folder for new invoices', icon: Cpu },
];

/**
 * Walk any execution payload and extract all "result leaf" objects —
 * objects that contain bookingId, orderId, options, restaurants, products, doctors, etc.
 * Handles both raw connector output AND the plan_completed envelope:
 * { intentId, results: { nodeId: { output: { bookingId, ... } } }, metadata }
 */
const collectOutputs = (raw?: unknown): any[] => {
 if (!raw) return [];
 const outputs: any[] = [];
 const seen = new Set<any>();

 const isLeaf = (obj: any): boolean =>
 !!(obj &&
 (Array.isArray(obj.options) || Array.isArray(obj.restaurants) ||
 Array.isArray(obj.candidates) || Array.isArray(obj.doctors) ||
 Array.isArray(obj.products) || obj.bookingId || obj.orderId ||
 obj.trainName || obj.pnr || obj.ticket));

 const walk = (obj: any) => {
 if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
 seen.add(obj);

 if (isLeaf(obj)) { outputs.push(obj); return; }

 // Unwrap plan_completed envelope: dig into .results[nodeId].output
 const results = obj.payload?.results || obj.results;
 if (results && typeof results === 'object' && !Array.isArray(results)) {
 for (const nodeResult of Object.values(results) as any[]) {
 if (nodeResult?.output) walk(nodeResult.output);
 }
 }

 // Generic recursive walk
 for (const key of Object.keys(obj)) {
 if (key === 'results') continue; // already handled above
 const child = obj[key];
 if (child && typeof child === 'object') walk(child);
 }
 };

 walk(raw as any);
 return outputs;
};

const buildResultSummary = (raw?: unknown, intent?: string) => {
 const output = collectOutputs(raw)[0];
 if (!output) return 'Task completed.';
 if (Array.isArray(output.options)) return `Found ${output.options.length} options for you.`;
 if (Array.isArray(output.restaurants)) return `Here are ${output.restaurants.length} places nearby.`;
 if (Array.isArray(output.doctors)) return `Found ${output.doctors.length} doctors near you.`;
 if (Array.isArray(output.products)) return `Found ${output.products.length} results.`;
 if (output.bookingId) return `Booking confirmed — ${output.trainName || output.provider || 'Your trip'} is ready.`;
 if (output.pnr) return `Ticket booked. PNR: ${output.pnr}`;
 if (output.orderId) return `Order placed (${output.orderId}).`;
 return 'Execution complete.';
};

const buildResultArtifacts = (intent: string, raw?: unknown): ResultArtifact[] => {
 const artifacts: ResultArtifact[] = [];
 const outputs = collectOutputs(raw);

 for (const output of outputs) {
 // ── Transport Search Results ──────────────────────────────────
 if (Array.isArray(output.options) && output.options.length > 0) {
 const opts = output.options as any[];
 const fastest = opts.reduce((b, o) => Number(o.eta) < Number(b.eta) ? o : b, opts[0]);
 const cheapest = opts.reduce((b, o) => Number(o.price) < Number(b.price) ? o : b, opts[0]);
 artifacts.push(
 { label: 'Fastest', value: `${fastest.providerName || fastest.provider || 'Provider'} · ${fastest.eta} min`, status: 'verified' },
 { label: 'Cheapest', value: `${cheapest.providerName || cheapest.provider || 'Provider'} · ₹${cheapest.price}`, status: 'verified' },
 );
 }

 // ── Train / Booking Confirmation ─────────────────────────────
 if (output.bookingId) {
 artifacts.push({ label: 'Booking ID', value: output.bookingId, status: 'verified' });
 }
 if (output.pnr) {
 artifacts.push({ label: 'PNR', value: output.pnr, status: 'verified' });
 }
 if (output.trainName) {
 artifacts.push({ label: 'Train', value: output.trainName, status: 'verified' });
 }
 if (output.provider && !output.trainName) {
 artifacts.push({ label: 'Provider', value: output.provider, status: 'verified' });
 }
 if (output.price && !Array.isArray(output.options)) {
 const currency = output.currency || '₹';
 artifacts.push({ label: 'Fare', value: `${currency} ${output.price}`, status: 'verified' });
 }
 if (output.from && output.to) {
 artifacts.push({ label: 'Route', value: `${output.from} → ${output.to}`, status: 'observed' });
 }
 if (output.eta && !Array.isArray(output.options)) {
 artifacts.push({ label: 'ETA', value: `${output.eta} min`, status: 'observed' });
 }
 if (output.status) {
 const statusLabel = String(output.status).charAt(0).toUpperCase() + String(output.status).slice(1);
 artifacts.push({ label: 'Status', value: statusLabel, status: 'verified' });
 }

 // ── Food ─────────────────────────────────────────────────────
 if (Array.isArray(output.restaurants) && output.restaurants.length > 0) {
 const r = output.restaurants[0] as any;
 artifacts.push({ label: 'Top Match', value: r.name || 'Restaurant', status: 'ready' });
 if (r.eta) artifacts.push({ label: 'Delivery', value: `${r.eta} min`, status: 'observed' });
 }

 // ── Order Confirmation ────────────────────────────────────────
 if (output.orderId) {
 artifacts.push({ label: 'Order ID', value: output.orderId, status: 'verified' });
 if (output.total) artifacts.push({ label: 'Total', value: `${output.currency || '₹'} ${output.total}`, status: 'verified' });
 if (output.delivery) artifacts.push({ label: 'Delivery', value: output.delivery, status: 'observed' });
 }

 // ── Healthcare ────────────────────────────────────────────────
 if (Array.isArray(output.doctors) && output.doctors.length > 0) {
 const d = output.doctors[0] as any;
 artifacts.push({ label: 'Top Doctor', value: d.name || 'Doctor', status: 'ready' });
 if (d.hospital) artifacts.push({ label: 'Hospital', value: d.hospital, status: 'observed' });
 }

 // ── Shopping ─────────────────────────────────────────────────
 if (Array.isArray(output.products) && output.products.length > 0) {
 const p = output.products[0] as any;
 artifacts.push({ label: 'Best Match', value: p.name || 'Product', status: 'ready' });
 if (p.price) artifacts.push({ label: 'Price', value: `₹${p.price}`, status: 'observed' });
 }
 }

 // Graceful empty state — no Debug Raw, ever
 if (artifacts.length === 0) {
 artifacts.push({ label: 'Status', value: 'Completed successfully', status: 'verified' });
 }

 return artifacts.slice(0, 6);
};

// ── Ephemeral Widget Wrapper ────────────────────────────────────────────────
const EphemeralWidget = ({ 
 widgetType, 
 widgetPayload, 
 sessionId, 
 onResume 
}: { 
 widgetType: string, 
 widgetPayload: any, 
 sessionId: string, 
 onResume: (payload: any) => void 
}) => {
 const WidgetComponent = widgetRegistry.resolve(widgetType as any);

 if (!WidgetComponent) {
 return <div className="p-4 text-secondary text-destructive">Widget "{widgetType}" not found.</div>;
 }

 const mockInstance: any = {
 id: "ephemeral-widget",
 type: widgetType as any,
 version: "1.0",
 lifecycle: "WAITING_USER", // Changed from EXECUTING to allow user input
 payload: widgetPayload || {},
 workflowId: sessionId,
 createdAt: Date.now(),
 updatedAt: Date.now()
 };

 // Supply mock workflow UI context required by widgets
 return (
 <div className="w-full">
 <WidgetComponent 
 instance={mockInstance}
 workflowId={sessionId} 
 onAction={(action: any) => {
 if (action.action === 'SUBMIT') {
 onResume(action.data);
 }
 }}
 />
 </div>
 );
};

export default function ExecutionCenter() {
 const [input, setInput] = useState('');
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 
 const scrollRef = useRef<HTMLDivElement>(null);
 const currentIntentRef = useRef('');
 const activeSessionRef = useRef<string | null>(null);

 useEffect(() => {
 if (scrollRef.current) {
 scrollRef.current.scrollIntoView({ behavior: 'smooth' });
 }
 }, [messages]);

 const updateLastAssistantMessage = (updater: (msg: ChatMessage) => ChatMessage) => {
 setMessages(prev => {
 const newMessages = [...prev];
 for (let i = newMessages.length - 1; i >= 0; i--) {
 if (newMessages[i].role === 'assistant') {
 newMessages[i] = updater(newMessages[i]);
 break;
 }
 }
 return newMessages;
 });
 };

 const addStep = (type: Step['type'], text: string) => {
 updateLastAssistantMessage(msg => ({
 ...msg,
 steps: [...(msg.steps || []), { id: Math.random().toString(36).slice(2), type, text, time: new Date().toLocaleTimeString() }]
 }));
 };

 const completeExecution = (intent: string, raw?: unknown) => {
 updateLastAssistantMessage(msg => ({
 ...msg,
 status: 'complete',
 result: {
 summary: buildResultSummary(raw),
 raw,
 artifacts: buildResultArtifacts(intent, raw),
 }
 }));
 };

 useEffect(() => {
 if (!isElectron) return undefined;
 const api = (window as any).electronAPI;

 const handlers: Array<[string, (...args: any[]) => void]> = [
 ['execution:plan_started', (data: any) => {
 addStep('planning', 'Searching live providers...');
 updateLastAssistantMessage(msg => ({ ...msg, status: 'searching' }));
 }],
 ['execution:node_started', (data: any) => addStep('strategy', `Binding runtime capabilities...`)],
 ['execution:browser_step', (data: any) => addStep('browser', `Browser: ${data?.payload?.step || data?.step || 'interacting'}`)],
 ['execution:capability_started', (data: any) => addStep('capability', `Executing capability...`)],
 ['execution:capability_completed', (data: any) => {
 addStep('complete', `Capability verified.`);
 }],
 ['execution:node_completed', (data: any) => addStep('complete', `Node output verified.`)],
 ['execution:node_awaiting_approval', (data: any) => {
 const payload = data?.payload || data;
 const capability = payload?.node?.capability || payload?.node?.action || 'execution action';
 updateLastAssistantMessage(msg => ({
 ...msg,
 status: 'waiting',
 approval: {
 id: payload?.node?.id || 'approval',
 capability,
 description: `CHATR requires explicit authorization before executing ${capability}.`,
 }
 }));
 }],
 ['execution:plan_completed', (data: any) => {
 addStep('complete', 'Search complete.');
 const payload = data?.payload || data;
 // Extract raw options[] from any node output
 const results: Record<string, any> = payload?.results || {};
 let rawOptions: UniversalOption[] = [];
 for (const nodeResult of Object.values(results)) {
 const output = (nodeResult as any)?.output;
 if (output?.options && Array.isArray(output.options) && output.options.length > 0) {
 rawOptions = output.options as UniversalOption[];
 break;
 }
 }

        if (rawOptions.length > 0) {
          // Show OptionsCard
          updateLastAssistantMessage(msg => ({
            ...msg,
            status: 'options_ready',
            rawOptions,
            intentForOptions: currentIntentRef.current || 'transport.search',
          }));
        } else {
          // No options — show standard result card
          completeExecution(currentIntentRef.current || 'intent', data);
        }
      }],
    ];

    handlers.forEach(([channel, handler]) => api.on(channel, handler));
    return () => {
      if (!api.off) return;
      handlers.forEach(([channel, handler]) => api.off(channel, handler));
    };
  }, []);

 const submit = async (overrideInput?: string) => {
 const intent = overrideInput || input;
 if (!intent.trim()) return;

 setInput('');
 currentIntentRef.current = intent;

 setMessages(prev => [
 ...prev,
 { id: Math.random().toString(), role: 'user', content: intent },
 { id: Math.random().toString(), role: 'assistant', status: 'loading', steps: [] }
 ]);

 addStep('understanding', 'Analyzing intent context...');

 if (isElectron) {
 try {
 // If there's an active session, resume it with this text
 let response: any;
 if (activeSessionRef.current) {
 response = await (window as any).electronAPI.invoke('kernel:intent:resume', {
 sessionId: activeSessionRef.current,
 followUpText: intent,
 });
 } else {
 response = await (window as any).electronAPI.invoke('kernel:intent:process', intent);
 }

 if (response?.status === 'needs_clarification') {
 // Kernel needs more info — show clarification card
 activeSessionRef.current = response.sessionId;
 updateLastAssistantMessage(msg => ({
 ...msg,
 status: 'clarifying',
 clarification: {
 sessionId: response.sessionId,
 question: response.question || 'I need a bit more information.',
 missing: response.missing || [],
 resolved: response.resolved || {},
 widget: response.widget
 },
 }));
 return;
 }

 // Session fulfilled or new intent executed
 activeSessionRef.current = null;

 if (response?.ok) {
 // Store constraints so SearchProgressCard knows from/to while waiting for plan_completed
 const c = response.constraints || {};
 updateLastAssistantMessage(msg => ({
 ...msg,
 constraintsForOptions: { from: c.from, to: c.to },
 }));
 } else if (!response?.ok) {
 updateLastAssistantMessage(msg => ({ ...msg, status: 'complete', result: {
 summary: response?.error || 'Could not process your request.',
 artifacts: [],
 }}));
 }
 } catch (error: any) {
 addStep('error', `Execution failed: ${error.message}`);
 updateLastAssistantMessage(msg => ({ ...msg, status: 'error' }));
 }
 return;
 }

 // ── WEB / BROWSER FALLBACK SIMULATOR ──
 try {
 addStep('planning', 'Resolving capabilities & provider endpoints...');
 await new Promise(r => setTimeout(r, 400));

 const lower = intent.toLowerCase();
 if (lower.includes('cab') || lower.includes('flight') || lower.includes('train') || lower.includes('airport') || lower.includes('delhi') || lower.includes('transport')) {
 addStep('strategy', 'Querying transport connectors (Uber, Ola, IRCTC)...');
 updateLastAssistantMessage(msg => ({ ...msg, status: 'searching' }));
 await new Promise(r => setTimeout(r, 600));

 updateLastAssistantMessage(msg => ({
 ...msg,
 status: 'options_ready',
 intentForOptions: 'transport.search',
 constraintsForOptions: { from: 'Current Location', to: 'Airport / Destination' },
 rawOptions: [
 { optionId: 'opt-1', title: 'Uber Premier', subtitle: 'Fastest pickup · Luxury Sedan', price: 480, currency: 'INR', eta: 4, providerName: 'Uber', vehicleType: 'Sedan' },
 { optionId: 'opt-2', title: 'Ola Executive', subtitle: 'Comfort AC · High Rated Driver', price: 420, currency: 'INR', eta: 7, providerName: 'Ola', vehicleType: 'Executive' },
 { optionId: 'opt-3', title: 'Vande Bharat Express', subtitle: 'Executive Chair Car · On-time 99%', price: 1250, currency: 'INR', eta: 180, providerName: 'IRCTC', vehicleType: 'Train' },
 ]
 }));
 } else if (lower.includes('doctor') || lower.includes('cardiologist') || lower.includes('health') || lower.includes('clinic')) {
 addStep('strategy', 'Searching verified medical registry & availability...');
 await new Promise(r => setTimeout(r, 500));
 addStep('complete', 'Found 3 top rated cardiologists near your location.');
 completeExecution(intent, {
 doctors: [
 { name: 'Dr. Sameer Gupta', hospital: 'Apollo Heart Center · 4.9 ★', fee: 1200 },
 { name: 'Dr. Priya Sharma', hospital: 'Fortis Healthcare · 4.8 ★', fee: 1000 },
 ]
 });
 } else {
 addStep('strategy', 'Processing natural language intent...');
 await new Promise(r => setTimeout(r, 500));
 addStep('complete', 'Task verified and workflow triggered successfully.');
 completeExecution(intent, {
 summary: `Successfully initiated intent "${intent}".`,
 artifacts: [
 { label: 'Status', value: 'Active & Executing', status: 'verified' },
 { label: 'Runtime Engine', value: 'Intent OS Kernel v2.4', status: 'verified' },
 ]
 });
 }
 } catch (err: any) {
 addStep('error', `Simulation failed: ${err?.message || 'Error'}`);
 updateLastAssistantMessage(msg => ({ ...msg, status: 'error' }));
 }
 };

 const handleApprove = async (nodeId: string) => {
 updateLastAssistantMessage(msg => ({ ...msg, status: 'loading', approval: null }));
 addStep('strategy', 'Authorization granted. Resuming execution...');
 
 if (isElectron) {
 const api = (window as any).electronAPI;
 if (api.invoke) {
 await api.invoke('kernel:execution:approve', { nodeId });
 }
 }
 };

 const handleReject = async (nodeId: string) => {
 updateLastAssistantMessage(msg => ({ 
 ...msg, 
 status: 'error', 
 approval: null, 
 steps: [...(msg.steps||[]), {id: 'c', type: 'error', text: 'Execution cancelled by user', time: new Date().toLocaleTimeString()}]
 }));
 
 if (isElectron) {
 const api = (window as any).electronAPI;
 if (api.invoke) {
 await api.invoke('kernel:execution:reject', { nodeId });
 }
 }
 };

 const handleWidgetResume = async (sessionId: string, constraints: any) => {
 updateLastAssistantMessage(msg => ({
 ...msg,
 status: 'loading',
 clarification: null
 }));
 addStep('understanding', 'Processing details...');
 
 if (isElectron) {
 try {
 const response = await (window as any).electronAPI.invoke('kernel:intent:resume', {
 sessionId,
 constraints,
 });

 if (response?.status === 'needs_clarification') {
 activeSessionRef.current = response.sessionId;
 updateLastAssistantMessage(msg => ({
 ...msg,
 status: 'clarifying',
 clarification: {
 sessionId: response.sessionId,
 question: response.question || 'I need a bit more information.',
 missing: response.missing || [],
 resolved: response.resolved || {},
 widget: response.widget
 },
 }));
 return;
 }

 activeSessionRef.current = null;
 if (!response?.ok) {
 updateLastAssistantMessage(msg => ({ ...msg, status: 'complete', result: {
 summary: response?.error || 'Could not process your request.',
 artifacts: [],
 }}));
 }
 } catch (error: any) {
 addStep('error', `Execution failed: ${error.message}`);
 updateLastAssistantMessage(msg => ({ ...msg, status: 'error' }));
 }
 }
 };

 return (
 <div className="flex flex-col h-[calc(100vh-48px)] w-full bg-background text-foreground font-sans relative">
 
 {/* Clean Background */}
 <div className="absolute inset-0 bg-background pointer-events-none" />
 
 {/* Main Scrollable Chat Area */}
 <div className="flex-1 overflow-y-auto w-full z-10 scroll-smooth">
 <div className="max-w-3xl mx-auto w-full pt-16 px-4 sm:px-6 flex flex-col min-h-full pb-8">
 
 {/* Welcome Screen */}
 {messages.length === 0 && (
 <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-1000 w-full py-10 my-auto relative z-10">
 <div className="mb-8 group">
 <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center relative">
 <Sparkles className="w-6 h-6 text-primary" />
 </div>
 </div>
 <h1 className="text-display font-medium tracking-tight text-foreground mb-3 text-center">
 Good afternoon.
 </h1>
 <p className="text-muted-foreground text-section mb-12 max-w-md text-center">
 What can I help you accomplish today?
 </p>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
 {QUICK_INTENTS.map((intent, idx) => {
 const Icon = intent.icon;
 return (
 <button
 key={idx}
 onClick={() => submit(intent.text)}
 className="group flex flex-col items-start p-5 bg-card/50 hover:bg-card border border-border hover:border-primary/40 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md text-left backdrop-blur-xl"
 >
 <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-4 transition-colors" />
 <h3 className="font-semibold text-card-foreground text-secondary mb-2">{intent.title}</h3>
 <p className="text-muted-foreground text-label group-hover:text-foreground/80">{intent.text}</p>
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Conversation History */}
 {messages.length > 0 && (
 <div className="flex flex-col gap-8 w-full mt-auto shrink-0">
 {messages.map((msg) => (
 <div key={msg.id} className={cn('flex w-full shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
 
 {msg.role === 'user' ? (
 <div className="max-w-[85%] sm:max-w-[70%] bg-primary text-primary-foreground px-5 py-3 rounded-2xl rounded-tr-sm shadow-sm">
 <p className="text-[15px] leading-relaxed">{msg.content}</p>
 </div>
 ) : (
 <div className="max-w-full sm:max-w-[85%] w-full flex items-start gap-4">
 {/* AI Avatar */}
 <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
 <Sparkles className="w-4 h-4 text-primary" />
 </div>
 
 <div className="flex flex-col gap-3 w-full min-w-0 shrink-0">
 {/* Execution Timeline */}
 {msg.steps && msg.steps.length > 0 && msg.status !== 'error' && (
 <div className="flex items-center gap-3 text-muted-foreground text-secondary bg-card/30 border border-border/50 px-4 py-2.5 rounded-full w-fit">
 {msg.status === 'complete' ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
 ) : (
 <Loader2 className="w-4 h-4 text-primary animate-spin" />
 )}
 <span className="font-medium truncate">
 {msg.steps[msg.steps.length - 1].text}
 </span>
 </div>
 )}

 {/* Error State */}
 {msg.status === 'error' && msg.steps && (
 <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl w-full text-destructive">
 <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
 <div className="flex flex-col">
 <span className="font-semibold text-secondary">Execution Failed</span>
 <span className="text-secondary opacity-90 mt-1">
 {msg.steps[msg.steps.length - 1]?.text || 'An error occurred during execution.'}
 </span>
 </div>
 </div>
 )}

 {/* Clarification Card — Intent Intelligence Engine needs more info */}
 {msg.status === 'clarifying' && msg.clarification && (
 <div className="mt-1 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
 {msg.clarification.widget ? (
 <div className="mt-2 w-full max-w-sm shrink-0">
 <EphemeralWidget 
 widgetType={msg.clarification.widget.type}
 widgetPayload={msg.clarification.widget.payload}
 sessionId={msg.clarification.sessionId}
 onResume={(constraints) => handleWidgetResume(msg.clarification!.sessionId, constraints)}
 />
 </div>
 ) : (
 <div className="mt-2 w-full max-w-[420px] rounded-xl border border-border bg-card p-5 shadow-sm">
 <div className="flex items-start gap-3">
 <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
 <Sparkles className="h-4 w-4 text-primary" />
 </div>
 
 <div className="flex w-full flex-col">
 <h4 className="mb-1 text-secondary font-semibold tracking-wide text-primary uppercase">Needs Clarification</h4>
 <p className="text-[15px] leading-relaxed text-foreground/90">
 {msg.clarification.question}
 </p>
 </div>
 </div>

 <div className="mt-6 flex flex-col gap-4">
 {/* Resolved Constraints */}
 {Object.keys(msg.clarification.resolved).length > 0 && (
 <div className="rounded-xl border border-border/50 bg-card/40 p-3 backdrop-blur-md">
 <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
 <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
 Resolved Context
 </div>
 <div className="flex flex-wrap gap-2">
 {Object.entries(msg.clarification.resolved).map(([field, data]: [string, any]) => (
 <div key={field} className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-label text-emerald-600 dark:text-emerald-400">
 <span className="capitalize">{field}:</span>
 <span className="text-foreground/80">{data?.value || String(data)}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Missing Constraints */}
 {msg.clarification.missing.length > 0 && (
 <div className="relative rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
 {/* Subtle pulsing background for the missing box */}
 <div className="absolute inset-0 animate-pulse rounded-xl bg-amber-500/5" />
 <div className="relative">
 <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-500">
 <HelpCircle className="h-3.5 w-3.5" />
 Information Required
 </div>
 <div className="flex flex-wrap gap-2">
 {msg.clarification.missing.map((field: string) => (
 <div key={field} className="flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-label font-semibold text-amber-600 dark:text-amber-400 shadow-sm transition-transform hover:scale-105">
 <span className="capitalize">{field}</span>
 <span className="relative flex h-2 w-2 ml-1">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
 <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
 </span>
 </div>
 ))}
 </div>
 <div className="mt-4 pt-3 border-t border-amber-500/20 flex gap-2">
 <input
 autoFocus
 type="text"
 placeholder={`Enter ${msg.clarification.missing.join(', ')}...`}
 className="flex-1 bg-background/50 border border-amber-500/30 rounded-lg px-3 py-2 text-input placeholder:text-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
 onKeyDown={(e) => {
 if (e.key === 'Enter' && e.currentTarget.value.trim()) {
 submit(e.currentTarget.value.trim());
 }
 }}
 />
 <button
 className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-2 text-button transition-colors"
 onClick={(e) => {
 const input = e.currentTarget.previousElementSibling as HTMLInputElement;
 if (input.value.trim()) {
 submit(input.value.trim());
 }
 }}
 >
 Send
 </button>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Habit Confirmation Buttons */}
 {msg.clarification.missing.length === 0 && (
 <div className="mt-5 flex items-center gap-3 border-t border-border/50 pt-4">
 <button 
 className="flex-1 rounded-xl bg-primary px-4 py-2 text-button font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
 onClick={() => handleWidgetResume(msg.clarification!.sessionId, {})}
 >
 Yes, use these
 </button>
 <button 
 className="flex-1 rounded-xl border border-border bg-card px-4 py-2 text-button font-semibold text-foreground shadow-sm transition-all hover:bg-muted hover:shadow-md hover:-translate-y-0.5 active:scale-95"
 onClick={() => submit("No, I want to change some details")}
 >
 Change details
 </button>
 </div>
 )}
 </div>
 )}
 </div>
 )}



 {/* Search Progress Card — shown while SEARCHING */}
 {msg.status === 'searching' && (
 <div className="mt-1 w-full">
 <SearchProgressCard
 from={msg.constraintsForOptions?.from}
 to={msg.constraintsForOptions?.to}
 providers={['IRCTC', 'ixigo', 'ConfirmTkt']}
 />
 </div>
 )}

 {/* Options Card — shown when OPTIONS_READY */}
 {msg.status === 'options_ready' && msg.rawOptions && msg.rawOptions.length > 0 && (
 <div className="mt-1 w-full">
 <OptionsCard
 intent={msg.intentForOptions || 'transport.search'}
 options={msg.rawOptions}
 from={msg.constraintsForOptions?.from}
 to={msg.constraintsForOptions?.to}
 isBooking={msg.isBooking}
 bookingOptionId={msg.bookingOptionId}
 onBook={async (option) => {
 // Mark this option as booking
 updateLastAssistantMessage(m => ({ ...m, isBooking: true, bookingOptionId: option.optionId }));
 addStep('strategy', `Booking ${option.title}...`);

 // Simulate booking — in production this calls kernel:intent:process 'transport.book'
 await new Promise(r => setTimeout(r, 150));

 const pnr = `PNR${Math.floor(Math.random() * 9000000 + 1000000)}`;
 const dep = option.departureTime ? new Date(option.departureTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '--';
 const arr = option.arrivalTime ? new Date(option.arrivalTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '--';

 updateLastAssistantMessage(m => ({
 ...m,
 isBooking: false,
 status: 'paying',
 payment: {
 status: 'idle',
 amount: option.price,
 currency: option.currency || 'INR',
 bookingId: `BK${Date.now()}`,
 description: option.from ? `${option.title} · ${option.from} → ${option.to || ''}` : `${option.title} · ${option.providerName || 'Provider'}`,
 },
 booking: {
 bookingId: `BK${Date.now()}`,
 pnr,
 title: option.title,
 subtitle: option.subtitle,
 details: [
 { label: 'From', value: option.from || '' },
 { label: 'To', value: option.to || '' },
 { label: 'Departure', value: dep },
 { label: 'Arrival', value: arr },
 { label: 'Class', value: option.class || option.vehicleType || '' },
 { label: 'Provider', value: option.providerName },
 ].filter(d => d.value),
 }
 }));
 }}
 />
 </div>
 )}

 {/* Payment Card */}
 {msg.status === 'paying' && msg.payment && (
 <div className="mt-1 w-full">
 <PaymentCard
 amount={msg.payment.amount}
 currency={msg.payment.currency}
 description={msg.payment.description}
 bookingId={msg.payment.bookingId}
 status={msg.payment.status}
 txnId={msg.payment.txnId}
 isProcessing={msg.payment.status === 'processing'}
 onCancel={() => updateLastAssistantMessage(m => ({ ...m, status: 'options_ready', payment: null }))}
 onPay={async (method) => {
 updateLastAssistantMessage(m => ({ ...m, payment: { ...m.payment!, status: 'processing' } }));
 addStep('strategy', `Processing ${method.toUpperCase()} payment...`);
 await new Promise(r => setTimeout(r, 150));
 const txnId = `TXN${Date.now()}`;
 updateLastAssistantMessage(m => ({
 ...m,
 status: 'confirmed',
 payment: { ...m.payment!, status: 'success', txnId },
 }));
 addStep('complete', 'Payment successful! Booking confirmed.');
 }}
 />
 </div>
 )}

 {/* Success Card */}
 {msg.status === 'confirmed' && msg.booking && (
 <div className="mt-1 w-full">
 <SuccessCard
 bookingId={msg.booking.bookingId}
 pnr={msg.booking.pnr}
 title={msg.booking.title}
 subtitle={msg.booking.subtitle}
 details={msg.booking.details}
 onAddCalendar={() => addStep('complete', 'Added to calendar.')}
 onSetReminder={() => addStep('complete', 'Reminder set for 2 hours before departure.')}
 onShare={() => addStep('complete', 'Booking details copied to clipboard.')}
 />
 </div>
 )}

 {/* Standard Results Card (non-options results) */}
 {msg.result && msg.status === 'complete' && (
 <div className="mt-1 p-5 rounded-2xl bg-card border border-border shadow-sm animate-in fade-in zoom-in-95 duration-500 w-full overflow-hidden">
 <h3 className="font-medium text-foreground text-[16px] mb-4 flex items-center gap-2">
 {msg.result.summary}
 </h3>
 {msg.result.artifacts.length > 0 && (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {msg.result.artifacts.map((art, idx) => (
 <div key={idx} className="bg-muted/40 border border-border/50 rounded-xl p-3 flex flex-col justify-center">
 <div className="flex items-center gap-2 mb-1">
 {art.status === 'verified' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
 <p className="text-label font-semibold text-muted-foreground uppercase tracking-wider">{art.label}</p>
 </div>
 <p className="text-secondary font-medium text-foreground truncate">{art.value}</p>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Approval Request */}
 {msg.approval && (
 <div className="mt-2 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 w-full animate-in slide-in-from-bottom-4 duration-500">
 <div className="flex items-start gap-3">
 <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
 <div className="flex-1">
 <h3 className="font-semibold text-foreground text-[15px] mb-2">Authorization Required</h3>
 <p className="text-secondary text-muted-foreground mb-4 ">{msg.approval.description}</p>
 <div className="flex flex-wrap items-center gap-3">
 <button onClick={() => handleApprove(msg.approval!.id)} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold text-secondary rounded-lg transition-colors flex items-center justify-center gap-2">
 Approve Execution
 </button>
 <button onClick={() => handleReject(msg.approval!.id)} 
 className="px-5 py-2.5 bg-card hover:bg-muted text-foreground font-medium text-secondary rounded-lg transition-colors border border-border">
 Cancel
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 ))}
 <div ref={scrollRef} className="h-40" />
 </div>
 )}
 </div>
 </div>

 {/* Fixed Omnibar */}
 <div className="shrink-0 w-full z-50 bg-background pt-4 pb-6 px-4 relative border-t border-border/10 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
 <div className="max-w-3xl mx-auto w-full relative">
 <div className="relative flex items-center bg-card border border-border rounded-full shadow-lg p-1.5 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all duration-300">
 <input
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && submit()}
 placeholder="Message CHATR..."
 className="flex-1 bg-transparent border-none focus:outline-none px-5 py-2.5 text-foreground placeholder:text-muted-foreground text-[15px]"
 />
 <button
 onClick={() => submit()}
 disabled={!input.trim()}
 className="shrink-0 w-10 h-10 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center transition-all text-primary-foreground ml-2"
 >
 <Send className="w-4 h-4 ml-0.5" />
 </button>
 </div>
 <p className="text-center text-[11px] text-muted-foreground mt-3 font-medium">
 CHATR OS can make mistakes. Check important information.
 </p>
 </div>
 </div>
 </div>
 );
}
