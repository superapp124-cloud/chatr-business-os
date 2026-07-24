import React from 'react';
import { CheckCheck, Smile, Reply, Forward, Sparkles, MoreVertical, FileText, Download, CheckCircle2, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '../types';
import { ExecutionResultCard } from '../../components/ExecutionResultCard';

interface MessageBubbleProps {
 msg: Message;
 isOwn: boolean;
 isAI: boolean;
 displayTime: string;
 onFullscreenImage: (url: string) => void;
 onReact: () => void;
 onReply: (msg: Message) => void;
 onForward: (msg: Message) => void;
 onAskAI: (msg: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
 msg,
 isOwn,
 isAI,
 displayTime,
 onFullscreenImage,
 onReact,
 onReply,
 onForward,
 onAskAI
}) => {
 return (
 <div className="relative group/bubble">
 <div className={cn(
 "px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm relative whitespace-pre-wrap flex flex-col gap-1 transition-all",
 isOwn 
 ? "bg-violet-600 text-white rounded-tr-sm min-w-[80px]" 
 : isAI 
 ? "bg-violet-500/10 border border-violet-500/20 text-white/90 rounded-tl-sm shadow-black/20"
 : "bg-zinc-900 border border-white/[0.05] text-white/90 rounded-tl-sm shadow-black/20"
 )}>
 {/* Render Attachments */}
 {msg.attachments && msg.attachments.length > 0 && (
 <div className="flex flex-col gap-2 mb-1">
 {msg.attachments.map((att: any, i: number) => {
 const isImage = att.mimeType?.startsWith('image/');
 if (isImage) {
 return (
 <div key={i} className="relative rounded-lg overflow-hidden border border-white/10 group/img">
 <img src={att.url} alt={att.name || 'Attachment'} className="w-full max-w-[240px] max-h-[240px] object-cover" />
 <button onClick={() => onFullscreenImage(att.url)} className="absolute inset-0 w-full h-full bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-label font-semibold backdrop-blur-sm">View Full</button>
 </div>
 );
 }
 return (
 <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 p-2 rounded-lg border transition-colors shadow-sm w-full max-w-[240px]", isOwn ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-white/5 border-white/10 hover:bg-white/10")}>
 <div className={cn("p-1.5 rounded-md", isOwn ? "bg-white/20" : "bg-white/10")}>
 <FileText className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-semibold truncate">{att.name || 'Document'}</p>
 {att.sizeBytes && <p className="text-[9px] opacity-70">{(att.sizeBytes / 1024).toFixed(1)} KB</p>}
 </div>
 <Download className="w-3.5 h-3.5 opacity-50" />
 </a>
 );
 })}
 </div>
 )}

 {/* Render Execution Progress */}
 {isAI && msg.isResolving && msg.executionProgress && msg.executionProgress.length > 0 && (
 <div className="flex flex-col gap-2 my-1 text-[12px] font-medium text-white/80">
 {msg.executionProgress.map((step, idx) => {
 const isLast = idx === msg.executionProgress!.length - 1;
 return (
 <div key={idx} className="flex items-center gap-2">
 {isLast ? (
 <CircleDashed className="w-3.5 h-3.5 text-violet-400 animate-[spin_3s_linear_infinite]" />
 ) : (
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
 )}
 <span className={cn(isLast ? "text-white/90 animate-pulse" : "text-white/60")}>
 {step.status}
 </span>
 </div>
 );
 })}
 </div>
 )}

 {/* Render Content */}
 {(!msg.isResolving || msg.content) && msg.content && <div>{msg.content}</div>}

 {/* Render Execution Result (Quiet Confidence) */}
 {isAI && !msg.isResolving && <ExecutionResultCard msg={msg} />}

 {isOwn && (
 <div className="flex items-center justify-end gap-1 text-[9px] text-white/70 select-none self-end mt-0.5">
 <span>{displayTime}</span>
 <CheckCheck className="w-3 h-3 text-blue-300" />
 </div>
 )}
 </div>
 
 {/* Hover Actions */}
 <div className={cn(
 "absolute top-0 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl p-1 z-10",
 isOwn ? "-left-4 -translate-x-full" : "-right-4 translate-x-full"
 )}>
 <button onClick={onReact} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="React">
 <Smile className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => onReply(msg)} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="Reply">
 <Reply className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => onForward(msg)} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="Forward">
 <Forward className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => onAskAI(msg)} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="Ask AI">
 <Sparkles className="w-3.5 h-3.5 text-violet-400 hover:text-violet-300" />
 </button>
 <button className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="More">
 <MoreVertical className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 );
});
