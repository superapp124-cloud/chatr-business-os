import React, { useState } from 'react';
import { IntentContext, ProviderResult } from '../../core/kernel/KernelSession';
import { ChevronRight, ChevronDown, Clock, Star, Info, Zap } from 'lucide-react';

interface DecisionResultsPanelProps {
 context: IntentContext;
 onSelect: (id: string) => void;
}

export const DecisionResultsPanel: React.FC<DecisionResultsPanelProps> = ({ context, onSelect }) => {
 const [expandedId, setExpandedId] = useState<string | null>(null);

 if (!context.topResults || context.topResults.length === 0) return null;

 return (
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-green-400 font-semibold mb-4">
 <Zap className="w-5 h-5" />
 <span>Found the best matches</span>
 </div>

 {context.topResults.map((result, idx) => {
 const isExpanded = expandedId === result.id;
 
 return (
 <div 
 key={result.id}
 className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-700 cursor-pointer"
 onClick={() => setExpandedId(isExpanded ? null : result.id)}
 >
 <div className="p-4 flex flex-col gap-3">
 <div className="flex justify-between items-start">
 <div>
 <h3 className="text-section font-bold text-white flex items-center gap-2">
 {result.name}
 {idx === 0 && <span className="text-label bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ">🏆 Top Pick</span>}
 </h3>
 {result.badge && (
 <span className="inline-block mt-1 text-label bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full ">
 {result.badge}
 </span>
 )}
 </div>
 <div className="text-right">
 <span className="text-workspace font-bold text-white">{result.price}</span>
 </div>
 </div>

 <div className="flex items-center gap-4 text-secondary text-gray-400">
 <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {result.deliveryTime}</span>
 <span className="flex items-center gap-1 text-yellow-500"><Star className="w-4 h-4 fill-yellow-500" /> {result.rating}</span>
 </div>

 {result.tags && result.tags.length > 0 && (
 <div className="flex gap-2">
 {result.tags.map(tag => (
 <span key={tag} className="text-label bg-gray-800 text-gray-300 px-2 py-1 rounded-md">
 {tag}
 </span>
 ))}
 </div>
 )}
 </div>

 {/* Decision Panel (Human explanation) */}
 <div className={`bg-gray-800/50 border-t border-gray-800 px-4 transition-all duration-300 ${isExpanded ? 'py-4 max-h-64' : 'max-h-0 py-0 opacity-0'} overflow-hidden`}>
 <div className="flex items-start gap-2 mb-3">
 <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
 <div>
 <span className="text-secondary font-semibold text-gray-200 block mb-1">Why this recommendation?</span>
 <ul className="space-y-1">
 {result.decisionReasons.map((reason, i) => (
 <li key={i} className="text-secondary text-gray-400 flex items-start gap-2">
 <span className="text-green-500 mt-0.5">✓</span>
 <span>{reason}</span>
 </li>
 ))}
 </ul>
 </div>
 </div>
 
 <button 
 onClick={(e) => {
 e.stopPropagation();
 onSelect(result.id);
 }}
 className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
 >
 Order from {result.name}
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 
 {!isExpanded && (
 <div className="bg-gray-800/30 py-2 text-center text-label text-gray-500 flex items-center justify-center gap-1 hover:text-gray-300 transition-colors">
 View Details <ChevronDown className="w-3 h-3" />
 </div>
 )}
 </div>
 );
 })}
 </div>
 );
};
