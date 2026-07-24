import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Circle, Loader2 } from 'lucide-react';
import { type ProgressStep } from '@/core/workflow-ui';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepListProps {
 steps: ProgressStep[];
 className?: string;
}

// ─── Step icon ────────────────────────────────────────────────────────────────

const StepIcon: React.FC<{ status: ProgressStep['status'] }> = ({ status }) => {
 switch (status) {
 case 'running':
 return (
 <Loader2
 className="h-4 w-4 text-violet-400 animate-spin shrink-0"
 aria-label="Running"
 />
 );
 case 'completed':
 return (
 <CheckCircle2
 className="h-4 w-4 text-emerald-400 shrink-0"
 aria-label="Completed"
 />
 );
 case 'failed':
 return (
 <XCircle
 className="h-4 w-4 text-red-400 shrink-0"
 aria-label="Failed"
 />
 );
 case 'pending':
 default:
 return (
 <Circle
 className="h-4 w-4 text-white/20 shrink-0"
 aria-label="Pending"
 />
 );
 }
};

// ─── Connector line ───────────────────────────────────────────────────────────

const Connector: React.FC<{ status: ProgressStep['status'] }> = ({ status }) => {
 const isComplete = status === 'completed';
 return (
 <div className="flex justify-center w-4 shrink-0">
 <motion.div
 initial={{ scaleY: 0 }}
 animate={{ scaleY: 1 }}
 transition={{ duration: 0.3, ease: 'easeInOut' }}
 style={{ originY: 0 }}
 className={cn(
 'w-px flex-1 min-h-[16px]',
 isComplete ? 'bg-emerald-500/50' : 'bg-white/10',
 )}
 />
 </div>
 );
};

// ─── Single Step ──────────────────────────────────────────────────────────────

const StepRow: React.FC<{ step: ProgressStep; isLast: boolean }> = ({ step, isLast }) => {
 const isActive = step.status === 'running' || step.status === 'completed';

 return (
 <div className="flex gap-3">
 {/* Left column: icon + connector */}
 <div className="flex flex-col items-center">
 <motion.div
 key={`${step.id}-${step.status}`}
 initial={{ scale: 0.6, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ type: 'spring', stiffness: 340, damping: 22 }}
 >
 <StepIcon status={step.status} />
 </motion.div>

 {!isLast && <Connector status={step.status} />}
 </div>

 {/* Right column: text */}
 <div
 className={cn(
 'pb-4 flex flex-col gap-0.5 min-w-0',
 isLast && 'pb-0',
 )}
 >
 <AnimatePresence mode="wait">
 <motion.span
 key={`${step.id}-title-${step.status}`}
 initial={{ opacity: 0, x: -4 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 4 }}
 transition={{ duration: 0.18 }}
 className={cn(
 'text-secondary font-medium ',
 isActive ? 'text-white' : 'text-white/40',
 )}
 >
 {step.title}
 </motion.span>
 </AnimatePresence>

 {step.subtitle && (
 <span className="text-label text-white/30 truncate">
 {step.subtitle}
 </span>
 )}
 </div>
 </div>
 );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const StepList: React.FC<StepListProps> = ({ steps, className }) => {
 if (!steps || steps.length === 0) return null;

 return (
 <div className={cn('flex flex-col', className)}>
 {steps.map((step, idx) => (
 <StepRow key={step.id} step={step} isLast={idx === steps.length - 1} />
 ))}
 </div>
 );
};

export default StepList;
