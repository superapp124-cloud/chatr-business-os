import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus, Archive } from 'lucide-react';
import { type WidgetLifecycle } from '@/core/workflow-ui';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LifecycleBadgeProps {
 lifecycle: WidgetLifecycle;
 className?: string;
}

// ─── Animated Dots ────────────────────────────────────────────────────────────

const PulsingDot = ({ color }: { color: string }) => (
 <span className="relative flex h-1.5 w-1.5 shrink-0">
 <span
 className={cn(
 'animate-ping absolute inline-flex h-full w-full rounded-full opacity-60',
 color,
 )}
 />
 <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', color)} />
 </span>
);

const StaticDot = ({ color }: { color: string }) => (
 <span className={cn('inline-flex rounded-full h-1.5 w-1.5 shrink-0', color)} />
);

/** Spinning loader constructed from a single bordered circle — no import needed */
const SpinningLoader = () => (
 <span
 className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-sky-400/30 border-t-sky-400 animate-spin"
 aria-hidden="true"
 />
);

// ─── Config map ───────────────────────────────────────────────────────────────

interface BadgeConfig {
 label: string;
 containerClass: string;
 indicator: React.ReactNode;
}

function getBadgeConfig(lifecycle: WidgetLifecycle): BadgeConfig {
 switch (lifecycle) {
 case 'CREATED':
 return {
 label: 'Starting...',
 containerClass: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50',
 indicator: <StaticDot color="bg-zinc-500" />,
 };

 case 'ACTIVE':
 return {
 label: 'Active',
 containerClass: 'bg-sky-950/70 text-sky-300 border border-sky-800/50',
 indicator: <StaticDot color="bg-sky-400" />,
 };

 case 'WAITING_USER':
 return {
 label: 'Waiting',
 containerClass: 'bg-violet-950/70 text-violet-300 border border-violet-700/50',
 indicator: <PulsingDot color="bg-violet-400" />,
 };

 case 'EXECUTING':
 return {
 label: 'Working',
 containerClass: 'bg-sky-950/70 text-sky-200 border border-sky-700/50',
 indicator: <SpinningLoader />,
 };

 case 'COMPLETED':
 return {
 label: 'Done',
 containerClass: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50',
 indicator: (
 <Check
 className="h-2.5 w-2.5 shrink-0 text-emerald-400"
 strokeWidth={3}
 aria-hidden="true"
 />
 ),
 };

 case 'FAILED':
 return {
 label: 'Failed',
 containerClass: 'bg-red-950/70 text-red-300 border border-red-800/50',
 indicator: (
 <X
 className="h-2.5 w-2.5 shrink-0 text-red-400"
 strokeWidth={3}
 aria-hidden="true"
 />
 ),
 };

 case 'CANCELLED':
 return {
 label: 'Cancelled',
 containerClass: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50',
 indicator: (
 <Minus
 className="h-2.5 w-2.5 shrink-0 text-zinc-500"
 strokeWidth={3}
 aria-hidden="true"
 />
 ),
 };

 case 'ARCHIVED':
 return {
 label: 'Archived',
 containerClass: 'bg-zinc-900/80 text-zinc-500 border border-zinc-800/50',
 indicator: (
 <Archive className="h-2.5 w-2.5 shrink-0 text-zinc-600" aria-hidden="true" />
 ),
 };

 default:
 return {
 label: lifecycle,
 containerClass: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50',
 indicator: <StaticDot color="bg-zinc-500" />,
 };
 }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const LifecycleBadge: React.FC<LifecycleBadgeProps> = ({ lifecycle, className }) => {
 const config = getBadgeConfig(lifecycle);

 return (
 <motion.span
 key={lifecycle}
 initial={{ opacity: 0, scale: 0.85 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.2, ease: 'easeOut' }}
 className={cn(
 'inline-flex items-center gap-1.5',
 'rounded-full px-2 py-0.5',
 'text-[10px] font-bold uppercase tracking-wide',
 'select-none whitespace-nowrap',
 config.containerClass,
 className,
 )}
 aria-label={`Widget status: ${config.label}`}
 >
 {config.indicator}
 <span>{config.label}</span>
 </motion.span>
 );
};

export default LifecycleBadge;
