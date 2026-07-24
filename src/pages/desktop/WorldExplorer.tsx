import React, { useState, useEffect, useRef } from 'react';
import { worldModel } from '@/kernel/world/WorldModel';
import { GraphNode, Relationship } from '@/kernel/world/types';
import { Globe2, Layers, Cpu, Database, Network, Activity } from 'lucide-react';
import { kernelBus } from '@/kernel/core/EventBus';
import { cn } from '@/lib/utils';

export const WorldExplorer: React.FC = () => {
 const [nodes, setNodes] = useState<GraphNode[]>([]);
 const [edges, setEdges] = useState<Relationship[]>([]);
 const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
 const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple');

 useEffect(() => {
 const refreshData = () => {
 const snap = worldModel.extractStateForSnapshot().state;
 setNodes(Array.from(snap.nodes.values()));
 setEdges(Array.from(snap.edges.values()));
 };

 refreshData();
 // Re-fetch on any mutation to the world
 const timer = setInterval(refreshData, 1000);
 return () => clearInterval(timer);
 }, []);

 // Simple layout engine: Group by type, arrange in concentric circles
 const width = 800;
 const height = 600;
 const cx = width / 2;
 const cy = height / 2;

 const nodePositions = new Map<string, { x: number, y: number, color: string }>();
 
 const typeGroups = {
 'Intent': { radius: 0, color: '#f43f5e' }, // Center
 'Process': { radius: 100, color: '#3b82f6' },
 'Capability': { radius: 200, color: '#a855f7' },
 'Entity': { radius: 300, color: '#10b981' },
 'Knowledge': { radius: 250, color: '#eab308' },
 'other': { radius: 350, color: '#64748b' }
 };

 const groupedNodes = nodes.reduce((acc, node) => {
 const key = (typeGroups as any)[node.type] ? node.type : 'other';
 if (!acc[key]) acc[key] = [];
 acc[key].push(node);
 return acc;
 }, {} as Record<string, GraphNode[]>);

 Object.entries(groupedNodes).forEach(([type, typeNodes]) => {
 const groupInfo = (typeGroups as any)[type];
 typeNodes.forEach((node, i) => {
 const angle = (i / typeNodes.length) * Math.PI * 2;
 // Add slight staggering based on index to prevent perfect overlap if many nodes
 const stagger = (i % 2 === 0 ? 1 : 0.9);
 nodePositions.set(node.id, {
 x: cx + Math.cos(angle) * (groupInfo.radius * stagger),
 y: cy + Math.sin(angle) * (groupInfo.radius * stagger),
 color: groupInfo.color
 });
 });
 });

 return (
 <div className="flex h-full bg-[#020202] text-white font-sans overflow-hidden">
 {/* Sidebar */}
 <div className="w-80 border-r border-white/5 bg-black/40 backdrop-blur-xl p-6 flex flex-col z-20">
 <div className="flex items-center gap-3 text-workspace font-bold text-white mb-6">
 <Globe2 className="w-6 h-6 text-purple-400" />
 World State
 </div>

 <div className="flex bg-white/5 rounded-lg p-1 mb-8">
 <button onClick={() => setViewMode('simple')} className={cn("flex-1 py-1.5 text-label font-semibold rounded-md transition-colors", viewMode === 'simple' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}>Simple</button>
 <button onClick={() => setViewMode('advanced')} className={cn("flex-1 py-1.5 text-label font-semibold rounded-md transition-colors", viewMode === 'advanced' ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}>Advanced</button>
 </div>

 <div className="grid grid-cols-2 gap-4 mb-8">
 <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center">
 <Layers className="w-5 h-5 text-emerald-400 mb-2" />
 <div className="text-page font-bold">{nodes.length}</div>
 <div className="text-label text-white/40 uppercase tracking-widest mt-1">Knowledge Bits</div>
 </div>
 <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center">
 <Network className="w-5 h-5 text-blue-400 mb-2" />
 <div className="text-page font-bold">{edges.length}</div>
 <div className="text-label text-white/40 uppercase tracking-widest mt-1">Connections</div>
 </div>
 </div>

 {selectedNode ? (
 <div className="flex-1 overflow-y-auto animate-in fade-in slide-in-from-left-4 duration-300">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-secondary font-semibold uppercase tracking-widest text-white/40">Node Inspector</h3>
 <button onClick={() => setSelectedNode(null)} className="text-white/40 hover:text-white">✕</button>
 </div>
 
 <div className="space-y-4">
 <div>
 <div className="text-label text-white/30 mb-1">ID</div>
 <div className="font-mono text-secondary break-all text-white/80">{selectedNode.id}</div>
 </div>
 <div>
 <div className="text-label text-white/30 mb-1">Type</div>
 <div className="inline-block px-2 py-1 rounded text-label font-bold uppercase tracking-wider" 
 style={{ backgroundColor: `${nodePositions.get(selectedNode.id)?.color}20`, color: nodePositions.get(selectedNode.id)?.color }}>
 {selectedNode.type}
 </div>
 </div>
 <div>
 <div className="text-label text-white/30 mb-2">Properties</div>
 
 {selectedNode.type === 'Entity' && (selectedNode.properties as any).health && (
 <div className="mb-4">
 <div className="text-label text-white/50 mb-1">Health Status</div>
 <div className={`inline-flex items-center px-2 py-1 rounded text-label font-bold ${
 (selectedNode.properties as any).health === 'ONLINE' ? 'bg-green-500/20 text-green-400' :
 (selectedNode.properties as any).health === 'DEGRADED' ? 'bg-yellow-500/20 text-yellow-400' :
 'bg-red-500/20 text-red-400'
 }`}>
 <span className="w-2 h-2 rounded-full bg-current mr-2 animate-pulse" />
 {(selectedNode.properties as any).health}
 </div>
 </div>
 )}

 {selectedNode.type === 'Entity' && (selectedNode.properties as any).trust && (
 <div className="mb-4">
 <div className="text-label text-white/50 mb-2">Trust Vector</div>
 <div className="grid grid-cols-2 gap-2">
 {Object.entries((selectedNode.properties as any).trust).map(([key, val]) => (
 <div key={key} className="bg-white/5 rounded px-2 py-1 flex justify-between items-center">
 <span className="text-[10px] text-white/60 capitalize">{key}</span>
 <span className="text-[10px] font-mono text-emerald-400">{(val as number).toFixed(2)}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 
 {selectedNode.type === 'Capability' && (selectedNode.properties as any).certification && (
 <div className="mb-4">
 <div className="text-label text-white/50 mb-1">Certification</div>
 <div className="inline-block px-2 py-1 rounded text-label font-bold bg-blue-500/20 text-blue-400">
 {(selectedNode.properties as any).certification}
 </div>
 </div>
 )}

 <div className="text-label text-white/50 mb-1 mt-4">Raw State</div>
 <pre className="bg-white/5 p-3 rounded-lg text-[10px] font-mono overflow-x-auto border border-white/10 text-white/70">
 {JSON.stringify(selectedNode.properties, null, 2)}
 </pre>
 </div>
 </div>
 </div>
 ) : (
 <div className="flex-1 flex flex-col items-center justify-center text-white/20">
 <Database className="w-12 h-12 mb-4 opacity-50" />
 <p className="text-center text-secondary">Click any node on the map<br/>to inspect its state.</p>
 </div>
 )}
 </div>

 {/* Main Area */}
 <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-black to-black">
 {viewMode === 'advanced' ? (
 <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 z-10" preserveAspectRatio="xMidYMid meet">
 {/* Edges */}
 {edges.map(edge => {
 const source = nodePositions.get(edge.source);
 const target = nodePositions.get(edge.target);
 if (!source || !target) return null;
 return (
 <g key={edge.id}>
 <line 
 x1={source.x} y1={source.y} 
 x2={target.x} y2={target.y} 
 stroke="rgba(255,255,255,0.1)" 
 strokeWidth="1"
 />
 <text 
 x={(source.x + target.x) / 2} 
 y={(source.y + target.y) / 2 - 5}
 fill="rgba(255,255,255,0.3)"
 fontSize="8"
 textAnchor="middle"
 >
 {edge.predicate}
 </text>
 </g>
 )
 })}
 
 {/* Nodes */}
 {nodes.map(node => {
 const pos = nodePositions.get(node.id);
 if (!pos) return null;
 const isSelected = selectedNode?.id === node.id;
 return (
 <g 
 key={node.id} 
 transform={`translate(${pos.x}, ${pos.y})`}
 onClick={() => setSelectedNode(node)}
 className="cursor-pointer transition-transform hover:scale-110"
 >
 {isSelected && (
 <circle r="20" fill="none" stroke={pos.color} strokeWidth="1" className="animate-ping opacity-50" />
 )}
 <circle 
 r="12" 
 fill={`${pos.color}30`}
 stroke={pos.color} 
 strokeWidth={isSelected ? "3" : "1.5"} 
 />
 <circle r="4" fill={pos.color} />
 <text 
 y="24" 
 fill="rgba(255,255,255,0.7)" 
 fontSize="10" 
 textAnchor="middle"
 className="font-mono drop-shadow-md"
 >
 {node.properties?.name || node.id.split('_')[0] + '...'}
 </text>
 </g>
 )
 })}
 </svg>
 ) : (
 <div className="absolute inset-0 z-10 p-12 overflow-y-auto bg-gradient-to-br from-black/80 via-black to-purple-950/20 backdrop-blur-md">
 <div className="max-w-5xl mx-auto mt-8">
 <div className="flex items-center gap-5 mb-12">
 <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
 <Globe2 className="w-7 h-7 text-white" />
 </div>
 <div>
 <h2 className="text-display tracking-tight">World Overview</h2>
 <p className="text-white/50 text-secondary mt-2 font-medium">Real-time mapping of capabilities and processes</p>
 </div>
 </div>
 
 <div className="grid grid-cols-2 gap-8">
 {/* Active Work Card */}
 <div className="relative group">
 <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent opacity-20 blur-2xl rounded-[32px] transition-opacity duration-500 group-hover:opacity-40" />
 <div className="relative bg-black/40 border border-white/10 rounded-[32px] p-8 backdrop-blur-xl flex flex-col h-[500px]">
 <div className="flex items-center gap-4 mb-8">
 <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
 <Activity className="w-5 h-5 text-emerald-400" />
 </div>
 <h3 className="text-page text-white tracking-tight">Active Work</h3>
 </div>
 <div className="space-y-4 overflow-y-auto flex-1 pr-2">
 {nodes.filter(n => n.type === 'Process').map(n => (
 <div key={n.id} className="bg-white/[0.03] p-5 rounded-2xl border border-white/5 hover:bg-white/[0.06] transition-colors group/item relative overflow-hidden">
 <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50 scale-y-0 group-hover/item:scale-y-100 transition-transform origin-top" />
 <div className="text-body font-medium">{n.properties?.name || n.id}</div>
 <div className="flex items-center gap-2 mt-2">
 <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-label text-white/50 capitalize ">{n.properties?.state || 'Running'}</span>
 </div>
 </div>
 ))}
 {nodes.filter(n => n.type === 'Process').length === 0 && (
 <div className="flex flex-col items-center justify-center h-[300px] text-white/20">
 <div className="relative mb-6">
 <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
 <Activity className="w-16 h-16 opacity-80 text-emerald-400 relative z-10" />
 </div>
 <div className="text-workspace text-white/70 tracking-tight">System Idle</div>
 <div className="text-secondary font-medium mt-1">Ready to execute new tasks</div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Available Services Card */}
 <div className="relative group">
 <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 to-transparent opacity-20 blur-2xl rounded-[32px] transition-opacity duration-500 group-hover:opacity-40" />
 <div className="relative bg-black/40 border border-white/10 rounded-[32px] p-8 backdrop-blur-xl flex flex-col h-[500px]">
 <div className="flex items-center gap-4 mb-8">
 <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
 <Network className="w-5 h-5 text-purple-400" />
 </div>
 <h3 className="text-page text-white tracking-tight">Available Services</h3>
 </div>
 <div className="space-y-4 overflow-y-auto flex-1 pr-2">
 {nodes.filter(n => n.type === 'Entity').map(n => (
 <div key={n.id} className="bg-white/[0.03] p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/[0.06] transition-colors group/item relative overflow-hidden">
 <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50 scale-y-0 group-hover/item:scale-y-100 transition-transform origin-top" />
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
 <Globe2 className="w-5 h-5 text-purple-400" />
 </div>
 <div className="text-body font-medium">{n.properties?.name || n.id.replace('provider.', '')}</div>
 </div>
 <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
 Ready
 </div>
 </div>
 ))}
 {nodes.filter(n => n.type === 'Entity').length === 0 && (
 <div className="flex flex-col items-center justify-center h-[300px] text-white/20">
 <div className="relative mb-6">
 <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
 <Globe2 className="w-16 h-16 opacity-80 text-purple-400 relative z-10" />
 </div>
 <div className="text-workspace text-white/70 tracking-tight">Discovering</div>
 <div className="text-secondary font-medium mt-1">Waiting for capability providers</div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default WorldExplorer;
