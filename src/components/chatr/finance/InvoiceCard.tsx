import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Send, ShieldCheck } from 'lucide-react';
import { InvoiceArtifact, formatMoney } from '@/core/capabilities/finance/types';
import { cn } from '@/lib/utils';

export function InvoiceCard({ data, onMarkPaid }: { data: Partial<InvoiceArtifact>; onMarkPaid?: () => void }) {
 const [auditExpanded, setAuditExpanded] = useState(false);

 const statusConfig: Record<string, { bg: string; text: string }> = {
 DRAFT: { bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-400' },
 SENT: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400' },
 PAID: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400' },
 OVERDUE: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-400' },
 CANCELLED: { bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-500' },
 };

 const cfg = statusConfig[data.status || 'DRAFT'];

 return (
 <div className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">

 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-blue-950/20 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
 <FileText className="w-5 h-5 text-blue-400" />
 </div>
 <div>
 <h3 className="text-white font-semibold text-secondary">{data.invoiceNumber}</h3>
 <p className="text-slate-400 text-label">{data.clientName} · Due {data.dueDate}</p>
 </div>
 </div>
 <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border', cfg.bg, cfg.text)}>
 {data.status}
 </span>
 </div>

 {/* Amounts */}
 <div className="p-4 border-b border-slate-700/50 space-y-2">
 <div className="flex justify-between text-secondary">
 <span className="text-slate-400">Subtotal</span>
 <span className="text-slate-200">{data.subtotal ? formatMoney(data.subtotal) : '—'}</span>
 </div>
 <div className="flex justify-between text-secondary">
 <span className="text-slate-400">GST (18%)</span>
 <span className="text-slate-200">{data.taxAmount ? formatMoney(data.taxAmount) : '—'}</span>
 </div>
 <div className="flex justify-between text-secondary pt-2 border-t border-slate-700/50 font-bold">
 <span className="text-slate-200">Total</span>
 <span className="text-blue-400 text-body">{data.totalAmount ? formatMoney(data.totalAmount) : '—'}</span>
 </div>
 </div>

 {/* Cross-domain provenance */}
 {data.triggeredByOpportunityId && (
 <div className="px-4 py-3 bg-violet-900/10 border-b border-slate-700/50 flex items-center gap-2">
 <span className="text-[10px] text-violet-400">⚡ Auto-generated from CRM Deal Close</span>
 </div>
 )}

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
 {data.status === 'SENT' && onMarkPaid && (
 <div className="p-3 bg-slate-950/50">
 <button onClick={onMarkPaid}
 className="w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-button rounded-xl flex items-center justify-center gap-2 transition-colors">
 <Send className="w-4 h-4" /> Mark as Paid
 </button>
 </div>
 )}
 </div>
 );
}
