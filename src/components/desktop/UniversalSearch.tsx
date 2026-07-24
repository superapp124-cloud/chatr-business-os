import React, { useState, useEffect } from 'react';
import { Search, FileText, Loader2, Sparkles } from 'lucide-react';
import { generate } from '@/services/ai';

export const UniversalSearch = () => {
 const [isOpen, setIsOpen] = useState(false);
 const [query, setQuery] = useState('');
 const [isSearching, setIsSearching] = useState(false);
 const [results, setResults] = useState<{
 summary?: string;
 messages: any[];
 files: any[];
 } | null>(null);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 setIsOpen((prev) => !prev);
 }
 if (e.key === 'Escape') {
 setIsOpen(false);
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, []);

 const handleSearch = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!query.trim()) return;

 setIsSearching(true);
 setResults(null);
 try {
 const prompt = `You are the Universal AI Search for CHATR. The user is searching for: "${query}". 
Synthesize a highly concise summary of what they are looking for.
Format your output EXACTLY as a JSON object:
{
 "summary": "AI summary of the answer",
 "messages": [{"sender": "Sanobar", "text": "Related message snippet", "room": "General"}],
 "files": [{"name": "document.pdf", "type": "pdf"}]
}`;
 const res = await generate({ prompt, preferLocal: true });
 try {
 const jsonStr = res.substring(res.indexOf('{'), res.lastIndexOf('}') + 1);
 const parsed = JSON.parse(jsonStr);
 setResults(parsed);
 } catch (err) {
 setResults({ summary: res, messages: [], files: [] });
 }
 } catch (e) {
 setResults({ summary: 'Search failed to reach AI backend.', messages: [], files: [] });
 } finally {
 setIsSearching(false);
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="w-full max-w-2xl bg-[#0b0b14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
 <form onSubmit={handleSearch} className="flex items-center px-4 py-3 border-b border-white/10 relative">
 <Search className="w-5 h-5 text-white/40 mr-3 shrink-0" />
 <input
 autoFocus
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder="Ask AI or search anything... (e.g., 'What did Sanobar say?')"
 className="flex-1 bg-transparent text-white text-body placeholder:text-white/30 focus:outline-none"
 />
 {isSearching && <Loader2 className="w-5 h-5 text-violet-400 animate-spin absolute right-12" />}
 <div className="flex items-center gap-2">
 <span className="text-[10px] font-mono text-white/30 border border-white/10 rounded px-1.5 py-0.5">ESC</span>
 </div>
 </form>

 <div className="max-h-[60vh] overflow-y-auto p-4 flex flex-col gap-4">
 {!results && !isSearching && (
 <div className="text-center py-12">
 <Sparkles className="w-8 h-8 text-violet-500/50 mx-auto mb-3" />
 <p className="text-secondary text-white/50">Search across chats, files, and meetings instantly.</p>
 </div>
 )}

 {results?.summary && (
 <div className="p-4 rounded-xl bg-violet-600/10 border border-violet-500/20 text-secondary text-white/80 ">
 <div className="flex items-center gap-2 mb-2 text-violet-300 font-bold text-label uppercase tracking-wider">
 <Sparkles className="w-3.5 h-3.5" /> AI Synthesis
 </div>
 {results.summary}
 </div>
 )}

 {results?.messages && results.messages.length > 0 && (
 <div>
 <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 px-1">Related Messages</div>
 <div className="space-y-1">
 {results.messages.map((m, i) => (
 <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer border border-transparent hover:border-white/10">
 <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
 <span className="text-label font-bold text-white">{m.sender?.[0] || 'U'}</span>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-baseline justify-between mb-0.5">
 <span className="text-label font-bold text-white/90">{m.sender}</span>
 <span className="text-[10px] text-white/40 px-1.5 py-0.5 rounded bg-white/5">#{m.room}</span>
 </div>
 <p className="text-[11px] text-white/60 truncate">{m.text}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {results?.files && results.files.length > 0 && (
 <div>
 <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 px-1">Files & Documents</div>
 <div className="grid grid-cols-2 gap-2">
 {results.files.map((f, i) => (
 <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04] bg-zinc-900/50 hover:bg-white/5 transition-colors cursor-pointer">
 <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
 <FileText className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-label text-white/90 truncate">{f.name}</p>
 <p className="text-[10px] text-white/40 uppercase">{f.type}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};
