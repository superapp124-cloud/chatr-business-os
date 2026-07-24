import React, { useState } from "react";
import { Search, Mic, ArrowRight, Globe, Newspaper, Code, BookOpen, Flag } from "lucide-react";

interface AILandingViewProps {
 onSearch: (query: string) => void;
}

export function AILandingView({ onSearch }: AILandingViewProps) {
 const [query, setQuery] = useState("");

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (query.trim()) {
 onSearch(query);
 }
 };

 const suggestions = [
 "Best 5G phones under Rs 20,000",
 "How does quantum computing work?",
 "IPL 2026 points table",
 "How to file ITR online",
 "Top AI tools for startups 2026",
 "Delhi to Mumbai flight prices today"
 ];

 return (
 <div className="flex flex-col items-center justify-center min-h-[85vh] w-full px-4 text-center">
 
 {/* Brand Title */}
 <h1 className="text-7xl sm:text-8xl font-black tracking-tighter mb-4">
 <span className="bg-gradient-to-r from-[#9b88ff] via-[#d0a3ff] to-[#ffb099] text-transparent bg-clip-text">Chatr</span>
 <span className="text-[#ffa384] ml-4">AI</span>
 </h1>
 
 {/* Subtitle */}
 <p className="text-[#5a677f] font-semibold tracking-[0.2em] text-label sm:text-secondary mb-12 uppercase">
 MULTI-MODEL &middot; INDIA-NATIVE &middot; REAL-TIME WEB
 </p>

 {/* Main Search Box */}
 <form onSubmit={handleSubmit} className="w-full max-w-4xl mb-6">
 <div className="relative flex items-center bg-[#111827] border border-[#1f2937] rounded-2xl transition-all hover:border-[#374151] focus-within:border-[#4f46e5] focus-within:ring-1 focus-within:ring-[#4f46e5] shadow-2xl overflow-hidden p-2">
 <Search className="w-5 h-5 text-gray-400 ml-4 mr-3 flex-shrink-0" />
 <input
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder="Ask anything in English, Hindi, or Urdu..."
 className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-section sm:text-workspace py-3 w-full"
 autoFocus
 />
 <div className="flex items-center gap-2 pr-2 flex-shrink-0">
 <button type="button" className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5">
 <Mic className="w-5 h-5" />
 </button>
 <button
 type="submit"
 disabled={!query.trim()}
 className="px-5 py-2.5 bg-[#1f2937] hover:bg-[#374151] text-indigo-300 font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
 >
 <ArrowRight className="w-4 h-4 opacity-50" />
 <span>Search</span>
 </button>
 </div>
 </div>
 </form>

 {/* Categories */}
 <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
 <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors text-button">
 <Globe className="w-4 h-4" /> Web
 </button>
 <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors text-button">
 <Newspaper className="w-4 h-4" /> News
 </button>
 <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors text-button">
 <Code className="w-4 h-4" /> Code
 </button>
 <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-colors text-button">
 <BookOpen className="w-4 h-4" /> Research
 </button>
 <button className="flex items-center gap-2 px-6 py-2 rounded-xl border border-[#818cf8] text-white bg-[#312e81]/30 transition-colors text-button ">
 <Flag className="w-4 h-4" /> Bharat
 </button>
 </div>

 {/* Try Asking */}
 <div className="w-full max-w-4xl">
 <h3 className="text-[#4b5563] text-label font-semibold tracking-widest uppercase mb-4">Try Asking</h3>
 <div className="flex flex-wrap justify-center gap-3">
 {suggestions.map((suggestion, i) => (
 <button
 key={i}
 onClick={() => onSearch(suggestion)}
 className="px-5 py-2.5 rounded-xl border border-white/5 bg-[#111827]/50 text-gray-300 hover:text-white hover:bg-[#1f2937] hover:border-white/10 transition-colors text-secondary"
 >
 {suggestion}
 </button>
 ))}
 </div>
 </div>

 {/* Footer Details */}
 <div className="fixed bottom-6 flex items-center gap-6 text-label text-[#4b5563]">
 <div className="flex items-center gap-1">
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
 Noida &middot; UP
 </div>
 <div>3 answer lenses active</div>
 <div>Real-time web</div>
 </div>
 </div>
 );
}
