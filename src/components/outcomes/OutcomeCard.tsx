import React, { useState } from 'react';
import { Commitment } from '../../core/capabilities/types';
import { commitmentRuntime } from '@/core/capabilities/CommitmentRuntime';
import { playbookEngine } from '../../core/services/PlaybookEngine';
import { capabilityRegistry } from '../../core/capabilities/CapabilityRegistry';
import { Check, X, Clock, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MissingFieldsCard } from './MissingFieldsCard';
import { PreviewCard } from './PreviewCard';
import { UniversalSearchResultsCard } from './UniversalSearchResultsCard';
import { PolicyInterventionCard } from './PolicyInterventionCard';

interface OutcomeCardProps {
 outcome: Commitment;
}

export const OutcomeCard: React.FC<OutcomeCardProps> = ({ outcome }) => {
 const [isExecuting, setIsExecuting] = useState(false);

 const handleConfirm = async () => {
 setIsExecuting(true);
 await commitmentRuntime.confirmCommitment(outcome);
 setIsExecuting(false);
 };

 const handleCancel = () => {
 eventBus.publish('chatr:commitment-state-changed', { ...outcome, status: 'canceled' }, 'OutcomeCard');
 };

 const handleMissingFieldSubmit = async (key: string, value: string) => {
 setIsExecuting(true);
 const capability = capabilityRegistry.getCapability(outcome.capability);
 if (capability) {
 await playbookEngine.resumeWithInput(outcome, capability, key, value);
 }
 setIsExecuting(false);
 };

 const handleResultSelect = async (result: any) => {
 setIsExecuting(true);
 const capability = capabilityRegistry.getCapability(outcome.capability);
 if (capability) {
 await playbookEngine.selectResult(outcome, capability, result);
 }
 setIsExecuting(false);
 };

 return (
 <motion.div 
 initial={{ opacity: 0, y: 15, scale: 0.98 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 className="bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden"
 >
 <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
 <div className="flex items-center gap-3 border-b border-white/5 pb-3 relative z-10">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-page shadow-inner">
 {outcome.preview?.icon || <Clock className="w-5 h-5 text-emerald-400" />}
 </div>
 <div className="flex-1">
 <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">{outcome.type || 'Commitment'} DETECTED</p>
 <p className="text-secondary text-white/90 font-medium mt-0.5">{outcome.title}</p>
 </div>
 </div>
 
 <AnimatePresence mode="popLayout">
 {/* Policy & Security Interventions */}
 {(outcome.status === 'approval_required' || outcome.status === 'policy_blocked' || outcome.status === 'permission_denied') && (
 <motion.div
 initial={{ opacity: 0, y: 10, scale: 0.95 }} 
 animate={{ opacity: 1, y: 0, scale: 1 }} 
 exit={{ opacity: 0, scale: 0.95 }}
 className="relative z-10"
 >
 <PolicyInterventionCard commitment={outcome} />
 </motion.div>
 )}

 {/* Stage 1: Detected */}
 {outcome.status === 'suggested' && (
 <motion.div 
 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
 className="flex gap-2 relative z-10"
 >
 <button 
 onClick={handleConfirm}
 disabled={isExecuting}
 className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-button font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:shadow-none"
 >
 {isExecuting ? 'Confirming...' : 'Confirm'} <Check className="w-3.5 h-3.5" />
 </button>
 <button 
 onClick={handleCancel}
 className="px-4 py-2.5 bg-zinc-800/50 hover:bg-zinc-700/50 text-white/70 hover:text-white text-button font-semibold rounded-xl transition-all border border-white/5"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </motion.div>
 )}

 {/* Stage 2: Extracting / Executing */}
 {(outcome.status === 'extracting' || outcome.status === 'executing' || outcome.status === 'waiting' || outcome.status === 'observed') && (
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
 className="py-4 px-3 bg-zinc-800/30 rounded-xl flex items-center justify-center text-white/70 text-label border border-white/5 relative z-10"
 >
 <Loader2 className="w-4 h-4 mr-3 animate-spin text-emerald-400" /> 
 {outcome.status === 'extracting' ? 'Analyzing intention...' : 'Executing commitment...'}
 </motion.div>
 )}

 {/* Stage 2: Needs Input */}
 {outcome.status === 'needs_input' && outcome.missingFields && (
 <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="relative z-10">
 <MissingFieldsCard 
 missingFields={outcome.missingFields} 
 onSelect={handleMissingFieldSubmit}
 />
 </motion.div>
 )}

 {/* Stage 3: Searching */}
 {outcome.status === 'searching' && (
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
 className="flex flex-col items-center justify-center py-8 gap-4 bg-zinc-800/30 rounded-xl mt-2 border border-white/5 relative z-10"
 >
 <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
 <p className="text-label text-white/60 tracking-wide">Searching providers...</p>
 </motion.div>
 )}

 {/* Stage 4: Results Ready */}
 {outcome.status === 'results_ready' && (
 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative z-10">
 <UniversalSearchResultsCard 
 commitment={outcome} 
 onSelect={handleResultSelect} 
 />
 </motion.div>
 )}

 {/* Stage 5: Preview */}
 {outcome.status === 'preview_ready' && outcome.preview && (
 <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-10">
 <PreviewCard 
 preview={outcome.preview}
 isExecuting={isExecuting}
 onConfirm={handleConfirm}
 onCancel={handleCancel}
 />
 </motion.div>
 )}

 {/* Stage 5: Completed */}
 {outcome.status === 'completed' && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2.5 px-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-label font-semibold rounded-xl flex items-center justify-center relative z-10">
 <Check className="w-3.5 h-3.5 mr-2" /> Completed
 </motion.div>
 )}
 
 {outcome.status === 'canceled' && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2.5 px-3 bg-red-500/10 border border-red-500/20 text-red-400 text-label font-semibold rounded-xl flex items-center justify-center relative z-10">
 <X className="w-3.5 h-3.5 mr-2" /> Canceled
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
};
