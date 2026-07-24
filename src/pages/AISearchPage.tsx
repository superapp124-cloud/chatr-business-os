import React, { useEffect } from "react";
import { useAISearch } from "../hooks/useAISearch";
import { SearchInputBar } from "../components/ai-search/SearchInputBar";
import { StreamingSynthesis } from "../components/ai-search/StreamingSynthesis";
import { SourceCardsPanel } from "../components/ai-search/SourceCardsPanel";
import { ModelStatusIndicator } from "../components/ai-search/ModelStatusIndicator";
import { AILandingView } from "../components/ai-search/AILandingView";
import { BrainCircuit } from "lucide-react";

export function AISearchPage() {
 const { 
 search, 
 status, 
 currentStep, 
 text, 
 sources, 
 activeProviders, 
 primaryProvider,
 error,
 cached
 } = useAISearch();

 const handleSearch = (query: string) => {
 // Scroll to top on new search
 window.scrollTo({ top: 0, behavior: 'smooth' });
 search(query, "web"); // using web mode by default, smart routing handled in backend
 };

 const isIdle = status === "idle" && !text;

 return (
 <div className="min-h-screen bg-[#0B0F19] text-white selection:bg-indigo-500/30 font-sans">
 {!isIdle && (
 <>
 <div className="fixed top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>

 <header className="sticky top-0 z-50 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/5">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2 text-indigo-400">
 <BrainCircuit className="w-6 h-6" />
 <span className="font-bold text-workspace tracking-tight text-white">CHATR <span className="text-indigo-400 font-normal">AI Search</span></span>
 </div>
 
 <ModelStatusIndicator 
 primaryProvider={primaryProvider}
 activeProviders={activeProviders}
 status={status}
 />
 </div>
 
 <SearchInputBar 
 onSearch={handleSearch} 
 status={status} 
 currentStep={currentStep} />
 </div>
 </header>
 </>
 )}

 <main className={isIdle ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
 {error && (
 <div className="max-w-7xl mx-auto px-4 mt-8">
 <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 mb-8">
 {error}
 </div>
 </div>
 )}

 {isIdle ? (
 <AILandingView onSearch={handleSearch} />
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
 {/* Left Column: AI Synthesis */}
 <div className="lg:col-span-8 order-2 lg:order-1">
 <StreamingSynthesis text={text} status={status} />
 
 {cached && (
 <div className="mt-4 flex items-center justify-end text-label text-gray-500 font-mono">
 <span className="bg-white/5 px-2 py-1 rounded">Served from Redis Edge Cache</span>
 </div>
 )}
 </div>

 {/* Right Column: Source Cards */}
 <div className="lg:col-span-4 order-1 lg:order-2">
 <div className="sticky top-40">
 <SourceCardsPanel 
 sources={sources} 
 isLoading={status === "searching" || (status === "synthesizing" && sources.length === 0)} 
 />
 </div>
 </div>
 </div>
 )}
 </main>
 </div>
 );
}

export default AISearchPage;
