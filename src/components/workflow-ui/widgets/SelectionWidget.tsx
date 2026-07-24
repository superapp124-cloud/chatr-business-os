import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import {
 type WidgetProps,
 type SelectionWidgetPayload,
 type SelectionOption,
 type SelectionColumn,
} from '@/core/workflow-ui';
import { cn } from '@/lib/utils';
import { WidgetShell } from '../primitives/WidgetShell';

// ─── Column value renderer ─────────────────────────────────────────────────────

function formatDuration(value: unknown): string {
 const mins = Number(value);
 if (isNaN(mins)) return String(value ?? '');
 if (mins < 60) return `${mins} min`;
 const h = Math.floor(mins / 60);
 const m = mins % 60;
 return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatCurrency(value: unknown, code?: string): string {
 const num = Number(value);
 if (isNaN(num)) return String(value ?? '');
 const symbol = code === 'USD' ? '$' : code === 'EUR' ? '€' : '₹';
 return `${symbol}${num.toLocaleString()}`;
}

function formatRating(value: unknown): React.ReactNode {
 const rating = Number(value);
 if (isNaN(rating)) return String(value ?? '');
 const full = Math.floor(rating);
 const frac = rating - full;
 return (
 <span className="flex items-center gap-0.5">
 {Array.from({ length: 5 }).map((_, i) => (
 <Star
 key={i}
 className={cn(
 'h-3 w-3',
 i < full
 ? 'text-amber-400 fill-amber-400'
 : frac > 0 && i === full
 ? 'text-amber-400/60 fill-amber-400/40'
 : 'text-white/15',
 )}
 />
 ))}
 <span className="ml-1 text-white/60 text-label">{rating.toFixed(1)}</span>
 </span>
 );
}

const CellValue: React.FC<{
 col: SelectionColumn;
 value: unknown;
 primary?: boolean;
}> = ({ col, value, primary }) => {
 const baseClass = cn(
 'leading-none',
 primary
 ? 'text-white font-bold text-body'
 : 'text-white/50 text-label',
 );

 switch (col.type) {
 case 'currency':
 return (
 <span className={cn(baseClass, primary && 'text-section')}>
 {formatCurrency(value, col.currencyCode)}
 </span>
 );
 case 'duration':
 return <span className={baseClass}>{formatDuration(value)}</span>;
 case 'rating':
 return primary ? (
 <span className={baseClass}>{formatRating(value)}</span>
 ) : (
 <span className={baseClass}>{String(value ?? '')}</span>
 );
 case 'time':
 return <span className={baseClass}>{String(value ?? '')}</span>;
 case 'badge':
 return (
 <span
 className={cn(
 'rounded-full px-2 py-0.5 text-[10px] font-semibold',
 'bg-white/10 text-white/60',
 )}
 >
 {String(value ?? '')}
 </span>
 );
 default:
 return <span className={baseClass}>{String(value ?? '')}</span>;
 }
};

// ─── Badge pill ───────────────────────────────────────────────────────────────

type BadgeVariant = SelectionOption['badgeVariant'];

const badgeVariantClass: Record<NonNullable<BadgeVariant>, string> = {
 primary: 'bg-violet-600/30 text-violet-300 border border-violet-500/40',
 success: 'bg-emerald-600/30 text-emerald-300 border border-emerald-600/40',
 warning: 'bg-amber-600/30 text-amber-300 border border-amber-600/40',
 info: 'bg-sky-600/30 text-sky-300 border border-sky-600/40',
};

const OptionBadge: React.FC<{ label: string; variant?: BadgeVariant }> = ({
 label,
 variant = 'primary',
}) => (
 <span
 className={cn(
 'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap',
 badgeVariantClass[variant],
 )}
 >
 {label}
 </span>
);

// ─── Single option row ────────────────────────────────────────────────────────

const OptionRow: React.FC<{
 option: SelectionOption;
 columns?: SelectionColumn[];
 selected: boolean;
 onSelect: () => void;
}> = ({ option, columns = [], selected, onSelect }) => {
 const primaryCol = columns.find((c) => c.primary) ?? columns[0];
 const secondaryCols = columns.filter((c) => c !== primaryCol);

 return (
 <motion.button
 layout
 whileTap={{ scale: 0.985 }}
 onClick={onSelect}
 disabled={option.disabled}
 className={cn(
 'w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3 transition-all duration-200',
 'border relative overflow-hidden',
 // Base state
 selected
 ? 'bg-violet-950/50 border-violet-500/60 ring-1 ring-violet-500/40'
 : option.recommended
 ? 'bg-white/[0.03] border-violet-500/20 hover:bg-white/[0.05] hover:border-violet-500/40'
 : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]',
 option.disabled && 'opacity-40 cursor-not-allowed',
 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
 )}
 aria-pressed={selected}
 aria-label={`Select ${option.values?.[columns[0]?.key] ?? option.id}`}
 >
 {/* Recommended left accent bar */}
 {option.recommended && (
 <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-violet-500/70" />
 )}

 {/* Icon / emoji */}
 {option.icon && (
 <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden" role="img">
 {option.icon.startsWith('http') ? (
 <img src={option.icon} alt="logo" className="w-6 h-6 object-contain" />
 ) : (
 <span className="text-workspace">{option.icon}</span>
 )}
 </span>
 )}

 {/* Primary value (price / main info) */}
 <div className="flex flex-col gap-1 flex-1 min-w-0">
 {/* Provider name — first non-primary column or fallback */}
 {secondaryCols.length > 0 && (
 <span className="text-secondary font-semibold text-white truncate">
 {String(option.values?.[secondaryCols[0].key] ?? '')}
 </span>
 )}

 {/* Secondary values */}
 <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
 {secondaryCols.slice(1).map((col) => (
 <CellValue key={col.key} col={col} value={option.values?.[col.key]} />
 ))}
 </div>
 </div>

 {/* Primary value (right side) */}
 <div className="flex flex-col items-end gap-1.5 shrink-0">
 {primaryCol && (
 <CellValue
 col={primaryCol}
 value={option.values?.[primaryCol.key]}
 primary
 />
 )}

 {option.badge && (
 <OptionBadge label={option.badge} variant={option.badgeVariant} />
 )}
 </div>

 {/* Selection ring glow */}
 {selected && (
 <motion.span
 layoutId="sel-glow"
 className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-violet-400/30"
 transition={{ duration: 0.18 }}
 />
 )}
 </motion.button>
 );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SelectionWidget: React.FC<WidgetProps> = ({
 instance,
 workflowId,
 onAction,
}) => {
 const payload = instance.payload as SelectionWidgetPayload;
 const {
 title,
 subtitle,
 columns = [],
 options,
 selectedId: initialSelectedId,
 allowMultiple,
 showMoreLabel,
 totalCount,
 } = payload;

 const [selectedIds, setSelectedIds] = useState<Set<string>>(
 initialSelectedId ? new Set([initialSelectedId]) : new Set(),
 );
 const [showMore, setShowMore] = useState(false);

 const hasMoreOptions = totalCount !== undefined && totalCount > options.length;
 const visibleOptions = showMore ? options : options.slice(0, 3);

 const handleSelect = (option: SelectionOption) => {
 if (option.disabled) return;

 let next: Set<string>;
 if (allowMultiple) {
 next = new Set(selectedIds);
 if (next.has(option.id)) {
 next.delete(option.id);
 } else {
 next.add(option.id);
 }
 } else {
 next = new Set([option.id]);
 }
 setSelectedIds(next);

 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'SELECT',
 data: {
 optionId: option.id,
 option: option as unknown as Record<string, unknown>,
 selectedIds: Array.from(next),
 },
 });
 };

 return (
 <WidgetShell
 title={title ?? 'Best Options Found'}
 subtitle={subtitle ?? 'On-device web search & automation'}
 lifecycle={instance.lifecycle}
 collapsible={false}
 >
 <div className="px-3 pt-3 pb-4 flex flex-col gap-2">

 {/* ── Options list ── */}
 <AnimatePresence initial={false}>
 {visibleOptions.map((option, idx) => (
 <motion.div
 key={option.id}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -6 }}
 transition={{ duration: 0.22, delay: idx * 0.05 }}
 >
 <OptionRow
 option={option}
 columns={columns}
 selected={selectedIds.has(option.id)}
 onSelect={() => handleSelect(option)}
 />
 </motion.div>
 ))}
 </AnimatePresence>

 {/* ── More options toggle ── */}
 {hasMoreOptions && (
 <motion.button
 whileTap={{ scale: 0.97 }}
 onClick={() => setShowMore((p) => !p)}
 className={cn(
 'flex items-center justify-center gap-1.5 w-full',
 'rounded-2xl px-4 py-2 mt-1',
 'bg-white/[0.03] border border-white/[0.06]',
 'text-white/50 text-label ',
 'hover:bg-white/[0.06] hover:text-white/70 transition-all duration-150',
 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
 )}
 aria-expanded={showMore}
 >
 {showMore ? (
 <>
 <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
 Show less
 </>
 ) : (
 <>
 <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
 {showMoreLabel ??
 `${totalCount! - options.slice(0, 3).length} more options`}
 </>
 )}
 </motion.button>
 )}

 {/* ── Confirm selection CTA (when something is selected and lifecycle is WAITING_USER) ── */}
 {selectedIds.size > 0 && instance.lifecycle === 'WAITING_USER' && (
 <motion.button
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.22 }}
 whileTap={{ scale: 0.97 }}
 onClick={() => {
 const ids = Array.from(selectedIds);
 const selected = options.filter((o) => ids.includes(o.id));
 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'CONFIRM_SELECTION',
 data: {
 selectedIds: ids,
 options: selected as unknown as Record<string, unknown>[],
 },
 });
 }}
 className={cn(
 'flex items-center justify-center w-full',
 'rounded-2xl px-4 py-3 mt-1',
 'bg-violet-600 hover:bg-violet-500',
 'text-white text-secondary font-semibold',
 'shadow-[0_4px_20px_rgba(124,58,237,0.4)]',
 'transition-all duration-150 active:scale-[0.98]',
 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
 )}
 >
 Continue with selection
 </motion.button>
 )}
 </div>
 </WidgetShell>
 );
};

export default SelectionWidget;
