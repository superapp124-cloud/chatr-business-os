/**
 * ResultWidget — Final outcome display (success / failure / info / warning).
 *
 * The last widget in most workflows. Shows the final state clearly
 * and optionally offers follow-up action chips.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps, ResultWidgetPayload } from '@/core/workflow-ui';

const STATUS_CONFIG = {
 success: {
 icon: CheckCircle2,
 iconClass: 'text-emerald-400',
 bgClass: 'bg-emerald-500/10',
 borderClass: 'border-emerald-500/25',
 badgeBg: 'bg-emerald-500/15 text-emerald-300',
 },
 failure: {
 icon: XCircle,
 iconClass: 'text-red-400',
 bgClass: 'bg-red-500/10',
 borderClass: 'border-red-500/25',
 badgeBg: 'bg-red-500/15 text-red-300',
 },
 info: {
 icon: Info,
 iconClass: 'text-blue-400',
 bgClass: 'bg-blue-500/10',
 borderClass: 'border-blue-500/25',
 badgeBg: 'bg-blue-500/15 text-blue-300',
 },
 warning: {
 icon: AlertTriangle,
 iconClass: 'text-amber-400',
 bgClass: 'bg-amber-500/10',
 borderClass: 'border-amber-500/25',
 badgeBg: 'bg-amber-500/15 text-amber-300',
 },
};

const ResultWidget = memo(function ResultWidget({ instance, workflowId, onAction }: WidgetProps) {
 const payload = instance.payload as ResultWidgetPayload;
 const config = STATUS_CONFIG[payload.status] ?? STATUS_CONFIG.info;
 const Icon = config.icon;

 const handleAction = (actionId: string) => {
 onAction({
 widgetId: instance.id,
 workflowId,
 action: actionId.toUpperCase(),
 data: { actionId },
 });
 };

 return (
 <motion.div
 initial={{ opacity: 0, scale: 0.96 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.35, ease: 'easeOut' }}
 className={cn(
 'rounded-3xl border overflow-hidden bg-[#111118]',
 config.borderClass,
 )}
 >
 {/* Header */}
 <div className={cn('px-4 py-4 flex items-center gap-3', config.bgClass)}>
 <div className={cn(
 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/20',
 )}>
 <Icon className={cn('h-5 w-5', config.iconClass)} />
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-[14px] font-bold text-white leading-tight">{payload.title}</p>
 {payload.message && (
 <p className="text-[12px] text-white/60 mt-0.5 leading-snug">{payload.message}</p>
 )}
 </div>
 </div>

 {/* Metadata */}
 {payload.metadata && payload.metadata.length > 0 && (
 <div className="px-4 py-3 space-y-1.5">
 {payload.metadata.map((item, i) => (
 <div key={i} className="flex items-center justify-between gap-3 py-1 px-3 rounded-xl bg-white/[0.03]">
 <span className="text-[11px] text-white/40">{item.label}</span>
 <span className="text-[12px] font-semibold text-white">{item.value}</span>
 </div>
 ))}
 </div>
 )}

 {/* Action chips */}
 {payload.actions && payload.actions.length > 0 && (
 <div className="px-4 pb-4 flex flex-wrap gap-2">
 {payload.actions.map(action => (
 <motion.button
 key={action.id}
 whileTap={{ scale: 0.96 }}
 onClick={() => handleAction(action.id)}
 className={cn(
 'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all',
 action.variant === 'primary'
 ? 'bg-violet-600 text-white hover:bg-violet-500'
 : 'bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.10]',
 )}
 >
 {action.label}
 </motion.button>
 ))}
 </div>
 )}
 </motion.div>
 );
});

export default ResultWidget;
