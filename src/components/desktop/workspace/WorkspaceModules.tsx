import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Search, Clock, Briefcase, CheckCircle2, FileText, Settings, Zap, MoreHorizontal, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// ============================================
// Conversations Module
// ============================================
export const WorkspaceConversations: React.FC = () => {
 const [conversations, setConversations] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const navigate = useNavigate();

 useEffect(() => {
 fetchConversations();
 }, []);

 const fetchConversations = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { data: myParticipations } = await supabase
 .from('conversation_participants')
 .select('conversation_id, conversations(updated_at, id)')
 .eq('user_id', user.id);

 const conversationIds = (myParticipations || []).map(p => p.conversation_id);
 if (conversationIds.length === 0) { setConversations([]); setLoading(false); return; }

 const { data: otherParticipants } = await supabase
 .from('conversation_participants')
 .select('conversation_id, profiles!inner(id, username, full_name, avatar_url)')
 .in('conversation_id', conversationIds)
 .neq('user_id', user.id);

 const { data: recentMessages } = await supabase
 .from('messages')
 .select('conversation_id, content, created_at, sender_id')
 .in('conversation_id', conversationIds)
 .order('created_at', { ascending: false });

 const messagesByConv = (recentMessages || []).reduce((acc: any, msg: any) => {
 if (!acc[msg.conversation_id]) acc[msg.conversation_id] = msg;
 return acc;
 }, {});

 const otherProfilesByConv = (otherParticipants || []).reduce((acc: any, p: any) => {
 if (!acc[p.conversation_id]) acc[p.conversation_id] = (p as any).profiles;
 return acc;
 }, {});

 const formatted = (myParticipations || []).map((d: any) => {
 const profile = otherProfilesByConv[d.conversation_id];
 const lastMsg = messagesByConv[d.conversation_id];
 return {
 id: d.conversation_id,
 name: profile?.full_name || profile?.username || 'Unknown',
 avatar_url: profile?.avatar_url,
 last_message: lastMsg?.content || 'No messages yet',
 last_message_at: lastMsg?.created_at || '',
 is_my_message: lastMsg?.sender_id === user.id,
 };
 }).sort((a: any, b: any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

 setConversations(formatted);
 } finally {
 setLoading(false);
 }
 };

 const filtered = conversations.filter(c =>
 c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 c.last_message.toLowerCase().includes(searchQuery.toLowerCase())
 );

 return (
 <div className="flex-1 flex flex-col overflow-hidden">
 <div className="p-4 border-b border-border/50 space-y-3">
 <h2 className="text-section font-bold">Conversations</h2>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Search conversations..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
 </div>
 </div>
 <ScrollArea className="flex-1">
 {loading ? (
 <div className="p-4 space-y-3">
 {[...Array(6)].map((_, i) => (
 <div key={i} className="flex items-center gap-3 animate-pulse">
 <div className="w-12 h-12 rounded-full bg-muted" />
 <div className="flex-1 space-y-2">
 <div className="h-4 w-32 bg-muted rounded" />
 <div className="h-3 w-48 bg-muted rounded" />
 </div>
 </div>
 ))}
 </div>
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
 <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
 <p className="font-medium">{searchQuery ? 'No conversations found' : 'No conversations yet'}</p>
 </div>
 ) : (
 <div>
 {filtered.map(c => (
 <button
 key={c.id}
 onClick={() => navigate(`/desktop/chat?conversation=${c.id}`)}
 className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
 >
 <Avatar className="h-12 w-12 shrink-0">
 <AvatarImage src={c.avatar_url} />
 <AvatarFallback>{c.name[0]?.toUpperCase()}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between mb-0.5">
 <p className="font-medium truncate">{c.name}</p>
 {c.last_message_at && (
 <span className="text-label text-muted-foreground shrink-0 ml-2">
 {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
 </span>
 )}
 </div>
 <p className="text-secondary text-muted-foreground truncate">
 {c.is_my_message ? '↗ ' : ''}{c.last_message}
 </p>
 </div>
 <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
 </button>
 ))}
 </div>
 )}
 </ScrollArea>
 </div>
 );
};

// ============================================
// Work Module (Tasks + Documents)
// ============================================
export const WorkspaceWork: React.FC = () => {
 const [tasks, setTasks] = useState<any[]>([]);
 const [files, setFiles] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<'tasks' | 'files'>('tasks');

 useEffect(() => {
 fetchData();
 }, []);

 const fetchData = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 // Fetch tasks (from workspace_tasks if exists, fallback to empty)
 const { data: taskData } = await supabase
 .from('workspace_tasks')
 .select('*')
 .eq('status', 'pending')
 .order('created_at', { ascending: false })
 .limit(20);

 setTasks(taskData || []);

 // Fetch files shared in messages
 const { data: fileMessages } = await supabase
 .from('messages')
 .select('id, content, created_at, sender_id, conversation_id, profiles!sender_id(username, full_name)')
 .eq('message_type', 'file')
 .order('created_at', { ascending: false })
 .limit(20);

 setFiles(fileMessages || []);
 } catch (err) {
 console.error('WorkspaceWork fetch error:', err);
 } finally {
 setLoading(false);
 }
 };

 const completeTask = async (taskId: string) => {
 setTasks(prev => prev.filter(t => t.id !== taskId));
 await supabase.from('workspace_tasks').update({ status: 'completed' }).eq('id', taskId);
 };

 return (
 <div className="flex-1 flex flex-col overflow-hidden">
 <div className="p-4 border-b border-border/50">
 <h2 className="text-section font-bold mb-3">Work</h2>
 <div className="flex gap-1">
 {(['tasks', 'files'] as const).map(tab => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={cn(
 "px-4 py-2 rounded-lg text-secondary font-medium transition-colors capitalize",
 activeTab === tab ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
 )}
 >
 {tab === 'tasks' ? <><CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />Tasks</> : <><FileText className="w-3.5 h-3.5 inline mr-1.5" />Files</>}
 </button>
 ))}
 </div>
 </div>

 <ScrollArea className="flex-1 p-4">
 {loading ? (
 <div className="space-y-3">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
 ))}
 </div>
 ) : activeTab === 'tasks' ? (
 tasks.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
 <CheckCircle2 className="w-12 h-12 mb-3 opacity-30" />
 <p className="font-medium">All caught up!</p>
 <p className="text-secondary">No pending tasks</p>
 </div>
 ) : (
 <div className="space-y-2">
 {tasks.map(task => (
 <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
 <button onClick={() => completeTask(task.id)} className="mt-0.5 w-5 h-5 rounded-full border-2 border-muted-foreground hover:border-primary hover:bg-primary/10 transition-colors shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="font-medium text-secondary">{task.title}</p>
 {task.description && <p className="text-label text-muted-foreground mt-0.5 truncate">{task.description}</p>}
 {task.due_date && (
 <div className="flex items-center gap-1 mt-1">
 <Clock className="w-3 h-3 text-muted-foreground" />
 <span className="text-[11px] text-muted-foreground">{format(new Date(task.due_date), 'dd MMM, HH:mm')}</span>
 </div>
 )}
 </div>
 <Badge variant="outline" className="text-[10px] shrink-0">{task.task_type || 'task'}</Badge>
 </div>
 ))}
 </div>
 )
 ) : (
 files.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
 <FileText className="w-12 h-12 mb-3 opacity-30" />
 <p className="font-medium">No files yet</p>
 <p className="text-secondary">Files shared in conversations appear here</p>
 </div>
 ) : (
 <div className="space-y-2">
 {files.map(file => (
 <div key={file.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
 <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-400/10 flex items-center justify-center shrink-0">
 <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-secondary font-medium truncate">{file.content}</p>
 <p className="text-label text-muted-foreground">
 {(file.profiles as any)?.full_name || (file.profiles as any)?.username || 'Unknown'} · {format(new Date(file.created_at), 'dd MMM, HH:mm')}
 </p>
 </div>
 </div>
 ))}
 </div>
 )
 )}
 </ScrollArea>
 </div>
 );
};

// ============================================
// More Module (Settings/Integrations shortcuts)
// ============================================
export const WorkspaceMore: React.FC = () => {
 const navigate = useNavigate();

 const shortcuts = [
 { icon: Settings, label: 'Desktop Settings', desc: 'Theme, notifications, keyboard shortcuts', action: () => navigate('/desktop/settings') },
 { icon: Zap, label: 'AI Intelligence', desc: 'View AI summaries, insights and memory', action: () => navigate('/desktop/intelligence') },
 { icon: MessageCircle, label: 'Open Chat', desc: 'Switch to full chat view', action: () => navigate('/desktop/chat') },
 { icon: Briefcase, label: 'Calls', desc: 'Call history and new call', action: () => navigate('/desktop/calls') },
 ];

 return (
 <div className="flex-1 overflow-auto p-6">
 <h2 className="text-section font-bold mb-6">More</h2>
 <div className="grid grid-cols-2 gap-4">
 {shortcuts.map((s, i) => (
 <button
 key={i}
 onClick={s.action}
 className="flex flex-col items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
 >
 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
 <s.icon className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="font-semibold text-secondary">{s.label}</p>
 <p className="text-label text-muted-foreground mt-0.5">{s.desc}</p>
 </div>
 </button>
 ))}
 </div>
 </div>
 );
};
