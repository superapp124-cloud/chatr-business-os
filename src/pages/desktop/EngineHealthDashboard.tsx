import React, { useState, useEffect } from 'react';
import {
 Activity, Server, Cpu, Database, Network, Clock, AlertTriangle,
 Zap, ArrowUpRight, BarChart2, ShieldCheck, HardDrive, RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { engineHealthStore, EngineHealthMetrics, EngineHealthSnapshot } from '@/core/runtime/EngineHealthStore';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

function MetricCard({
 title, value, unit, icon: Icon, trend, target, warningThreshold, criticalThreshold
}: {
 title: string; value: number; unit?: string; icon: React.ElementType; trend?: string;
 target?: number; warningThreshold?: number; criticalThreshold?: number;
}) {
 let statusColor = 'text-emerald-400';
 let bgColor = 'bg-emerald-500/10 border-emerald-500/20';

 if (criticalThreshold !== undefined && value >= criticalThreshold) {
 statusColor = 'text-rose-400';
 bgColor = 'bg-rose-500/10 border-rose-500/20';
 } else if (warningThreshold !== undefined && value >= warningThreshold) {
 statusColor = 'text-amber-400';
 bgColor = 'bg-amber-500/10 border-amber-500/20';
 }

 return (
 <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2 text-slate-400">
 <Icon className="w-4 h-4" />
 <span className="text-label uppercase tracking-wider">{title}</span>
 </div>
 {target !== undefined && (
 <span className="text-[10px] text-slate-500 font-mono">Target: {target}{unit}</span>
 )}
 </div>
 <div className="flex items-end justify-between mt-2">
 <div className="flex items-baseline gap-1">
 <span className={cn('text-display font-mono tracking-tight', statusColor)}>
 {value % 1 !== 0 ? value.toFixed(1) : value}
 </span>
 {unit && <span className="text-secondary text-slate-500 font-medium">{unit}</span>}
 </div>
 {trend && (
 <div className={cn('text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1', bgColor, statusColor)}>
 <ArrowUpRight className="w-3 h-3" />
 {trend}
 </div>
 )}
 </div>
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Dashboard Page
// ─────────────────────────────────────────────────────────────

export const EngineHealthDashboard: React.FC = () => {
 const [metrics, setMetrics] = useState<EngineHealthMetrics>(engineHealthStore.getMetrics());
 const [history, setHistory] = useState<EngineHealthSnapshot[]>(engineHealthStore.getHistory());

 useEffect(() => {
 const unsub = engineHealthStore.subscribe(() => {
 setMetrics(engineHealthStore.getMetrics());
 setHistory(engineHealthStore.getHistory());
 });
 return unsub;
 }, []);

 // Format data for chart
 const chartData = history.map(h => ({
 time: new Date(h.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
 activeWorkflows: h.activeWorkflows,
 queueDepth: h.queueDepth,
 runningStages: h.runningStages,
 eventThroughput: h.eventThroughput,
 aiLatency: h.aiRuntimeLatencyMs
 }));

 return (
 <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans overflow-y-auto">
 
 {/* Top Bar */}
 <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur-md z-10">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
 <Server className="w-5 h-5 text-emerald-400" />
 </div>
 <div>
 <h1 className="text-section font-bold text-white">Engine Health Dashboard</h1>
 <p className="text-label text-slate-500">Platform-wide operational telemetry & performance budgets</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span className="flex items-center gap-1.5 text-label text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
 <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
 System Healthy
 </span>
 </div>
 </div>

 <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
 
 {/* Section: Throughput & Concurrency */}
 <div>
 <h2 className="text-secondary font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <Activity className="w-4 h-4" /> Throughput & Concurrency
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <MetricCard title="Active Workflows" value={metrics.activeWorkflows} icon={Network} />
 <MetricCard title="Running Stages" value={metrics.runningStages} icon={Cpu} />
 <MetricCard title="Queue Depth" value={metrics.queueDepth} icon={Database} warningThreshold={50} criticalThreshold={200} />
 <MetricCard title="Event Throughput" value={metrics.eventThroughput} unit="eps" icon={Zap} trend="+12%" />
 </div>
 </div>

 {/* Section: Performance Budgets (Latencies) */}
 <div>
 <h2 className="text-secondary font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <Clock className="w-4 h-4" /> Performance Budgets
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <MetricCard 
 title="Provider Lookup (Avg)" 
 value={metrics.providerLatencyMs} unit="ms" icon={Network} 
 target={5} warningThreshold={5} criticalThreshold={10} 
 />
 <MetricCard 
 title="Event Publish (Avg)" 
 value={metrics.eventPublishLatencyMs} unit="ms" icon={Zap} 
 target={10} warningThreshold={10} criticalThreshold={50} 
 />
 <MetricCard 
 title="AI Overhead (Avg)" 
 value={metrics.aiRuntimeLatencyMs} unit="ms" icon={Cpu} 
 target={50} warningThreshold={50} criticalThreshold={200} 
 />
 </div>
 </div>

 {/* Section: Reliability & Errors */}
 <div>
 <h2 className="text-secondary font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <ShieldCheck className="w-4 h-4" /> Reliability Metrics
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <MetricCard 
 title="Stage Error Rate" 
 value={metrics.errorRate} unit="%" icon={AlertTriangle} 
 warningThreshold={1} criticalThreshold={5} 
 />
 <MetricCard 
 title="Stage Retry Rate" 
 value={metrics.retryRate} unit="%" icon={RefreshCw} 
 warningThreshold={5} criticalThreshold={15} 
 />
 <MetricCard 
 title="Compensation Rate" 
 value={metrics.compensationRate} unit="%" icon={ArrowUpRight} 
 warningThreshold={2} criticalThreshold={10} 
 />
 </div>
 </div>

 {/* Section: Event Runtime */}
 <div>
 <h2 className="text-secondary font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <Zap className="w-4 h-4" /> Event Runtime Operations
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <MetricCard 
 title="Dead Letter Queue" 
 value={metrics.dlqCount} icon={AlertTriangle} 
 warningThreshold={1} criticalThreshold={10} 
 />
 <MetricCard 
 title="Batch Flushes" 
 value={metrics.batchFlushCount} icon={Database} 
 />
 <MetricCard 
 title="Queue Saturation" 
 value={metrics.queueSaturation} unit="%" icon={Activity} 
 warningThreshold={50} criticalThreshold={80} 
 />
 </div>
 </div>

 {/* Section: Resources */}
 <div>
 <h2 className="text-secondary font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <HardDrive className="w-4 h-4" /> Resource Utilization
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <MetricCard 
 title="Memory Usage" 
 value={metrics.memoryUsageMB} unit="MB" icon={Database} 
 warningThreshold={512} criticalThreshold={1024} 
 />
 </div>
 </div>

 {/* Section: Performance Timeline */}
 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
 <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg h-80">
 <h2 className="text-secondary font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
 <BarChart2 className="w-4 h-4" /> Performance Timeline (Last 2 Min)
 </h2>
 {chartData.length > 0 ? (
 <ResponsiveContainer width="100%" height="85%">
 <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
 <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickMargin={10} />
 <YAxis stroke="#64748b" fontSize={11} />
 <Tooltip 
 contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
 itemStyle={{ color: '#e2e8f0' }}
 />
 <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
 <Line type="monotone" dataKey="queueDepth" name="Queue Depth" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
 <Line type="monotone" dataKey="activeWorkflows" name="Workflows" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
 <Line type="monotone" dataKey="runningStages" name="Stages" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
 <Line type="monotone" dataKey="eventThroughput" name="Events/sec" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-full flex items-center justify-center text-slate-500 text-secondary italic">
 Collecting telemetry...
 </div>
 )}
 </div>

 <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg h-80">
 <h2 className="text-secondary font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
 <HardDrive className="w-4 h-4" /> Memory Profiler
 </h2>
 {chartData.length > 0 ? (
 <ResponsiveContainer width="100%" height="85%">
 <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
 <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickMargin={10} />
 <YAxis stroke="#64748b" fontSize={11} unit="MB" />
 <Tooltip 
 contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
 itemStyle={{ color: '#e2e8f0' }}
 />
 <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
 <Line type="monotone" dataKey="memoryUsageMB" name="Total Heap (MB)" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
 <Line type="monotone" dataKey="eventQueueUsageMB" name="Queue Memory (MB)" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-full flex items-center justify-center text-slate-500 text-secondary italic">
 Collecting memory profiles...
 </div>
 )}
 </div>
 </div>

 </div>
 </div>
 );
};

export default EngineHealthDashboard;
