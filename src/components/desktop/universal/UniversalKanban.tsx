import React, { useState, useEffect, useRef } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import { IObjectDefinition } from '../../../sdk/types';
import { BusinessObjectStore } from '../../../sdk/engines/BusinessObjectStore';

interface Props {
 capabilityId: string;
 objectDefinition: IObjectDefinition;
 onRecordClick?: (record: Record<string, any>) => void;
}

const COLORS = [
 { border: 'border-indigo-500/50', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
 { border: 'border-violet-500/50', bg: 'bg-violet-500/10', text: 'text-violet-400' },
 { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
 { border: 'border-amber-500/50', bg: 'bg-amber-500/10', text: 'text-amber-400' },
 { border: 'border-rose-500/50', bg: 'bg-rose-500/10', text: 'text-rose-400' },
 { border: 'border-cyan-500/50', bg: 'bg-cyan-500/10', text: 'text-cyan-400' }
];

export const UniversalKanban: React.FC<Props> = ({ capabilityId, objectDefinition, onRecordClick }) => {
 const [records, setRecords] = useState<Record<string, any>[]>([]);
 const [draggedId, setDraggedId] = useState<string | null>(null);
 const [dragOverCol, setDragOverCol] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);

 const statusField = objectDefinition.fields.find(f => f.name === 'status' || f.name === 'state') || objectDefinition.fields[0];
 const titleField = objectDefinition.fields.find(f => f.type === 'string') || objectDefinition.fields[0];
 const columns = statusField?.options || ['Todo', 'In Progress', 'Done'];

 useEffect(() => {
 // Load live records from Kernel
 setRecords(BusinessObjectStore.list(capabilityId, objectDefinition.name));
 }, [capabilityId, objectDefinition]);

 const handleDragStart = (e: React.DragEvent, id: string) => {
 setDraggedId(id);
 e.dataTransfer.effectAllowed = 'move';
 // Small delay to keep the ghost image intact while making original transparent
 setTimeout(() => {
 const el = document.getElementById(`card-${id}`);
 if (el) el.style.opacity = '0.4';
 }, 0);
 };

 const handleDragEnd = (e: React.DragEvent, id: string) => {
 const el = document.getElementById(`card-${id}`);
 if (el) el.style.opacity = '1';
 setDraggedId(null);
 setDragOverCol(null);
 };

 const handleDragOver = (e: React.DragEvent, col: string) => {
 e.preventDefault();
 if (dragOverCol !== col) setDragOverCol(col);
 };

 const handleDrop = (e: React.DragEvent, col: string) => {
 e.preventDefault();
 if (!draggedId) return;

 setError(null);
 try {
 // 1. Dispatch update to Kernel
 BusinessObjectStore.update(capabilityId, objectDefinition.name, draggedId, { [statusField.name]: col });
 
 // 2. If successful, reload state
 setRecords(BusinessObjectStore.list(capabilityId, objectDefinition.name));
 } catch (err: any) {
 // 3. Catch State Machine / Policy rejections
 setError(err.message || 'Transition blocked');
 }
 
 const el = document.getElementById(`card-${draggedId}`);
 if (el) el.style.opacity = '1';
 
 setDraggedId(null);
 setDragOverCol(null);
 };

 return (
 <div className="flex flex-col h-full bg-[#09090b] relative">
 {error && (
 <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-500 text-white px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-top-4">
 <span>⚠️ {error}</span>
 <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100">✕</button>
 </div>
 )}
 <div className="flex gap-6 h-full p-6 overflow-x-auto">
 {columns.map((col, idx) => {
 const colRecords = records.filter(r => r[statusField.name] === col);
 const theme = COLORS[idx % COLORS.length];

 return (
 <div 
 key={col} 
 className={`flex flex-col w-80 shrink-0 bg-zinc-900/40 rounded-2xl border-2 transition-colors duration-200 backdrop-blur-sm ${dragOverCol === col ? 'border-indigo-500 bg-zinc-900/60' : 'border-zinc-800/50'}`}
 onDragOver={(e) => handleDragOver(e, col)}
 onDrop={(e) => handleDrop(e, col)}
 onDragLeave={() => setDragOverCol(null)}
 >
 <div className={`p-4 flex items-center justify-between border-b ${theme.border}`}>
 <h3 className="font-semibold text-white tracking-wide">{col}</h3>
 <span className={`text-label px-2.5 py-1 rounded-full ${theme.bg} ${theme.text}`}>
 {colRecords.length}
 </span>
 </div>
 
 <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto min-h-[200px] scrollbar-thin scrollbar-thumb-zinc-700">
 {colRecords.map(record => (
 <div 
 key={record.id}
 id={`card-${record.id}`}
 draggable
 onDragStart={(e) => handleDragStart(e, record.id)}
 onDragEnd={(e) => handleDragEnd(e, record.id)}
 onClick={() => onRecordClick && onRecordClick(record)}
 className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl cursor-grab active:cursor-grabbing hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 hover:border-zinc-700 transition-all group"
 >
 <div className="flex items-start justify-between">
 <h4 className="text-zinc-200 font-medium mb-3 leading-snug group-hover:text-white transition-colors">{record[titleField.name]}</h4>
 <GripVertical className="text-zinc-600 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
 </div>
 <div className="flex gap-2 text-label">
 <span className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">{record.id}</span>
 </div>
 </div>
 ))}
 </div>

 <div className="p-3">
 <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700/80 text-zinc-500 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/50 transition-all">
 <Plus size={16} />
 <span className="font-medium">Add</span>
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
};
