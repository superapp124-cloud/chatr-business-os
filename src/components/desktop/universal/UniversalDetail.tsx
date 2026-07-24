import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Trash2, Clock, MessageSquare, Paperclip, Sparkles, Circle, Check, ShieldAlert, CheckCircle2, ChevronDown, CheckSquare, Users, Cpu } from 'lucide-react';
import { IObjectDefinition } from '../../../sdk/types';
import { BusinessObjectStore } from '../../../sdk/engines/BusinessObjectStore';
import { StateMachineEngine } from '../../../sdk/engines/StateMachineEngine';
import { PolicyEngine } from '../../../sdk/engines/PolicyEngine';

interface Props {
 capabilityId: string;
 objectDefinition: IObjectDefinition;
 recordId: string;
 onBack?: () => void;
 onEdit?: (record: Record<string, any>) => void;
}

export const UniversalDetail: React.FC<Props> = ({ capabilityId, objectDefinition, recordId, onBack, onEdit }) => {
 const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'related' | 'ai'>('overview');
 const [record, setRecord] = useState<Record<string, any> | null>(null);
 const [aiInput, setAiInput] = useState('');
 const [aiChat, setAiChat] = useState<{role: string, text: string}[]>([]);

 useEffect(() => {
 const data = BusinessObjectStore.get(capabilityId, objectDefinition.name, recordId);
 setRecord(data || null);
 }, [recordId, objectDefinition, capabilityId]);

 if (!record) return <div className="p-8 text-zinc-500 animate-pulse">Loading record details...</div>;

 const titleField = objectDefinition.fields.find(f => f.type === 'string')?.name || 'title';
 const statusField = objectDefinition.fields.find(f => f.name === 'status' || f.name === 'state')?.name || 'status';

 const handleAiSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!aiInput.trim()) return;
 
 setAiChat(prev => [...prev, { role: 'user', text: aiInput }]);
 setAiInput('');
 
 // Simulate AI response
 setTimeout(() => {
 setAiChat(prev => [...prev, { role: 'ai', text: `Based on this ${objectDefinition.name}, here is a summary: ${record[titleField]} is currently ${record[statusField]}.` }]);
 }, 800);
 };

 return (
 <div className="h-full flex flex-col bg-[#09090b] text-zinc-400">
 {/* Header */}
 <div className="sticky top-0 bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-800/80 z-10 px-8 py-5 flex items-center justify-between">
 <div className="flex items-center gap-5">
 <button onClick={onBack} className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors"><ArrowLeft size={20} /></button>
 <h1 className="text-page text-white tracking-tight">{record[titleField] || record.id}</h1>
 <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-label font-semibold border border-indigo-500/20 uppercase tracking-wider">{record[statusField]}</span>
 </div>
 <div className="flex items-center gap-3">
 {/* We remove scattered buttons here to favor the Universal Action Bar */}
 </div>
 </div>

 {/* Phase 8: Universal Action Bar */}
 <div className="px-8 flex items-center border-b border-zinc-800/60 bg-zinc-950/20">
 <button onClick={() => alert('Review workflow initiated.')} className="px-5 py-3.5 text-secondary font-semibold text-zinc-300 hover:text-white border-b-2 border-transparent hover:border-zinc-500 transition-all flex items-center gap-2">
 <CheckSquare size={16} className="text-zinc-500" /> Review
 </button>
 <button 
 onClick={() => {
 if (record._pendingPolicy) {
 const r = { ...record };
 delete r._pendingPolicy;
 BusinessObjectStore.update(capabilityId, objectDefinition.name, record.id, r);
 setRecord(BusinessObjectStore.get(capabilityId, objectDefinition.name, record.id) || null);
 } else {
 alert('Record is already approved / no pending policies.');
 }
 }}
 className={`px-5 py-3.5 text-secondary font-semibold transition-all flex items-center gap-2 border-b-2 ${record._pendingPolicy ? 'text-amber-400 border-amber-500 bg-amber-500/10' : 'text-zinc-300 hover:text-white border-transparent hover:border-zinc-500'}`}
 >
 <CheckCircle2 size={16} className={record._pendingPolicy ? "text-amber-500" : "text-zinc-500"} /> Approve
 </button>
 <button onClick={() => alert('Delegation dialog opened.')} className="px-5 py-3.5 text-secondary font-semibold text-zinc-300 hover:text-white border-b-2 border-transparent hover:border-zinc-500 transition-all flex items-center gap-2">
 <Users size={16} className="text-zinc-500" /> Delegate
 </button>
 <button onClick={() => alert('Discussion thread opened.')} className="px-5 py-3.5 text-secondary font-semibold text-zinc-300 hover:text-white border-b-2 border-transparent hover:border-zinc-500 transition-all flex items-center gap-2">
 <MessageSquare size={16} className="text-zinc-500" /> Discuss
 </button>
 <button onClick={() => alert('Automation builder opened.')} className="px-5 py-3.5 text-secondary font-semibold text-zinc-300 hover:text-white border-b-2 border-transparent hover:border-zinc-500 transition-all flex items-center gap-2">
 <Cpu size={16} className="text-zinc-500" /> Automate
 </button>
 
 <div className="ml-auto">
 <button className="px-5 py-3.5 text-button font-semibold text-zinc-400 hover:text-white transition-all flex items-center gap-2">
 More <ChevronDown size={14} />
 </button>
 </div>
 </div>

 {/* Policy Engine Approval UI (ABI v1.0) */}
 {record._pendingPolicy && (() => {
 const policies = PolicyEngine.getPolicies(capabilityId);
 const policy = policies.find(p => p.id === record._pendingPolicy);
 
 return (
 <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-4 flex items-center justify-between">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
 <ShieldAlert className="text-amber-500" size={20} />
 </div>
 <div>
 <h3 className="text-amber-500 font-bold text-secondary">Action Requires Approval</h3>
 <p className="text-amber-200/70 text-secondary mt-0.5">
 This transition triggered a policy: <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded text-amber-300">{policy?.condition || record._pendingPolicy}</span>
 </p>
 {policy?.effect.role && (
 <p className="text-amber-500/80 text-label mt-2 flex items-center gap-1.5">
 <Circle size={10} className="fill-amber-500/50" />
 Awaiting authorization from: <span className="text-amber-400 font-bold">{policy.effect.role}</span>
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-3">
 <button 
 onClick={() => {
 const r = { ...record };
 delete r._pendingPolicy;
 r[statusField] = machine?.initialState || 'Draft'; // basic rollback
 BusinessObjectStore.update(capabilityId, objectDefinition.name, record.id, r);
 setRecord(BusinessObjectStore.get(capabilityId, objectDefinition.name, record.id) || null);
 }}
 className="px-5 py-2.5 bg-[#09090b] border border-amber-500/30 hover:bg-amber-500/10 text-amber-500 text-secondary font-bold rounded-xl transition-colors"
 >
 Cancel Transition
 </button>
 <button 
 onClick={() => {
 const r = { ...record };
 delete r._pendingPolicy;
 // We simulate approval by removing the flag
 BusinessObjectStore.update(capabilityId, objectDefinition.name, record.id, r);
 setRecord(BusinessObjectStore.get(capabilityId, objectDefinition.name, record.id) || null);
 }}
 className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-secondary font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2"
 >
 <CheckCircle2 size={16} /> Authorize (Admin Override)
 </button>
 </div>
 </div>
 );
 })()}

 {/* State Machine UI (ABI v1.0) */}
 {(() => {
 const machine = StateMachineEngine.getMachine(capabilityId, objectDefinition.name);
 const currentState = record[statusField];
 if (!machine || !machine.states) return null;
 
 const allStates = Object.keys(machine.states);
 let currentIndex = allStates.indexOf(currentState);
 if (currentIndex === -1) currentIndex = 0; // fallback if unknown state

 return (
 <div className="px-12 py-8 bg-zinc-950/50 border-b border-zinc-800/80">
 <div className="flex items-center justify-between relative max-w-4xl mx-auto">
 {/* Progress Line */}
 <div className="absolute left-0 top-4 -translate-y-1/2 w-full h-1 bg-zinc-800/60 rounded-full overflow-hidden">
 <div 
 className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
 style={{ width: `${(currentIndex / (Math.max(1, allStates.length - 1))) * 100}%` }}
 />
 </div>

 {/* Steps */}
 {allStates.map((stateName, idx) => {
 const isCompleted = idx < currentIndex;
 const isCurrent = idx === currentIndex;
 
 return (
 <div key={stateName} className="relative z-10 flex flex-col items-center gap-3 w-32 -ml-16 first:ml-0 last:mr-0">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-label font-bold transition-all duration-500 ${
 isCompleted ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 
 isCurrent ? 'bg-[#09090b] border-2 border-indigo-400 text-indigo-400 scale-110 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 
 'bg-[#09090b] border-2 border-zinc-800 text-zinc-500'
 }`}>
 {isCompleted ? <Check size={14} strokeWidth={3} /> : (idx + 1)}
 </div>
 <span className={`text-[10px] font-bold uppercase tracking-wider text-center ${
 isCompleted || isCurrent ? 'text-zinc-200' : 'text-zinc-600'
 }`}>
 {stateName}
 </span>
 </div>
 );
 })}
 </div>
 </div>
 );
 })()}

 {/* Tabs */}
 <div className="px-8 pt-4 border-b border-zinc-800/80 flex gap-8">
 {['overview', 'activity', 'related', 'ai'].map(tab => (
 <button 
 key={tab} 
 onClick={() => setActiveTab(tab as any)}
 className={`pb-3 capitalize font-medium transition-all border-b-2 text-secondary ${activeTab === tab ? 'text-indigo-400 border-indigo-500' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
 >
 {tab}
 </button>
 ))}
 </div>

 {/* Content Area */}
 <div className="flex-1 overflow-y-auto p-8">
 {activeTab === 'overview' && (
 <div className="grid grid-cols-2 gap-x-12 gap-y-8 max-w-4xl">
 {objectDefinition.fields.map(f => {
 let displayValue = record[f.name] || '—';
 if (f.type === 'reference' && record[f.name] && capabilityId && f.referenceTo) {
 const refRec = BusinessObjectStore.get(capabilityId, f.referenceTo, record[f.name]);
 if (refRec) {
 displayValue = refRec.Title || refRec.Name || refRec.Summary || refRec.Label || record[f.name];
 }
 }
 return (
 <div key={f.name} className="flex flex-col gap-1.5 p-4 rounded-xl hover:bg-zinc-900/40 transition-colors border border-transparent hover:border-zinc-800/50">
 <span className="text-label uppercase tracking-wider text-zinc-500 font-semibold">{f.label || f.name}</span>
 <span className={`text-section font-medium ${f.type === 'reference' ? 'text-indigo-400' : 'text-zinc-200'}`}>{displayValue}</span>
 </div>
 );
 })}
 </div>
 )}

 {activeTab === 'activity' && (
 <div className="max-w-2xl mt-4">
 <div className="relative pl-8 border-l border-zinc-800 space-y-10 py-4">
 {(record._history || [{type: 'created', timestamp: record._createdAt || new Date().toISOString(), details: 'Record created'}]).slice().reverse().map((evt: any, i: number) => (
 <div key={i} className="relative group">
 <div className={`absolute -left-[37px] p-1.5 rounded-full border-4 border-[#09090b] transition-shadow ${
 evt.type === 'created' ? 'bg-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)]' :
 evt.type === 'state_change' ? 'bg-emerald-500' :
 evt.type === 'policy_approval_requested' ? 'bg-amber-500' :
 'bg-zinc-700'
 }`}>
 {evt.type === 'created' ? <Circle size={10} className="text-white fill-white" /> :
 evt.type === 'state_change' ? <Check size={10} className="text-white" /> :
 evt.type === 'policy_approval_requested' ? <Shield size={10} className="text-white" /> :
 <Clock size={10} className="text-white" />}
 </div>
 <div className="text-white font-medium mb-1 capitalize">{evt.type.replace(/_/g, ' ')}</div>
 <div className="text-secondary text-zinc-500">{new Date(evt.timestamp).toLocaleString()} by {evt.actor || 'system'}</div>
 <div className="mt-2 text-secondary text-zinc-400 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">{evt.details}</div>
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'related' && (
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
 {objectDefinition.relations?.map(r => (
 <div key={r.name} className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 hover:border-zinc-700 transition-colors group">
 <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
 <Paperclip size={24} className="text-zinc-500 group-hover:text-zinc-400" />
 </div>
 <div>
 <h3 className="text-white font-medium capitalize mb-1">{r.name}</h3>
 <p className="text-zinc-500 text-secondary">No {r.targetObject} linked yet.</p>
 </div>
 <button className="mt-2 px-5 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-button hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700">Add Link</button>
 </div>
 )) || (
 <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
 <Paperclip size={32} className="mb-4 opacity-20" />
 <p>No relations defined for this object.</p>
 </div>
 )}
 </div>
 )}

 {activeTab === 'ai' && (
 <div className="flex flex-col h-full max-w-3xl mx-auto -mx-8 -my-8 px-8 py-8 bg-zinc-900/20">
 <div className="flex-1 flex flex-col gap-6 mb-6 overflow-y-auto">
 {aiChat.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
 <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
 <Sparkles size={32} className="text-indigo-400" />
 </div>
 <p className="text-section">Ask AI about this record...</p>
 <p className="text-secondary text-zinc-600 text-center max-w-sm">You can ask for summaries, analysis, or to extract specific information from this object.</p>
 </div>
 ) : (
 aiChat.map((msg, i) => (
 <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
 <div className={`px-5 py-3.5 rounded-2xl max-w-[85%] text-secondary shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-zinc-900 text-zinc-200 rounded-tl-sm border border-zinc-800'}`}>
 {msg.role === 'ai' && <Sparkles size={16} className="inline mr-2.5 text-indigo-400 mb-0.5" />}
 {msg.text}
 </div>
 </div>
 ))
 )}
 </div>
 <form onSubmit={handleAiSubmit} className="relative mt-auto">
 <input 
 type="text" 
 value={aiInput}
 onChange={e => setAiInput(e.target.value)}
 placeholder="Message AI assistant..."
 className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-5 pr-14 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-lg"
 />
 <button type="submit" disabled={!aiInput.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-colors">
 <MessageSquare size={18} />
 </button>
 </form>
 </div>
 )}
 </div>
 </div>
 );
};
