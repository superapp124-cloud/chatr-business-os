import React from 'react';
import { Brain, MapPin, Search, KeyRound, CreditCard, CheckCircle2, Loader2, Sparkles, Network } from 'lucide-react';
import { IntentState, IntentContext } from '../../core/kernel/KernelSession';

interface ExecutionPipelineViewerProps {
 state: IntentState;
 context: IntentContext;
}

export const ExecutionPipelineViewer: React.FC<ExecutionPipelineViewerProps> = ({ state, context }) => {
 const isPastResolving = state !== 'idle' && state !== 'resolving';
 
 if (state === 'idle') return null;
 // If we are past the resolving and results_ready state (e.g. paying, tracking), we might want to hide this
 // or keep it visible. Let's hide it if we are connecting/paying.
 if (!['resolving', 'results_ready'].includes(state)) return null;

 const renderParallelTask = (
 title: string,
 isComplete: boolean | undefined,
 icon: React.ReactNode,
 details?: React.ReactNode,
 metric?: { latencyMs: number }
 ) => {
 return (
 <div className={`flex flex-col p-3 rounded-xl border ${isComplete ? 'border-green-500/20 bg-green-500/5' : 'border-gray-800 bg-gray-900/50'} transition-all duration-300`}>
 <div className="flex items-center justify-between mb-1">
 <div className="flex items-center gap-2">
 <div className={`${isComplete ? 'text-green-400' : 'text-purple-400'}`}>
 {!isComplete ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
 </div>
 <span className={`font-medium text-secondary ${isComplete ? 'text-gray-200' : 'text-white'}`}>
 {title}
 </span>
 </div>
 {isComplete && metric && (
 <span className="text-[10px] text-green-500/70 font-mono">{metric.latencyMs}ms</span>
 )}
 </div>
 {isComplete && details && (
 <div className="text-label text-gray-400 mt-1 pl-6">
 {details}
 </div>
 )}
 </div>
 );
 };

 return (
 <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 border border-gray-800 mb-4 shadow-2xl">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2 text-purple-400 font-semibold">
 <Network className="w-5 h-5" />
 <span>Concurrent Resolution</span>
 </div>
 {context.metrics?.Total_Intent_To_Results && (
 <div className="text-label font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded-md">
 Total SLA: <span className="text-green-400 font-bold">{context.metrics.Total_Intent_To_Results.latencyMs}ms</span>
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
 {/* Connection lines could be drawn here, but grid is clean enough */}
 {renderParallelTask(
 'Understanding Intent',
 context.tasksCompleted?.understanding,
 <Brain className="w-4 h-4" />,
 context.extractedEntities?.join(', '),
 context.metrics?.Understanding
 )}

 {renderParallelTask(
 'Location Context',
 context.tasksCompleted?.location,
 <MapPin className="w-4 h-4" />,
 context.location,
 context.metrics?.Location
 )}

 {renderParallelTask(
 'Provider Search',
 context.tasksCompleted?.providerSearch,
 <Search className="w-4 h-4" />,
 context.providersSearched && `Queried ${context.providersSearched.length} providers`,
 context.metrics?.ProviderSearch
 )}

 {renderParallelTask(
 'Session Validation',
 context.tasksCompleted?.sessionCheck,
 <KeyRound className="w-4 h-4" />,
 'Valid token found',
 context.metrics?.SessionCheck
 )}

 {renderParallelTask(
 'Payment Readiness',
 context.tasksCompleted?.paymentReadiness,
 <CreditCard className="w-4 h-4" />,
 'UPI pre-authorized',
 context.metrics?.PaymentReadiness
 )}
 </div>

 {context.tasksCompleted?.providerSearch && (
 <div className="mt-4 pt-3 border-t border-gray-800 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
 <span className="text-secondary font-medium text-gray-300">
 Searching {context.resultsFound} options... <span className="text-red-400">Eliminated {context.resultsEliminated}</span>
 </span>
 </div>
 )}

 {isPastResolving && context.metrics?.Ranking && (
 <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
 <span className="text-secondary font-medium text-green-400 flex items-center gap-1">
 <Sparkles className="w-4 h-4" /> Finalizing top recommendations
 </span>
 <span className="text-label text-gray-500 font-mono">{context.metrics.Ranking.latencyMs}ms</span>
 </div>
 )}
 </div>
 );
};
