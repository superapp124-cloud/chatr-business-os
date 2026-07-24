import React, { useEffect, useState } from 'react';
import { conversation } from '@/core/conversation/ConversationSDK';
import { HealthResponse } from '@/core/conversation/types';

export default function KernelConsole() {
 const [health, setHealth] = useState<HealthResponse | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [refreshKey, setRefreshKey] = useState(0);

 useEffect(() => {
 async function fetchHealth() {
 try {
 const data = await conversation.health();
 setHealth(data);
 setError(null);
 } catch (err: any) {
 setError(err.message || 'Failed to fetch kernel health');
 }
 }
 fetchHealth();
 
 // Auto refresh every 2 seconds
 const interval = setInterval(fetchHealth, 2000);
 return () => clearInterval(interval);
 }, [refreshKey]);

 if (error) {
 return (
 <div className="p-8 text-red-500 font-mono">
 <h1 className="text-page mb-4 font-bold">KERNEL PANIC</h1>
 <p>{error}</p>
 <button 
 onClick={() => setRefreshKey(k => k + 1)}
 className="mt-4 px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800"
 >
 RETRY
 </button>
 </div>
 );
 }

 if (!health) {
 return <div className="p-8 font-mono text-gray-400">Booting Kernel Console...</div>;
 }

 // Handle any additional properties that might come from the updated health endpoint
 const metrics = health as any;

 return (
 <div className="p-8 bg-zinc-950 text-emerald-500 font-mono min-h-full">
 <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
 <div>
 <h1 className="text-display text-white tracking-widest">CHATR CORE <span className="text-emerald-500">v{health.version}</span></h1>
 <p className="text-zinc-400 text-secondary mt-1">Codename: {health.codename} | Status: {health.core.toUpperCase()}</p>
 </div>
 <div className="text-right">
 <p className="text-zinc-500 text-label uppercase tracking-widest">Uptime</p>
 <p className="text-section text-white">{metrics.system?.uptimeSeconds ? `${metrics.system.uptimeSeconds}s` : 'N/A'}</p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
 <div className="bg-zinc-900 p-4 rounded border border-zinc-800">
 <p className="text-zinc-500 text-label mb-1 uppercase tracking-wider">AI Provider</p>
 <p className="text-workspace text-white capitalize">{health.provider}</p>
 <p className="text-label text-zinc-400 mt-1">{health.providerOk ? '● Online' : '○ Offline'}</p>
 </div>
 <div className="bg-zinc-900 p-4 rounded border border-zinc-800">
 <p className="text-zinc-500 text-label mb-1 uppercase tracking-wider">Active Model</p>
 <p className="text-workspace text-white">{health.model}</p>
 <p className="text-label text-zinc-400 mt-1">{health.latencyMs}ms ping</p>
 </div>
 <div className="bg-zinc-900 p-4 rounded border border-zinc-800">
 <p className="text-zinc-500 text-label mb-1 uppercase tracking-wider">Memory Usage</p>
 <p className="text-workspace text-white">{metrics.system?.memoryUsageMB ? `${metrics.system.memoryUsageMB} MB` : 'N/A'}</p>
 </div>
 <div className="bg-zinc-900 p-4 rounded border border-zinc-800">
 <p className="text-zinc-500 text-label mb-1 uppercase tracking-wider">Total Requests</p>
 <p className="text-workspace text-white">{metrics.requests || 0}</p>
 <p className="text-label text-zinc-400 mt-1">Avg {metrics.avgLatencyMs || 0}ms / req</p>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 {/* Modules */}
 <div>
 <h2 className="text-section font-bold text-white mb-4 border-b border-zinc-800 pb-2">MODULE REGISTRY</h2>
 <div className="bg-zinc-900 rounded border border-zinc-800 overflow-hidden">
 <table className="w-full text-left text-secondary">
 <thead className="bg-zinc-950 text-zinc-500 uppercase">
 <tr>
 <th className="px-4 py-3 font-normal">Module</th>
 <th className="px-4 py-3 font-normal">Version</th>
 <th className="px-4 py-3 font-normal">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-800">
 {health.modules.map((mod: any) => (
 <tr key={mod.name} className="hover:bg-zinc-800/50">
 <td className="px-4 py-3 text-white font-medium">{mod.name}</td>
 <td className="px-4 py-3 text-zinc-400">{mod.version || '-'}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-0.5 rounded text-label ${
 mod.status === 'stable' ? 'bg-emerald-500/20 text-emerald-400' :
 mod.status === 'reserved' ? 'bg-zinc-700/50 text-zinc-400' :
 'bg-yellow-500/20 text-yellow-400'
 }`}>
 {mod.status}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Lifecycle Inspector */}
 <div>
 <h2 className="text-section font-bold text-white mb-4 border-b border-zinc-800 pb-2">LIFECYCLE INSPECTOR (Last 5)</h2>
 <div className="bg-zinc-900 rounded border border-zinc-800 overflow-hidden p-4">
 {metrics.inspector?.recentSpans?.slice(-5).reverse().map((span: any) => (
 <div key={span.requestId} className="mb-4 last:mb-0 border-b border-zinc-800 pb-4 last:border-0 last:pb-0">
 <div className="flex justify-between items-center mb-2">
 <span className="text-label text-zinc-500 truncate mr-4">{span.requestId}</span>
 <span className={`text-label px-2 py-0.5 rounded ${
 span.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
 span.status === 'failed' ? 'bg-red-500/20 text-red-400' :
 'bg-blue-500/20 text-blue-400'
 }`}>
 {span.status} {span.latencyMs}ms
 </span>
 </div>
 <div className="grid grid-cols-4 gap-1">
 {Object.entries(span.marks || {}).map(([stage, time]: [string, any]) => (
 <div key={stage} className="bg-zinc-950 p-1 rounded text-center">
 <div className="text-[10px] text-zinc-500 truncate uppercase">{stage}</div>
 </div>
 ))}
 </div>
 </div>
 ))}
 {(!metrics.inspector?.recentSpans || metrics.inspector.recentSpans.length === 0) && (
 <div className="text-center text-zinc-500 py-8">No requests tracked yet.</div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
