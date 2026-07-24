import React from 'react';
import { BrainCircuit, CheckCheck, Zap, FileText, Calendar, X, Loader2, Sparkles, CornerUpRight, Forward, Paperclip, CircleDashed, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { WorkflowRenderer } from '@/components/workflow-ui';
import type { Message, Room, CopilotMessage, RightPaneTab } from '../types';
import { ExecutionResultCard } from '../../components/ExecutionResultCard';

interface RightPaneProps {
 selectedRoom: Room | null;
 activeThreadId: string | null;
 setActiveThreadId: (id: string | null) => void;
 rightPaneTab: RightPaneTab;
 setRightPaneTab: (tab: RightPaneTab) => void;
 chatMessages: Message[];
 currentUserId: string | null;
 copilotMessages: CopilotMessage[];
 copilotInput: string;
 setCopilotInput: (v: string) => void;
 copilotAttachments?: File[];
 setCopilotAttachments?: React.Dispatch<React.SetStateAction<File[]>>;
 copilotLoading: boolean;
 copilotEndRef: React.RefObject<HTMLDivElement>;
 onCopilotSend: (msg?: string) => void;
 onExtract: () => void;
 isExtracting: boolean;
 osTasks: any[];
 osDecisions: any[];
 osNotes: any[];
 osEvents: any[];
 threadInput: string;
 setThreadInput: (v: string) => void;
 onSendThreadReply: () => void;
 onFullscreenImage: (url: string) => void;
}

export const RightPane: React.FC<RightPaneProps> = React.memo(({
 selectedRoom,
 activeThreadId,
 setActiveThreadId,
 rightPaneTab,
 setRightPaneTab,
 chatMessages,
 currentUserId,
 copilotMessages,
 copilotInput,
 setCopilotInput,
 copilotAttachments = [],
 setCopilotAttachments,
 copilotLoading,
 copilotEndRef,
 onCopilotSend,
 onExtract,
 isExtracting,
 osTasks,
 osDecisions,
 osNotes,
 osEvents,
 threadInput,
 setThreadInput,
 onSendThreadReply,
 onFullscreenImage
}) => {
 if (!selectedRoom) return null;

 return (
 <div className="w-[420px] shrink-0 border-l border-white/[0.06] bg-[#0b0b14] flex flex-col relative z-20">
 
 {/* State 1: Active Thread */}
 {activeThreadId ? (
 <>
 <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.04]">
 <div className="flex items-center gap-2">
 <h3 className="text-secondary font-bold text-white/90">Thread</h3>
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">#{selectedRoom.name}</span>
 </div>
 <button onClick={() => setActiveThreadId(null)} className="p-1.5 rounded-md hover:bg-white/10 text-white/50 transition-colors">
 <X className="w-4 h-4" />
 </button>
 </div>
 
 <ScrollArea className="flex-1">
 <div className="p-4 flex flex-col gap-4">
 {(() => {
 const parentMsg = chatMessages.find(m => m.id === activeThreadId);
 if (!parentMsg) return <div className="text-white/40 text-label text-center py-4">Message not found</div>;
 
 return (
 <div className="flex flex-col gap-4">
 {/* Parent Message */}
 <div className="flex gap-3">
 <div className="w-8 h-8 rounded-[8px] bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
 {parentMsg.senderAvatar ? (
 <img src={parentMsg.senderAvatar} className="w-full h-full object-cover" />
 ) : (
 <span className="text-label font-bold text-white">{parentMsg.senderId === currentUserId ? 'Me' : parentMsg.senderName?.[0]?.toUpperCase() || 'U'}</span>
 )}
 </div>
 <div className="flex-1">
 <div className="flex items-baseline gap-2 mb-1">
 <span className="text-label font-bold text-white/90">{parentMsg.senderId === currentUserId ? 'Me' : parentMsg.senderName}</span>
 <span className="text-[10px] text-white/30">{new Date(parentMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
 </div>
 <p className="text-[13px] text-white/80 leading-relaxed">{parentMsg.content}</p>
 </div>
 </div>

 <div className="flex items-center gap-4">
 <div className="h-px bg-white/[0.06] flex-1" />
 <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Replies</span>
 <div className="h-px bg-white/[0.06] flex-1" />
 </div>

 {/* Real Replies */}
 <div className="flex flex-col gap-4 py-2">
 {chatMessages
 .filter(m => m.replyToId === activeThreadId)
 .map(reply => (
 <div key={reply.id} className="flex gap-3">
 <div className="w-6 h-6 rounded-[6px] bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
 {reply.senderAvatar ? (
 <img src={reply.senderAvatar} className="w-full h-full object-cover" />
 ) : (
 <span className="text-[10px] font-bold text-white">{reply.senderName?.[0]?.toUpperCase() || 'U'}</span>
 )}
 </div>
 <div className="flex-1">
 <div className="flex items-baseline gap-2 mb-0.5">
 <span className="text-[11px] font-bold text-white/90">{reply.senderId === currentUserId ? 'Me' : reply.senderName}</span>
 <span className="text-[9px] text-white/30">{new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
 </div>
 <p className="text-[13px] text-white/90 leading-relaxed break-words whitespace-pre-wrap">{reply.content}</p>
 
 {/* Attachments */}
 {reply.attachments && reply.attachments.length > 0 && (
 <div className="mt-2 flex flex-col gap-2">
 {reply.attachments.map((att, i) => (
 <div key={i} className="rounded-lg overflow-hidden border border-white/[0.05]">
 {att.mimeType?.startsWith('image/') ? (
 <img src={att.url} alt={att.name} className="max-w-full max-h-60 object-cover cursor-pointer" onClick={() => onFullscreenImage(att.url)} />
 ) : (
 <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 transition-colors">
 <FileText className="w-4 h-4 text-blue-400" />
 <span className="text-label text-blue-400 truncate flex-1">{att.name}</span>
 {att.sizeBytes && <span className="text-[10px] text-white/30">{Math.round(att.sizeBytes / 1024)} KB</span>}
 </a>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 ))}
 {chatMessages.filter(m => m.replyToId === activeThreadId).length === 0 && (
 <div className="flex items-center justify-center py-2">
 <span className="text-label text-white/30">No replies yet.</span>
 </div>
 )}
 </div>
 </div>
 );
 })()}
 </div>
 </ScrollArea>
 <div className="p-3 pb-24 border-t border-white/[0.04]">
 <div className="flex gap-2">
 <input
 value={threadInput}
 onChange={e => setThreadInput(e.target.value)}
 placeholder="Reply in thread..."
 className="flex-1 bg-zinc-900 border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
 onKeyDown={e => {
 if (e.key === 'Enter') onSendThreadReply();
 }}
 />
 <button 
 onClick={onSendThreadReply}
 className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors shrink-0"
 >
 <CornerUpRight className="w-3.5 h-3.5 text-white" />
 </button>
 </div>
 </div>
 </>
 ) : (
 /* State 2: OS Panel */
 <>
 <div className="h-14 shrink-0 flex items-center justify-between px-2 border-b border-white/[0.04]">
 <div className="flex items-center gap-1">
 <button onClick={() => setRightPaneTab('copilot')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'copilot' ? "bg-white/10 text-violet-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="chatrAI"><img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-4 h-4 rounded-full object-cover shrink-0" /></button>
 <button onClick={() => setRightPaneTab('tasks')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'tasks' ? "bg-white/10 text-emerald-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Tasks"><CheckCheck className="w-4 h-4" /></button>
 <button onClick={() => setRightPaneTab('decisions')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'decisions' ? "bg-white/10 text-blue-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Decisions"><Zap className="w-4 h-4" /></button>
 <button onClick={() => setRightPaneTab('notes')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'notes' ? "bg-white/10 text-amber-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Notes"><FileText className="w-4 h-4" /></button>
 <button onClick={() => setRightPaneTab('calendar')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'calendar' ? "bg-white/10 text-orange-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Calendar"><Calendar className="w-4 h-4" /></button>
 </div>
 <button 
 onClick={onExtract}
 disabled={isExtracting}
 className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 hover:bg-violet-600/40 transition-colors disabled:opacity-50"
 title="Extract OS Entities from Chat"
 >
 {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
 </button>
 </div>

 {rightPaneTab === 'copilot' && (
 <>
 <ScrollArea className="flex-1">
 <div className="p-3 space-y-3">
 {copilotMessages.length === 0 && (
 <div className="flex flex-col gap-3">
 <div className="p-3 rounded-xl bg-violet-600/10 border border-violet-500/20 text-[11px] text-white/60 leading-relaxed">
 <span className="text-violet-300 font-bold flex items-center gap-1.5"><img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-4 h-4 rounded-md object-cover" /> chatrAI</span><br/>
 I'm your chatrAI assistant for this conversation. I've automatically analyzed the context.
 </div>
 
 <div className="p-3 rounded-xl bg-zinc-900 border border-white/[0.04]">
 <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 block">Live Context</span>
 <div className="space-y-2">
 <div className="flex items-start gap-2">
 <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
 <p className="text-[11px] text-white/80">Discussing bulk and retail pricing options.</p>
 </div>
 <div className="flex items-start gap-2">
 <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
 <p className="text-[11px] text-white/80">Action item: Send quotation format.</p>
 </div>
 </div>
 </div>

 <div className="space-y-1.5 mt-2">
 <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block px-1">Suggested Actions</span>
 <button onClick={() => onCopilotSend("Draft a quotation for retail pricing")} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/80 transition-colors">
 Draft a quotation for retail pricing
 </button>
 <button onClick={() => onCopilotSend("Summarize our previous discussion")} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/80 transition-colors">
 Summarize our previous discussion
 </button>
 <button onClick={() => onCopilotSend("Schedule a follow-up meeting")} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/80 transition-colors">
 Schedule a follow-up meeting
 </button>
 </div>
 </div>
 )}
 {copilotMessages.map((m, i) => (
 <div key={i} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
 <div className={cn(
 'max-w-[90%] px-3 py-2 rounded-xl text-[11px] leading-relaxed relative',
 m.role === 'user'
 ? 'bg-violet-600 text-white rounded-br-sm'
 : 'bg-zinc-800/80 border border-white/[0.06] text-white/80 rounded-bl-sm'
 )}>
 {/* Progressive Execution Steps */}
 {m.role === 'assistant' && (m as any).isResolving && (m as any).executionProgress && (
 <div className="flex flex-col gap-2 my-1 text-[11px] font-medium text-white/80">
 {(m as any).executionProgress.map((step: any, idx: number) => {
 const isLast = idx === (m as any).executionProgress.length - 1;
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

 {/* Content */}
 {(!(m as any).isResolving || m.content) && m.content && <div>{m.content}</div>}

 {/* Execution Result */}
 {m.role === 'assistant' && !(m as any).isResolving && ((m as any).confidence || (m as any).explainability) && (
 <div className="-mx-2 mb-1">
 <ExecutionResultCard msg={m as any} />
 </div>
 )}
 </div>

 {/* Workflow Widget Stack */}
 {m.role === 'assistant' && (m as any).workflowId && (
 <div className="w-full">
 <WorkflowRenderer workflowId={(m as any).workflowId} />
 </div>
 )}
 </div>
 ))}
 {copilotLoading && (
 <div className="flex justify-start">
 <div className="px-3 py-2 rounded-xl bg-zinc-800/80 border border-white/[0.06] text-violet-400 text-[11px]">
 <span className="animate-pulse">CHATR AI is thinking…</span>
 </div>
 </div>
 )}
 <div ref={copilotEndRef} />
 </div>
 </ScrollArea>

 <div className="p-3 pb-24 border-t border-white/[0.04] flex flex-col gap-2">
 {copilotAttachments && copilotAttachments.length > 0 && (
 <div className="flex gap-2 flex-wrap mb-1">
 {copilotAttachments.map((f, i) => (
 <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-md px-2 py-1">
 <FileText className="w-3 h-3 text-violet-400" />
 <span className="text-[10px] text-white/80 max-w-[100px] truncate">{f.name}</span>
 <button onClick={() => setCopilotAttachments?.(prev => prev.filter((_, idx) => idx !== i))} className="text-white/40 hover:text-white/80">
 <X className="w-3 h-3" />
 </button>
 </div>
 ))}
 </div>
 )}
 <div className="flex gap-2">
 <button
 onClick={() => {
 const input = document.createElement('input');
 input.type = 'file';
 input.multiple = true;
 input.onchange = (e: any) => {
 const files = Array.from(e.target.files) as File[];
 setCopilotAttachments?.(prev => [...prev, ...files]);
 };
 input.click();
 }}
 className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 flex items-center justify-center transition-colors shrink-0 border border-white/[0.06]"
 title="Attach Files"
 >
 <Paperclip className="w-4 h-4 text-white/60" />
 </button>
 <input
 value={copilotInput}
 onChange={e => setCopilotInput(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && onCopilotSend()}
 placeholder="Ask CHATR AI…"
 className="flex-1 bg-zinc-900 border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
 />
 <button
 onClick={() => onCopilotSend()}
 disabled={copilotLoading || (!copilotInput.trim() && copilotAttachments.length === 0)}
 className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center transition-colors"
 >
 <CornerUpRight className="w-3.5 h-3.5 text-white" />
 </button>
 </div>
 </div>
 </>
 )}

 {rightPaneTab === 'tasks' && (
 <ScrollArea className="flex-1">
 <div className="p-4 space-y-3">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-label font-bold text-white/90">Action Items</h3>
 <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{osTasks.length}</span>
 </div>
 {osTasks.length === 0 ? (
 <div className="text-center py-8 text-[11px] text-white/40">No tasks extracted yet.</div>
 ) : (
 osTasks.map((t: any) => (
 <div key={t.id} className="p-3 bg-zinc-900/50 border border-white/[0.04] rounded-xl flex items-start gap-3 group">
 <div className="w-4 h-4 rounded border border-white/20 mt-0.5 shrink-0 flex items-center justify-center group-hover:border-emerald-500/50 cursor-pointer">
 {t.status === 'done' && <CheckCheck className="w-3 h-3 text-emerald-400" />}
 </div>
 <div>
 <p className="text-label text-white/90 mb-1">{t.title}</p>
 <div className="flex items-center gap-2 text-[10px] text-white/40">
 {t.assignee && <span className="text-emerald-400/80">@{t.assignee}</span>}
 {t.scheduledFor && <span>Scheduled: {new Date(t.scheduledFor).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
 </div>
 </div>
 </div>
 ))
 )}
 </div>
 </ScrollArea>
 )}

 {rightPaneTab === 'decisions' && (
 <ScrollArea className="flex-1">
 <div className="p-4 space-y-3">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-label font-bold text-white/90">Key Decisions</h3>
 <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{osDecisions.length}</span>
 </div>
 {osDecisions.length === 0 ? (
 <div className="text-center py-8 text-[11px] text-white/40">No decisions captured yet.</div>
 ) : (
 osDecisions.map((d: any) => (
 <div key={d.id} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl relative overflow-hidden">
 <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
 <p className="text-label text-white/90 mb-1">{d.description}</p>
 <p className="text-[9px] text-white/30">Captured {new Date(d.createdAt).toLocaleDateString()}</p>
 </div>
 ))
 )}
 </div>
 </ScrollArea>
 )}

 {rightPaneTab === 'notes' && (
 <ScrollArea className="flex-1">
 <div className="p-4 space-y-3">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-label font-bold text-white/90">Shared Notes</h3>
 <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{osNotes.length}</span>
 </div>
 {osNotes.length === 0 ? (
 <div className="text-center py-8 text-[11px] text-white/40">No notes yet.</div>
 ) : (
 osNotes.map((n: any) => (
 <div key={n.id} className="p-3 bg-zinc-900/50 border border-amber-500/20 rounded-xl">
 <p className="text-[10px] font-bold text-amber-400 mb-1">{n.title}</p>
 <p className="text-[11px] text-white/70 whitespace-pre-wrap leading-relaxed">{n.content}</p>
 </div>
 ))
 )}
 </div>
 </ScrollArea>
 )}

 {rightPaneTab === 'calendar' && (
 <ScrollArea className="flex-1">
 <div className="p-4 space-y-3">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-label font-bold text-white/90">Upcoming Events</h3>
 <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">{osEvents.length}</span>
 </div>
 {osEvents.length === 0 ? (
 <div className="text-center py-8 text-[11px] text-white/40">No events scheduled.</div>
 ) : (
 osEvents.map((e: any) => (
 <div key={e.id} className="p-3 bg-zinc-900/50 border border-white/[0.04] rounded-xl flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-400 flex flex-col items-center justify-center shrink-0">
 <span className="text-[9px] font-bold uppercase">{new Date(e.date).toLocaleString('default', { month: 'short' })}</span>
 <span className="text-label font-black">{new Date(e.date).getDate()}</span>
 </div>
 <div>
 <p className="text-label text-white/90 mb-0.5">{e.title}</p>
 <p className="text-[10px] text-white/40">{e.time}</p>
 </div>
 </div>
 ))
 )}
 </div>
 </ScrollArea>
 )}
 </>
 )}
 </div>
 );
});
