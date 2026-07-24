import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { type WidgetLifecycle } from '@/core/workflow-ui';
import { cn } from '@/lib/utils';
import { LifecycleBadge } from './LifecycleBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WidgetShellProps {
 title: string;
 subtitle?: string;
 lifecycle: WidgetLifecycle;
 children: React.ReactNode;
 collapsible?: boolean;
 defaultExpanded?: boolean;
 className?: string;
}

// ─── Left accent border resolver ─────────────────────────────────────────────

function getAccentClass(lifecycle: WidgetLifecycle): string {
 switch (lifecycle) {
 case 'COMPLETED':
 return 'border-l-2 border-l-emerald-500/60';
 case 'FAILED':
 return 'border-l-2 border-l-red-500/60';
 case 'WAITING_USER':
 return 'border-l-2 border-l-violet-500/80 animate-pulse';
 default:
 return 'border-l-2 border-l-transparent';
 }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WidgetShell: React.FC<WidgetShellProps> = ({
 title,
 subtitle,
 lifecycle,
 children,
 collapsible = false,
 defaultExpanded = true,
 className,
}) => {
 const [expanded, setExpanded] = useState(defaultExpanded);

 return (
 <motion.div
 initial={{ opacity: 0, y: 8, scale: 0.98 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
 className={cn(
 // Base card
 'bg-[#111118] border border-white/[0.06] rounded-3xl overflow-hidden',
 // Left lifecycle accent
 getAccentClass(lifecycle),
 // Lift shadow
 'shadow-[0_4px_24px_rgba(0,0,0,0.5)]',
 className,
 )}
 >
 {/* ── Header ── */}
 <div
 className={cn(
 'flex items-center justify-between gap-3 px-4 py-3.5',
 collapsible && 'cursor-pointer select-none',
 'border-b border-white/[0.04]',
 )}
 onClick={collapsible ? () => setExpanded((p) => !p) : undefined}
 role={collapsible ? 'button' : undefined}
 aria-expanded={collapsible ? expanded : undefined}
 >
 {/* Title + Subtitle */}
 <div className="flex flex-col gap-0.5 min-w-0">
 <span className="text-secondary font-semibold text-white truncate">
 {title}
 </span>
 {subtitle && (
 <span className="text-label text-white/40 truncate">{subtitle}</span>
 )}
 </div>

 {/* Right cluster: badge + chevron */}
 <div className="flex items-center gap-2 shrink-0">
 <LifecycleBadge lifecycle={lifecycle} />

 {collapsible && (
 <motion.div
 animate={{ rotate: expanded ? 0 : -90 }}
 transition={{ duration: 0.22, ease: 'easeInOut' }}
 className="text-white/30"
 >
 <ChevronDown className="h-4 w-4" />
 </motion.div>
 )}
 </div>
 </div>

 {/* ── Body ── */}
 <AnimatePresence initial={false}>
 {(!collapsible || expanded) && (
 <motion.div
 key="body"
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
 className="overflow-hidden"
 >
 {children}
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
};

export default WidgetShell;
