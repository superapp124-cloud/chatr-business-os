import React from 'react';
import { CalendarDays, Clock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LeaveRequestCard({ data, onApprove, onReject }: any) {
 return (
 <div className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">
 <div className="p-4 border-b border-slate-700/50 bg-indigo-950/30 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
 <CalendarDays className="w-5 h-5 text-indigo-400" />
 </div>
 <div>
 <h3 className="text-white font-medium">{data.employeeName}</h3>
 <p className="text-slate-400 text-label">Leave Request: {data.leaveType}</p>
 </div>
 </div>
 <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md", 
 data.status === 'PENDING' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : 
 data.status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
 "bg-rose-500/10 text-rose-400 border border-rose-500/20"
 )}>
 {data.status}
 </span>
 </div>
 <div className="p-4 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">Start Date</p>
 <p className="text-secondary text-slate-200">{data.startDate}</p>
 </div>
 <div>
 <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">End Date</p>
 <p className="text-secondary text-slate-200">{data.endDate}</p>
 </div>
 </div>
 <div>
 <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-1">Reason</p>
 <p className="text-secondary text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">{data.reason}</p>
 </div>
 </div>
 {data.status === 'PENDING' && (
 <div className="p-3 bg-slate-950/50 border-t border-slate-800 flex gap-2">
 <button onClick={onApprove} className="flex-1 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-button rounded-xl flex items-center justify-center gap-2 transition-colors">
 <CheckCircle className="w-4 h-4" /> Approve
 </button>
 <button onClick={onReject} className="flex-1 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-button rounded-xl flex items-center justify-center gap-2 transition-colors">
 <XCircle className="w-4 h-4" /> Reject
 </button>
 </div>
 )}
 </div>
 );
}
