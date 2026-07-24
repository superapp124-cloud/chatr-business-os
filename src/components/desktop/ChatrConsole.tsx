import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Phone, Sparkles, FileText, Calendar, BrainCircuit, Play, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { aiEngine, ExecutionPlan } from '@/lib/ai/ExecutionEngine';
import { ApprovalQueue } from '@/components/desktop/ApprovalQueue';
import { motion, AnimatePresence } from 'framer-motion';

// Mock Predictive Context
const zeroStateContext = [
 { icon: <FileText className="w-4 h-4 text-orange-500" />, label: 'Summarize pasted notes', type: 'ChatrAI' },
 { icon: <Calendar className="w-4 h-4 text-blue-500" />, label: 'Plan follow-up steps', type: 'ChatrAI' },
 { icon: <MessageSquare className="w-4 h-4 text-emerald-500" />, label: 'Draft a careful reply', type: 'ChatrAI' },
];

export const ChatrConsole: React.FC = () => {
 const [isOpen, setIsOpen] = useState(false);
 const [query, setQuery] = useState('');
 const [activeMode, setActiveMode] = useState<'Universal' | 'Communication' | 'Action' | 'AI'>('Universal');
 const [activePlan, setActivePlan] = useState<ExecutionPlan | null>(null);
 const navigate = useNavigate();

 // Toggle palette on Cmd/Ctrl + K or Space
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 setIsOpen((prev) => !prev);
 }
 if (e.key === 'Escape') {
 setIsOpen(false);
 setTimeout(() => setActivePlan(null), 300);
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [isOpen]);

 // Effect to automatically switch modes based on Intent Parsing (simulated)
 useEffect(() => {
 const q = query.toLowerCase();
 if (q.startsWith('prepare') || q.startsWith('draft')) {
 setActiveMode('Action');
 } else if (q.startsWith('summarize') || q.startsWith('ai')) {
 setActiveMode('AI');
 } else if (q.includes('john') || q.includes('sarah')) {
 setActiveMode('Communication');
 } else {
 setActiveMode('Universal');
 }
 }, [query]);

 const handleExecute = () => {
 if (query.trim()) {
 const plan = aiEngine.generatePlan(query, {}, 'recruitment');
 setActivePlan(plan);
 aiEngine.executePlan(plan, (updatedPlan) => {
 setActivePlan({ ...updatedPlan });
 });
 }
 };

 const renderDynamicContent = () => {
 if (activePlan) {
 return (
 <div className="h-[450px]">
 <ApprovalQueue plan={activePlan} onUpdatePlan={(updated) => setActivePlan({...updated})} />
 </div>
 );
 }

 if (!query) {
 // ZERO STATE: Predictive Suggestions
 return (
 <div className="space-y-4">
 <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
 <Sparkles className="w-3 h-3 text-[#5c22ff]" />
 ChatrAI Suggestions
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-2">
 {zeroStateContext.map((item, i) => (
 <Card key={i} className="p-3 cursor-pointer hover:border-[#5c22ff] hover:shadow-md transition-all group">
 <div className="flex flex-col gap-2">
 <div className="p-2 bg-slate-50 rounded-lg w-fit group-hover:bg-[#5c22ff]/5 border border-slate-100">
 {item.icon}
 </div>
 <span className="font-semibold text-slate-700 text-secondary">{item.label}</span>
 </div>
 </Card>
 ))}
 </div>
 </div>
 );
 }

 if (activeMode === 'Communication') {
 return (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
 <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
 <MessageSquare className="w-3 h-3 text-emerald-500" />
 Communication Graph: {query}
 </div>
 <div className="flex gap-2 px-2 overflow-x-auto pb-2">
 <Button variant="outline" className="gap-2 shrink-0"><Phone className="w-4 h-4"/> Call</Button>
 <Button variant="outline" className="gap-2 shrink-0"><MessageSquare className="w-4 h-4"/> Message</Button>
 <Button variant="outline" className="gap-2 shrink-0"><FileText className="w-4 h-4"/> Recent Files</Button>
 <Button variant="outline" className="gap-2 shrink-0"><Calendar className="w-4 h-4"/> Meeting Notes</Button>
 <Button variant="outline" className="gap-2 shrink-0 border-[#5c22ff] text-[#5c22ff]"><Sparkles className="w-4 h-4"/> ChatrAI Summary</Button>
 </div>
 </div>
 );
 }

 if (activeMode === 'Action') {
 return (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
 <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
 <Play className="w-3 h-3 text-[#5c22ff]" />
 ChatrAI Execution Engine
 </div>
 <div className="px-2">
 <div className="bg-slate-50 border rounded-xl p-4 flex flex-col gap-3">
 <div className="text-secondary font-medium text-slate-700">Ready to orchestrate workflow for:</div>
 <div className="font-semibold text-[#5c22ff] italic line-clamp-1">"{query}"</div>
 <Button onClick={handleExecute} className="w-full bg-[#5c22ff] hover:bg-[#4b1ac4] mt-2 h-10">
 Generate Execution Plan <ArrowRight className="w-4 h-4 ml-2" />
 </Button>
 </div>
 </div>
 </div>
 );
 }

 // Default Universal Search
 return (
 <div className="space-y-1">
 <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
 Universal Search Results
 </div>
 <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#5c22ff]/5 group transition-colors text-left">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
 <BrainCircuit className="w-4 h-4 text-[#5c22ff]" />
 </div>
 <span className="font-semibold text-slate-700">Search "{query}" in ChatrAI memory</span>
 </div>
 <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">Memory</span>
 </button>
 </div>
 );
 };

 return (
 <AnimatePresence>
 {isOpen && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
 {/* iOS 27 Deep Blur Overlay */}
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.3 }}
 className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-2xl"
 onClick={() => setIsOpen(false)}
 />
 
 {/* Console Window */}
 <motion.div 
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 10 }}
 transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
 className="relative w-full max-w-3xl glass-panel overflow-hidden border-white/10 dark:border-white/5"
 >
 
 {/* Input Area */}
 <div className="flex items-center px-6 border-b border-slate-200/50 dark:border-white/10 relative">
 {/* Subtle ambient glow behind input */}
 <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />
 
 <Search className="w-6 h-6 text-[#5c22ff] dark:text-purple-400 shrink-0 relative z-10" />
 <input 
 autoFocus
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 if (activeMode === 'Action' || query.toLowerCase().includes('hire')) {
 handleExecute();
 }
 }
 }}
 placeholder="Ask ChatrAI to search, summarize, draft, or automate..."
 className="w-full h-20 px-4 text-page bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium relative z-10"
 />
 <kbd className="hidden sm:inline-flex items-center gap-1 bg-slate-100/50 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded px-2 py-1 text-label font-mono font-bold uppercase tracking-wider relative z-10">
 ESC
 </kbd>
 </div>

 {/* Dynamic Context Area */}
 <div className="p-4 bg-transparent min-h-[200px] max-h-[60vh] overflow-y-auto custom-scrollbar">
 {renderDynamicContent()}
 </div>

 {/* Footer */}
 <div className="bg-slate-50/50 dark:bg-black/20 border-t border-slate-200/50 dark:border-white/10 px-6 py-4 flex items-center justify-between text-label text-slate-500 dark:text-slate-400 backdrop-blur-md">
 <div className="flex items-center gap-4">
 <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#5c22ff] dark:text-purple-400" /> ChatrAI Console</span>
 </div>
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-1.5">
 <kbd className="bg-white/50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 shadow-sm font-mono text-[10px]">Enter</kbd>
 <span>to select</span>
 </div>
 <div className="flex items-center gap-1.5">
 <kbd className="bg-white/50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 shadow-sm font-mono text-[10px]">Up</kbd>
 <kbd className="bg-white/50 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 shadow-sm font-mono text-[10px]">Down</kbd>
 <span>to navigate</span>
 </div>
 </div>
 </div>

 </motion.div>
 </div>
 )}
 </AnimatePresence>
 );
};
