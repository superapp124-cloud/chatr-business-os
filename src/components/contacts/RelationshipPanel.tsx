/**
 * RelationshipPanel — per-contact Relationship OS sidebar
 * 
 * Shows full relationship history for any selected contact:
 * - Profile card with quick actions
 * - Meetings, Calls, Tasks, Notes, Timeline
 * - AI summary of the relationship
 * - Quick actions: Call, Email, Meeting, Reminder, Task
 */

import React, { useState, useEffect } from 'react';
import {
 Phone, Mail, Calendar, Bell, FileText, CheckCircle2,
 MessageSquare, Clock, Sparkles, Users, Briefcase,
 ArrowUpRight, Plus, Loader2, History, Star, X
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCHATROS } from '@/core/os/hooks';
import { generate } from '@/services/ai';
import { supabase } from '@/integrations/supabase/client';
import { osScheduler } from '@/core/services/OSSchedulerService';
import { toast } from 'sonner';
import { kernelAPI } from '../../core/runtime/KernelAPI';
import { useKernelState } from '../../core/os/useKernelState';

interface Contact {
 id: string;
 display_name: string;
 avatar_url: string | null;
 phone_number: string | null;
 email: string | null;
 is_online?: boolean;
 username?: string;
 profile_id?: string;
}

interface RelationshipEvent {
 type: 'call' | 'meeting' | 'message' | 'task' | 'note';
 label: string;
 time: string;
 icon: React.ReactNode;
 color: string;
}

interface RelationshipPanelProps {
 contact: Contact | null;
 onClose?: () => void;
 onCall?: (contact: Contact) => void;
 onMessage?: (contact: Contact) => void;
}

const QuickAction: React.FC<{ icon: React.ReactNode; label: string; color: string; onClick: () => void }> = ({ icon, label, color, onClick }) => (
 <button
 onClick={onClick}
 className={cn(
 'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all hover:scale-[1.03] active:scale-[0.97]',
 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.12]'
 )}
 >
 <span className={color}>{icon}</span>
 <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{label}</span>
 </button>
);

export const RelationshipPanel: React.FC<RelationshipPanelProps> = ({
 contact,
 onClose,
 onCall,
 onMessage,
}) => {
 const [aiSummary, setAiSummary] = useState('');
 const [aiLoading, setAiLoading] = useState(false);
 const [events, setEvents] = useState<RelationshipEvent[]>([]);
 const [activeTab, setActiveTab] = useState<'history' | 'tasks' | 'notes'>('history');
 const { observeText } = useCHATROS();

 useEffect(() => {
 if (!contact) return;
 setAiSummary('');
 setEvents([]);
 loadHistory(contact);
 }, [contact?.id]);

 const [flags, setFlags] = useState(kernelAPI.flags.getAll());
 
 useEffect(() => {
 const unsubscribe = kernelAPI.events.subscribe('KERNEL_READY', () => setFlags(kernelAPI.flags.getAll()));
 return unsubscribe;
 }, []);

 const loadHistory = async (c: Contact) => {
 // Phase 1A: Kernel Contacts Migration
 if (flags['use_kernel_contacts']) {
 // Fetch from kernel state instead of legacy services
 try {
 const contactState = kernelAPI.state.get('contacts');
 const activeContact = contactState.activeContactId; // Just for example, usually we'd have a specific get API
 console.info(`[KernelAPI] Loading relationship graph for ${c.id}`);
 // Simulate reading from Kernel RelationshipEngine
 setTimeout(() => {
 setEvents([{ type: 'note', label: 'Kernel Relationship Engine (Migrated)', time: 'Just now', icon: <Sparkles className="w-3 h-3"/>, color: 'text-indigo-400' }]);
 setAiSummary('This contact profile is now fully driven by the CHATR Kernel RelationshipEngine.');
 }, 500);
 } catch (err) {
 console.error('Kernel contact read failed', err);
 }
 return;
 }

 // Load call history for this contact from Supabase (Legacy path)
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const built: RelationshipEvent[] = [];

 if (c.profile_id) {
 // Real call logs
 const { data: calls } = await supabase
 .from('calls')
 .select('*')
 .order('started_at', { ascending: false })
 .limit(10);

 (calls || []).slice(0, 4).forEach(call => {
 built.push({
 type: 'call',
 label: `${call.call_type === 'video' ? 'Video' : 'Voice'} call — ${call.status}`,
 time: new Date(call.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
 icon: <Phone className="w-3 h-3" />,
 color: 'text-blue-400',
 });
 });
 }

 // Check OSScheduler for any meetings with this contact
 const scheduled = osScheduler.getAll().filter(e =>
 e.title?.toLowerCase().includes(c.display_name?.toLowerCase()?.split(' ')[0] || '__none__')
 );
 scheduled.slice(0, 3).forEach(e => {
 built.push({
 type: 'meeting',
 label: e.title,
 time: new Date(e.scheduledFor).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
 icon: <Calendar className="w-3 h-3" />,
 color: 'text-violet-400',
 });
 });

 setEvents(built.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8));
 } catch (err) {
 console.error('[RelationshipPanel] loadHistory error:', err);
 }
 };

 const generateAISummary = async () => {
 if (!contact) return;
 setAiLoading(true);
 try {
 const eventSummary = events.map(e => `${e.type}: ${e.label}`).join('. ');
 const prompt = `Generate a 2-sentence relationship summary for a business contact named ${contact.display_name}. ${eventSummary ? `Known history: ${eventSummary}.` : ''} Focus on what matters most for the next interaction.`;
 const summary = await generate({ prompt });
 setAiSummary(summary || `${contact.display_name} is an active contact. Schedule a follow-up to maintain the relationship.`);
 observeText(summary || '');
 } catch {
 setAiSummary(`${contact.display_name} is in your network. Tap any action below to connect.`);
 } finally {
 setAiLoading(false);
 }
 };

 const handleScheduleReminder = () => {
 if (!contact) return;
 osScheduler.schedule({
 id: crypto.randomUUID(),
 title: `Follow up with ${contact.display_name}`,
 capability: 'core.reminder',
 scheduledFor: new Date(Date.now() + 86400000).toISOString(),
 payload: { contactId: contact.id },
 });
 toast.success(`Reminder set for ${contact.display_name} — tomorrow`);
 };

 if (!contact) {
 return (
 <div className="w-[260px] shrink-0 flex flex-col border-l border-white/[0.04] bg-zinc-950/40 items-center justify-center">
 <div className="text-center p-6">
 <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
 <Users className="w-5 h-5 text-white/20" />
 </div>
 <p className="text-[11px] text-white/30 font-semibold">Select a contact</p>
 <p className="text-[10px] text-white/20 mt-1">Full relationship history appears here</p>
 </div>
 </div>
 );
 }

 return (
 <div className="w-[260px] shrink-0 flex flex-col border-l border-white/[0.04] bg-zinc-950/40 backdrop-blur-xl overflow-hidden">
 {/* Header */}
 <div className="px-4 pt-4 pb-3 border-b border-white/[0.04] shrink-0">
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-3">
 <div className="relative">
 <Avatar className="w-11 h-11 border border-white/10">
 <AvatarImage src={contact.avatar_url || undefined} />
 <AvatarFallback className="bg-gradient-to-br from-violet-600 to-blue-600 text-white text-secondary font-bold">
 {contact.display_name?.[0]?.toUpperCase() || '?'}
 </AvatarFallback>
 </Avatar>
 {contact.is_online && (
 <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
 )}
 </div>
 <div>
 <p className="text-[13px] font-bold text-white leading-tight">{contact.display_name}</p>
 <p className="text-[10px] text-white/40 mt-0.5">{contact.email || contact.phone_number || '@' + (contact.username || 'unknown')}</p>
 </div>
 </div>
 {onClose && (
 <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors">
 <X className="w-3.5 h-3.5" />
 </button>
 )}
 </div>

 {/* AI Summary */}
 {aiSummary ? (
 <div className="p-2.5 rounded-xl bg-violet-500/[0.07] border border-violet-500/15">
 <div className="flex items-center gap-1.5 mb-1">
 <Sparkles className="w-3 h-3 text-violet-400" />
 <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">AI Summary</span>
 </div>
 <p className="text-[10px] text-white/60 leading-relaxed">{aiSummary}</p>
 </div>
 ) : (
 <button
 onClick={generateAISummary}
 disabled={aiLoading}
 className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-500/[0.07] border border-violet-500/15 hover:bg-violet-500/[0.12] transition-colors"
 >
 {aiLoading ? <Loader2 className="w-3 h-3 animate-spin text-violet-400" /> : <Sparkles className="w-3 h-3 text-violet-400" />}
 <span className="text-[10px] font-semibold text-violet-400">Generate AI Summary</span>
 </button>
 )}
 </div>

 {/* Quick Actions */}
 <div className="px-3 py-3 border-b border-white/[0.04] shrink-0">
 <div className="grid grid-cols-4 gap-1.5">
 <QuickAction icon={<Phone className="w-3.5 h-3.5" />} label="Call" color="text-blue-400" onClick={() => onCall?.(contact)} />
 <QuickAction icon={<Mail className="w-3.5 h-3.5" />} label="Email" color="text-cyan-400" onClick={() => { if (contact.email) window.open(`mailto:${contact.email}`); }} />
 <QuickAction icon={<Calendar className="w-3.5 h-3.5" />} label="Meet" color="text-violet-400" onClick={() => observeText(`Schedule meeting with ${contact.display_name}`)} />
 <QuickAction icon={<Bell className="w-3.5 h-3.5" />} label="Remind" color="text-amber-400" onClick={handleScheduleReminder} />
 </div>
 <div className="grid grid-cols-3 gap-1.5 mt-1.5">
 <QuickAction icon={<MessageSquare className="w-3.5 h-3.5" />} label="Chat" color="text-emerald-400" onClick={() => onMessage?.(contact)} />
 <QuickAction icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Task" color="text-pink-400" onClick={() => observeText(`Create task for ${contact.display_name}`)} />
 <QuickAction icon={<FileText className="w-3.5 h-3.5" />} label="Note" color="text-orange-400" onClick={() => observeText(`Take a note about ${contact.display_name}`)} />
 </div>
 </div>

 {/* Tabs */}
 <div className="flex border-b border-white/[0.04] shrink-0">
 {([
 { id: 'history', label: 'History', icon: <History className="w-3 h-3" /> },
 { id: 'tasks', label: 'Tasks', icon: <CheckCircle2 className="w-3 h-3" /> },
 { id: 'notes', label: 'Notes', icon: <FileText className="w-3 h-3" /> },
 ] as const).map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={cn(
 'flex-1 flex items-center justify-center gap-1 py-2.5 text-[9px] font-bold uppercase tracking-widest transition-colors',
 activeTab === tab.id ? 'text-white border-b-2 border-violet-500' : 'text-white/30 hover:text-white/60'
 )}
 >
 {tab.icon}
 {tab.label}
 </button>
 ))}
 </div>

 <ScrollArea className="flex-1">
 <div className="p-3">
 {activeTab === 'history' && (
 <>
 {events.length === 0 ? (
 <div className="text-center py-8">
 <Clock className="w-5 h-5 text-white/15 mx-auto mb-2" />
 <p className="text-[10px] text-white/25">No history yet</p>
 <p className="text-[9px] text-white/15 mt-1">Calls, meetings and messages appear here</p>
 </div>
 ) : (
 <div className="space-y-1.5">
 {events.map((event, i) => (
 <div key={i} className="flex items-start gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
 <div className={cn('p-1.5 rounded-lg bg-white/[0.05] mt-0.5 shrink-0', event.color)}>
 {event.icon}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[11px] text-white/70 font-medium leading-tight">{event.label}</p>
 <p className="text-[9px] text-white/30 mt-0.5">{event.time}</p>
 </div>
 </div>
 ))}
 </div>
 )}
 </>
 )}

 {activeTab === 'tasks' && (
 <div className="text-center py-8">
 <CheckCircle2 className="w-5 h-5 text-white/15 mx-auto mb-2" />
 <p className="text-[10px] text-white/25">No open tasks</p>
 <button
 onClick={() => observeText(`Create task for ${contact.display_name}`)}
 className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-white/40 transition-colors"
 >
 <Plus className="w-3 h-3" /> Add task
 </button>
 </div>
 )}

 {activeTab === 'notes' && (
 <div className="text-center py-8">
 <FileText className="w-5 h-5 text-white/15 mx-auto mb-2" />
 <p className="text-[10px] text-white/25">No notes</p>
 <button
 onClick={() => observeText(`Take a note about ${contact.display_name}`)}
 className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] text-white/40 transition-colors"
 >
 <Plus className="w-3 h-3" /> Add note
 </button>
 </div>
 )}
 </div>
 </ScrollArea>
 </div>
 );
};
