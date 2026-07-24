import React, { useState, useEffect } from 'react';
import { eventBus, ChatrEvent } from '@/core/runtime/EventBus';
import { commitmentRuntime } from '@/core/capabilities/CommitmentRuntime';
import { Check, X, Clock, Play, List, Activity, LayoutTemplate, Zap, RefreshCw, BarChart2 } from 'lucide-react';
import { Commitment } from '@/core/capabilities/types';

export const KernelDashboard: React.FC = () => {
 const [history, setHistory] = useState<ChatrEvent[]>([]);
 const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null);

 useEffect(() => {
 // Poll or subscribe to events
 const updateHistory = () => {
 setHistory(eventBus.getHistory());
 };
 
 // Subscribe to all chatr:* events
 const allEvents = ['chatr:commitment-planned', 'chatr:commitment-state-changed', 'chatr:commitment-suggested', 'chatr:commitment-observed', 'chatr:reality-verified', 'chatr:timer-fired', 'chatr:commitment-verification-failed'];
 allEvents.forEach(evt => eventBus.subscribe(evt, updateHistory));
 
 // Initial load
 updateHistory();
 
 return () => {
 allEvents.forEach(evt => eventBus.unsubscribe(evt, updateHistory));
 };
 }, []);

 // Extract unique commitments from history
 const commitmentsMap = new Map<string, any>();
 history.forEach(evt => {
 const c = evt.payload?.commitment;
 if (c && c.id) {
 if (!commitmentsMap.has(c.id) || evt.type === 'chatr:commitment-state-changed') {
 commitmentsMap.set(c.id, c);
 }
 }
 });
 
 const liveCommitments = Array.from(commitmentsMap.values());

 return (
 <div className="flex h-full bg-[#0a0a0a] text-white">
 {/* LEFT PANEL: Commitments List */}
 <div className="w-1/3 border-r border-white/10 flex flex-col">
 <div className="p-4 border-b border-white/10 flex items-center justify-between">
 <h1 className="font-bold text-section flex items-center gap-2">
 <Zap className="w-5 h-5 text-emerald-400" />
 Kernel Dashboard
 </h1>
 <span className="text-label font-mono text-white/50 bg-white/5 px-2 py-1 rounded">v1.0.0</span>
 </div>
 
 <div className="p-4 flex-1 overflow-y-auto">
 <h2 className="text-secondary font-semibold text-white/70 mb-4 uppercase tracking-wider flex items-center gap-2">
 <List className="w-4 h-4" /> Live Commitments
 </h2>
 
 <div className="space-y-3">
 {liveCommitments.length === 0 && (
 <div className="text-white/40 text-secondary text-center py-10">No active commitments</div>
 )}
 {liveCommitments.map(c => (
 <div 
 key={c.id}
 onClick={() => setSelectedCommitmentId(c.id)}
 className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedCommitmentId === c.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
 >
 <div className="flex justify-between items-start mb-2">
 <span className="font-medium text-secondary">{c.title || c.capability}</span>
 <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
 {c.status}
 </span>
 </div>
 <div className="text-label font-mono text-white/40">{c.capability}</div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* RIGHT PANEL: Commitment Inspector */}
 <div className="w-2/3 flex flex-col bg-[#111]">
 {selectedCommitmentId ? (
 <CommitmentInspector commitmentId={selectedCommitmentId} history={history} />
 ) : (
 <div className="flex-1 flex flex-col items-center justify-center text-white/30">
 <LayoutTemplate className="w-16 h-16 mb-4 opacity-50" />
 <p>Select a commitment to inspect</p>
 </div>
 )}
 </div>
 </div>
 );
};

// ==========================================
// COMMITMENT INSPECTOR
// ==========================================
const CommitmentInspector: React.FC<{ commitmentId: string, history: ChatrEvent[] }> = ({ commitmentId, history }) => {
 // Read-only timeline
 const timeline = eventBus.getTimeline(commitmentId);
 const latestCommitment = timeline.reverse().find(e => e.payload?.commitment)?.payload.commitment;
 
 if (!latestCommitment) return null;

 return (
 <div className="flex flex-col h-full overflow-hidden">
 <div className="p-6 border-b border-white/10 bg-[#161616]">
 <div className="flex justify-between items-start mb-4">
 <div>
 <h2 className="text-page font-bold">{latestCommitment.title || 'Untitled'}</h2>
 <p className="font-mono text-secondary text-white/50 mt-1">{latestCommitment.id}</p>
 </div>
 <div className="flex gap-2">
 <span className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 font-mono text-secondary border border-blue-500/20">
 {latestCommitment.capability}
 </span>
 <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 font-mono text-secondary border border-emerald-500/20 uppercase tracking-widest">
 {latestCommitment.status}
 </span>
 </div>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-6 space-y-8">
 {/* Timeline Section */}
 <section>
 <h3 className="text-secondary font-semibold text-white/70 mb-4 uppercase tracking-wider flex items-center gap-2">
 <Activity className="w-4 h-4" /> Timeline Replay (Read-Only)
 </h3>
 <div className="relative pl-4 border-l border-white/10 space-y-6">
 {timeline.slice().reverse().map((evt, idx) => (
 <div key={evt.id} className="relative">
 <div className="absolute w-2 h-2 bg-emerald-500 rounded-full -left-[21px] top-1.5 ring-4 ring-[#111]"></div>
 <div className="text-label font-mono text-white/40 mb-1 flex justify-between">
 <span>{new Date(evt.timestamp).toISOString()}</span>
 <span>{evt.source}</span>
 </div>
 <div className="bg-white/5 border border-white/10 p-3 rounded-md font-mono text-secondary">
 <span className="text-emerald-400 font-bold">{evt.type}</span>
 </div>
 </div>
 ))}
 </div>
 </section>

 {/* Telemetry/Details Section */}
 <section>
 <h3 className="text-secondary font-semibold text-white/70 mb-4 uppercase tracking-wider flex items-center gap-2">
 <BarChart2 className="w-4 h-4" /> Telemetry Snapshot
 </h3>
 <pre className="bg-black/50 p-4 rounded-lg border border-white/10 text-label font-mono text-white/70 overflow-x-auto">
 {JSON.stringify(latestCommitment, null, 2)}
 </pre>
 </section>
 </div>
 </div>
 );
};
