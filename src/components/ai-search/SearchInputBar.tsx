import React, { useState } from "react";
import { Search, Loader2, ArrowRight } from "lucide-react";

interface SearchInputBarProps {
 onSearch: (query: string) => void;
 status: string;
 currentStep: string;
}

export function SearchInputBar({ onSearch, status, currentStep }: SearchInputBarProps) {
 const [query, setQuery] = useState("");
 const isSearching = status === "searching" || status === "synthesizing";

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (query.trim() && !isSearching) {
 onSearch(query);
 }
 };

 return (
 <div className="w-full max-w-3xl mx-auto relative group">
 <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
 
 <form onSubmit={handleSubmit} className="relative bg-black border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
 <div className="flex items-center px-4 py-3">
 <Search className="w-5 h-5 text-gray-400 mr-3" />
 <input
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 disabled={isSearching}
 placeholder="Ask anything (e.g. IPL 2026 points table)..."
 className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-section disabled:opacity-50"
 autoFocus
 />
 <button
 type="submit"
 disabled={!query.trim() || isSearching}
 className="ml-3 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors disabled:opacity-30"
 >
 {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
 </button>
 </div>
 
 {isSearching && currentStep && (
 <div className="bg-white/5 px-4 py-2 flex items-center border-t border-white/10 text-label text-indigo-300 font-mono">
 <Loader2 className="w-3 h-3 animate-spin mr-2" />
 <span>{currentStep}</span>
 </div>
 )}
 </form>
 </div>
 );
}
