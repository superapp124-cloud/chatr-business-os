import React from 'react';
import { Target, Calendar, DollarSign, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpportunityArtifact } from '@/core/capabilities/crm/types';

const stageColors: Record<string, string> = {
 DISCOVERY: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
 PROPOSAL: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
 NEGOTIATION: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
 CLOSED_WON: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
 CLOSED_LOST: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export function OpportunityPipelineCard({ data }: { data: Partial<OpportunityArtifact> }) {
 return (
 <div className="w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">
 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex items-start justify-between gap-2">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0 mt-0.5">
 <Target className="w-5 h-5 text-amber-400" />
 </div>
 <div>
 <h3 className="text-white font-semibold text-secondary ">{data.title}</h3>
 <p className="text-slate-400 text-label mt-0.5">Next: {data.nextAction}</p>
 </div>
 </div>
 <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border shrink-0", stageColors[data.stage || 'DISCOVERY'])}>
 {data.stage?.replace('_', ' ')}
 </span>
 </div>

 {/* Value & Probability */}
 <div className="p-4 grid grid-cols-3 gap-3 border-b border-slate-700/50">
 <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
 <div className="flex items-center gap-1 mb-1">
 <DollarSign className="w-3 h-3 text-emerald-400" />
 <span className="text-[10px] text-slate-400 uppercase tracking-wider">Value</span>
 </div>
 <p className="text-secondary font-bold text-emerald-400">₹{((data.value || 0) / 100000).toFixed(1)}L</p>
 </div>
 <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
 <div className="flex items-center gap-1 mb-1">
 <Percent className="w-3 h-3 text-violet-400" />
 <span className="text-[10px] text-slate-400 uppercase tracking-wider">Win %</span>
 </div>
 <p className="text-secondary font-bold text-violet-400">{data.probability}%</p>
 </div>
 <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
 <div className="flex items-center gap-1 mb-1">
 <Calendar className="w-3 h-3 text-sky-400" />
 <span className="text-[10px] text-slate-400 uppercase tracking-wider">Close</span>
 </div>
 <p className="text-secondary font-bold text-sky-400">{data.closeDate}</p>
 </div>
 </div>

 {/* BANT */}
 <div className="p-4 space-y-2">
 {[
 { label: 'Budget', value: data.budget },
 { label: 'Authority', value: data.authority },
 { label: 'Need', value: data.need },
 { label: 'Timeline', value: data.timeline },
 ].map(({ label, value }) => (
 <div key={label} className="flex gap-3 text-secondary">
 <span className="text-slate-500 w-16 shrink-0">{label}</span>
 <span className="text-slate-300">{value}</span>
 </div>
 ))}
 </div>
 </div>
 );
}
