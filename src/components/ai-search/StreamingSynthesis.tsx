import React from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Loader2 } from "lucide-react";

interface StreamingSynthesisProps {
 text: string;
 status: string;
}

export function StreamingSynthesis({ text, status }: StreamingSynthesisProps) {
 const isSynthesizing = status === "synthesizing";

 if (!text && !isSynthesizing) {
 return null;
 }

 // A custom renderer for citations like [1], [2] to make them look like premium badges
 const renderCitations = (content: string) => {
 // We do this via simple regex replace for demonstration, or we could use custom ReactMarkdown components.
 // For now, ReactMarkdown handles standard text well.
 return content;
 };

 return (
 <div className="bg-black/40 border border-white/5 rounded-2xl p-6 lg:p-8 relative overflow-hidden backdrop-blur-xl">
 {/* Background glow */}
 <div className="absolute top-0 left-1/4 w-1/2 h-32 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
 
 <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
 <Sparkles className="w-5 h-5 text-indigo-400" />
 <h2 className="text-section font-medium text-white tracking-wide">AI Synthesis</h2>
 {isSynthesizing && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin ml-2" />}
 </div>

 <div className="prose prose-invert prose-indigo max-w-none text-gray-300
 prose-p:leading-relaxed prose-p:mb-4
 prose-headings:text-white prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-4
 prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
 prose-strong:text-white
 prose-ul:my-4 prose-li:my-1
 prose-table:border-collapse prose-table:w-full prose-table:my-6
 prose-th:border prose-th:border-white/20 prose-th:bg-white/5 prose-th:p-3 prose-th:text-left
 prose-td:border prose-td:border-white/10 prose-td:p-3
 prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800 prose-pre:rounded-xl
 prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
 ">
 <ReactMarkdown
 components={{
 // Transform citation patterns [1] into styled badges if needed
 // But relying on prose styles for now
 }}
 >
 {text || "Synthesizing response..."}
 </ReactMarkdown>
 </div>
 
 {isSynthesizing && (
 <div className="mt-4 flex items-center">
 <span className="w-2 h-4 bg-indigo-500 animate-pulse inline-block rounded-sm"></span>
 </div>
 )}
 </div>
 );
}
