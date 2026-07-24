import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
 Search, MessageSquare, Phone, Video, Users, BrainCircuit, Calendar,
 CheckSquare, FolderOpen, Building2, Settings, FileText, Hash,
 ArrowRight, Sparkles, Clock, Zap, Command, Keyboard, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOptionalService } from '@/platform/Infrastructure/PlatformContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
 id: string;
 category: string;
 icon: React.ComponentType<{ className?: string }>;
 label: string;
 description?: string;
 shortcut?: string;
 action: () => void;
 keywords?: string[];
}

interface CommandPaletteProps {
 open: boolean;
 onClose: () => void;
 userId?: string;
}

// ─── Recent searches stored in localStorage ───────────────────────────────────
const RECENTS_KEY = 'chatr_cmd_recents';
const getRecents = (): string[] => {
 try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]'); } catch { return []; }
};
const addRecent = (label: string) => {
 const recents = getRecents().filter(r => r !== label).slice(0, 4);
 localStorage.setItem(RECENTS_KEY, JSON.stringify([label, ...recents]));
};

// ─── Component ─────────────────────────────────────────────────────────────────
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, userId }) => {
 const navigate = useNavigate();
 const searchService = useOptionalService<any>('SearchService');
 const [query, setQuery] = useState('');
 const [debouncedQuery, setDebouncedQuery] = useState('');
 const [isSearching, setIsSearching] = useState(false);
 const [remoteResults, setRemoteResults] = useState<CommandItem[]>([]);
 const [selectedIdx, setSelectedIdx] = useState(0);
 const [recentSearches, setRecentSearches] = useState<string[]>([]);
 const inputRef = useRef<HTMLInputElement>(null);

 const go = useCallback((path: string, label: string, state?: any) => {
 addRecent(label);
 navigate(path, { state });
 onClose();
 }, [navigate, onClose]);

 // Debounce query
 useEffect(() => {
 const handler = setTimeout(() => setDebouncedQuery(query), 300);
 return () => clearTimeout(handler);
 }, [query]);

 // Execute remote search
 useEffect(() => {
 if (!debouncedQuery.trim() || !searchService) {
 setRemoteResults([]);
 return;
 }
 
 let active = true;
 setIsSearching(true);
 
 // We will collect results from both remote and local sources
 const promises: Promise<any>[] = [];
 
 if (searchService) {
 promises.push(searchService.search(debouncedQuery, '').catch(() => ({ all: [] })));
 } else {
 promises.push(Promise.resolve({ all: [] }));
 }

 // Add local documents search if available
 const electronAPI = (window as any).electronAPI;
 if (electronAPI && electronAPI.documents) {
 promises.push(electronAPI.documents.search(debouncedQuery, 5).catch(() => []));
 } else {
 promises.push(Promise.resolve([]));
 }

 Promise.all(promises).then(([remoteRes, localRes]) => {
 if (!active) return;
 const mapped: CommandItem[] = [];
 
 // Map global cloud results to CommandItems
 if (remoteRes.all) {
 remoteRes.all.forEach((item: any) => {
 let icon = Globe;
 if (item.entityType === 'message') icon = MessageSquare;
 else if (item.entityType === 'task') icon = CheckSquare;
 else if (item.entityType === 'meeting') icon = Calendar;
 else if (item.entityType === 'file') icon = FileText;
 
 mapped.push({
 id: `search-${item.entityId}`,
 category: 'Cloud Search',
 icon,
 label: item.title,
 description: item.preview || `Found in ${item.entityType}`,
 action: () => go(item.urlPath, item.title)
 });
 });
 }

 // Map local document results to CommandItems
 if (Array.isArray(localRes)) {
 localRes.forEach((file: any) => {
 mapped.push({
 id: `local-doc-${file.path}`,
 category: 'Local Documents',
 icon: FileText,
 label: file.name,
 description: file.path,
 // Clicking a local file in command palette opens it natively using the OS default application
 action: async () => {
 const electron = (window as any).electronAPI;
 if (electron?.documents?.open) {
 await electron.documents.open(file.path);
 onClose();
 } else {
 go(`/desktop/workspace-ide?file=${encodeURIComponent(file.path)}`);
 }
 }
 });
 });
 }

 setRemoteResults(mapped);
 setIsSearching(false);
 }).catch(() => {
 if (active) setIsSearching(false);
 });
 
 return () => { active = false; };
 }, [debouncedQuery, searchService, go]);

 // ─── Static command registry ──────────────────────────────────────────────
 const commands: CommandItem[] = [
 // Navigation
 { id: 'nav-chat', category: 'Navigate', icon: MessageSquare, label: 'Open Chat', shortcut: 'C', action: () => go('/desktop/chat', 'Open Chat'), keywords: ['messages', 'conversations'] },
 { id: 'nav-calls', category: 'Navigate', icon: Phone, label: 'Open Calls', shortcut: 'L', action: () => go('/desktop/calls', 'Open Calls'), keywords: ['call', 'phone'] },
 { id: 'nav-contacts', category: 'Navigate', icon: Users, label: 'Open Contacts', shortcut: 'O', action: () => go('/desktop/contacts', 'Open Contacts'), keywords: ['people', 'contacts'] },
 { id: 'nav-ai', category: 'Navigate', icon: BrainCircuit, label: 'Open AI Hub', shortcut: 'A', action: () => go('/desktop/canvas', 'Open AI Hub'), keywords: ['ai', 'intelligence', 'brain'] },
 { id: 'nav-crm', category: 'Navigate', icon: Building2, label: 'Open CRM', shortcut: 'R', action: () => go('/desktop/pro/business', 'Open CRM'), keywords: ['crm', 'customers', 'business'] },
 { id: 'nav-inbox', category: 'Navigate', icon: FileText, label: 'Smart Inbox', shortcut: 'I', action: () => go('/desktop/smart-inbox', 'Smart Inbox'), keywords: ['inbox', 'unified'] },
 { id: 'nav-settings', category: 'Navigate', icon: Settings, label: 'Settings', shortcut: ',', action: () => go('/desktop/settings', 'Settings'), keywords: ['settings', 'preferences'] },
 // Actions
 { id: 'act-newchat', category: 'Actions', icon: MessageSquare, label: 'New Chat', description: 'Start a new conversation', action: () => { go('/desktop/chat', 'New Chat'); } },
 { id: 'act-call', category: 'Actions', icon: Phone, label: 'Make a Call', description: 'Dial a number or contact', action: () => go('/desktop/calls', 'Make a Call') },
 { id: 'act-video', category: 'Actions', icon: Video, label: 'Video Meeting', description: 'Start a video conference', action: () => go('/desktop/calls', 'Video Meeting') },
 { id: 'act-askai', category: 'Actions', icon: Sparkles, label: 'Ask AI', description: 'Open AI assistant', action: () => go('/desktop/canvas', 'Ask AI'), keywords: ['ai', 'ask', 'help'] },
 { id: 'act-task', category: 'Actions', icon: CheckSquare, label: 'Create Task', description: 'Add a new task', action: () => go('/desktop/workspace', 'Create Task'), keywords: ['task', 'todo'] },
 { id: 'act-meeting', category: 'Actions', icon: Calendar, label: 'Schedule Meeting', description: 'Book a meeting', action: () => go('/desktop/workspace', 'Schedule Meeting'), keywords: ['meeting', 'calendar', 'book', 'friday'] },
 { id: 'act-ticket', category: 'Actions', icon: Hash, label: 'Create Ticket', description: 'Open a support ticket', action: () => go('/desktop/workspace', 'Create Ticket'), keywords: ['ticket', 'support', 'issue'] },
 { id: 'act-files', category: 'Files', icon: FolderOpen, label: 'Browse Files', action: () => go('/desktop/workspace', 'Browse Files'), keywords: ['files', 'documents'] },
 // AI Actions
 { id: 'ai-summarize', category: 'AI', icon: BrainCircuit, label: 'Summarize yesterday', description: 'AI summary of yesterday\'s activity', action: () => go('/desktop/canvas', 'Summarize yesterday', { autoTrigger: 'ai-summarize' }), keywords: ['summarize', 'summary', 'yesterday'] },
 { id: 'ai-draft', category: 'AI', icon: Sparkles, label: 'Draft a reply', description: 'AI drafts a response for you', action: () => go('/desktop/canvas', 'Draft a reply', { autoTrigger: 'ai-draft' }), keywords: ['draft', 'write', 'reply'] },
 { id: 'ai-translate', category: 'AI', icon: Zap, label: 'Translate clipboard', description: 'Translate clipboard content', action: () => go('/desktop/canvas', 'Translate clipboard', { autoTrigger: 'ai-translate' }), keywords: ['translate', 'language', 'clipboard'] },
 
 // Automation OS
 { id: 'os-studio', category: 'Automation OS', icon: Command, label: 'Open Workflow Studio', description: 'Enter the Automation OS', shortcut: 'W', action: () => go('/desktop/studio', 'Open Workflow Studio'), keywords: ['workflow', 'automation', 'os', 'studio'] },
 { id: 'os-run', category: 'Automation OS', icon: Zap, label: 'Run Workflow', description: 'Navigate to studio and run active workflow', action: () => go('/desktop/studio', 'Run Workflow', { autoTrigger: 'RUN_WORKFLOW' }), keywords: ['run', 'execute', 'workflow'] },
 { id: 'os-compile', category: 'Automation OS', icon: CheckSquare,label: 'Compile Workflow', description: 'Navigate to studio and compile workflow', action: () => go('/desktop/studio', 'Compile Workflow', { autoTrigger: 'COMPILE_WORKFLOW' }), keywords: ['compile', 'build', 'workflow'] },
 ];

 // ─── Filter logic ─────────────────────────────────────────────────────────
 const filtered = query.trim() === ''
 ? commands
 : commands.filter(c => {
 const q = query.toLowerCase();
 return (
 c.label.toLowerCase().includes(q) ||
 c.description?.toLowerCase().includes(q) ||
 c.category.toLowerCase().includes(q) ||
 c.keywords?.some(k => k.includes(q))
 );
 });

 // Group by category
 const allResults = [...filtered, ...remoteResults];
 
 const grouped: Record<string, CommandItem[]> = {};
 allResults.forEach(c => {
 if (!grouped[c.category]) grouped[c.category] = [];
 grouped[c.category].push(c);
 });

 const flatFiltered = allResults;

 // ─── Keyboard navigation ──────────────────────────────────────────────────
 useEffect(() => {
 if (!open) return;
 setQuery('');
 setSelectedIdx(0);
 setRecentSearches(getRecents());
 setTimeout(() => inputRef.current?.focus(), 50);
 }, [open]);

 useEffect(() => { setSelectedIdx(0); }, [query]);

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'ArrowDown') {
 e.preventDefault();
 setSelectedIdx(i => Math.min(i + 1, flatFiltered.length - 1));
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 setSelectedIdx(i => Math.max(i - 1, 0));
 } else if (e.key === 'Enter') {
 e.preventDefault();
 flatFiltered[selectedIdx]?.action();
 } else if (e.key === 'Escape') {
 onClose();
 }
 };

 if (!open) return null;

 return (
 <div
 className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
 onClick={onClose}
 >
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

 {/* Palette */}
 <div
 className="relative w-full max-w-2xl mx-4 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in slide-in-from-top-4 duration-200"
 onClick={e => e.stopPropagation()}
 onKeyDown={handleKeyDown}
 >
 {/* Search input */}
 <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
 <Search className="w-5 h-5 text-white/40 shrink-0" />
 <input
 ref={inputRef}
 type="text"
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder="Search or type a command... (Call Rahul, Ask AI, Find Invoice)"
 className="flex-1 bg-transparent text-white placeholder:text-white/30 text-secondary outline-none"
 />
 {query && (
 <button onClick={() => setQuery('')} className="text-white/30 hover:text-white/60 text-label transition-colors">
 Clear
 </button>
 )}
 <kbd className="hidden sm:block text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
 </div>

 {/* Results */}
 <ScrollArea className="max-h-[420px]">
 {query === '' && recentSearches.length > 0 && (
 <div className="px-2 pt-3 pb-1">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1 flex items-center gap-1.5">
 <Clock className="w-3 h-3" /> Recent
 </p>
 {recentSearches.map(r => (
 <button
 key={r}
 onClick={() => setQuery(r)}
 className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-secondary text-white/50 hover:text-white/90 transition-colors"
 >
 <Clock className="w-4 h-4 text-white/25" />
 {r}
 </button>
 ))}
 </div>
 )}

 {Object.entries(grouped).map(([category, items]) => (
 <div key={category} className="px-2 pt-3 pb-1">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1">{category}</p>
 {items.map((item) => {
 const globalIdx = flatFiltered.indexOf(item);
 const isSelected = globalIdx === selectedIdx;
 const Icon = item.icon;
 return (
 <button
 key={item.id}
 onClick={() => { item.action(); addRecent(item.label); }}
 onMouseEnter={() => setSelectedIdx(globalIdx)}
 className={cn(
 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-100 group',
 isSelected ? 'bg-white/10' : 'hover:bg-white/5'
 )}
 >
 <div className={cn(
 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
 isSelected ? 'bg-violet-600 text-white' : 'bg-white/8 text-white/50 group-hover:text-white/80'
 )}>
 <Icon className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <p className={cn('text-secondary font-medium truncate', isSelected ? 'text-white' : 'text-white/80')}>
 {item.label}
 </p>
 {item.description && (
 <p className="text-label text-white/35 truncate">{item.description}</p>
 )}
 </div>
 {item.shortcut && (
 <kbd className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
 {item.shortcut}
 </kbd>
 )}
 {isSelected && <ArrowRight className="w-4 h-4 text-white/40 shrink-0" />}
 </button>
 );
 })}
 </div>
 ))}

 {allResults.length === 0 && !isSearching && (
 <div className="px-4 py-12 text-center">
 <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-3" />
 <p className="text-white/40 text-secondary">No results for "{query}"</p>
 <p className="text-white/25 text-label mt-1">Try "Call Rahul", "Ask AI", "Find Invoice"</p>
 </div>
 )}
 </ScrollArea>

 {/* Footer */}
 <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/8 text-[11px] text-white/25">
 <span className="flex items-center gap-1"><kbd className="border border-white/15 rounded px-1">↑↓</kbd> navigate</span>
 <span className="flex items-center gap-1"><kbd className="border border-white/15 rounded px-1">↵</kbd> open</span>
 <span className="flex items-center gap-1"><kbd className="border border-white/15 rounded px-1">esc</kbd> close</span>
 <span className="ml-auto flex items-center gap-1"><Command className="w-3 h-3" /> CHATR Command Center</span>
 </div>
 </div>
 </div>
 );
};
