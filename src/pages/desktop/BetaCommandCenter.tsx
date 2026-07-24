import React, { useEffect, useState } from 'react';
import { Shield, Activity, BarChart3, Clock, AlertTriangle, CheckCircle, RefreshCcw, Rewind, Play } from 'lucide-react';

interface Trace {
 correlationId: string;
 events: { stage: string; timestamp: number }[];
 durationMs: number;
}

export function BetaCommandCenter() {
 const [traces, setTraces] = useState<Trace[]>([]);
 const [loading, setLoading] = useState(true);

 const fetchTelemetry = async () => {
 try {
 const res = await fetch('http://localhost:8087/kernel/telemetry');
 if (res.ok) {
 const data = await res.json();
 setTraces(data.traces);
 }
 } catch (e) {
 console.error(e);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchTelemetry();
 const interval = setInterval(fetchTelemetry, 5000);
 return () => clearInterval(interval);
 }, []);

 // Compute Metrics
 const suggestionsShown = traces.filter(t => t.events.some(e => e.stage === 'KERNEL.SUGGESTION.PROPOSED')).length;
 const suggestionsAccepted = traces.filter(t => t.events.some(e => e.stage === 'KERNEL.ACTION.CONFIRMED')).length;
 const suggestionsDismissed = traces.filter(t => t.events.some(e => e.stage === 'KERNEL.SUGGESTION.DISMISSED')).length;
 
 // Undo/Edit metrics would require specific payloads to be tracked in bus.cjs.
 // For now we calculate edit rate by looking for "isEdited" flag in action payloads if we logged it.
 // Since trace.jsonl only logs stages currently, we'll simulate these advanced metrics for the UI structure.
 
 const acceptanceRate = suggestionsShown ? ((suggestionsAccepted / suggestionsShown) * 100).toFixed(1) : 0;
 const dismissRate = suggestionsShown ? ((suggestionsDismissed / suggestionsShown) * 100).toFixed(1) : 0;

 // Manual Edit Rate: traces where payload has isEdited=true
 const editedCount = traces.filter(t =>
 t.events.some(e => (e as any).payload?.isEdited === true)
 ).length;
 const manualEditRate = suggestionsAccepted > 0
 ? ((editedCount / suggestionsAccepted) * 100).toFixed(1)
 : '0.0';

 // Avg Confirm Time: ms between PROPOSED and CONFIRMED events
 const confirmTimes = traces
 .map(t => {
 const proposed = t.events.find(e => e.stage === 'KERNEL.SUGGESTION.PROPOSED');
 const confirmed = t.events.find(e => e.stage === 'KERNEL.ACTION.CONFIRMED');
 return proposed && confirmed ? confirmed.timestamp - proposed.timestamp : null;
 })
 .filter((v): v is number => v !== null && v > 0);
 const avgConfirmMs = confirmTimes.length
 ? (confirmTimes.reduce((a, b) => a + b, 0) / confirmTimes.length)
 : 0;
 const avgConfirmDisplay = avgConfirmMs
 ? avgConfirmMs < 1000 ? `${Math.round(avgConfirmMs)}ms` : `${(avgConfirmMs / 1000).toFixed(1)}s`
 : '—';

 // Habit Formation: ratio of INTENT_DETECTED that weren't triggered by user text (voluntary)
 const voluntaryIntents = traces.filter(t =>
 t.events.some(e => e.stage === 'INTENT_DETECTED' && (e as any).payload?.voluntary === true)
 ).length;
 const habitRate = suggestionsShown ? ((voluntaryIntents / suggestionsShown) * 100).toFixed(1) : '0.0';

 // Replay trace: re-dispatch via CommandBus if available
 const replayTrace = (trace: Trace) => {
 window.dispatchEvent(new CustomEvent('chatr:replay-trace', { detail: { correlationId: trace.correlationId } }));
 };

 return (
 <div className="flex-1 bg-zinc-950 text-white flex flex-col h-full overflow-hidden">
 <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900/50">
 <div>
 <h1 className="text-page font-bold flex items-center gap-2">
 <Activity className="text-emerald-400 w-6 h-6" />
 Beta Command Center
 </h1>
 <p className="text-zinc-400 mt-1">Live telemetry for CHATR Private Beta.</p>
 </div>
 <button onClick={fetchTelemetry} className="p-2 bg-white/5 rounded-lg hover:bg-white/10">
 <RefreshCcw className="w-5 h-5 text-zinc-400" />
 </button>
 </div>

 <div className="flex-1 overflow-y-auto p-6 space-y-8">
 
 {/* Trust Metrics */}
 <section>
 <h2 className="text-section mb-4 flex items-center gap-2">
 <Shield className="w-5 h-5 text-blue-400" />
 Trust Metrics
 </h2>
 <div className="grid grid-cols-5 gap-4">
 <MetricCard title="Acceptance Rate" value={`${acceptanceRate}%`} subtitle={`${suggestionsAccepted} of ${suggestionsShown}`} icon={<CheckCircle className="text-emerald-400" />} />
 <MetricCard title="Dismiss Rate" value={`${dismissRate}%`} subtitle={`${suggestionsDismissed} of ${suggestionsShown}`} icon={<AlertTriangle className="text-amber-400" />} />
 <MetricCard title="Manual Edit Rate" value={`${manualEditRate}%`} subtitle={`${editedCount} edited before confirm`} icon={<BarChart3 className="text-violet-400" />} />
 <MetricCard title="Avg Confirm Time" value={avgConfirmDisplay} subtitle={`Over ${confirmTimes.length} confirmations`} icon={<Clock className="text-blue-400" />} />
 <MetricCard title="Habit Formation" value={`${habitRate}%`} subtitle={`${voluntaryIntents} voluntary intents`} icon={<Activity className="text-pink-400" />} />
 </div>
 </section>

 {/* Intent Replay */}
 <section>
 <h2 className="text-section mb-4 flex items-center gap-2">
 <Rewind className="w-5 h-5 text-pink-400" />
 Live Intent Replay
 </h2>
 
 <div className="bg-zinc-900 border border-white/5 rounded-xl overflow-hidden">
 {loading ? (
 <div className="p-8 text-center text-zinc-500">Loading traces...</div>
 ) : traces.length === 0 ? (
 <div className="p-8 text-center text-zinc-500">No traces recorded yet.</div>
 ) : (
 <table className="w-full text-left text-secondary">
 <thead className="bg-zinc-950">
 <tr>
 <th className="px-4 py-3 font-medium text-zinc-400">Trace ID</th>
 <th className="px-4 py-3 font-medium text-zinc-400">Duration</th>
 <th className="px-4 py-3 font-medium text-zinc-400">Flow</th>
 <th className="px-4 py-3 font-medium text-zinc-400">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-white/5">
 {traces.slice().reverse().map((trace: any) => (
 <tr key={trace.correlationId} className="hover:bg-white/5 transition-colors">
 <td className="px-4 py-3 font-mono text-table text-zinc-500">{trace.correlationId.split('-')[0]}</td>
 <td className="px-4 py-3 text-zinc-300">{trace.durationMs}ms</td>
 <td className="px-4 py-3">
 <div className="flex flex-wrap gap-2">
 {trace.events.map((e: any, i: number) => (
 <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
 {e.stage.split('.')[1]}
 </span>
 ))}
 </div>
 </td>
 <td className="px-4 py-3">
 <button
 onClick={() => replayTrace(trace)}
 className="flex items-center gap-1 text-label text-blue-400 hover:text-blue-300"
 >
 <Play className="w-3 h-3" /> Replay
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 </section>

 </div>
 </div>
 );
}

function MetricCard({ title, value, subtitle, icon }: any) {
 return (
 <div className="bg-zinc-900 border border-white/5 p-4 rounded-xl flex flex-col gap-2">
 <div className="flex justify-between items-start">
 <span className="text-zinc-400 text-secondary">{title}</span>
 {icon}
 </div>
 <div className="text-display ">{value}</div>
 <div className="text-label text-zinc-500">{subtitle}</div>
 </div>
 );
}
