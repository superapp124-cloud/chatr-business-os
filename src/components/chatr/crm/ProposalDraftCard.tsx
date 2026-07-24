import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Send, Tag } from 'lucide-react';
import { ProposalArtifact } from '@/core/capabilities/crm/types';
import { cn } from '@/lib/utils';

export function ProposalDraftCard({ data, onSend }: { data: Partial<ProposalArtifact>, onSend?: () => void }) {
 const [expanded, setExpanded] = useState(false);

 const total = data.pricing?.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) || 0;
 const discounted = total * (1 - (data.discountPercentage || 0) / 100);

 return (
 <div className="w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">
 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-violet-950/30 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
 <FileText className="w-5 h-5 text-violet-400" />
 </div>
 <div>
 <h3 className="text-white font-semibold text-secondary">{data.title}</h3>
 <p className="text-slate-400 text-label">Valid until {data.validUntil}</p>
 </div>
 </div>
 <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border",
 data.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
 data.status === 'SENT' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
 )}>
 {data.status}
 </span>
 </div>

 {/* Executive Summary */}
 <div className="p-4 border-b border-slate-700/50">
 <p className="text-label text-slate-400 mb-2 ">Executive Summary</p>
 <p className="text-secondary text-slate-300 line-clamp-3">{data.executiveSummary}</p>
 </div>

 {/* Pricing */}
 <div className="border-b border-slate-700/50">
 <button onClick={() => setExpanded(v => !v)}
 className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
 <div className="flex items-center gap-2">
 <Tag className="w-4 h-4 text-slate-400" />
 <span className="text-secondary font-medium text-slate-200">Pricing Breakdown</span>
 </div>
 {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
 </button>
 {expanded && (
 <div className="px-4 pb-4 space-y-2">
 {data.pricing?.map((item, i) => (
 <div key={i} className="flex justify-between items-center text-secondary">
 <span className="text-slate-400">{item.item}</span>
 <span className="text-slate-200">₹{(item.quantity * item.unitPrice).toLocaleString()}</span>
 </div>
 ))}
 {(data.discountPercentage || 0) > 0 && (
 <div className="flex justify-between items-center text-secondary text-rose-400 pt-1 border-t border-slate-700/50">
 <span>Discount ({data.discountPercentage}%)</span>
 <span>-₹{(total - discounted).toLocaleString()}</span>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Total + Send */}
 <div className="p-4 bg-slate-950/50 flex items-center justify-between">
 <div>
 <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Total Value</p>
 <p className="text-workspace font-bold text-violet-400">₹{discounted.toLocaleString()}</p>
 </div>
 {data.status === 'DRAFT' && (
 <button onClick={onSend}
 className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-button rounded-xl transition-colors">
 <Send className="w-4 h-4" />
 Send to Client
 </button>
 )}
 </div>
 </div>
 );
}
