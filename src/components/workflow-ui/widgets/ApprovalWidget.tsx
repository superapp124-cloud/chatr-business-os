/**
 * ApprovalWidget — Approval gate for high-risk or policy-gated actions.
 *
 * Used for: enterprise approvals, large payments, HR actions, data access.
 * Lifecycle: WAITING_USER → EXECUTING → COMPLETED or CANCELLED.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps, ApprovalWidgetPayload } from '@/core/workflow-ui';

const RISK_CONFIG = {
 low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Low Risk', icon: ShieldCheck },
 medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Medium Risk', icon: AlertTriangle },
 high: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'High Risk', icon: ShieldAlert },
};

const ApprovalWidget = memo(function ApprovalWidget({ instance, workflowId, onAction }: WidgetProps) {
 const payload = instance.payload as ApprovalWidgetPayload;
 const risk = RISK_CONFIG[payload.riskLevel ?? 'low'];
 const RiskIcon = risk.icon;

 const isWaiting = instance.lifecycle === 'WAITING_USER';
 const isExecuting = instance.lifecycle === 'EXECUTING';
 const isCompleted = instance.lifecycle === 'COMPLETED';
 const isCancelled = instance.lifecycle === 'CANCELLED';

 const handleApprove = () => {
 onAction({ widgetId: instance.id, workflowId, action: 'APPROVE', data: { approved: true } });
 };

 const handleReject = () => {
 onAction({ widgetId: instance.id, workflowId, action: 'REJECT', data: { approved: false } });
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3 }}
 className="rounded-3xl border border-white/[0.06] bg-[#111118] overflow-hidden"
 >
 {/* Risk header */}
 <div className={cn('px-4 py-3 flex items-center gap-2.5', risk.bg)}>
 <RiskIcon className={cn('h-5 w-5 shrink-0', risk.color)} />
 <div className="flex-1 min-w-0">
 <p className="text-[13px] font-bold text-white">{payload.title ?? 'Approval Required'}</p>
 {payload.description && (
 <p className="text-[11px] text-white/50 mt-0.5 leading-snug">{payload.description}</p>
 )}
 </div>
 <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', risk.bg, risk.color)}>
 {risk.label}
 </span>
 </div>

 {/* Details */}
 <div className="px-4 py-3 space-y-1.5">
 {payload.details.map((item, i) => (
 <div key={i} className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-xl bg-white/[0.03]">
 <span className="text-[12px] text-white/40">{item.label}</span>
 <span className="text-[12px] font-semibold text-white truncate">{item.value}</span>
 </div>
 ))}
 </div>

 {payload.requiredApproverRole && (
 <div className="px-4 pb-3">
 <p className="text-[11px] text-white/30">
 Requires approval from: <span className="text-white/60 font-medium">{payload.requiredApproverRole}</span>
 </p>
 </div>
 )}

 {/* CTAs */}
 {!isCompleted && !isCancelled && (
 <div className="px-4 pb-4 flex gap-2">
 <motion.button
 whileTap={{ scale: 0.97 }}
 onClick={handleReject}
 disabled={isExecuting}
 className="flex-1 py-2.5 rounded-2xl border border-red-500/30 text-[13px] font-semibold text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
 >
 {payload.rejectLabel ?? 'Reject'}
 </motion.button>
 <motion.button
 whileTap={{ scale: 0.97 }}
 onClick={handleApprove}
 disabled={isExecuting}
 className="flex-[2] py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-[13px] font-bold text-white disabled:opacity-50 shadow-[0_4px_16px_rgba(34,197,94,0.3)]"
 >
 {isExecuting ? 'Processing...' : (payload.approveLabel ?? 'Approve')}
 </motion.button>
 </div>
 )}

 {isCompleted && (
 <div className="px-4 pb-4 flex items-center gap-2">
 <CheckCircle2 className="h-4 w-4 text-emerald-400" />
 <span className="text-[12px] font-semibold text-emerald-400">Approved</span>
 </div>
 )}

 {isCancelled && (
 <div className="px-4 pb-4 flex items-center gap-2">
 <XCircle className="h-4 w-4 text-red-400" />
 <span className="text-[12px] font-semibold text-red-400">Rejected</span>
 </div>
 )}
 </motion.div>
 );
});

export default ApprovalWidget;
