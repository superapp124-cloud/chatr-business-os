import React, { useEffect, useState } from 'react';
import { useLocalAI, AIPhase } from '@/hooks/useLocalAI';
import { Cpu, CheckCircle, Loader2, AlertCircle, Download, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const PHASE_CONFIG: Record<AIPhase, {
 icon: React.ReactNode;
 label: string;
 color: string;
 showProgress: boolean;
 dismissAfterMs?: number;
}> = {
 idle: {
 icon: <Cpu className="w-3.5 h-3.5" />,
 label: 'Starting AI...',
 color: 'text-slate-400',
 showProgress: false,
 },
 checking: {
 icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
 label: 'Checking AI...',
 color: 'text-slate-400',
 showProgress: false,
 },
 downloading: {
 icon: <Download className="w-3.5 h-3.5 animate-bounce" />,
 label: 'Setting up AI engine...',
 color: 'text-blue-400',
 showProgress: true,
 },
 installing: {
 icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
 label: 'Installing AI...',
 color: 'text-blue-400',
 showProgress: false,
 },
 starting: {
 icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
 label: 'Starting local AI...',
 color: 'text-indigo-400',
 showProgress: false,
 },
 pulling: {
 icon: <Download className="w-3.5 h-3.5 animate-bounce" />,
 label: 'Downloading AI model...',
 color: 'text-purple-400',
 showProgress: true,
 },
 ready: {
 icon: <CheckCircle className="w-3.5 h-3.5" />,
 label: 'Local AI active',
 color: 'text-emerald-400',
 showProgress: false,
 dismissAfterMs: 4000,
 },
 error: {
 icon: <AlertCircle className="w-3.5 h-3.5" />,
 label: 'AI setup issue',
 color: 'text-amber-400',
 showProgress: false,
 },
 cloud_fallback: {
 icon: <AlertCircle className="w-3.5 h-3.5" />,
 label: 'Local AI unavailable',
 color: 'text-amber-400',
 showProgress: false,
 dismissAfterMs: 3000,
 },
};

export const AIStatusBadge: React.FC = () => {
 const { status, isElectron, retrySetup } = useLocalAI();
 const [visible, setVisible] = useState(false);
 const [expanded, setExpanded] = useState(false);
 const [dismissed, setDismissed] = useState(false);

 const config = PHASE_CONFIG[status.phase] ?? PHASE_CONFIG.error;

 useEffect(() => {
 if (status.phase !== 'idle') {
 setVisible(true);
 setDismissed(false);
 }
 }, [status.phase]);

 useEffect(() => {
 if (config.dismissAfterMs && !dismissed) {
 const timer = setTimeout(() => setDismissed(true), config.dismissAfterMs);
 return () => clearTimeout(timer);
 }
 }, [status.phase, config.dismissAfterMs, dismissed]);

 if (!isElectron || !visible || dismissed) return null;

 const progress = status.phase === 'downloading'
 ? status.downloadProgress
 : status.phase === 'pulling'
 ? status.pullProgress
 : 0;

 return (
 <div
 className={cn(
 'mx-2 mb-2 rounded-xl overflow-hidden transition-all duration-300',
 'border border-white/5 backdrop-blur-xl',
 status.phase === 'ready' ? 'bg-emerald-500/5' : 'bg-white/3'
 )}
 style={{ fontSize: '11px' }}
 >
 <div className="flex items-center gap-2 px-3 py-2">
 <span className={cn('flex-shrink-0', config.color)}>
 {config.icon}
 </span>
 <span className={cn('flex-1 font-medium truncate', config.color)}>
 {config.label}
 {status.currentModel && status.phase === 'pulling' && (
 <span className="text-slate-600 ml-1">({status.currentModel})</span>
 )}
 </span>

 {config.showProgress && progress > 0 && (
 <span className="text-slate-500 font-mono flex-shrink-0">{Math.round(progress)}%</span>
 )}

 {(status.error || status.warning || status.message) && (
 <button
 onClick={() => setExpanded((value) => !value)}
 className="text-slate-600 hover:text-slate-400 flex-shrink-0"
 >
 {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
 </button>
 )}

 {status.phase === 'error' && (
 <button
 onClick={() => retrySetup()}
 className="text-amber-400 hover:text-amber-300 flex-shrink-0"
 title="Retry local AI setup"
 >
 <RotateCcw className="w-3 h-3" />
 </button>
 )}
 </div>

 {config.showProgress && (
 <div className="mx-3 mb-2 h-0.5 rounded-full bg-white/5 overflow-hidden">
 <div
 className="h-full rounded-full transition-all duration-300"
 style={{
 width: `${Math.max(2, progress)}%`,
 background: status.phase === 'pulling'
 ? 'linear-gradient(90deg, #6366f1, #a855f7)'
 : 'linear-gradient(90deg, #3b82f6, #6366f1)',
 }}
 />
 </div>
 )}

 {expanded && (status.error || status.warning || status.message) && (
 <div className="px-3 pb-2 text-[10px] text-slate-500 leading-relaxed">
 {status.error && <p className="text-amber-400/80">{status.error}</p>}
 {status.warning && <p className="text-amber-300/80">{status.warning}</p>}
 {status.message && <p>{status.message}</p>}
 {status.phase === 'cloud_fallback' && (
 <p className="mt-1">Cloud AI is disabled for privacy. Start Ollama to use AI features.</p>
 )}
 </div>
 )}
 </div>
 );
};
