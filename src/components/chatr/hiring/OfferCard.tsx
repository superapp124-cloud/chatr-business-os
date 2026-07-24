import React from 'react';
import { OfferViewModel } from './viewmodels';
import { FileText, Send, Building } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfferCard({ data, onSendToHRMS }: { data: OfferViewModel, onSendToHRMS?: () => void }) {
 return (
 <div className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">
 
 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-indigo-950/30 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
 <FileText className="w-5 h-5 text-indigo-400" />
 </div>
 <div>
 <h3 className="text-white font-medium">Offer Recommended</h3>
 <p className="text-slate-400 text-label">{data.candidateName}</p>
 </div>
 </div>
 <div>
 <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md", 
 data.status === 'DRAFT' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
 )}>
 {data.status}
 </span>
 </div>
 </div>

 {/* Details */}
 <div className="p-4 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">Role</p>
 <p className="text-secondary text-slate-200">{data.role}</p>
 </div>
 <div>
 <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">Proposed Salary</p>
 <p className="text-secondary font-medium text-emerald-400">{data.salary}</p>
 </div>
 </div>
 </div>

 {/* Action */}
 <div className="p-3 bg-slate-950/50 border-t border-slate-800">
 <button 
 onClick={onSendToHRMS}
 className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-button rounded-xl flex items-center justify-center gap-2 transition-colors"
 >
 <Building className="w-4 h-4" />
 Send to HRMS Provider
 </button>
 </div>

 </div>
 );
}
