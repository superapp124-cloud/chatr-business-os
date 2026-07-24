import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, UserPlus, Phone, Video, MessageCircle, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useCall } from '@/contexts/CallContext';
import { RelationshipPanel } from '@/components/contacts/RelationshipPanel';

interface Contact {
 id: string;
 profile_id?: string;
 username?: string;
 display_name: string;
 avatar_url: string | null;
 phone_number: string | null;
 email: string | null;
 is_online: boolean;
}

export const DesktopContacts: React.FC = () => {
 const { startCall } = useCall();
 const navigate = useNavigate();
 const [contacts, setContacts] = useState<Contact[]>([]);
 const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [loading, setLoading] = useState(true);
 const [showAddModal, setShowAddModal] = useState(false);
 const [addSearch, setAddSearch] = useState('');
 const [addResults, setAddResults] = useState<any[]>([]);
 const [addLoading, setAddLoading] = useState(false);

 useEffect(() => {
 fetchContacts();
 }, []);

 const fetchContacts = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { data, error } = await supabase
 .from('contacts')
 .select(`
 id, 
 name, 
 phone_number, 
 contact_id,
 profiles!contact_id(id, username, full_name, avatar_url)
 `)
 .eq('user_id', user.id);

 if (error) throw error;

 const formattedContacts: Contact[] = (data || []).map((d: any) => {
 const profile = d.profiles;
 return {
 id: d.id,
 profile_id: profile?.id,
 username: profile?.username,
 display_name: profile?.full_name || profile?.username || d.name || 'Unknown',
 avatar_url: profile?.avatar_url || null,
 phone_number: d.phone_number || null,
 email: null,
 is_online: !!profile,
 };
 }).sort((a, b) => a.display_name.localeCompare(b.display_name));

 setContacts(formattedContacts);
 } catch (error) {
 // console.warn('Error fetching contacts:', error); // Suppressed to avoid UI spam on fresh accounts
 } finally {
 setLoading(false);
 }
 };

 // Open a DM with this contact
 const openChat = useCallback(async (contact: Contact) => {
 if (!contact.profile_id) {
 toast.error('This contact is not a registered CHATR user yet.');
 return;
 }
 try {
 const { data: convId, error } = await supabase
 .rpc('create_direct_conversation', { other_user_id: contact.profile_id });
 if (error) throw error;
 navigate(`/desktop/chat?conv=${convId}`);
 } catch (e) {
 toast.error('Could not open conversation.');
 }
 }, [navigate]);

 // Search for users to add
 const searchUsers = useCallback(async (q: string) => {
 if (!q.trim()) { setAddResults([]); return; }
 setAddLoading(true);
 const { data } = await supabase
 .from('profiles')
 .select('id, username, full_name, avatar_url')
 .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
 .limit(10);
 setAddResults(data || []);
 setAddLoading(false);
 }, []);

 useEffect(() => {
 const t = setTimeout(() => searchUsers(addSearch), 300);
 return () => clearTimeout(t);
 }, [addSearch, searchUsers]);

 const addContact = async (profile: any) => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { error } = await supabase.from('contacts').insert({
 user_id: user.id,
 contact_id: profile.id,
 name: profile.full_name || profile.username,
 phone_number: profile.phone_number || null,
 });
 if (error && error.code !== '23505') {
 toast.error('Failed to add contact');
 } else {
 toast.success(`${profile.full_name || profile.username} added!`);
 fetchContacts();
 setShowAddModal(false);
 setAddSearch('');
 }
 };

 const filteredContacts = contacts.filter(c =>
 c.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (c.phone_number && c.phone_number.includes(searchQuery))
 );


 return (
 <div className="flex h-full bg-background overflow-hidden">
 {/* Add Contact Modal */}
 {showAddModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
 <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
 <div className="flex items-center justify-between p-4 border-b border-white/10">
 <h2 className="text-secondary font-bold text-white">Find People</h2>
 <button onClick={() => { setShowAddModal(false); setAddSearch(''); setAddResults([]); }} className="p-1 rounded-md hover:bg-white/10 text-white/50">
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className="p-4 space-y-3">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
 <input
 autoFocus
 value={addSearch}
 onChange={e => setAddSearch(e.target.value)}
 placeholder="Search by name or username..."
 className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-secondary text-white placeholder-white/30 outline-none focus:border-violet-500/60"
 />
 </div>
 <ScrollArea className="max-h-60">
 {addLoading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>}
 {addResults.map(p => (
 <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer" onClick={() => addContact(p)}>
 <Avatar className="h-9 w-9">
 <AvatarImage src={p.avatar_url} />
 <AvatarFallback className="bg-violet-600/30 text-violet-300 text-label">{(p.full_name || p.username || '?')[0].toUpperCase()}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <p className="text-secondary font-medium text-white truncate">{p.full_name || p.username}</p>
 <p className="text-label text-white/40 truncate">@{p.username}</p>
 </div>
 <button className="px-3 py-1 rounded-lg bg-violet-600/30 text-violet-300 text-button hover:bg-violet-600/50">Add</button>
 </div>
 ))}
 {!addLoading && addSearch.trim() && addResults.length === 0 && (
 <p className="text-center text-secondary text-white/30 py-4">No users found</p>
 )}
 </ScrollArea>
 </div>
 </div>
 </div>
 )}

 {/* Contacts List */}
 <div className="w-80 border-r border-border flex flex-col bg-card/30">
 <div className="p-4 border-b border-border">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-section font-bold">Contacts</h2>
 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAddModal(true)}>
 <UserPlus className="h-4 w-4" />
 </Button>
 </div>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search contacts..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9 h-9 bg-muted/50 text-secondary"
 />
 </div>
 </div>

 <ScrollArea className="flex-1">
 {loading ? (
 <div className="p-4 space-y-4">
 {[...Array(6)].map((_, i) => (
 <div key={i} className="flex items-center gap-3 animate-pulse">
 <div className="w-10 h-10 rounded-full bg-muted" />
 <div className="flex-1 space-y-2">
 <div className="h-3.5 w-24 bg-muted rounded" />
 <div className="h-3 w-32 bg-muted rounded" />
 </div>
 </div>
 ))}
 </div>
 ) : filteredContacts.length === 0 ? (
 <div className="p-8 text-center flex flex-col items-center">
 <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
 <p className="text-secondary font-medium text-muted-foreground">
 {searchQuery ? 'No contacts found' : 'Your address book is empty'}
 </p>
 {!searchQuery && (
 <button onClick={() => setShowAddModal(true)} className="mt-3 text-label text-violet-400 hover:text-violet-300 underline">
 Find people to add
 </button>
 )}
 </div>
 ) : (
 <div className="py-2">
 {filteredContacts.map((contact) => (
 <div
 key={contact.id}
 onClick={() => setSelectedContact(contact)}
 className={cn(
 "group flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer",
 selectedContact?.id === contact.id ? "bg-muted" : "hover:bg-muted/50"
 )}
 >
 <div className="relative shrink-0">
 <Avatar className="h-10 w-10">
 <AvatarImage src={contact.avatar_url || undefined} />
 <AvatarFallback className="bg-primary/10 text-primary font-medium">
 {contact.display_name[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 {contact.is_online && (
 <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-secondary truncate">{contact.display_name}</p>
 <p className="text-label text-muted-foreground truncate">
 {contact.phone_number || contact.email || (contact.username ? `@${contact.username}` : 'No contact info')}
 </p>
 </div>
 {/* Action buttons appear on hover */}
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
 <button
 onClick={e => { e.stopPropagation(); openChat(contact); }}
 className="p-1.5 rounded-lg hover:bg-violet-500/20 text-muted-foreground hover:text-violet-400 transition-colors"
 title="Message"
 >
 <MessageCircle className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={e => { e.stopPropagation(); if (contact.username) startCall(contact.username, false); else toast.error('No username to call'); }}
 className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-400 transition-colors"
 title="Audio Call"
 >
 <Phone className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={e => { e.stopPropagation(); if (contact.username) startCall(contact.username, true); else toast.error('No username to call'); }}
 className="p-1.5 rounded-lg hover:bg-blue-500/20 text-muted-foreground hover:text-blue-400 transition-colors"
 title="Video Call"
 >
 <Video className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </ScrollArea>
 </div>

 {/* Relationship Workspace */}
 <div className="flex-1 flex flex-col min-w-0 bg-background">
 {selectedContact ? (
 <RelationshipWorkspace contact={selectedContact} onChat={openChat} onCall={(c, video) => c.username ? startCall(c.username, video) : toast.error('No username')} />
 ) : (
 <div className="flex-1 flex items-center justify-center">
 <div className="text-center flex flex-col items-center animate-in fade-in zoom-in duration-500">
 <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
 <Users className="h-10 w-10 text-muted-foreground/40" />
 </div>
 <h3 className="text-workspace font-bold text-foreground">Contact Workspace</h3>
 <p className="text-secondary text-muted-foreground mt-2 max-w-[250px]">
 Select a contact to message, call, or view shared history.
 </p>
 <button onClick={() => setShowAddModal(true)} className="mt-4 px-4 py-2 rounded-xl bg-violet-600/20 text-violet-400 text-secondary font-medium hover:bg-violet-600/30 transition-colors">
 Find & Add People
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

// ============================================
// Relationship Workspace Sub-Component
// ============================================

const RelationshipWorkspace: React.FC<{ contact: Contact; onChat: (c: Contact) => void; onCall: (c: Contact, video: boolean) => void }> = ({ contact, onChat, onCall }) => {
 const [activeTab, setActiveTab] = useState('overview');
 const [loading, setLoading] = useState(true);
 const [conversationId, setConversationId] = useState<string | null>(null);
 const [aiSummary, setAiSummary] = useState<string | null>(null);
 
 // Data
 const [messages, setMessages] = useState<any[]>([]);
 const [calls, setCalls] = useState<any[]>([]);
 const [files, setFiles] = useState<any[]>([]);
 
 const navigate = useNavigate();

 useEffect(() => {
 setActiveTab('overview');
 setAiSummary(null);
 fetchRelationshipData();
 }, [contact.id]);


 const fetchRelationshipData = async () => {
 if (!contact.profile_id) {
 setLoading(false);
 return; // Not a registered CHATR user, no history
 }

 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 // 1. Find the shared conversation between these two users
 // A simple approach since it's a 1-on-1: find conversations where both are participants
 const { data: myParticipations } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', user.id);
 const myConvIds = myParticipations?.map(p => p.conversation_id) || [];
 
 let convId = null;
 if (myConvIds.length > 0) {
 const { data: shared } = await supabase
 .from('conversation_participants')
 .select('conversation_id')
 .in('conversation_id', myConvIds)
 .eq('user_id', contact.profile_id)
 .limit(1);
 
 if (shared && shared.length > 0) {
 convId = shared[0].conversation_id;
 setConversationId(convId);
 }
 }

 // 2. Fetch Calls
 const { data: callData } = await supabase
 .from('calls')
 .select('*')
 .or(`caller_id.eq.${contact.profile_id},receiver_id.eq.${contact.profile_id}`)
 .order('started_at', { ascending: false })
 .limit(20);
 setCalls(callData || []);

 if (convId) {
 // 3. Fetch Messages
 const { data: msgData } = await supabase
 .from('messages')
 .select('*')
 .eq('conversation_id', convId)
 .order('created_at', { ascending: false })
 .limit(20);
 setMessages((msgData || []).reverse());

 // 4. Fetch Files
 const { data: fileData } = await supabase
 .from('messages')
 .select('*')
 .eq('conversation_id', convId)
 .eq('message_type', 'file')
 .order('created_at', { ascending: false })
 .limit(20);
 setFiles(fileData || []);
 } else {
 setMessages([]);
 setFiles([]);
 }
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 };

 const generateSummary = async () => {
 if (!conversationId) return toast.info("No conversation history to summarize.");
 setAiSummary('Generating...');
 try {
 const messageDigest = messages
 .slice(-50)
 .map((message: any) => `${message.sender_id || 'unknown'}: ${message.content || message.message || ''}`)
 .join('\n');
 const callDigest = calls
 .slice(0, 10)
 .map((call: any) => `${call.call_type || 'call'} ${call.status || ''} ${call.duration || 0}s ${call.started_at || ''}`)
 .join('\n');
 const fileDigest = files
 .slice(0, 10)
 .map((file: any) => file.file_name || file.content || 'Shared file')
 .join('\n');

 const prompt = `Create a concise relationship summary using only this local CHATR data.

Contact: ${contact.display_name}

Recent messages:
${messageDigest || '(no recent messages)'}

Recent calls:
${callDigest || '(no recent calls)'}

Shared files:
${fileDigest || '(no shared files)'}

Return 2 short paragraphs with context, open action items, and any follow-up suggestions.`;

 const summary = await generate({ prompt, preferLocal: true });
 setAiSummary(summary);
 } catch (err) {
 console.error('[DesktopContacts] local summary failed:', err);
 setAiSummary("Could not generate summary with local Ollama.");
 }
 };

 const quickAction = (action: string) => {
 if (!contact.profile_id) return toast.error("User is not registered on CHATR.");
 
 if (action === 'message' && conversationId) {
 navigate(`/desktop/chat?conversation=${conversationId}`);
 } else if (action === 'audio call') {
 startCall(contact.display_name, false);
 } else if (action === 'video call') {
 startCall(contact.display_name, true);
 } else {
 toast.success(`Starting ${action}...`);
 }
 };

 // Build a unified timeline for the "Timeline" tab
 const timelineItems = [...messages, ...calls, ...files].map(item => {
 if (item.caller_id) return { ...item, _type: 'call', _date: new Date(item.started_at) };
 if (item.message_type === 'file') return { ...item, _type: 'file', _date: new Date(item.created_at) };
 return { ...item, _type: 'message', _date: new Date(item.created_at) };
 }).sort((a, b) => b._date.getTime() - a._date.getTime());

 if (loading) {
 return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
 }

 return (
 <div className="flex-1 flex flex-col h-full">
 {/* Header Profile */}
 <div className="p-8 border-b border-border/50 flex items-start gap-6 bg-card/30">
 <Avatar className="w-24 h-24 shadow-sm border-2 border-background">
 <AvatarImage src={contact.avatar_url || undefined} />
 <AvatarFallback className="text-display bg-primary/10 text-primary">
 {contact.display_name[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0 pt-2">
 <div className="flex items-center gap-3 mb-1">
 <h1 className="text-display truncate text-foreground">{contact.display_name}</h1>
 {contact.is_online && <span className="bg-green-500/10 text-green-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Registered</span>}
 </div>
 <div className="flex items-center gap-4 text-secondary text-muted-foreground mt-2">
 {contact.phone_number && (
 <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {contact.phone_number}</span>
 )}
 {contact.email && (
 <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {contact.email}</span>
 )}
 </div>
 
 <div className="flex items-center gap-3 mt-6">
 <Button onClick={() => onChat(contact)} className="rounded-full shadow-sm">
 <MessageCircle className="w-4 h-4 mr-2" /> Message
 </Button>
 <Button onClick={() => onCall(contact, false)} variant="outline" className="rounded-full">
 <Phone className="w-4 h-4 mr-2" /> Call
 </Button>
 <Button onClick={() => onCall(contact, true)} variant="outline" className="rounded-full">
 <Video className="w-4 h-4 mr-2" /> Video
 </Button>
 </div>
 </div>
 </div>

 <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
 <div className="px-8 border-b border-border/50 bg-card/30">
 <TabsList className="bg-transparent h-12 gap-6 w-full justify-start p-0">
 <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 font-medium">Overview</TabsTrigger>
 <TabsTrigger value="messages" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 font-medium">Messages</TabsTrigger>
 <TabsTrigger value="calls" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 font-medium">Calls</TabsTrigger>
 <TabsTrigger value="files" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 font-medium">Files</TabsTrigger>
 <TabsTrigger value="timeline" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 font-medium">Timeline</TabsTrigger>
 </TabsList>
 </div>

 <ScrollArea className="flex-1">
 <div className="p-8 max-w-4xl mx-auto">
 
 {/* OVERVIEW TAB */}
 <TabsContent value="overview" className="mt-0 space-y-6">
 <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-6 opacity-10">
 <Sparkles className="w-24 h-24 text-blue-500" />
 </div>
 <div className="relative z-10 space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-bold text-blue-500 flex items-center gap-2">
 <Sparkles className="w-4 h-4" /> Relationship Summary
 </h3>
 <Button variant="secondary" size="sm" onClick={generateSummary} className="h-8 text-label bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-none">
 {aiSummary === 'Generating...' ? 'Analyzing...' : 'Generate Insights'}
 </Button>
 </div>
 <div className="text-secondary text-foreground/80 min-h-[60px]">
 {aiSummary ? (
 aiSummary
 ) : (
 <p className="text-muted-foreground italic">
 Generate an AI summary to get a quick digest of your recent interactions, open action items, and context with {contact.display_name}.
 </p>
 )}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="p-5 border border-border rounded-2xl bg-card">
 <h4 className="text-secondary font-semibold mb-1">Recent Activity</h4>
 <p className="text-page font-bold">{messages.length + calls.length} <span className="text-secondary text-muted-foreground">interactions</span></p>
 </div>
 <div className="p-5 border border-border rounded-2xl bg-card">
 <h4 className="text-secondary font-semibold mb-1">Shared Files</h4>
 <p className="text-page font-bold">{files.length} <span className="text-secondary text-muted-foreground">documents</span></p>
 </div>
 </div>
 </TabsContent>

 {/* MESSAGES TAB */}
 <TabsContent value="messages" className="mt-0">
 {messages.length === 0 ? (
 <EmptyState icon={MessageCircle} message="No recent messages" />
 ) : (
 <div className="space-y-4">
 {messages.map(msg => (
 <div key={msg.id} className="p-4 rounded-xl border border-border bg-card/50">
 <p className="text-secondary mb-2">{msg.content}</p>
 <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(msg.created_at), {addSuffix: true})}</p>
 </div>
 ))}
 </div>
 )}
 </TabsContent>

 {/* CALLS TAB */}
 <TabsContent value="calls" className="mt-0">
 {calls.length === 0 ? (
 <EmptyState icon={Phone} message="No recent calls" />
 ) : (
 <div className="space-y-3">
 {calls.map(call => (
 <div key={call.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors">
 <div className={cn(
 "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
 call.status === 'missed' ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
 )}>
 {call.status === 'missed' ? <PhoneMissed className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-secondary capitalize">{call.call_type} Call</p>
 <p className="text-label text-muted-foreground">{format(new Date(call.started_at), 'MMM dd, yyyy · hh:mm a')}</p>
 </div>
 {call.status === 'ended' && call.ended_at && (
 <div className="text-label font-mono text-muted-foreground">
 {Math.floor((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000)}s
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </TabsContent>

 {/* FILES TAB */}
 <TabsContent value="files" className="mt-0">
 {files.length === 0 ? (
 <EmptyState icon={FileText} message="No files shared" />
 ) : (
 <div className="grid grid-cols-2 gap-4">
 {files.map(f => (
 <div key={f.id} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
 <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
 <FileText className="w-5 h-5" />
 </div>
 <div className="min-w-0">
 <p className="font-medium text-secondary truncate">{f.content}</p>
 <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(f.created_at), 'MMM dd, yyyy')}</p>
 </div>
 </div>
 ))}
 </div>
 )}
 </TabsContent>

 {/* TIMELINE TAB */}
 <TabsContent value="timeline" className="mt-0 relative">
 <div className="absolute left-[27px] top-4 bottom-4 w-px bg-border/80" />
 {timelineItems.length === 0 ? (
 <EmptyState icon={Activity} message="No activity yet" />
 ) : (
 <div className="space-y-6">
 {timelineItems.map((item, idx) => (
 <div key={idx} className="flex gap-6 relative z-10">
 <div className="w-14 h-14 rounded-full bg-background border-4 border-background flex items-center justify-center shrink-0 shadow-sm mt-1">
 <div className={cn(
 "w-10 h-10 rounded-full flex items-center justify-center text-white",
 item._type === 'call' ? "bg-emerald-500" : 
 item._type === 'file' ? "bg-indigo-500" : "bg-blue-500"
 )}>
 {item._type === 'call' ? <Phone className="w-4 h-4" /> :
 item._type === 'file' ? <FileText className="w-4 h-4" /> : 
 <MessageCircle className="w-4 h-4" />}
 </div>
 </div>
 <div className="flex-1 bg-card border border-border p-5 rounded-2xl shadow-sm">
 <div className="flex justify-between items-center mb-2">
 <span className="text-label font-bold uppercase tracking-wider text-muted-foreground">
 {item._type}
 </span>
 <span className="text-label text-muted-foreground font-mono">
 {formatDistanceToNow(item._date, {addSuffix: true})}
 </span>
 </div>
 <p className="text-secondary">
 {item._type === 'call' ? `${item.call_type} call (${item.status})` : item.content}
 </p>
 </div>
 </div>
 ))}
 </div>
 )}
 </TabsContent>
 </div>
 </ScrollArea>
 </Tabs>

 {/* Relationship OS — right sidebar */}
 <RelationshipPanel
 contact={selectedContact}
 onCall={(c) => onCall(c, false)}
 onMessage={(c) => onChat(c)}
 />
 </div>
 );
};

const EmptyState = ({ icon: Icon, message }: { icon: any, message: string }) => (
 <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in">
 <Icon className="w-12 h-12 mb-4 opacity-20" />
 <p className="font-medium">{message}</p>
 </div>
);

export default DesktopContacts;
