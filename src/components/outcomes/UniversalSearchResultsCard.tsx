import React, { useState } from 'react';
import { Commitment, CapabilityPlaybook } from '../../core/capabilities/types';
import { capabilityRegistry } from '../../core/capabilities/CapabilityRegistry';
import { Check, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface UniversalSearchResultsCardProps {
 commitment: Commitment;
 onSelect: (result: any) => void;
}

export const UniversalSearchResultsCard: React.FC<UniversalSearchResultsCardProps> = ({ commitment, onSelect }) => {
 const [selectedId, setSelectedId] = useState<string | null>(null);

 const capability = capabilityRegistry.getCapability(commitment.capability);
 const playbook = capability?.playbook;
 const config = playbook?.searchConfiguration;

 const results = commitment.searchResults || [];
 
 if (results.length === 0) {
 return <div className="text-white/50 text-label p-3">No results found from providers.</div>;
 }

 const primaryActionLabel = config?.primaryActionLabel || 'Select Option';

 return (
 <div className="flex flex-col gap-3 mt-1">
 <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest pl-1">
 {results.length} Options Found
 </h4>
 
 <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
 {results.map((result, idx) => (
 <motion.div 
 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
 key={result.id || idx}
 onClick={() => setSelectedId(result.id || idx.toString())}
 className={`p-3 rounded-xl border cursor-pointer transition-all duration-300 relative overflow-hidden group ${(selectedId === result.id || selectedId === idx.toString()) ? 'bg-gradient-to-r from-violet-600/30 to-violet-900/10 border-violet-500/50 shadow-lg shadow-violet-900/20 scale-[1.02]' : 'bg-zinc-800/40 border-white/5 hover:bg-zinc-800/80 hover:border-white/10'}`}
 >
 {(selectedId === result.id || selectedId === idx.toString()) && <div className="absolute inset-0 bg-violet-400/10 pointer-events-none" />}
 
 <div className="relative z-10 flex flex-col gap-2">
 {/* Dynamic Columns Rendering */}
 {config && config.columns ? (
 <div className="flex justify-between items-start">
 {config.columns.map(col => (
 <div key={col.key} className="flex flex-col">
 <span className="text-[9px] uppercase text-white/40 tracking-wider mb-0.5">{col.label}</span>
 <span className={`text-secondary font-bold ${col.type === 'currency' ? 'text-emerald-400' : 'text-white/90'}`}>
 {result[col.key]}
 </span>
 </div>
 ))}
 </div>
 ) : (
 <div className="text-label text-white/70">
 {JSON.stringify(result)}
 </div>
 )}
 
 {result._provider && (
 <div className="text-[9px] text-white/30 uppercase tracking-widest text-right mt-1">
 Provided by {result._provider}
 </div>
 )}
 </div>
 </motion.div>
 ))}
 </div>

 <button 
 onClick={() => {
 const selected = results.find((r, i) => r.id === selectedId || i.toString() === selectedId);
 if (selected) onSelect(selected);
 }}
 disabled={!selectedId}
 className="mt-3 w-full py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-label font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-900/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
 >
 {primaryActionLabel} <ChevronRight className="w-3.5 h-3.5" />
 </button>
 </div>
 );
};
