import React from "react";
import { Cpu, Zap, Box } from "lucide-react";

interface ModelStatusIndicatorProps {
 primaryProvider: string | null;
 activeProviders: string[];
 status: string;
}

export function ModelStatusIndicator({ primaryProvider, activeProviders, status }: ModelStatusIndicatorProps) {
 if (!primaryProvider && activeProviders.length === 0) return null;

 const getIcon = (provider: string) => {
 switch (provider.toLowerCase()) {
 case "gemini": return <Zap className="w-3 h-3 text-yellow-400" />;
 case "groq": return <Zap className="w-3 h-3 text-red-400" />;
 case "together": return <Box className="w-3 h-3 text-blue-400" />;
 default: return <Cpu className="w-3 h-3 text-green-400" />;
 }
 };

 const getLabel = (provider: string) => {
 switch (provider.toLowerCase()) {
 case "gemini": return "Gemini Flash";
 case "groq": return "Groq Llama 3.3";
 case "together": return "Llama 3.3 Turbo";
 case "ipl_2026_fallback": return "Bharat Engine (Local)";
 default: return provider;
 }
 };

 return (
 <div className="flex flex-wrap gap-2 items-center text-label font-mono">
 <div className="text-gray-500 mr-2 flex items-center gap-1">
 <Cpu className="w-3 h-3" />
 <span>Consensus Engines:</span>
 </div>
 
 {activeProviders.map((provider) => (
 <div 
 key={provider}
 className={`flex items-center gap-1 px-2 py-1 rounded-md border ${
 provider === primaryProvider 
 ? "bg-indigo-900/40 border-indigo-500/50 text-indigo-200" 
 : "bg-gray-800/50 border-gray-700 text-gray-400"
 }`}
 >
 {getIcon(provider)}
 <span>{getLabel(provider)}</span>
 {provider === primaryProvider && status === "synthesizing" && (
 <span className="relative flex h-2 w-2 ml-1">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
 </span>
 )}
 </div>
 ))}
 
 {!activeProviders.includes(primaryProvider || "") && primaryProvider && (
 <div className="flex items-center gap-1 px-2 py-1 rounded-md border bg-indigo-900/40 border-indigo-500/50 text-indigo-200">
 {getIcon(primaryProvider)}
 <span>{getLabel(primaryProvider)}</span>
 </div>
 )}
 </div>
 );
}
