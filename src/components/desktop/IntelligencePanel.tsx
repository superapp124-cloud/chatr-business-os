/**
 * IntelligencePanel — Live Conversation Intelligence
 *
 * Replaces static "Suggested Actions" in the Chat right panel.
 * Shows live extracted knowledge: People, Dates, Intents, Knowledge, Commitments.
 * Reads directly from GlobalIntentProvider (useCHATROS).
 */

import React, { useState } from 'react';
import { useCHATROS } from '@/core/os/hooks';
import {
 Users, Calendar, Zap, BookOpen, CheckCircle2, ChevronRight,
 Clock, Bell, Phone, Mail, FileText, DollarSign, Plane, Building2,
 Lightbulb, ArrowUpRight, Search, Star, BarChart2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const INTENT_ICONS: Record<string, React.ReactNode> = {
 meeting: <Users className="w-3 h-3" />,
 reminder: <Bell className="w-3 h-3" />,
 task: <CheckCircle2 className="w-3 h-3" />,
 expense: <DollarSign className="w-3 h-3" />,
 flight: <Plane className="w-3 h-3" />,
 hotel: <Building2 className="w-3 h-3" />,
 email: <Mail className="w-3 h-3" />,
 document: <FileText className="w-3 h-3" />,
 interview: <Star className="w-3 h-3" />,
 followup: <ArrowUpRight className="w-3 h-3" />,
};

const INTENT_COLORS: Record<string, string> = {
 meeting: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
 reminder: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
 task: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
 expense: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
 flight: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
 hotel: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
 email: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
 document: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
 interview: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
 followup: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
};

interface SectionProps {
 icon: React.ReactNode;
 title: string;
 accentColor: string;
 count: number;
 children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ icon, title, accentColor, count, children }) => {
 const [open, setOpen] = useState(true);
 if (count === 0) return null;

 return (
 <div className="mb-4">
 <button
 onClick={() => setOpen(o => !o)}
 className="w-full flex items-center gap-2 py-1.5 px-1 hover:bg-white/[0.03] rounded-lg transition-colors mb-1.5"
 >
 <span className={accentColor}>{icon}</span>
 <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{title}</span>
 <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto border', accentColor.replace('text-', 'bg-').replace('-4', '-5/15') + ' border-current/20', accentColor)}>
 {count}
 </span>
 <ChevronRight className={cn('w-3 h-3 text-white/20 transition-transform', open && 'rotate-90')} />
 </button>
 {open && (
 <div className="space-y-1">
 {children}
 </div>
 )}
 </div>
 );
};

interface IntelligencePanelProps {
 onActionClick?: (action: string) => void;
}

export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ onActionClick }) => {
 const { knowledge, pageContext, commitments, scheduledToday } = useCHATROS();
 const hasKnowledge = knowledge.people.length > 0 || knowledge.intents.length > 0 || knowledge.dateLabels.length > 0 || knowledge.topics.length > 0;

 const pendingCommitments = commitments.filter(c =>
 ['suggested', 'needs_input', 'executing', 'waiting', 'confirmed'].includes(c.status)
 );
 const completedCommitments = commitments.filter(c =>
 c.status === 'completed' || c.status === 'reality_verified'
 ).slice(-3);

 return (
 <ScrollArea className="flex-1">
 <div className="p-3">
 {/* Empty state */}
 {!hasKnowledge && pendingCommitments.length === 0 && scheduledToday.length === 0 && (
 <div className="flex flex-col items-center py-10 gap-3">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-white/[0.06] flex items-center justify-center">
 <Lightbulb className="w-5 h-5 text-white/20" />
 </div>
 <div className="text-center">
 <p className="text-[11px] font-semibold text-white/30">Start typing to see live insights</p>
 <p className="text-[10px] text-white/20 mt-1">People, dates, and intents appear here</p>
 </div>
 {/* Suggested starter prompts */}
 <div className="w-full mt-2 space-y-1.5">
 {pageContext.intentSuggestions.slice(0, 3).map((s, i) => (
 <button
 key={i}
 onClick={() => onActionClick?.(s)}
 className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] hover:border-white/[0.08] transition-all text-[10px] text-white/50 hover:text-white/80"
 >
 {s}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* People */}
 {knowledge.people.length > 0 && (
 <Section
 icon={<Users className="w-3 h-3" />}
 title="People"
 accentColor="text-blue-400"
 count={knowledge.people.length}
 >
 {knowledge.people.map((person, i) => (
 <div
 key={i}
 className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer group"
 onClick={() => onActionClick?.(`Schedule meeting with ${person}`)}
 >
 <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
 <span className="text-[9px] font-bold text-blue-400">{person[0]?.toUpperCase()}</span>
 </div>
 <span className="text-[11px] text-white/80 font-medium">{person}</span>
 <ArrowUpRight className="w-3 h-3 text-white/20 group-hover:text-white/50 ml-auto transition-colors" />
 </div>
 ))}
 </Section>
 )}

 {/* Dates */}
 {knowledge.dateLabels.length > 0 && (
 <Section
 icon={<Calendar className="w-3 h-3" />}
 title="Dates & Times"
 accentColor="text-amber-400"
 count={knowledge.dateLabels.length}
 >
 {knowledge.dateLabels.map((label, i) => (
 <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/[0.05] border border-amber-500/10">
 <Clock className="w-3 h-3 text-amber-400 shrink-0" />
 <span className="text-[11px] text-white/70">{label}</span>
 </div>
 ))}
 </Section>
 )}

 {/* Detected Intents */}
 {knowledge.intents.length > 0 && (
 <Section
 icon={<Zap className="w-3 h-3" />}
 title="Intent"
 accentColor="text-violet-400"
 count={knowledge.intents.length}
 >
 <div className="flex flex-wrap gap-1.5">
 {knowledge.intents.map((intent, i) => (
 <span
 key={i}
 className={cn(
 'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-semibold capitalize cursor-pointer hover:opacity-80 transition-opacity',
 INTENT_COLORS[intent] || 'bg-white/[0.05] text-white/50 border-white/10'
 )}
 onClick={() => onActionClick?.(`${intent.replace('followup', 'Follow up')}`)}
 >
 {INTENT_ICONS[intent] || <Zap className="w-3 h-3" />}
 {intent === 'followup' ? 'Follow-up' : intent.charAt(0).toUpperCase() + intent.slice(1)}
 </span>
 ))}
 </div>
 </Section>
 )}

 {/* Topics / Knowledge */}
 {knowledge.topics.length > 0 && (
 <Section
 icon={<BookOpen className="w-3 h-3" />}
 title="Topics"
 accentColor="text-emerald-400"
 count={knowledge.topics.length}
 >
 <div className="flex flex-wrap gap-1.5">
 {knowledge.topics.map((topic, i) => (
 <span
 key={i}
 className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.07] text-[10px] text-white/50 hover:text-white/70 hover:bg-white/[0.08] cursor-pointer transition-all"
 onClick={() => onActionClick?.(`Find related documents: ${topic}`)}
 >
 {topic}
 </span>
 ))}
 </div>
 </Section>
 )}

 {/* Today's Schedule */}
 {scheduledToday.length > 0 && (
 <Section
 icon={<Bell className="w-3 h-3" />}
 title="Today"
 accentColor="text-indigo-400"
 count={scheduledToday.length}
 >
 {scheduledToday.slice(0, 4).map(entry => (
 <div key={entry.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-indigo-500/[0.05] border border-indigo-500/10">
 <Bell className="w-3 h-3 text-indigo-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-medium text-white/80 truncate">{entry.title}</p>
 <p className="text-[9px] text-white/30">
 {new Date(entry.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
 </p>
 </div>
 </div>
 ))}
 </Section>
 )}

 {/* Pending Commitments */}
 {pendingCommitments.length > 0 && (
 <Section
 icon={<CheckCircle2 className="w-3 h-3" />}
 title="Commitments"
 accentColor="text-teal-400"
 count={pendingCommitments.length}
 >
 {pendingCommitments.slice(0, 5).map(c => (
 <div key={c.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
 <div className={cn(
 'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
 c.status === 'suggested' ? 'bg-amber-400' :
 c.status === 'executing' ? 'bg-violet-400 animate-pulse' :
 'bg-emerald-400'
 )} />
 <div className="flex-1 min-w-0">
 <p className="text-[11px] text-white/70 truncate">{c.title}</p>
 <p className="text-[9px] text-white/30 capitalize">{c.status.replace(/_/g, ' ')}</p>
 </div>
 </div>
 ))}
 </Section>
 )}

 {/* Recent Completions */}
 {completedCommitments.length > 0 && (
 <Section
 icon={<BarChart2 className="w-3 h-3" />}
 title="Completed"
 accentColor="text-emerald-400"
 count={completedCommitments.length}
 >
 {completedCommitments.map(c => (
 <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/10">
 <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
 <p className="text-[11px] text-white/60 truncate">{c.title}</p>
 </div>
 ))}
 </Section>
 )}
 </div>
 </ScrollArea>
 );
};
