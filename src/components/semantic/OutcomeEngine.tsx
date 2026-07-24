import React, { useState, useEffect } from 'react';
import { projectionStore, ProjectionState } from '@/core/intent/projectionStore';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, FileText, Bell, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

export function OutcomeEngine() {
 const [state, setState] = useState<ProjectionState>(projectionStore.getState());
 const [suggestionRenderedAt, setSuggestionRenderedAt] = useState<number | null>(null);
 
 // Local queue derived from candidates
 const [queue, setQueue] = useState<any[]>([]);
 const [isEditing, setIsEditing] = useState(false);
 const [editTitle, setEditTitle] = useState('');

 useEffect(() => {
 return projectionStore.subscribe(state => {
 setState({ ...state });
 
 const incoming = state.activeSuggestion?.candidates || (state.activeSuggestion ? [state.activeSuggestion] : []);
 
 if (incoming.length > 0 && queue.length === 0) {
 setQueue(incoming);
 setSuggestionRenderedAt(Date.now());
 } else if (incoming.length === 0 && queue.length > 0) {
 setQueue([]);
 setSuggestionRenderedAt(null);
 setIsEditing(false);
 }
 });
 }, [state.activeSuggestion]);

 const suggestion = queue[0];

 useEffect(() => {
 if (suggestion) {
 setEditTitle(suggestion.title);
 setIsEditing(false);
 setSuggestionRenderedAt(Date.now());
 toast.success('7. Engine: Rendered suggestion: ' + suggestion.title);
 }
 }, [suggestion]);

 if (!suggestion || !state.isReady) {
 return null;
 }

 const handleConfirm = async () => {
 try {
 const timeToConfirm = suggestionRenderedAt ? (Date.now() - suggestionRenderedAt) / 1000 : 0;
 const isManualEdit = editTitle !== suggestion.title;
 
 const payload = {
 action: { type: suggestion.action, entities: suggestion.entities || {} },
 payload: { ...suggestion.payload, title: editTitle, timeToConfirm, isEdited: isManualEdit, action: 'CONFIRMED' },
 correlationId: state.activeCorrelationId
 };

 const response = await fetch('http://localhost:8087/kernel/action', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload)
 });

 if (!response.ok) {
 throw new Error('Action failed');
 }

 toast.success(`${editTitle} confirmed`);
 
 // Inject success summary back into conversation UI via a custom event, or handled by the parent
 window.dispatchEvent(new CustomEvent('chatr:outcome-executed', { detail: { text: `✓ ${editTitle} (${suggestion.type.toLowerCase()})`, type: suggestion.type, raw: suggestion }}));

 popQueue();
 } catch (err) {
 toast.error('Failed to confirm action');
 }
 };

 const handleDismiss = async () => {
 toast.info('Suggestion dismissed');
 const timeToDismiss = suggestionRenderedAt ? (Date.now() - suggestionRenderedAt) / 1000 : 0;
 
 try {
 await fetch('http://localhost:8087/kernel/action', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 action: { type: 'DISMISS_SUGGESTION' },
 payload: { timeToDismiss, action: 'DISMISSED' },
 correlationId: state.activeCorrelationId
 })
 });
 } catch (e) {
 console.error('Failed to report dismiss', e);
 }
 
 popQueue();
 };

 const popQueue = () => {
 const newQueue = queue.slice(1);
 setQueue(newQueue);
 if (newQueue.length === 0) {
 projectionStore.reset();
 }
 };

 const Icon = {
 'MEETING': Calendar,
 'TASK': CheckCircle2,
 'DOCUMENT': FileText,
 'REMINDER': Bell
 }[suggestion.type] || CheckCircle2;

 return (
 <div className="w-full flex justify-center my-4">
 <AnimatePresence mode="wait">
 <motion.div 
 key={suggestion.title + suggestion.type}
 initial={{ opacity: 0, y: 20, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -20, scale: 0.95 }}
 transition={{ duration: 0.2 }}
 className="bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl overflow-hidden w-full max-w-sm"
 >
 {/* Glanceable Card Layout */}
 <div className="p-4">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3 w-full">
 <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
 <Icon className="w-5 h-5 text-emerald-400" />
 </div>
 <div className="flex-1 min-w-0 pr-4">
 {isEditing ? (
 <input 
 autoFocus
 value={editTitle}
 onChange={(e) => setEditTitle(e.target.value)}
 className="text-white font-medium bg-zinc-800 border-none outline-none rounded px-2 w-full mb-1 text-secondary"
 onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
 />
 ) : (
 <div className="group flex items-center gap-2 cursor-pointer" onClick={() => setIsEditing(true)}>
 <h3 className="text-white font-medium truncate">{editTitle}</h3>
 <Edit3 className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
 </div>
 )}
 <p className="text-zinc-400 text-secondary truncate">{suggestion.context}</p>
 </div>
 </div>
 
 <button 
 onClick={handleDismiss}
 className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
 >
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M18 6L6 18M6 6l12 12"/>
 </svg>
 </button>
 </div>
 {queue.length > 1 && (
 <div className="mt-3 text-label text-emerald-500/80">
 + {queue.length - 1} more suggestions queued
 </div>
 )}
 </div>

 {/* 1-Tap Action Area */}
 <div className="bg-zinc-950 p-2">
 <Button 
 onClick={handleConfirm}
 className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl"
 >
 Confirm
 </Button>
 </div>
 </motion.div>
 </AnimatePresence>
 </div>
 );
}
