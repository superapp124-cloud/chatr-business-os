import React, { useState, useEffect } from 'react';
import { Search, Command } from 'lucide-react';
import { IntentPipeline } from '@/core/intent/IntentPipeline';

export function CommandPalette() {
 const [isOpen, setIsOpen] = useState(false);
 const [query, setQuery] = useState('');

 // Example list of capabilities that would come from the Intent OS dynamically
 const commands = [
 { id: '1', title: "Find John's resume", category: 'Memory' },
 { id: '2', title: "Call Rahul", category: 'Communication' },
 { id: '3', title: "Find my invoice", category: 'Desktop' },
 { id: '4', title: "Book flight", category: 'Browser' },
 { id: '5', title: "Summarize meeting", category: 'Intelligence' }
 ];

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 setIsOpen((open) => !open);
 }
 if (e.key === 'Escape') {
 setIsOpen(false);
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, []);

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && query.trim()) {
 IntentPipeline.process(query);
 setIsOpen(false);
 setQuery('');
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-background/80 backdrop-blur-sm">
 <div className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
 
 {/* Input Area */}
 <div className="flex items-center px-4 py-3 border-b border-border gap-3">
 <Search className="w-5 h-5 text-muted-foreground" />
 <input
 autoFocus
 className="flex-1 bg-transparent border-none outline-none text-foreground text-section placeholder:text-muted-foreground"
 placeholder="What do you want to accomplish? (e.g. 'Find my invoice')"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={handleKeyDown}
 />
 <div className="flex items-center gap-1 text-label text-muted-foreground bg-muted px-2 py-1 rounded">
 <Command className="w-3 h-3" />
 <span>K</span>
 </div>
 </div>

 {/* Results Area */}
 <div className="max-h-[60vh] overflow-y-auto py-2">
 {commands
 .filter(c => c.title.toLowerCase().includes(query.toLowerCase()))
 .map((cmd) => (
 <div 
 key={cmd.id}
 onClick={() => {
 IntentPipeline.process(cmd.title);
 setIsOpen(false);
 setQuery('');
 }}
 className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent hover:text-accent-foreground mx-2 rounded-md transition-colors"
 >
 <div className="font-medium">{cmd.title}</div>
 <div className="text-label text-muted-foreground bg-muted px-2 py-1 rounded-full">
 {cmd.category}
 </div>
 </div>
 ))}
 
 {query.length > 0 && commands.filter(c => c.title.toLowerCase().includes(query.toLowerCase())).length === 0 && (
 <div className="px-4 py-8 text-center text-muted-foreground">
 <p className="mb-2">No matching commands found.</p>
 <p className="text-secondary">Press <strong>Enter</strong> to ask the AI to handle this intent.</p>
 </div>
 )}
 </div>
 
 {/* Footer */}
 <div className="px-4 py-2 border-t border-border bg-muted/50 text-label text-muted-foreground flex justify-between">
 <div>Workspace: Default</div>
 <div>Intent OS v1.0</div>
 </div>
 </div>
 </div>
 );
}
