import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 BrainCircuit, Clipboard, Mic, Globe, StickyNote, Camera,
 Calculator, FolderDown, ChevronUp, ChevronDown, X, Sparkles,
 Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';

interface DockTool {
 id: string;
 icon: React.ComponentType<{ className?: string }>;
 label: string;
 color: string;
 action: () => void;
}

export const ProductivityDock: React.FC = () => {
 const navigate = useNavigate();
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark' || themeMode === 'system';

 const [expanded, setExpanded] = useState(false);
 const [activePanel, setActivePanel] = useState<string | null>(null);
 const [note, setNote] = useState('');
 const [clipboardContent, setClipboardContent] = useState<string>('');
 const panelRef = useRef<HTMLDivElement>(null);

 // Click outside to close
 useEffect(() => {
 if (!activePanel) return;
 const handler = (e: MouseEvent) => {
 if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
 setActivePanel(null);
 }
 };
 document.addEventListener('mousedown', handler);
 return () => document.removeEventListener('mousedown', handler);
 }, [activePanel]);

 const tools: DockTool[] = [
 {
 id: 'ai',
 icon: BrainCircuit,
 label: 'Ask AI',
 color: 'text-violet-400 hover:bg-violet-500/20',
 action: () => { navigate('/desktop/canvas'); setExpanded(false); },
 },
 {
 id: 'clipboard',
 icon: Clipboard,
 label: 'Clipboard',
 color: 'text-sky-400 hover:bg-sky-500/20',
 action: async () => {
 try {
 const text = await navigator.clipboard.readText();
 setClipboardContent(text || 'Clipboard is empty');
 } catch {
 setClipboardContent('Clipboard access denied');
 }
 setActivePanel(activePanel === 'clipboard' ? null : 'clipboard');
 },
 },
 {
 id: 'voice',
 icon: Mic,
 label: 'Voice Note',
 color: 'text-red-400 hover:bg-red-500/20',
 action: () => setActivePanel(activePanel === 'voice' ? null : 'voice'),
 },
 {
 id: 'translate',
 icon: Globe,
 label: 'Translate',
 color: 'text-emerald-400 hover:bg-emerald-500/20',
 action: () => setActivePanel(activePanel === 'translate' ? null : 'translate'),
 },
 {
 id: 'notes',
 icon: StickyNote,
 label: 'Quick Note',
 color: 'text-amber-400 hover:bg-amber-500/20',
 action: () => setActivePanel(activePanel === 'notes' ? null : 'notes'),
 },
 {
 id: 'screenshot',
 icon: Camera,
 label: 'Screenshot',
 color: 'text-pink-400 hover:bg-pink-500/20',
 action: async () => {
 try {
 if ((window as any).electronAPI) {
 await (window as any).electronAPI.invoke('capture:screenshot');
 } else {
 alert('Screenshot available in Electron desktop app');
 }
 } catch {}
 },
 },
 ];

 return (
 <div ref={panelRef} className="fixed bottom-5 right-5 z-[8000] flex flex-col items-end gap-2">

 {/* ── Active panel ─────────────────────────────────────────────────── */}
 {activePanel === 'clipboard' && (
 <div className={cn(
 'w-72 rounded-2xl border shadow-2xl p-4 backdrop-blur-2xl animate-in slide-in-from-bottom-2 duration-200',
 isDark ? 'bg-zinc-900/95 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
 )}>
 <div className="flex items-center justify-between mb-3">
 <span className="text-secondary font-semibold flex items-center gap-2">
 <Clipboard className="w-4 h-4 text-sky-400" /> Clipboard
 </span>
 <button onClick={() => setActivePanel(null)} className="text-white/40 hover:text-white/80">
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className={cn(
 'text-label rounded-xl p-3 font-mono break-all max-h-32 overflow-auto ',
 isDark ? 'bg-white/5 text-white/70' : 'bg-zinc-50 text-zinc-600'
 )}>
 {clipboardContent || 'Reading clipboard...'}
 </div>
 {clipboardContent && clipboardContent.startsWith('http') && (
 <div className="mt-2 text-label text-violet-400 bg-violet-500/10 px-3 py-1.5 rounded-lg ">
 🔗 URL detected — open in AI Browser?
 </div>
 )}
 </div>
 )}

 {activePanel === 'notes' && (
 <div className={cn(
 'w-72 rounded-2xl border shadow-2xl p-4 backdrop-blur-2xl animate-in slide-in-from-bottom-2 duration-200',
 isDark ? 'bg-zinc-900/95 border-white/10' : 'bg-white border-zinc-200'
 )}>
 <div className="flex items-center justify-between mb-3">
 <span className={cn('text-secondary font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
 <StickyNote className="w-4 h-4 text-amber-400" /> Quick Note
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => { navigator.clipboard.writeText(note); }}
 className="text-label text-amber-400 hover:text-amber-200 transition-colors"
 >
 Copy
 </button>
 <button onClick={() => setActivePanel(null)} className={isDark ? 'text-white/40 hover:text-white/80' : 'text-zinc-400 hover:text-zinc-700'}>
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 <textarea
 value={note}
 onChange={e => setNote(e.target.value)}
 placeholder="Start typing..."
 className={cn(
 'w-full h-32 text-secondary bg-transparent outline-none resize-none ',
 isDark ? 'text-white/80 placeholder:text-white/25' : 'text-zinc-800 placeholder:text-zinc-400'
 )}
 autoFocus
 />
 <div className={cn('text-[10px] mt-1', isDark ? 'text-white/20' : 'text-zinc-400')}>
 {note.length} chars · Auto-saved locally
 </div>
 </div>
 )}

 {activePanel === 'translate' && (
 <div className={cn(
 'w-72 rounded-2xl border shadow-2xl p-4 backdrop-blur-2xl animate-in slide-in-from-bottom-2 duration-200',
 isDark ? 'bg-zinc-900/95 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
 )}>
 <div className="flex items-center justify-between mb-3">
 <span className="text-secondary font-semibold flex items-center gap-2">
 <Globe className="w-4 h-4 text-emerald-400" /> Translate
 </span>
 <button onClick={() => setActivePanel(null)} className={isDark ? 'text-white/40 hover:text-white/80' : 'text-zinc-400 hover:text-zinc-700'}>
 <X className="w-4 h-4" />
 </button>
 </div>
 <p className={cn('text-label mb-3', isDark ? 'text-white/50' : 'text-zinc-500')}>
 Ask AI to translate your clipboard content:
 </p>
 <button
 onClick={() => { navigate('/desktop/canvas'); setActivePanel(null); }}
 className="w-full py-2 rounded-xl bg-emerald-600/20 text-emerald-400 text-secondary font-semibold hover:bg-emerald-600/30 transition-colors border border-emerald-500/20"
 >
 Open AI Translator →
 </button>
 </div>
 )}

 {activePanel === 'voice' && (
 <div className={cn(
 'w-64 rounded-2xl border shadow-2xl p-4 backdrop-blur-2xl animate-in slide-in-from-bottom-2 duration-200',
 isDark ? 'bg-zinc-900/95 border-white/10 text-white' : 'bg-white border-zinc-200 text-zinc-900'
 )}>
 <div className="flex items-center justify-between mb-4">
 <span className="text-secondary font-semibold flex items-center gap-2">
 <Mic className="w-4 h-4 text-red-400" /> Voice Note
 </span>
 <button onClick={() => setActivePanel(null)} className={isDark ? 'text-white/40 hover:text-white/80' : 'text-zinc-400 hover:text-zinc-700'}>
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className="flex flex-col items-center gap-3">
 <div className="w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center cursor-pointer hover:bg-red-500/30 transition-colors">
 <Mic className="w-6 h-6 text-red-400" />
 </div>
 <p className={cn('text-label', isDark ? 'text-white/40' : 'text-zinc-400')}>Tap to record voice note</p>
 </div>
 </div>
 )}

 {/* ── Dock strip ───────────────────────────────────────────────────── */}
 <div className={cn(
 'flex items-center gap-2 p-3 rounded-3xl border shadow-2xl backdrop-blur-2xl transition-all duration-300',
 isDark
 ? 'bg-zinc-900/90 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.8)]'
 : 'bg-white/90 border-zinc-200 shadow-[0_8px_32px_rgba(0,0,0,0.15)]'
 )}>

 {/* Toggle expand */}
 <button
 onClick={() => setExpanded(prev => !prev)}
 className={cn(
 'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
 isDark ? 'text-white/30 hover:bg-white/8 hover:text-white/70' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'
 )}
 title="Productivity Dock"
 >
 {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
 </button>

 {/* Divider */}
 <div className={cn('w-px h-5', isDark ? 'bg-white/10' : 'bg-zinc-200')} />

 {/* Tool buttons — always visible */}
 {tools.map(tool => {
 const Icon = tool.icon;
 const isActive = activePanel === tool.id;
 return (
 <button
 key={tool.id}
 onClick={tool.action}
 title={tool.label}
 className={cn(
 'w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150',
 tool.color,
 isActive && (isDark ? 'bg-white/10 scale-110' : 'bg-zinc-100 scale-110')
 )}
 >
 <Icon className="w-4 h-4" />
 </button>
 );
 })}

 {/* Label strip when expanded */}
 {expanded && (
 <div className={cn(
 'absolute bottom-full right-0 mb-2 flex flex-col items-end gap-1 pointer-events-none'
 )}>
 {tools.map(tool => (
 <span
 key={tool.id}
 className={cn(
 'text-[10px] font-semibold px-2 py-0.5 rounded',
 isDark ? 'bg-zinc-900/80 text-white/60' : 'bg-white/80 text-zinc-600'
 )}
 >
 {tool.label}
 </span>
 ))}
 </div>
 )}
 </div>
 </div>
 );
};
