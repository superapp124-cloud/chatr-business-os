import React, { useState, useEffect, useCallback } from 'react';
import { BrainCircuit, Check, Settings, Cpu, AlertCircle, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { ServiceRegistry } from '@/platform/Infrastructure/ServiceRegistry';
import { useCHATROS } from '@/core/os/hooks';

type AIStatus = 'healthy' | 'degraded' | 'offline';
type AIMode = 'local' | 'unavailable' | 'unknown';

const LOCAL_OLLAMA_ENDPOINTS = [
 'http://127.0.0.1:3717/api/tags',
 'http://localhost:3717/api/tags',
 'http://127.0.0.1:11434/api/tags',
 'http://localhost:11434/api/tags',
];

export const TinyAIIndicator = () => {
 const { theme } = useTheme();
 const isDark =
 theme === 'dark' ||
 (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

 const [isOpen, setIsOpen] = useState(false);
 const [status, setStatus] = useState<AIStatus>('offline');
 const [aiMode, setAIMode] = useState<AIMode>('unknown');
 const [latency, setLatency] = useState<number | null>(null);
 const [ollamaModels, setOllamaMod] = useState<string[]>([]);

 // Page-aware AI mode from GlobalIntentProvider
 const { pageContext } = useCHATROS();
 const pageAILabel = pageContext?.aiLabel || 'CHATR AI';
 const pageAIEmoji = pageContext?.aiEmoji || '⚡';

 const statusLabel =
 status === 'healthy'
 ? 'AI Ready'
 : status === 'degraded'
 ? 'AI Initializing'
 : 'AI Unavailable';

 const statusColor =
 status === 'healthy'
 ? 'bg-emerald-500'
 : status === 'degraded'
 ? 'bg-amber-400'
 : 'bg-red-500';

 const pollStatus = useCallback(async () => {
 try {
 const healthMonitor = ServiceRegistry.get<{ getStatus(): AIStatus }>('HealthMonitor');
 setStatus(healthMonitor.getStatus());
 } catch {
 // Platform services may not be ready yet.
 }

 for (const endpoint of LOCAL_OLLAMA_ENDPOINTS) {
 try {
 const t0 = performance.now();
 const res = await fetch(endpoint, {
 signal: AbortSignal.timeout(2000),
 });
 const elapsed = Math.round(performance.now() - t0);

 if (res.ok) {
 const json = await res.json();
 const models: string[] = (json.models ?? []).map((m: any) => m.name as string);
 setOllamaMod(models);
 setAIMode('local');
 setLatency(elapsed);
 setStatus((prev) => (prev === 'offline' ? 'healthy' : prev));
 return;
 }
 } catch {
 // Try the next local endpoint.
 }
 }

 setOllamaMod([]);
 setAIMode('unavailable');
 setLatency(null);
 setStatus((prev) => (prev === 'healthy' ? 'offline' : prev));
 }, []);

 useEffect(() => {
 pollStatus();
 const timer = setInterval(pollStatus, 10_000);
 return () => clearInterval(timer);
 }, [pollStatus]);

 return (
 <div className="relative z-50">
 <button
 onClick={() => setIsOpen(!isOpen)}
 className={cn(
 'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-[11px] font-medium border',
 isDark
 ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
 : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
 )}
 >
 <span
 className={cn(
 'w-2 h-2 rounded-full',
 statusColor,
 status === 'degraded' && 'animate-pulse'
 )}
 />
 <img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-4 h-4 rounded-full object-cover shadow-sm" />
 <span className="font-bold">{pageAILabel}</span>
 {status === 'healthy' && <Radio className="w-3 h-3 text-emerald-400 ml-0.5" />}
 </button>

 {isOpen && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
 <div
 className={cn(
 'absolute top-full right-0 mt-2 w-72 rounded-xl border shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100',
 isDark
 ? 'bg-slate-900 border-white/10 text-white'
 : 'bg-white border-slate-200 text-slate-800'
 )}
 >
 <div className="flex items-center gap-2 mb-3">
 <BrainCircuit
 className={cn(
 'w-4 h-4',
 status === 'healthy' ? 'text-emerald-500' : 'text-slate-400'
 )}
 />
 <h3 className="text-secondary font-bold">AI Status</h3>
 {status === 'healthy' && (
 <span className="ml-auto flex items-center text-[10px] text-emerald-500">
 <Check className="w-3 h-3 mr-0.5" /> Ready
 </span>
 )}
 </div>

 <div className="space-y-2 mb-4">
 <div className="flex justify-between items-center text-label">
 <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
 Processing
 </span>
 <span className="font-medium flex items-center gap-1">
 {aiMode === 'local' ? (
 <>
 <Cpu className="w-3 h-3 text-emerald-400" /> Local Ollama
 </>
 ) : aiMode === 'unavailable' ? (
 <>
 <AlertCircle className="w-3 h-3 text-red-500" /> Offline
 </>
 ) : (
 'Detecting...'
 )}
 </span>
 </div>

 {aiMode === 'unavailable' ? (
 <div className="my-3 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-label">
 <p className="font-semibold mb-1">AI is currently unavailable.</p>
 <p className="opacity-90 leading-relaxed mb-3">CHATR runs AI entirely on your device for absolute privacy. No conversation has been uploaded.</p>
 <div className="flex flex-col gap-2">
 <button className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 py-1 rounded transition-colors text-[11px] font-medium" onClick={() => window.open('https://ollama.ai', '_blank')}>
 Start Ollama
 </button>
 <button className="w-full bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 py-1 rounded transition-colors text-[11px] font-medium" onClick={pollStatus}>
 Retry Connection
 </button>
 </div>
 </div>
 ) : (
 <>
 <div className="flex justify-between items-center text-label">
 <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Model</span>
 <span className="font-medium truncate max-w-[130px] text-right">
 {ollamaModels.length > 0 ? ollamaModels[0] : 'Not ready'}
 </span>
 </div>

 <div className="flex justify-between items-center text-label">
 <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Latency</span>
 <span
 className={cn(
 'font-medium',
 latency !== null && latency < 500 ? 'text-emerald-500' : 'text-amber-400'
 )}
 >
 {latency !== null ? `${latency}ms` : 'Local offline'}
 </span>
 </div>

 <div className="flex justify-between items-center text-label">
 <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
 Platform Health
 </span>
 <span
 className={cn(
 'font-medium capitalize',
 status === 'healthy'
 ? 'text-emerald-500'
 : status === 'degraded'
 ? 'text-amber-400'
 : 'text-red-400'
 )}
 >
 {status}
 </span>
 </div>
 </>
 )}

 {ollamaModels.length > 1 && (
 <div className="pt-1">
 <div className={cn('text-[10px] mb-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
 Available local models
 </div>
 <div className="flex flex-wrap gap-1">
 {ollamaModels.slice(0, 4).map((m) => (
 <span
 key={m}
 className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
 >
 {m}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>

 <button
 className={cn(
 'w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-label border transition-colors',
 isDark ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'
 )}
 onClick={() => setIsOpen(false)}
 >
 <Settings className="w-3.5 h-3.5" /> Manage Local Models
 </button>
 </div>
 </>
 )}
 </div>
 );
};
