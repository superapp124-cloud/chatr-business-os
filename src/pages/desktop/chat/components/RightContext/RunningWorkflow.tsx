import React from 'react';
import { useLiveWorkflows } from '@/providers/useLiveWorkflows';
import { Lock, CheckCircle2, RotateCw } from 'lucide-react';

export const RunningWorkflow: React.FC = () => {
 const { workflows, isLoading, isEmpty } = useLiveWorkflows();

 return (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-label font-semibold text-white/90">Running Workflows</span>
 <button className="text-[10px] text-violet-400 hover:text-violet-300">View all</button>
 </div>
 <div className="space-y-2">
 {isLoading && workflows.length === 0 ? (
 <div className="animate-pulse flex gap-2 items-center">
 <div className="w-4 h-4 bg-white/10 rounded-full shrink-0" />
 <div className="h-3 bg-white/10 rounded w-full" />
 </div>
 ) : isEmpty ? (
 <p className="text-label text-white/40 italic">No active workflows</p>
 ) : (
 workflows.map((wf: any) => (
 <div key={wf.id} className="flex items-center justify-between group">
 <div className="flex items-center gap-2 overflow-hidden">
 <Lock className="w-3.5 h-3.5 text-white/40 shrink-0" />
 <span className="text-label text-white/70 truncate">{wf.name}</span>
 </div>
 <span className={`text-[10px] shrink-0 ml-2 ${wf.status === 'active' ? 'text-emerald-400' : 'text-white/40'}`}>
 {wf.status}
 </span>
 </div>
 ))
 )}
 </div>
 </div>
 );
};
