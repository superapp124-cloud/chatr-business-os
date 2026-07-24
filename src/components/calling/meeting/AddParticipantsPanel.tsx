import React, { useState, useEffect } from 'react';
import { X, Search, Mail, Phone, UserPlus, Link, Copy, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AddParticipantsPanelProps {
 onClose: () => void;
 onAdd: (target: string) => void;
 meetingLink?: string;
}

interface RecentContact {
 id: string;
 full_name: string;
 username: string;
 avatar_url: string;
}

const TABS = ['Search', 'Email', 'Phone', 'Guest Link'];

const GRADIENT_COLORS = [
 'from-blue-600 to-cyan-500',
 'from-pink-600 to-rose-500',
 'from-orange-600 to-amber-500',
 'from-emerald-600 to-teal-500',
 'from-purple-600 to-fuchsia-500',
];

export const AddParticipantsPanel: React.FC<AddParticipantsPanelProps> = ({
 onClose,
 onAdd,
 meetingLink,
}) => {
 const [activeTab, setActiveTab] = useState(0);
 const [input, setInput] = useState('');
 const [copiedLink, setCopiedLink] = useState(false);
 const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);
 const [searchResults, setSearchResults] = useState<RecentContact[]>([]);
 const [searching, setSearching] = useState(false);

 // Generate a real meeting link from the room ID or window location
 const realMeetingLink = meetingLink || window.location.href;

 // Load real recent contacts from Supabase (people you've called recently)
 useEffect(() => {
 const load = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { data: calls } = await supabase
 .from('calls')
 .select('caller_id, receiver_id')
 .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
 .order('created_at', { ascending: false })
 .limit(20);

 if (!calls?.length) return;

 const otherIds = [...new Set(
 calls.map(c => c.caller_id === user.id ? c.receiver_id : c.caller_id).filter(Boolean)
 )].slice(0, 5);

 if (!otherIds.length) return;

 const { data: profiles } = await supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url')
 .in('id', otherIds);

 if (profiles) setRecentContacts(profiles as RecentContact[]);
 };
 load();
 }, []);

 // Search Supabase profiles on input change
 useEffect(() => {
 if (!input.trim() || activeTab !== 0) { setSearchResults([]); return; }
 const timeout = setTimeout(async () => {
 setSearching(true);
 const { data } = await supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url')
 .or(`username.ilike.%${input.trim()}%,full_name.ilike.%${input.trim()}%`)
 .limit(5);
 setSearchResults((data as RecentContact[]) || []);
 setSearching(false);
 }, 300);
 return () => clearTimeout(timeout);
 }, [input, activeTab]);

 const handleAdd = (target?: string) => {
 const val = target || input.trim();
 if (!val) return;
 onAdd(val);
 setInput('');
 toast.success(`Invite sent to ${val}`);
 };

 const copyLink = () => {
 navigator.clipboard.writeText(realMeetingLink).catch(() => {});
 setCopiedLink(true);
 setTimeout(() => setCopiedLink(false), 2000);
 toast.success('Meeting link copied!');
 };

 const sendEmailInvite = async () => {
 if (!input.trim()) return;
 try {
 await supabase.functions.invoke('send-meeting-invite', {
 body: { email: input.trim(), meetingLink: realMeetingLink },
 });
 toast.success(`Email invite sent to ${input.trim()}`);
 setInput('');
 } catch {
 toast.error('Failed to send email. Please copy the link manually.');
 }
 };

 const sendSmsInvite = async () => {
 if (!input.trim()) return;
 try {
 await supabase.functions.invoke('send-sms-invite', {
 body: { phone: input.trim(), meetingLink: realMeetingLink },
 });
 toast.success(`SMS invite sent to ${input.trim()}`);
 setInput('');
 } catch {
 toast.error('Failed to send SMS. Please copy the link manually.');
 }
 };

 const displayContacts = input.trim() && searchResults.length > 0 ? searchResults : recentContacts;

 return (
 <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-80 bg-zinc-900 border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200 z-50">
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
 <h3 className="text-secondary font-bold text-white">Add Participants</h3>
 <button onClick={onClose} className="w-6 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors">
 <X className="w-3.5 h-3.5 text-white/60" />
 </button>
 </div>

 {/* Tabs */}
 <div className="flex border-b border-white/[0.07]">
 {TABS.map((tab, i) => (
 <button
 key={tab}
 onClick={() => { setActiveTab(i); setInput(''); }}
 className={cn(
 'flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all',
 activeTab === i
 ? 'text-purple-400 border-b-2 border-purple-500 bg-purple-500/5'
 : 'text-white/40 hover:text-white/60'
 )}
 >
 {tab}
 </button>
 ))}
 </div>

 <div className="p-3 space-y-3">
 {/* Search Tab */}
 {activeTab === 0 && (
 <div className="space-y-3">
 <div className="flex gap-2">
 <div className="flex-1 flex items-center gap-2 bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2">
 <Search className="w-3.5 h-3.5 text-white/30 shrink-0" />
 <input
 autoFocus
 type="text"
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
 placeholder="Search CHATR users..."
 className="flex-1 bg-transparent text-secondary text-white placeholder:text-white/30 focus:outline-none"
 />
 </div>
 <button
 onClick={() => handleAdd()}
 disabled={!input}
 className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white transition-all"
 >
 <UserPlus className="w-4 h-4" />
 </button>
 </div>

 {/* Real Contacts */}
 <div>
 <div className="flex items-center gap-1.5 mb-2">
 <Clock className="w-3 h-3 text-white/30" />
 <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
 {input.trim() && searchResults.length > 0 ? 'Search Results' : 'Recent Contacts'}
 </span>
 {searching && <span className="text-[9px] text-purple-400">Searching…</span>}
 </div>
 {displayContacts.length === 0 && !searching && (
 <p className="text-[10px] text-white/30 text-center py-2">
 {input.trim() ? 'No users found.' : 'No recent contacts yet.'}
 </p>
 )}
 <div className="space-y-1">
 {displayContacts.map((c, i) => (
 <button
 key={c.id}
 onClick={() => handleAdd(c.username || c.id)}
 className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-colors group text-left"
 >
 <Avatar className="w-7 h-7 shrink-0">
 <AvatarImage src={c.avatar_url} />
 <AvatarFallback className={cn('text-label font-bold text-white bg-gradient-to-br', GRADIENT_COLORS[i % GRADIENT_COLORS.length])}>
 {(c.full_name || c.username || '?')[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="text-label text-white/90 truncate">{c.full_name || c.username}</div>
 <div className="text-[9px] text-white/40">@{c.username}</div>
 </div>
 <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Email Tab */}
 {activeTab === 1 && (
 <div className="space-y-3">
 <div className="flex items-center gap-2 bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2">
 <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
 <input
 autoFocus
 type="email"
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && sendEmailInvite()}
 placeholder="Enter email address..."
 className="flex-1 bg-transparent text-secondary text-white placeholder:text-white/30 focus:outline-none"
 />
 </div>
 <button
 onClick={sendEmailInvite}
 disabled={!input}
 className="w-full py-2.5 rounded-xl bg-blue-600/80 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-button font-bold transition-all flex items-center justify-center gap-2"
 >
 <Mail className="w-3.5 h-3.5" />
 Send Email Invite
 </button>
 <p className="text-[10px] text-white/30 text-center">
 An invite email will be sent with the meeting link.
 </p>
 </div>
 )}

 {/* Phone Tab */}
 {activeTab === 2 && (
 <div className="space-y-3">
 <div className="flex items-center gap-2 bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2">
 <Phone className="w-3.5 h-3.5 text-orange-400 shrink-0" />
 <input
 autoFocus
 type="tel"
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && sendSmsInvite()}
 placeholder="+91 XXXXX XXXXX"
 className="flex-1 bg-transparent text-secondary text-white placeholder:text-white/30 focus:outline-none"
 />
 </div>
 <button
 onClick={sendSmsInvite}
 disabled={!input}
 className="w-full py-2.5 rounded-xl bg-orange-600/80 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-button font-bold transition-all flex items-center justify-center gap-2"
 >
 <Phone className="w-3.5 h-3.5" />
 Send SMS Invite
 </button>
 <p className="text-[10px] text-white/30 text-center">
 An SMS with the meeting link will be sent to this number.
 </p>
 </div>
 )}

 {/* Guest Link Tab */}
 {activeTab === 3 && (
 <div className="space-y-3">
 <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl space-y-2">
 <div className="flex items-center gap-2">
 <Link className="w-3.5 h-3.5 text-purple-400 shrink-0" />
 <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Meeting Link</span>
 </div>
 <div className="font-mono text-label text-white/70 break-all">{realMeetingLink}</div>
 </div>
 <button
 onClick={copyLink}
 className={cn(
 'w-full py-2.5 rounded-xl text-label font-bold transition-all flex items-center justify-center gap-2',
 copiedLink
 ? 'bg-emerald-600/80 text-white border border-emerald-500/30'
 : 'bg-purple-600/80 hover:bg-purple-500 text-white border border-purple-500/30'
 )}
 >
 <Copy className="w-3.5 h-3.5" />
 {copiedLink ? 'Copied!' : 'Copy Meeting Link'}
 </button>
 <p className="text-[10px] text-white/30 text-center">
 Anyone with this link can join the meeting.
 </p>
 </div>
 )}
 </div>
 </div>
 );
};
