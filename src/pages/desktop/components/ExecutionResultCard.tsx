import React from 'react';
import { ShieldCheck, Zap, Server, BadgeCheck, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Message } from '../types';

interface ExecutionResultCardProps {
 msg: Message;
}

export const ExecutionResultCard: React.FC<ExecutionResultCardProps> = ({ msg }) => {
 if (!msg.confidence && !msg.explainability) return null;

 return (
 <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1.5">
 {msg.confidenceReason && msg.confidenceReason.includes('switched') && (
 <div className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
 <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
 <span>{msg.confidenceReason}</span>
 </div>
 )}
 
 <div className="flex items-center justify-between gap-4">
 {msg.confidence && (
 <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
 <ShieldCheck className="w-3.5 h-3.5" />
 {msg.confidence === 'HIGH' ? 'Verified from live information' : msg.confidence === 'MEDIUM' ? 'Verified from multiple sources' : 'Estimated using historical information'}
 </div>
 )}

 {msg.explainability && (
 <Popover>
 <PopoverTrigger asChild>
 <button className="text-[10px] text-violet-300 hover:text-violet-200 underline decoration-violet-500/50 hover:decoration-violet-400 transition-colors">
 Why this result?
 </button>
 </PopoverTrigger>
 <PopoverContent side="top" align="end" className="w-48 p-3 bg-zinc-900 border-white/10 shadow-xl">
 <div className="text-label text-white/80 mb-2">Result Factors</div>
 <div className="flex flex-col gap-1.5 text-[11px] text-white/60">
 {msg.explainability.fastest && (
 <div className="flex items-center gap-2"><Zap className="w-3 h-3 text-amber-400" /> Fastest response</div>
 )}
 {msg.explainability.live && (
 <div className="flex items-center gap-2"><Server className="w-3 h-3 text-emerald-400" /> Live information</div>
 )}
 {msg.explainability.reliable && (
 <div className="flex items-center gap-2"><ShieldCheck className="w-3 h-3 text-blue-400" /> Reliable source</div>
 )}
 {msg.explainability.verified && (
 <div className="flex items-center gap-2"><BadgeCheck className="w-3 h-3 text-purple-400" /> Verified before showing</div>
 )}
 </div>
 </PopoverContent>
 </Popover>
 )}
 </div>
 </div>
 );
};
