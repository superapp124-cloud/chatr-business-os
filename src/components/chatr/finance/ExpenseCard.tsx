import React, { useState } from 'react';
import { Receipt, ShieldCheck, AlertTriangle, Clock, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { ExpenseArtifact, formatMoney } from '@/core/capabilities/finance/types';
import { cn } from '@/lib/utils';

export function ExpenseCard({ data, onApprove }: { data: Partial<ExpenseArtifact>; onApprove?: () => void }) {
 const [auditExpanded, setAuditExpanded] = useState(false);

 const statusConfig = {
 DRAFT: { color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', icon: Clock },
 SUBMITTED: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
 APPROVED: { color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle },
 REJECTED: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: AlertTriangle },
 PAID: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: CheckCircle },
 } as const;

 const policyConfig = {
 WITHIN_LIMIT: { label: 'Auto Approved', color: 'text-emerald-400', icon: ShieldCheck },
 REQUIRES_APPROVAL: { label: 'Approval Required', color: 'text-amber-400', icon: AlertTriangle },
 EXCEEDS_LIMIT: { label: 'Exceeds Limit', color: 'text-rose-400', icon: AlertTriangle },
 } as const;

 const statusKey = (data.status || 'DRAFT') as keyof typeof statusConfig;
 const policyKey = (data.policyStatus || 'WITHIN_LIMIT') as keyof typeof policyConfig;
 const { color: statusColor, bg: statusBg, icon: StatusIcon } = statusConfig[statusKey];
 const { label: policyLabel, color: policyColor, icon: PolicyIcon } = policyConfig[policyKey];

 return (
 <div className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">

 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
 <Receipt className="w-5 h-5 text-orange-400" />
 </div>
 <div>
 <h3 className="text-white font-semibold text-secondary">Expense Report</h3>
 <p className="text-slate-400 text-label">{data.employeeName} · {data.category}</p>
 </div>
 </div>
 <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border flex items-center gap-1', statusBg)}>
 <StatusIcon className={cn('w-3 h-3', statusColor)} />
 <span className={statusColor}>{data.status}</span>
 </span>
 </div>

 {/* Amount + Policy */}
 <div className="p-4 border-b border-slate-700/50">
 <div className="flex items-end justify-between mb-3">
 <div>
 <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Amount</p>
 <p className="text-page font-bold text-white">{data.amount ? formatMoney(data.amount) : '—'}</p>
 </div>
 <div className={cn('flex items-center gap-1.5 text-label ', policyColor)}>
 <PolicyIcon className="w-3.5 h-3.5" />
 {policyLabel}
 </div>
 </div>
 {/* Idempotency key as subtle compliance indicator */}
 <div className="text-[10px] text-slate-600 font-mono truncate">
 Key: {data.idempotencyKey}
 </div>
 </div>

 {/* Audit Trail */}
 {data.auditTrail && data.auditTrail.length > 0 && (
 <div className="border-b border-slate-700/50">
 <button onClick={() => setAuditExpanded(v => !v)}
 className="w-full p-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
 <span className="text-label text-slate-400 flex items-center gap-2">
 <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
 Audit Trail ({data.auditTrail.length} entries)
 </span>
 {auditExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
 </button>
 {auditExpanded && (
 <div className="px-3 pb-3 space-y-2">
 {data.auditTrail.map((entry, i) => (
 <div key={i} className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/50">
 <div className="flex justify-between items-center mb-0.5">
 <span className="text-[11px] font-medium text-slate-300">{entry.action}</span>
 <span className="text-[10px] text-slate-500">{new Date(entry.timestamp).toLocaleDateString()}</span>
 </div>
 <p className="text-[11px] text-slate-500">{entry.actor} · {entry.rationale}</p>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Action */}
 {data.status === 'SUBMITTED' && onApprove && (
 <div className="p-3 bg-slate-950/50 border-t border-slate-800">
 <button onClick={onApprove}
 className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-button rounded-xl flex items-center justify-center gap-2 transition-colors">
 <CheckCircle className="w-4 h-4" /> Approve Expense
 </button>
 </div>
 )}
 </div>
 );
}
