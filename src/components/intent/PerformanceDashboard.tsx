import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, Zap, TrendingUp, Activity } from 'lucide-react';
import { IntentContext } from '../../core/kernel/KernelSession';

interface PerformanceDashboardProps {
 context: IntentContext;
 totalMs?: number;
}

interface SlaBar {
 stage: string;
 latencyMs: number;
 slaMs: number;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ context, totalMs }) => {
 if (!context.metrics || Object.keys(context.metrics).length === 0) return null;

 const stages: SlaBar[] = Object.values(context.metrics)
 .filter(m => m.stage !== 'Total_Intent_To_Results')
 .map(m => ({ stage: m.stage, latencyMs: m.latencyMs, slaMs: m.slaMs }));

 const totalSla = 500;
 const overallMs = totalMs ?? (context.metrics['Total_Intent_To_Results']?.latencyMs ?? 0);
 const overallWithinSla = overallMs <= totalSla;

 return (
 <div className="bg-gray-950/90 border border-gray-800 rounded-2xl p-5 mt-4 backdrop-blur-xl">
 <div className="flex items-center justify-between mb-5">
 <div className="flex items-center gap-2">
 <Activity className="w-4 h-4 text-purple-400" />
 <span className="text-secondary font-semibold text-gray-200">Performance Telemetry</span>
 </div>
 {overallMs > 0 && (
 <div className={`flex items-center gap-1.5 text-label font-mono px-2.5 py-1 rounded-full ${overallWithinSla ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
 {overallWithinSla ? <Zap className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
 Total: {overallMs}ms / {totalSla}ms SLA
 </div>
 )}
 </div>

 <div className="space-y-3">
 {stages.map(({ stage, latencyMs, slaMs }) => {
 const pct = Math.min((latencyMs / slaMs) * 100, 100);
 const withinSla = latencyMs <= slaMs;
 return (
 <div key={stage}>
 <div className="flex items-center justify-between mb-1">
 <div className="flex items-center gap-1.5">
 {withinSla
 ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
 : <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
 <span className="text-label text-gray-300 ">{stage}</span>
 </div>
 <div className="flex items-center gap-2">
 <span className={`text-[10px] font-mono ${withinSla ? 'text-green-400' : 'text-amber-400'}`}>
 {latencyMs}ms
 </span>
 <span className="text-[10px] font-mono text-gray-600">/ {slaMs}ms</span>
 </div>
 </div>
 {/* SLA bar */}
 <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-500 ${withinSla ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'}`}
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>
 );
 })}
 </div>

 {/* KPI summary row */}
 <div className="mt-5 pt-4 border-t border-gray-800 grid grid-cols-3 gap-3">
 {[
 { label: 'Stages', value: stages.length, icon: <TrendingUp className="w-3 h-3" /> },
 { label: 'Within SLA', value: stages.filter(s => s.latencyMs <= s.slaMs).length, icon: <CheckCircle2 className="w-3 h-3 text-green-400" /> },
 { label: 'Total', value: `${overallMs}ms`, icon: <Clock className="w-3 h-3" /> },
 ].map(({ label, value, icon }) => (
 <div key={label} className="bg-gray-900 rounded-lg p-2 text-center">
 <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
 {icon}
 <span className="text-[10px]">{label}</span>
 </div>
 <span className="text-secondary font-bold text-white">{value}</span>
 </div>
 ))}
 </div>
 </div>
 );
};
