import React from "react";
import { SearchSource } from "../../services/aiSearchStream";
import { ExternalLink, ShieldCheck, Globe, Building2, Newspaper } from "lucide-react";

interface SourceCardsPanelProps {
 sources: SearchSource[];
 isLoading: boolean;
}

export function SourceCardsPanel({ sources, isLoading }: SourceCardsPanelProps) {
 if (isLoading && sources.length === 0) {
 return (
 <div className="flex flex-col gap-3">
 <h3 className="text-secondary font-semibold text-gray-400 mb-2 uppercase tracking-wider">Live Web Sources</h3>
 {[1, 2, 3, 4].map(i => (
 <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-4 animate-pulse">
 <div className="flex items-center gap-2 mb-3">
 <div className="w-5 h-5 bg-white/10 rounded-full"></div>
 <div className="h-3 bg-white/10 rounded w-1/3"></div>
 </div>
 <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
 <div className="h-4 bg-white/10 rounded w-1/2"></div>
 </div>
 ))}
 </div>
 );
 }

 if (sources.length === 0) return null;

 const getDomain = (url: string) => {
 try {
 return new URL(url).hostname.replace("www.", "");
 } catch {
 return url;
 }
 };

 const getTrustBadge = (url: string) => {
 if (url.includes(".gov.in") || url.includes("uidai") || url.includes("incometax")) {
 return <div className="flex items-center gap-1 text-label text-green-400 bg-green-400/10 px-2 py-0.5 rounded"><Building2 className="w-3 h-3" /> Govt</div>;
 }
 if (url.includes("iplt20") || url.includes("bcci")) {
 return <div className="flex items-center gap-1 text-label text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded"><ShieldCheck className="w-3 h-3" /> Official</div>;
 }
 if (url.includes("thehindu") || url.includes("indianexpress") || url.includes("moneycontrol")) {
 return <div className="flex items-center gap-1 text-label text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded"><Newspaper className="w-3 h-3" /> News</div>;
 }
 return null;
 };

 return (
 <div className="flex flex-col gap-3">
 <h3 className="text-secondary font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center">
 <Globe className="w-4 h-4 mr-2" /> Live Web Sources
 </h3>
 
 <div className="grid grid-cols-1 gap-3">
 {sources.map((source, i) => (
 <a
 key={i}
 href={source.url !== "internal://chatr/fallback" ? source.url : "#"}
 target="_blank"
 rel="noopener noreferrer"
 className="group block bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/10 rounded-xl p-4 transition-all"
 >
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2 overflow-hidden">
 <img 
 src={`https://www.google.com/s2/favicons?domain=${getDomain(source.url)}&sz=32`} 
 alt="" 
 className="w-4 h-4 rounded-full bg-white/10"
 onError={(e) => { e.currentTarget.style.display = 'none' }}
 />
 <span className="text-label text-gray-400 truncate">{getDomain(source.url)}</span>
 </div>
 <div className="flex items-center gap-2">
 {getTrustBadge(source.url)}
 <span className="text-label text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded font-mono">[{source.index}]</span>
 </div>
 </div>
 
 <h4 className="text-secondary font-medium text-gray-200 mb-1 group-hover:text-indigo-300 transition-colors line-clamp-2">
 {source.title}
 </h4>
 
 <p className="text-label text-gray-500 line-clamp-2">
 {source.snippet}
 </p>
 </a>
 ))}
 </div>
 </div>
 );
}
