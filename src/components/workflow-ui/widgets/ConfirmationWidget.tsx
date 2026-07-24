/**
 * ConfirmationWidget — Pre-action summary before the user commits.
 *
 * Shows what the AI understood, what will happen, and lets the user
 * confirm or abort. Lifecycle: WAITING_USER → EXECUTING (on confirm).
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps, ConfirmationWidgetPayload } from '@/core/workflow-ui';

const ConfirmationWidget = memo(function ConfirmationWidget({ instance, workflowId, onAction }: WidgetProps) {
 const payload = instance.payload as ConfirmationWidgetPayload;
 const isWaiting = instance.lifecycle === 'WAITING_USER';
 const isExecuting = instance.lifecycle === 'EXECUTING';
 const isCompleted = instance.lifecycle === 'COMPLETED';

 const handleConfirm = () => {
 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'CONFIRM',
 data: { confirmed: true },
 });
 };

 const handleAbort = () => {
 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'CANCEL',
 data: { confirmed: false },
 });
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -6 }}
 transition={{ duration: 0.3, ease: 'easeOut' }}
 className={cn(
 'rounded-3xl overflow-hidden border',
 'bg-[#111118] border-white/[0.06]',
 isCompleted && 'border-emerald-500/30',
 )}
 >
 {/* Header */}
 <div className="px-4 pt-4 pb-3">
 <div className="flex items-start gap-2.5">
 <div className={cn(
 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
 isCompleted ? 'bg-emerald-500/15' : 'bg-violet-500/15',
 )}>
 {isCompleted
 ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
 : <ShieldCheck className="h-4 w-4 text-violet-400" />}
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-[13px] font-semibold text-white leading-tight">
 {payload.title ?? 'Confirm action'}
 </p>
 {payload.subtitle && (
 <p className="text-[11px] text-white/50 mt-0.5 leading-snug">{payload.subtitle}</p>
 )}
 </div>
 </div>
 </div>

 {/* Summary lines */}
 <div className="px-4 pb-3 space-y-1.5">
 {payload.lines.map((line, i) => (
 <div
 key={i}
 className={cn(
 'flex items-center justify-between gap-3 py-1.5 px-3 rounded-xl',
 line.highlight ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-white/[0.03]',
 )}
 >
 <span className="text-[12px] text-white/50 shrink-0">{line.label}</span>
 <span className={cn(
 'text-[12px] font-semibold truncate',
 line.highlight ? 'text-violet-300' : 'text-white',
 )}>
 {line.value}
 </span>
 </div>
 ))}
 </div>

 {/* Warning */}
 {payload.warning && (
 <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
 <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
 <p className="text-[11px] text-amber-300 leading-snug">{payload.warning}</p>
 </div>
 )}

 {/* CTAs */}
 {!isCompleted && (
 <div className="px-4 pb-4 flex gap-2">
 <motion.button
 whileTap={{ scale: 0.97 }}
 onClick={handleAbort}
 disabled={isExecuting}
 className={cn(
 'flex-1 py-2.5 rounded-2xl border border-white/10 text-[13px] font-semibold text-white/60 transition-colors',
 'hover:bg-white/[0.04] disabled:opacity-40',
 )}
 >
 {payload.abortLabel ?? 'Stop Task'}
 </motion.button>
 <motion.button
 whileTap={{ scale: 0.97 }}
 onClick={handleConfirm}
 disabled={isExecuting}
 className={cn(
 'flex-[2] py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all',
 'bg-gradient-to-r from-violet-600 to-purple-600 shadow-[0_4px_16px_rgba(124,58,237,0.4)]',
 'hover:shadow-[0_6px_20px_rgba(124,58,237,0.5)] disabled:opacity-50',
 isExecuting && 'opacity-60',
 )}
 >
 {isExecuting ? 'Processing...' : (payload.ctaLabel ?? 'Confirm')}
 </motion.button>
 </div>
 )}

 {/* Confirmed state */}
 {isCompleted && (
 <div className="px-4 pb-4 flex items-center gap-2">
 <CheckCircle2 className="h-4 w-4 text-emerald-400" />
 <span className="text-[12px] font-semibold text-emerald-400">Confirmed</span>
 </div>
 )}
 </motion.div>
 );
});

export default ConfirmationWidget;
