import React, { useState, useEffect } from 'react';
import { kernelBus } from '@/kernel/core/EventBus';
import { ProcessNode } from '@/kernel/abi/v1';
import { Activity, XCircle, LayoutGrid, CheckCircle2, Server, Globe, Power, LineChart, Cpu, Zap, Target } from 'lucide-react';
import { kernel } from '@/kernel/abi';
import { observabilityService } from '@/kernel/core/ObservabilityService';

export const ProcessMonitor: React.FC = () => {
 const [processes, setProcesses] = useState<Record<string, any>>({});
 const [activeTab, setActiveTab] = useState<'live' | 'history' | 'observability'>('live');
 const [metrics, setMetrics] = useState(observabilityService.getMetrics());

 useEffect(() => {
 const handleEvent = (event: any) => {
 const processId = event.content?.processId || event.payload?.processId || event.processId;
 if (!processId) return;

 setProcesses(prev => {
 const existing = prev[processId] || { id: processId, events: [], state: 'UNKNOWN', latency: 0 };
 const newState = event.type === 'process.spawned' ? 'SPAWNING' 
 : event.type === 'process.discovery_completed' ? 'DISCOVERY'
 : event.type === 'process.ranking_completed' ? 'RANKING'
 : event.type === 'process.selection_completed' ? 'SELECTION'
 : event.type === 'process.policy_checked' ? 'POLICY_APPROVED'
 : event.type === 'process.resources_allocated' ? 'ALLOCATED'
 : event.type === 'execution.started' ? 'EXECUTING'
 : event.type === 'process.completed' ? 'COMPLETED'
 : event.type === 'process.failed' ? 'FAILED'
 : existing.state;

 return {
 ...prev,
 [processId]: {
 ...existing,
 state: newState,
 events: [...existing.events, event],
 intentId: event.intentId || event.payload?.intentId || existing.intentId,
 targetCapability: event.payload?.targetCapability || existing.targetCapability,
 providerEntity: event.payload?.providerEntity || existing.providerEntity,
 }
 };
 });
 };

 const subscriptions = [
 'process.spawned', 'process.discovery_completed', 'process.ranking_completed',
 'process.selection_completed', 'process.policy_checked', 'process.resources_allocated',
 'execution.started', 'process.completed', 'process.failed'
 ];

 subscriptions.forEach(sub => kernelBus.subscribe(sub, handleEvent));

 const intervalId = setInterval(() => {
 setMetrics(observabilityService.getMetrics());
 }, 1000);

 return () => {
 clearInterval(intervalId);
 };
 }, []);

 const processList = Object.values(processes).sort((a, b) => b.events[0]?.timestamp - a.events[0]?.timestamp);

 const killProcess = async (id: string) => {
 try {
 await kernel.killProcess(id as any, "User terminated via Process Monitor");
 setProcesses(prev => ({
 ...prev,
 [id]: { ...prev[id], state: 'CANCELLED' }
 }));
 } catch (e) {
 console.error(e);
 }
 };

 return (
 <div className="flex h-full bg-[#050505] text-white overflow-hidden font-sans">
 <div className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-md p-4 flex flex-col">
 <div className="flex items-center gap-3 text-section font-bold text-emerald-400 mb-8">
 <Activity className="w-6 h-6" />
 Process Monitor
 </div>
 
 <div className="space-y-2">
 <button onClick={() => setActiveTab('live')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'live' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/60 hover:bg-white/5'}`}>
 <Server className="w-4 h-4" /> Live Processes
 </button>
 <button onClick={() => setActiveTab('history')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'history' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/60 hover:bg-white/5'}`}>
 <LayoutGrid className="w-4 h-4" /> Execution History
 </button>
 <button onClick={() => setActiveTab('observability')} className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'observability' ? 'bg-blue-500/20 text-blue-300' : 'text-white/60 hover:bg-white/5'}`}>
 <LineChart className="w-4 h-4" /> Observability
 </button>
 </div>

 <div className="mt-auto">
 <div className="text-label text-white/40 uppercase tracking-widest mb-2 font-semibold">System Status</div>
 <div className="flex items-center gap-2 text-secondary text-emerald-400 bg-emerald-950/30 px-3 py-2 rounded border border-emerald-900/50">
 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
 Kernel ABI Online
 </div>
 </div>
 </div>

 <div className="flex-1 flex flex-col relative">
 <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 to-transparent pointer-events-none" />
 
 <div className="p-6 border-b border-white/5 bg-black/20 backdrop-blur-xl z-10 flex justify-between items-center">
 <h1 className="text-workspace font-medium tracking-tight">Active Executions</h1>
 <div className="text-secondary font-mono text-white/50">{processList.length} Processes Tracked</div>
 </div>

 <div className="flex-1 overflow-y-auto p-12 z-10 custom-scrollbar">
 <div className="max-w-5xl mx-auto space-y-6">
 {processList.map(proc => (
 <div key={proc.id} className={`p-8 rounded-[32px] border transition-all duration-500 backdrop-blur-2xl relative overflow-hidden group/card ${proc.state === 'COMPLETED' ? 'bg-emerald-950/10 border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.05)]' : proc.state === 'FAILED' ? 'bg-red-950/10 border-red-500/20' : proc.state === 'CANCELLED' ? 'bg-white/[0.02] border-white/5' : 'bg-blue-950/10 border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.1)] hover:shadow-[0_0_80px_rgba(59,130,246,0.15)]'}`}>
 {/* Background Glow */}
 <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[100px] opacity-20 pointer-events-none transition-opacity duration-700 group-hover/card:opacity-40 ${proc.state === 'COMPLETED' ? 'bg-emerald-500' : proc.state === 'FAILED' ? 'bg-red-500' : proc.state === 'CANCELLED' ? 'hidden' : 'bg-blue-500'}`} />
 
 <div className="flex justify-between items-start mb-6 relative z-10">
 <div>
 <div className="flex items-center gap-4 mb-2">
 <span className="font-mono text-secondary text-white/40">Task: {proc.id}</span>
 <span className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full font-bold flex items-center gap-2 ${proc.state === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : proc.state === 'FAILED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : proc.state === 'CANCELLED' ? 'bg-white/10 text-white/50' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
 {proc.state !== 'COMPLETED' && proc.state !== 'FAILED' && proc.state !== 'CANCELLED' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
 {proc.state === 'COMPLETED' ? 'FINISHED' : proc.state === 'SPAWNING' ? 'UNDERSTANDING' : proc.state}
 </span>
 </div>
 <div className="text-page tracking-tight text-white/90">
 {proc.targetCapability || 'Understanding Task...'}
 </div>
 </div>
 
 {proc.state !== 'COMPLETED' && proc.state !== 'FAILED' && proc.state !== 'CANCELLED' && (
 <button onClick={() => killProcess(proc.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all group relative z-10">
 <Power className="w-5 h-5" />
 <span className="absolute -top-8 right-0 bg-black text-white text-label px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">Kill Process</span>
 </button>
 )}
 </div>

 <div className="flex items-center gap-8 mt-8 pt-6 border-t border-white/5 relative z-10">
 <div className="flex-1 flex items-center justify-between">
 {[{label: 'Understanding', state: 'SPAWNING'}, {label: 'Finding', state: 'DISCOVERY'}, {label: 'Verifying', state: 'POLICY_APPROVED'}, {label: 'Working', state: 'EXECUTING'}, {label: 'Finished', state: 'COMPLETED'}].map((step, idx) => {
 const isActive = proc.state === step.state;
 const isPast = proc.events.some((e: any) => e.type.includes(step.state.toLowerCase().replace('_approved', '_checked')));
 
 return (
 <div key={step.state} className="flex flex-col items-center gap-3 relative z-10 w-24">
 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${isActive ? 'border-blue-400 bg-blue-500/20 text-blue-400 shadow-[0_0_30px_rgba(96,165,250,0.5)] scale-110' : isPast ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-white/5 bg-black/40 text-white/10'}`}>
 {isPast && !isActive ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 rounded-full bg-current" />}
 </div>
 <span className={`text-[10px] font-bold uppercase tracking-widest text-center ${isActive ? 'text-blue-400' : isPast ? 'text-emerald-500/70' : 'text-white/20'}`}>
 {step.label}
 </span>
 </div>
 )
 })}
 {/* Connecting line */}
 <div className="absolute left-10 right-10 h-[2px] bg-white/5 -z-0 mt-[-24px]">
 {proc.state !== 'SPAWNING' && (
 <div className="h-full bg-gradient-to-r from-emerald-500/50 to-blue-500/50 transition-all duration-700" style={{ width: proc.state === 'COMPLETED' ? '100%' : proc.state === 'EXECUTING' ? '75%' : proc.state === 'POLICY_APPROVED' ? '50%' : '25%' }} />
 )}
 </div>
 </div>
 
 <div className="w-px h-16 bg-white/5 mx-2" />
 
 <div className="flex flex-col justify-center min-w-[140px]">
 <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold">Service</div>
 <div className="text-secondary font-medium flex items-center gap-3 text-white/90 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
 {proc.providerEntity ? (
 <><Globe className="w-4 h-4 text-purple-400" /> {proc.providerEntity.id.replace('provider.', '')}</>
 ) : (
 <span className="text-white/30 italic flex items-center gap-2"><div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-ping"/> Finding...</span>
 )}
 </div>
 </div>
 </div>
 </div>
 ))}
 
 {activeTab === 'live' && processList.length === 0 && (
 <div className="flex flex-col items-center justify-center h-[50vh] text-white/40 space-y-6">
 <div className="relative">
 <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
 <Activity className="w-20 h-20 opacity-80 text-blue-400 relative z-10" />
 </div>
 <div className="text-center">
 <h3 className="text-page text-white/90 mb-2 tracking-tight">System Idle</h3>
 <p className="text-secondary font-medium text-white/50">Ready to execute new tasks.</p>
 </div>
 </div>
 )}

 {activeTab === 'observability' && (
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-white/5 p-6 rounded-xl border border-white/10">
 <div className="text-white/50 text-secondary uppercase tracking-widest font-semibold flex items-center gap-2 mb-4"><Zap className="w-4 h-4"/> Kernel Throughput</div>
 <div className="text-display font-mono text-emerald-400">{metrics.eventsPerSec.toFixed(1)} <span className="text-section text-white/40">evt/s</span></div>
 </div>
 <div className="bg-white/5 p-6 rounded-xl border border-white/10">
 <div className="text-white/50 text-secondary uppercase tracking-widest font-semibold flex items-center gap-2 mb-4"><Server className="w-4 h-4"/> Active Processes</div>
 <div className="text-display font-mono text-blue-400">{metrics.activeProcesses}</div>
 </div>
 <div className="bg-white/5 p-6 rounded-xl border border-white/10">
 <div className="text-white/50 text-secondary uppercase tracking-widest font-semibold flex items-center gap-2 mb-4"><Cpu className="w-4 h-4"/> Avg Capability Latency</div>
 <div className="text-display font-mono text-purple-400">{metrics.avgCapLatency.toFixed(0)} <span className="text-section text-white/40">ms</span></div>
 </div>
 <div className="bg-white/5 p-6 rounded-xl border border-white/10">
 <div className="text-white/50 text-secondary uppercase tracking-widest font-semibold flex items-center gap-2 mb-4"><Target className="w-4 h-4"/> Avg Policy Latency</div>
 <div className="text-display font-mono text-pink-400">{metrics.avgPolicyLatency.toFixed(0)} <span className="text-section text-white/40">ms</span></div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default ProcessMonitor;
