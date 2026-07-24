import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Brain, Loader2, MessageSquare, ArrowRight, X, Sparkles, Filter } from 'lucide-react';
import { searchCommunicationMemory, backfillMemory, MemoryResult } from '@/utils/communicationMemory';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface CommunicationMemoryDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onJumpToConversation?: (conversationId: string, messageId: string) => void;
}

export const CommunicationMemoryDialog = ({ isOpen, onClose, onJumpToConversation }: CommunicationMemoryDialogProps) => {
 const [query, setQuery] = useState('');
 const [isSearching, setIsSearching] = useState(false);
 const [answer, setAnswer] = useState<string | null>(null);
 const [sources, setSources] = useState<MemoryResult[]>([]);
 const [filter, setFilter] = useState<string | undefined>(undefined);
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (isOpen) {
 setTimeout(() => inputRef.current?.focus(), 100);
 } else {
 setQuery('');
 setAnswer(null);
 setSources([]);
 }
 }, [isOpen]);

 const handleSearch = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!query.trim()) return;

 setIsSearching(true);
 setAnswer(null);
 setSources([]);

 const response = await searchCommunicationMemory(query, filter);
 
 if (response.success) {
 setAnswer(response.answer || 'No answer generated.');
 setSources(response.sources || []);
 } else {
 toast.error(response.error || 'Failed to search memory.');
 }
 
 setIsSearching(false);
 };

 const handleBackfill = async () => {
 const loadingToast = toast.loading('Running indexing worker...');
 const result = await backfillMemory();
 if (result.success) {
 toast.success(result.message, { id: loadingToast });
 } else {
 toast.error(result.message, { id: loadingToast });
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden bg-[#FAFAFA] border-none shadow-2xl rounded-2xl">
 <form onSubmit={handleSearch} className="flex items-center p-4 border-b bg-white">
 <Brain className="w-6 h-6 text-violet-500 mr-3" />
 <Input
 ref={inputRef}
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder="Ask your memory anything (e.g., 'What did Rahul say about the invoice?')"
 className="flex-1 border-none bg-transparent text-section shadow-none focus-visible:ring-0 placeholder:text-gray-400 p-0 h-10"
 />
 {query && (
 <Button 
 type="button" 
 variant="ghost" 
 size="icon" 
 className="rounded-full mr-1 text-gray-400 hover:text-gray-600"
 onClick={() => setQuery('')}
 >
 <X className="w-5 h-5" />
 </Button>
 )}
 <Button 
 type="submit" 
 disabled={isSearching || !query.trim()}
 className="rounded-full bg-violet-600 hover:bg-violet-700 h-10 px-6 shrink-0"
 >
 {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
 </Button>
 </form>

 <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/80 border-b border-gray-100 text-label overflow-x-auto">
 <Filter className="w-3.5 h-3.5 text-gray-400 mr-1" />
 <span className="text-gray-500 font-medium mr-2">Filter by:</span>
 {['message', 'document', 'image', 'ocr'].map(t => (
 <button 
 key={t}
 type="button"
 onClick={() => setFilter(filter === t ? undefined : t)}
 className={`px-3 py-1 rounded-full transition-colors ${filter === t ? 'bg-violet-100 text-violet-700 font-semibold' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
 >
 {t}
 </button>
 ))}
 <div className="flex-1" />
 <Button variant="ghost" size="sm" onClick={handleBackfill} className="text-label h-7 text-muted-foreground hover:text-foreground">
 Index History
 </Button>
 </div>

 <ScrollArea className="max-h-[60vh] min-h-[300px]">
 {isSearching ? (
 <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
 <div className="relative">
 <Brain className="w-10 h-10 text-violet-300 animate-pulse" />
 <Sparkles className="w-4 h-4 text-fuchsia-400 absolute -top-1 -right-1 animate-bounce" />
 </div>
 <p className="text-secondary font-medium">Scanning your knowledge graph...</p>
 </div>
 ) : answer ? (
 <div className="p-6">
 <div className="prose prose-slate prose-sm max-w-none mb-8">
 <ReactMarkdown>{answer}</ReactMarkdown>
 </div>
 
 {sources.length > 0 && (
 <div className="mt-6 pt-6 border-t border-gray-100">
 <h4 className="text-secondary font-semibold text-gray-900 mb-4 flex items-center gap-2">
 <Search className="w-4 h-4 text-gray-400" />
 Source Memories
 </h4>
 <div className="space-y-3">
 {sources.map((source, idx) => (
 <div 
 key={source.id} 
 className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
 onClick={() => {
 if (onJumpToConversation) {
 onJumpToConversation(source.conversation_id, source.id);
 onClose();
 }
 }}
 >
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-3 flex-1 min-w-0">
 <div className="mt-0.5 shrink-0 bg-violet-100 w-6 h-6 rounded-md flex items-center justify-center text-violet-600 font-mono text-label font-bold">
 {idx + 1}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-secondary text-gray-600 line-clamp-2">{source.content}</p>
 <div className="flex items-center gap-2 mt-2">
 <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
 {source.memory_type}
 </span>
 <span className="text-[10px] text-gray-400">Match: {Math.round(source.similarity * 100)}%</span>
 </div>
 </div>
 </div>
 <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
 <ArrowRight className="w-4 h-4 text-violet-600" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center h-[300px] text-gray-400 p-8 text-center gap-4">
 <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
 <MessageSquare className="w-8 h-8 text-gray-300" />
 </div>
 <div>
 <h3 className="text-gray-900 font-medium mb-1">Your Personal Knowledge Graph</h3>
 <p className="text-secondary">Search across messages, images, documents, and voice notes instantly using semantic AI.</p>
 </div>
 </div>
 )}
 </ScrollArea>
 </DialogContent>
 </Dialog>
 );
};
