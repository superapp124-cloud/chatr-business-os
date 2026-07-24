/**
 * MeetingCopilotPanel — Live AI during and before calls
 * 
 * Shows:
 * - Pre-call: Caller history, AI brief, agenda builder
 * - During call: Live notes, action items, suggested responses, decisions
 * - Post-call: Transcript summary, follow-ups, next steps
 */

import React, { useState, useEffect, useRef } from 'react';
import {
 Mic, CheckCircle2, Clock, Users, FileText, ArrowUpRight,
 Sparkles, MessageSquare, Target, AlertTriangle, CalendarPlus,
 Mail, Bell, ChevronDown, ChevronRight, Send, Loader2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCHATROS } from '@/core/os/hooks';
import { generate } from '@/services/ai';
import { toast } from 'sonner';
import { osScheduler } from '@/core/services/OSSchedulerService';

type CopilotMode = 'pre-call' | 'in-call' | 'post-call';

interface ActionItem {
 id: string;
 text: string;
 owner?: string;
 done: boolean;
 createdAt: string;
}

interface MeetingCopilotPanelProps {
 callState: 'idle' | 'connecting' | 'connected' | 'ended';
 callerName?: string;
 callerAvatar?: string;
 meetingGoal?: string;
 onScheduleFollowUp?: (text: string) => void;
}

export const MeetingCopilotPanel: React.FC<MeetingCopilotPanelProps> = ({
 callState,
 callerName,
 callerAvatar,
 meetingGoal,
 onScheduleFollowUp,
}) => {
 const [mode, setMode] = useState<CopilotMode>('pre-call');
 const [actionItems, setActionItems] = useState<ActionItem[]>([]);
 const [decisions, setDecisions] = useState<string[]>([]);
 const [liveNotes, setLiveNotes] = useState<string[]>([]);
 const [agenda, setAgenda] = useState<string[]>([]);
 const [agendaInput, setAgendaInput] = useState('');
 const [aiLoading, setAiLoading] = useState(false);
 const [aiSummary, setAiSummary] = useState('');
 const [noteInput, setNoteInput] = useState('');
 const [activeSection, setActiveSection] = useState<string | null>('agenda');
 const { observeText } = useCHATROS();

 // Sync mode to call state
 useEffect(() => {
 if (callState === 'idle') setMode('pre-call');
 else if (callState === 'connecting' || callState === 'connected') setMode('in-call');
 else if (callState === 'ended') setMode('post-call');
 }, [callState]);

 const addActionItem = (text: string) => {
 if (!text.trim()) return;
 const item: ActionItem = {
 id: crypto.randomUUID(),
 text: text.trim(),
 done: false,
 createdAt: new Date().toISOString(),
 };
 setActionItems(prev => [...prev, item]);
 observeText(text);
 };

 const addNote = () => {
 if (!noteInput.trim()) return;
 setLiveNotes(prev => [...prev, noteInput.trim()]);
 observeText(noteInput);
 setNoteInput('');
 };

 const addAgendaItem = () => {
 if (!agendaInput.trim()) return;
 setAgenda(prev => [...prev, agendaInput.trim()]);
 setAgendaInput('');
 };

 const generateCallBrief = async () => {
 setAiLoading(true);
 try {
 const prompt = `Generate a concise ChatrAI pre-call brief (3-4 sentences) for a ${meetingGoal || 'business'} call with ${callerName || 'a contact'}. Include: suggested topics to cover, what to clarify, and one key question to ask. Be direct and practical.`;
 const brief = await generate({ prompt });
 setAiSummary(brief || 'ChatrAI brief unavailable — proceeding with standard agenda.');
 } catch {
 setAiSummary('Focus on agenda items, clarify next steps, and confirm follow-up dates before ending the call.');
 } finally {
 setAiLoading(false);
 }
 };

 const generatePostCallSummary = async () => {
 setAiLoading(true);
 try {
 const notesText = liveNotes.join('. ');
 const actionsText = actionItems.map(a => a.text).join('. ');
 const prompt = `Summarize this meeting: Notes: ${notesText}. Actions: ${actionsText}. Decisions: ${decisions.join('. ')}. Write a 2-3 sentence executive summary.`;
 const summary = await generate({ prompt });
 setAiSummary(summary || 'Meeting completed. Review action items and send follow-up email.');
 } catch {
 setAiSummary('Meeting completed. Review action items and schedule follow-ups.');
 } finally {
 setAiLoading(false);
 }
 };

 const scheduleFollowUp = () => {
 const followUpText = `Follow up with ${callerName || 'contact'} about meeting outcomes`;
 osScheduler.schedule({
 id: crypto.randomUUID(),
 title: followUpText,
 capability: 'core.follow_up',
 scheduledFor: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
 payload: { actionItems, decisions },
 });
 toast.success('Follow-up scheduled for tomorrow');
 onScheduleFollowUp?.(followUpText);
 };

 const SectionHeader: React.FC<{ id: string; title: string; icon: React.ReactNode; count?: number; accent?: string }> = ({ id, title, icon, count, accent = 'text-white/50' }) => (
 <button
 onClick={() => setActiveSection(activeSection === id ? null : id)}
 className="w-full flex items-center gap-2 py-2 px-1 hover:bg-white/[0.03] rounded-lg transition-colors"
 >
 <span className={accent}>{icon}</span>
 <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{title}</span>
 {count !== undefined && count > 0 && (
 <span className="ml-auto text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full text-white/50">{count}</span>
 )}
 <ChevronRight className={cn('w-3 h-3 text-white/20 ml-auto transition-transform', activeSection === id && 'rotate-90')} />
 </button>
 );

 return (
 <div className="w-[260px] shrink-0 flex flex-col border-l border-white/[0.04] bg-zinc-950/50 backdrop-blur-xl overflow-hidden">
 {/* Header */}
 <div className="px-3 py-3 border-b border-white/[0.04] shrink-0">
 <div className="flex items-center gap-2">
 <div className={cn(
 'w-2 h-2 rounded-full',
 mode === 'in-call' ? 'bg-red-500 animate-pulse' : mode === 'post-call' ? 'bg-emerald-500' : 'bg-violet-500'
 )} />
 <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
 {mode === 'pre-call' ? 'Meeting Copilot' : mode === 'in-call' ? 'Live · Recording' : 'Post-Call'}
 </span>
 {mode === 'in-call' && (
 <span className="ml-auto text-[9px] text-red-400 font-bold animate-pulse">LIVE</span>
 )}
 </div>
 </div>

 <ScrollArea className="flex-1">
 <div className="p-3 space-y-1">

 {/* PRE-CALL MODE */}
 {mode === 'pre-call' && (
 <>
 {/* AI Brief */}
 <div className="p-3 rounded-xl bg-violet-500/[0.07] border border-violet-500/20 mb-3">
 <div className="flex items-center gap-2 mb-2">
 <Sparkles className="w-3.5 h-3.5 text-violet-400" />
 <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">ChatrAI Brief</span>
 </div>
 {aiLoading ? (
 <div className="flex items-center gap-2 text-[11px] text-white/40">
 <Loader2 className="w-3 h-3 animate-spin" /> Generating brief...
 </div>
 ) : aiSummary ? (
 <p className="text-[11px] text-white/70 leading-relaxed">{aiSummary}</p>
 ) : (
 <button
 onClick={generateCallBrief}
 className="w-full py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-[11px] font-semibold transition-colors"
 >
 Generate Pre-Call Brief
 </button>
 )}
 </div>

 {/* Agenda Builder */}
 <SectionHeader id="agenda" title="Agenda" icon={<Target className="w-3 h-3" />} count={agenda.length} accent="text-blue-400" />
 {activeSection === 'agenda' && (
 <div className="space-y-1.5 mb-2">
 {agenda.map((item, i) => (
 <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-500/[0.05] border border-blue-500/10">
 <span className="text-[10px] text-blue-400 font-bold">{i + 1}</span>
 <span className="text-[11px] text-white/70">{item}</span>
 </div>
 ))}
 <div className="flex gap-1.5">
 <input
 value={agendaInput}
 onChange={e => setAgendaInput(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && addAgendaItem()}
 placeholder="Add agenda item..."
 className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/40"
 />
 <button onClick={addAgendaItem} className="w-7 h-7 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 flex items-center justify-center text-blue-400 transition-colors">
 <Send className="w-3 h-3" />
 </button>
 </div>
 </div>
 )}

 {/* Suggested Topics */}
 <SectionHeader id="topics" title="Suggested Topics" icon={<MessageSquare className="w-3 h-3" />} accent="text-emerald-400" />
 {activeSection === 'topics' && (
 <div className="space-y-1 mb-2">
 {[
 'Clarify timeline and deliverables',
 'Review open action items',
 'Confirm next meeting date',
 'Budget and resource allocation',
 ].map((topic, i) => (
 <button
 key={i}
 onClick={() => { setAgenda(prev => [...prev, topic]); setActiveSection('agenda'); }}
 className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/[0.04] text-[11px] text-white/60 hover:text-white/80 transition-colors flex items-center gap-2"
 >
 <ArrowUpRight className="w-3 h-3 text-white/20 shrink-0" />
 {topic}
 </button>
 ))}
 </div>
 )}
 </>
 )}

 {/* IN-CALL MODE */}
 {mode === 'in-call' && (
 <>
 {/* Live Notes */}
 <SectionHeader id="notes" title={`Notes (${liveNotes.length})`} icon={<FileText className="w-3 h-3" />} accent="text-amber-400" />
 {activeSection === 'notes' && (
 <div className="space-y-1.5 mb-2">
 {liveNotes.map((note, i) => (
 <div key={i} className="px-2 py-1.5 rounded-lg bg-amber-500/[0.05] border border-amber-500/10 text-[11px] text-white/70">
 {note}
 </div>
 ))}
 <div className="flex gap-1.5">
 <input
 value={noteInput}
 onChange={e => setNoteInput(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && addNote()}
 placeholder="Capture a note..."
 className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/40"
 />
 <button onClick={addNote} className="w-7 h-7 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 flex items-center justify-center text-amber-400 transition-colors">
 <Send className="w-3 h-3" />
 </button>
 </div>
 </div>
 )}

 {/* Action Items */}
 <SectionHeader id="actions" title={`Action Items (${actionItems.length})`} icon={<CheckCircle2 className="w-3 h-3" />} accent="text-emerald-400" />
 {activeSection === 'actions' && (
 <div className="space-y-1.5 mb-2">
 {actionItems.map(item => (
 <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/10 group">
 <button onClick={() => setActionItems(prev => prev.map(a => a.id === item.id ? { ...a, done: !a.done } : a))}>
 <CheckCircle2 className={cn('w-3.5 h-3.5 transition-colors', item.done ? 'text-emerald-400' : 'text-white/20')} />
 </button>
 <span className={cn('text-[11px] flex-1', item.done ? 'line-through text-white/30' : 'text-white/70')}>{item.text}</span>
 </div>
 ))}
 <div className="flex gap-1.5">
 <input
 placeholder="Add action item..."
 onKeyDown={e => { if (e.key === 'Enter') { addActionItem((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
 className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-500/40"
 />
 </div>
 </div>
 )}

 {/* Decisions */}
 <SectionHeader id="decisions" title={`Decisions (${decisions.length})`} icon={<AlertTriangle className="w-3 h-3" />} accent="text-blue-400" />
 {activeSection === 'decisions' && (
 <div className="space-y-1.5 mb-2">
 {decisions.map((d, i) => (
 <div key={i} className="px-2 py-1.5 rounded-lg bg-blue-500/[0.05] border border-blue-500/10 text-[11px] text-white/70">
 ✓ {d}
 </div>
 ))}
 <input
 placeholder="Record a decision..."
 onKeyDown={e => { if (e.key === 'Enter') { setDecisions(prev => [...prev, (e.target as HTMLInputElement).value]); (e.target as HTMLInputElement).value = ''; } }}
 className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/40"
 />
 </div>
 )}

 {/* Agenda quick view */}
 {agenda.length > 0 && (
 <div className="mt-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
 <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1.5">Agenda</p>
 {agenda.map((item, i) => (
 <div key={i} className="flex items-center gap-2 py-0.5">
 <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
 <span className="text-[10px] text-white/50">{item}</span>
 </div>
 ))}
 </div>
 )}
 </>
 )}

 {/* POST-CALL MODE */}
 {mode === 'post-call' && (
 <>
 {/* AI Summary */}
 <div className="p-3 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 mb-3">
 <div className="flex items-center gap-2 mb-2">
 <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
 <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">ChatrAI Summary</span>
 </div>
 {aiLoading ? (
 <div className="flex items-center gap-2 text-[11px] text-white/40">
 <Loader2 className="w-3 h-3 animate-spin" /> Generating summary...
 </div>
 ) : aiSummary ? (
 <p className="text-[11px] text-white/70 leading-relaxed">{aiSummary}</p>
 ) : (
 <button
 onClick={generatePostCallSummary}
 className="w-full py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[11px] font-semibold transition-colors"
 >
 Generate Summary
 </button>
 )}
 </div>

 {/* Action Items Summary */}
 {actionItems.length > 0 && (
 <div className="mb-3">
 <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 px-1">
 Action Items ({actionItems.filter(a => !a.done).length} open)
 </p>
 {actionItems.map(item => (
 <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1">
 <CheckCircle2 className={cn('w-3.5 h-3.5', item.done ? 'text-emerald-400' : 'text-white/20')} />
 <span className={cn('text-[11px]', item.done ? 'line-through text-white/30' : 'text-white/70')}>{item.text}</span>
 </div>
 ))}
 </div>
 )}

 {/* Quick Actions */}
 <div className="space-y-2">
 <button
 onClick={scheduleFollowUp}
 className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/15 border border-violet-500/20 transition-all"
 >
 <CalendarPlus className="w-3.5 h-3.5 text-violet-400" />
 <span className="text-[11px] font-semibold text-violet-400">Schedule Follow-up</span>
 </button>
 <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 transition-all">
 <Mail className="w-3.5 h-3.5 text-blue-400" />
 <span className="text-[11px] font-semibold text-blue-400">Send Summary Email</span>
 </button>
 <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 transition-all">
 <Bell className="w-3.5 h-3.5 text-amber-400" />
 <span className="text-[11px] font-semibold text-amber-400">Set Reminder</span>
 </button>
 </div>
 </>
 )}
 </div>
 </ScrollArea>
 </div>
 );
};
