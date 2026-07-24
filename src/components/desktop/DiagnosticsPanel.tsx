import React, { useEffect, useState } from 'react';
import { kernelAPI } from '@/core/runtime/KernelAPI';
import { CHATRState } from '@/core/runtime/StateStore';
import { CheckCircle2, AlertCircle, RefreshCw, XCircle, Activity, Box, Database, HardDrive, ListTree, BugPlay, Layers, ShieldCheck } from 'lucide-react';
import { TARGET_PERFORMANCE_BUDGET } from '@/core/runtime/types';
import { KernelContractValidator } from '@/core/runtime/KernelContractTests';

export const DiagnosticsPanel: React.FC = () => {
 const [runtimeState, setRuntimeState] = useState<CHATRState['runtime']>(kernelAPI.state.get('runtime'));
 const [eventsPerSec, setEventsPerSec] = useState(0);
 const [eventsHistory, setEventsHistory] = useState(kernelAPI.events.history);
 const [flags, setFlags] = useState(kernelAPI.flags.getAll());
 const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'migration' | 'chaos' | 'calls'>('overview');

 useEffect(() => {
 const unsubscribe = kernelAPI.state.subscribe('runtime', (state) => {
 setRuntimeState(state);
 });

 const interval = setInterval(() => {
 setEventsPerSec(kernelAPI.events.throughputPerSecond);
 setEventsHistory(kernelAPI.events.history.slice(-100)); // Only show last 100 in UI
 }, 1000);

 return () => {
 unsubscribe();
 clearInterval(interval);
 };
 }, []);

 const getHealthScore = () => {
 let score = 100;
 if (runtimeState.kernelStatus === 'degraded') score -= 20;
 if (runtimeState.kernelStatus === 'crashed') score -= 100;
 Object.values(runtimeState.engineStatuses).forEach(s => {
 if (s === 'crashed' || s === 'failed') score -= 10;
 if (s === 'degraded' || s === 'recovering') score -= 5;
 });
 return Math.max(0, score);
 };

 const healthScore = getHealthScore();

 const handleChaosKill = (engineId: string) => {
 // Deliberately trigger a crash for chaos testing
 kernelAPI.events.publish('CRASH_DETECTED', { component: engineId }, { priority: 'critical', source: 'chaos_monkey' });
 const engine = (kernelAPI as any).engineRegistry?.get(engineId);
 if (engine) engine.dispose(); // force it down so supervisor catches it
 };

 const [contractResults, setContractResults] = useState<{ passed: number; failed: number; errors: string[] } | null>(null);

 const handleRunTests = async () => {
 const results = await KernelContractValidator.runAllTests();
 setContractResults(results);
 };

 const handleToggleFlag = (id: string) => {
 const current = flags[id];
 kernelAPI.flags.override(id, !current);
 setFlags(kernelAPI.flags.getAll());
 };

 return (
 <div className="w-full h-full p-6 bg-slate-900 text-slate-100 font-mono text-secondary overflow-y-auto custom-scrollbar flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-800">
 <div>
 <h2 className="text-page font-bold text-white flex items-center gap-3">
 <Activity className="text-emerald-500 w-6 h-6" />
 Kernel Inspector
 </h2>
 <div className="flex gap-4 mt-2 text-slate-400 text-label">
 <span>Uptime: {Math.floor((Date.now() - runtimeState.startedAt) / 1000)}s</span>
 <span>Mode: {runtimeState.runtimeMode}</span>
 <span>v{runtimeState.apiVersion}</span>
 </div>
 </div>
 <div className="text-right flex items-center gap-6">
 <div className="text-center">
 <div className={`text-display ${healthScore > 90 ? 'text-emerald-400' : healthScore > 70 ? 'text-yellow-400' : 'text-rose-400'}`}>
 {healthScore}%
 </div>
 <div className="text-label text-slate-500 uppercase tracking-wider">Health</div>
 </div>
 <div className="text-center">
 <div className="text-display text-blue-400">
 {eventsPerSec.toFixed(1)}
 </div>
 <div className="text-label text-slate-500 uppercase tracking-wider">ev/s</div>
 </div>
 </div>
 </div>

 {/* Tabs */}
 <div className="flex gap-4 mb-6 border-b border-slate-800 pb-2">
 {(['overview', 'events', 'calls', 'migration', 'chaos'] as const).map(tab => (
 <button 
 key={tab} 
 onClick={() => setActiveTab(tab)}
 className={`px-4 py-2 capitalize font-semibold rounded-md transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
 >
 {tab}
 </button>
 ))}
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto pr-2">
 {activeTab === 'overview' && (
 <div className="grid grid-cols-2 gap-6">
 {/* Engines */}
 <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
 <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Box className="w-4 h-4" /> Running Engines</h3>
 <div className="space-y-2">
 {Object.entries(runtimeState.engineStatuses).map(([id, status]) => (
 <div key={id} className="flex items-center justify-between bg-slate-900/50 p-2 px-3 rounded text-label border border-slate-700/30">
 <span className="text-slate-300">{id}</span>
 <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider
 ${status === 'ready' ? 'bg-emerald-500/10 text-emerald-400' : 
 status === 'booting' ? 'bg-blue-500/10 text-blue-400' : 
 status === 'crashed' || status === 'failed' ? 'bg-rose-500/10 text-rose-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
 {status}
 </span>
 </div>
 ))}
 </div>
 </div>

 {/* Performance Budgets */}
 <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
 <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Performance Budgets</h3>
 <div className="space-y-3 text-label">
 {Object.entries(TARGET_PERFORMANCE_BUDGET).map(([metric, limit]) => (
 <div key={metric} className="flex items-center justify-between">
 <span className="text-slate-400">{metric}</span>
 <div className="flex items-center gap-2">
 <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
 <div className="h-full bg-emerald-500" style={{ width: '30%' }} /> {/* Mock actual metric vs target */}
 </div>
 <span className="text-slate-300">&lt;{limit}ms</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {activeTab === 'events' && (
 <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 h-full flex flex-col">
 <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><ListTree className="w-4 h-4" /> Live Event Timeline</h3>
 <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px]">
 {eventsHistory.map((ev, i) => (
 <div key={i} className="flex items-start gap-4 p-2 hover:bg-slate-800 rounded border-l-2 border-transparent hover:border-indigo-500">
 <span className="text-slate-500 whitespace-nowrap">{new Date(ev.timestamp).toISOString().split('T')[1].replace('Z','')}</span>
 <span className={`font-bold w-48 shrink-0 ${ev.priority === 'critical' ? 'text-rose-400' : ev.priority === 'high' ? 'text-orange-400' : ev.priority === 'background' ? 'text-slate-500' : 'text-blue-400'}`}>
 {ev.type}
 </span>
 <span className="text-slate-400 truncate">{JSON.stringify(ev.payload)}</span>
 </div>
 )).reverse()}
 </div>
 </div>
 )}

 {activeTab === 'calls' && (
 <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
 <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Call Runtime</h3>
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
 <div className="text-slate-400 text-label uppercase tracking-wider mb-1">Active Calls</div>
 <div className="text-page font-bold text-emerald-400">
 {kernelAPI.hasEngine('CallEngine') ? (kernelAPI.getEngine<any>('CallEngine').metrics().activeSessions || 0) : 0}
 </div>
 </div>
 <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/30">
 <div className="text-slate-400 text-label uppercase tracking-wider mb-1">Transcript Buffer</div>
 <div className="text-page font-bold text-blue-400">
 {kernelAPI.hasEngine('CallEngine') ? (kernelAPI.getEngine<any>('CallEngine').metrics().bufferSize || 0) : 0}
 </div>
 </div>
 </div>
 
 <div className="mt-6 border-t border-slate-700/50 pt-4">
 <h4 className="text-slate-300 font-bold mb-2">Metrics</h4>
 <ul className="text-label space-y-2 text-slate-400">
 <li className="flex justify-between"><span>AI Suggestion Latency</span> <span className="text-emerald-400">{"<"}300 ms</span></li>
 <li className="flex justify-between"><span>Transcript Processing</span> <span className="text-emerald-400">{"<"}100 ms</span></li>
 <li className="flex justify-between"><span>Relationship Batch Update</span> <span className="text-emerald-400">{"<"}100 ms</span></li>
 </ul>
 </div>
 </div>
 )}

 {activeTab === 'migration' && (
 <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
 <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2"><Layers className="w-4 h-4" /> Phase 1 Migration Flags & Rollback</h3>
 <div className="space-y-4">
 {Object.entries(flags).map(([id, enabled]) => (
 <div key={id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
 <div>
 <div className="font-bold text-slate-200">{id}</div>
 <div className="text-label text-slate-500">Toggle Kernel vs Legacy implementations</div>
 </div>
 <button 
 onClick={() => handleToggleFlag(id)}
 className={`px-4 py-1.5 rounded-full text-label font-bold uppercase transition-colors ${enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-800 text-slate-400 border border-slate-600'}`}
 >
 {enabled ? 'Active' : 'Legacy'}
 </button>
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'chaos' && (
 <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
 <h3 className="text-rose-400 font-bold mb-4 flex items-center gap-2"><BugPlay className="w-4 h-4" /> Chaos Monkey</h3>
 <p className="text-slate-400 text-label mb-6">Inject deliberate failures to verify the RuntimeSupervisor's recovery and isolation mechanisms.</p>
 
 <div className="grid grid-cols-2 gap-4">
 {Object.keys(runtimeState.engineStatuses).map(id => (
 <button 
 key={id}
 onClick={() => handleChaosKill(id)}
 className="p-3 bg-slate-900/50 border border-rose-500/20 hover:border-rose-500/50 rounded-lg text-left transition-colors flex items-center justify-between group"
 >
 <span className="text-slate-300 font-bold">Kill {id}</span>
 <XCircle className="w-4 h-4 text-rose-500 opacity-50 group-hover:opacity-100" />
 </button>
 ))}
 </div>

 <div className="mt-8 border-t border-slate-700/50 pt-6">
 <h3 className="text-indigo-400 font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Contract Validation</h3>
 <p className="text-slate-400 text-label mb-4">Run automated contract tests against the live Kernel API to ensure compatibility.</p>
 
 <button 
 onClick={handleRunTests}
 className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-button"
 >
 Run Validation Suite
 </button>

 {contractResults && (
 <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700/30">
 <div className="flex gap-4 mb-2">
 <span className="text-emerald-400 font-bold">{contractResults.passed} Passed</span>
 <span className="text-rose-400 font-bold">{contractResults.failed} Failed</span>
 </div>
 {contractResults.errors.length > 0 && (
 <div className="text-label text-rose-400 mt-2 space-y-1">
 {contractResults.errors.map((e, i) => <div key={i}>{e}</div>)}
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 );
};
