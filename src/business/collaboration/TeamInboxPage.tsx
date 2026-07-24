import React, { useState, useEffect } from 'react';
import { Search, Phone, Video, MoreVertical, Bot, Clock, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface InboxThread {
 id: string;
 customer_name: string;
 customer_phone: string | null;
 last_message: string;
 last_message_at: string;
 status: string;
 unread_count: number;
 assigned_agent: string | null;
}

interface TimelineEvent {
 id: string;
 type: string;
 content: string;
 created_at: string;
 author: string;
}

export const BusinessInbox = () => {
 const { toast } = useToast();
 const [threads, setThreads] = useState<InboxThread[]>([]);
 const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
 const [activeThread, setActiveThread] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
 const [search, setSearch] = useState('');

 useEffect(() => {
 loadThreads();
 // Subscribe to realtime updates for new conversations
 const channel = supabase
 .channel('business_conversations_inbox')
 .on('postgres_changes', { event: '*', schema: 'public', table: 'business_conversations' }, () => {
 loadThreads();
 })
 .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [filter]);

 useEffect(() => {
 if (activeThread) loadTimeline(activeThread);
 }, [activeThread]);

 const loadThreads = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { data: profile } = await supabase
 .from('business_profiles')
 .select('id')
 .eq('user_id', user.id)
 .single();

 if (!profile) return;

 let query = supabase
 .from('business_conversations')
 .select('*')
 .eq('business_id', profile.id)
 .order('last_message_at', { ascending: false });

 if (filter !== 'all') {
 query = query.eq('status', filter);
 }

 const { data, error } = await query;
 if (error) throw error;
 setThreads(data || []);
 if (data && data.length > 0 && !activeThread) {
 setActiveThread(data[0].id);
 }
 } catch (error) {
 console.error('Error loading inbox:', error);
 } finally {
 setLoading(false);
 }
 };

 const loadTimeline = async (conversationId: string) => {
 try {
 const { data, error } = await supabase
 .from('business_conversation_events')
 .select('*')
 .eq('conversation_id', conversationId)
 .order('created_at', { ascending: true });
 if (!error) setTimeline(data || []);
 } catch {
 setTimeline([]);
 }
 };

 const resolveThread = async (threadId: string) => {
 const { error } = await supabase
 .from('business_conversations')
 .update({ status: 'resolved' })
 .eq('id', threadId);
 if (!error) {
 toast({ title: 'Conversation resolved' });
 loadThreads();
 }
 };

 const filteredThreads = threads.filter(t =>
 !search || t.customer_name?.toLowerCase().includes(search.toLowerCase())
 );

 const activeConversation = threads.find(t => t.id === activeThread);

 if (loading) {
 return (
 <div className="flex items-center justify-center h-full">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="flex h-full bg-background">
 {/* Inbox List */}
 <div className="w-80 border-r flex flex-col">
 <div className="p-4 border-b">
 <h2 className="font-semibold text-section mb-3">Team Inbox</h2>
 <div className="relative mb-3">
 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 className="pl-9"
 placeholder="Search conversations..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 />
 </div>
 <Tabs value={filter} onValueChange={v => setFilter(v as any)}>
 <TabsList className="w-full">
 <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
 <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
 <TabsTrigger value="resolved" className="flex-1">Resolved</TabsTrigger>
 </TabsList>
 </Tabs>
 </div>

 <div className="flex-1 overflow-y-auto">
 {filteredThreads.length === 0 ? (
 <div className="p-8 text-center text-muted-foreground">
 <User className="h-10 w-10 mx-auto mb-2 opacity-40" />
 <p className="text-secondary">No conversations yet</p>
 <p className="text-label mt-1">Customer messages will appear here</p>
 </div>
 ) : (
 filteredThreads.map(thread => (
 <div
 key={thread.id}
 onClick={() => setActiveThread(thread.id)}
 className={`p-4 border-b cursor-pointer transition-colors ${
 activeThread === thread.id
 ? 'bg-primary/10 border-l-4 border-l-primary'
 : 'hover:bg-accent/5 border-l-4 border-l-transparent'
 }`}
 >
 <div className="flex items-start justify-between mb-1">
 <div className="flex items-center gap-2">
 <Avatar className="h-8 w-8">
 <AvatarFallback className="text-label bg-primary/10 text-primary">
 {thread.customer_name?.charAt(0)?.toUpperCase() || '?'}
 </AvatarFallback>
 </Avatar>
 <span className="font-medium text-secondary">{thread.customer_name}</span>
 </div>
 <div className="flex items-center gap-1">
 {thread.unread_count > 0 && (
 <Badge className="text-label h-5 px-1.5 bg-primary">{thread.unread_count}</Badge>
 )}
 <Badge variant={thread.status === 'open' ? 'default' : 'secondary'} className="text-label">
 {thread.status}
 </Badge>
 </div>
 </div>
 <p className="text-label text-muted-foreground truncate ml-10">{thread.last_message}</p>
 <p className="text-label text-muted-foreground mt-1 ml-10">
 {thread.last_message_at
 ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })
 : '—'}
 </p>
 </div>
 ))
 )}
 </div>
 </div>

 {/* Conversation Detail */}
 <div className="flex-1 flex flex-col">
 {activeConversation ? (
 <>
 <div className="p-4 border-b flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Avatar className="h-9 w-9">
 <AvatarFallback className="bg-primary/10 text-primary">
 {activeConversation.customer_name?.charAt(0)?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div>
 <p className="font-semibold">{activeConversation.customer_name}</p>
 <p className="text-label text-muted-foreground">{activeConversation.customer_phone || 'No phone'}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Button variant="ghost" size="icon"><Phone className="h-4 w-4" /></Button>
 <Button variant="ghost" size="icon"><Video className="h-4 w-4" /></Button>
 {activeConversation.status === 'open' && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => resolveThread(activeConversation.id)}
 >
 <CheckCircle className="h-4 w-4 mr-1" />
 Resolve
 </Button>
 )}
 <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
 </div>
 </div>

 {/* Timeline */}
 <div className="flex-1 overflow-y-auto p-4 space-y-3">
 {timeline.length === 0 ? (
 <div className="text-center py-8 text-muted-foreground text-secondary">
 No events recorded yet
 </div>
 ) : (
 timeline.map(event => (
 <div key={event.id} className={`flex gap-3 ${event.type === 'ai_summary' ? 'bg-primary/5 rounded-lg p-3' : ''}`}>
 <div className="mt-0.5">
 {event.type === 'ai_summary' ? (
 <Bot className="h-4 w-4 text-primary" />
 ) : event.type === 'call' ? (
 <Phone className="h-4 w-4 text-green-500" />
 ) : (
 <Clock className="h-4 w-4 text-muted-foreground" />
 )}
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <span className="text-label ">{event.author}</span>
 <span className="text-label text-muted-foreground">
 {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
 </span>
 </div>
 <p className="text-secondary mt-0.5">{event.content}</p>
 </div>
 </div>
 ))
 )}
 </div>
 </>
 ) : (
 <div className="flex-1 flex items-center justify-center text-muted-foreground">
 <div className="text-center">
 <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
 <p>Select a conversation to view details</p>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default BusinessInbox;
