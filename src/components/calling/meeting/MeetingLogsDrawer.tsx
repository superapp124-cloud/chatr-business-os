import React, { useState, useEffect, useRef } from 'react';
import {
 MessageCircle, Users, Activity, FileText, BarChart2,
 Grid, ChevronUp, ChevronDown, Send, UserCheck, UserX, Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MeetingPolls } from './MeetingPolls';

interface LogEvent {
 time: string;
 message: string;
 type: 'join' | 'leave' | 'system' | 'ai' | 'share' | 'mute';
}

interface WaitingPerson {
 id: string;
 name: string;
 avatarColor: string;
}

interface ChatMessage {
 id: string;
 sender_name: string;
 sender_avatar?: string;
 text: string;
 time: string;
 self: boolean;
}

interface SharedFile {
 id: string;
 name: string;
 size: string;
 url: string;
 uploaded_by: string;
}

interface MeetingLogsDrawerProps {
 isOpen: boolean;
 onToggle: () => void;
 logEvents: LogEvent[];
 waitingRoom: WaitingPerson[];
 onAdmit: (id: string) => void;
 onReject: (id: string) => void;
 roomId?: string | null;
}

const LOG_ICONS: Record<string, React.ReactNode> = {
 join: <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />,
 leave: <div className="w-1.5 h-1.5 rounded-full bg-red-400" />,
 system: <div className="w-1.5 h-1.5 rounded-full bg-white/30" />,
 ai: <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />,
 share: <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />,
 mute: <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />,
};

const LOG_COLORS: Record<string, string> = {
 join: 'text-emerald-400/80',
 leave: 'text-red-400/80',
 system: 'text-white/50',
 ai: 'text-purple-400/80',
 share: 'text-blue-400/80',
 mute: 'text-amber-400/80',
};

const MEETING_TABS = [
 { icon: MessageCircle, label: 'Chat' },
 { icon: Activity, label: 'Activity' },
 { icon: FileText, label: 'Files' },
 { icon: BarChart2, label: 'Polls' },
 { icon: Grid, label: 'Apps' },
 { icon: Users, label: 'Waiting' },
];

export const MeetingLogsDrawer: React.FC<MeetingLogsDrawerProps> = ({
 isOpen,
 onToggle,
 logEvents,
 waitingRoom,
 onAdmit,
 onReject,
 roomId,
}) => {
 const [activeTab, setActiveTab] = useState(0);
 const [chatInput, setChatInput] = useState('');
 const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
 const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
 const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar: string } | null>(null);
 const [uploading, setUploading] = useState(false);
 const [chatDisabled, setChatDisabled] = useState(false);
 const chatEndRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Load current user profile
 useEffect(() => {
 const load = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data: profile } = await supabase.from('profiles').select('full_name, username, avatar_url').eq('id', user.id).single();
 setCurrentUser({ id: user.id, name: profile?.full_name || profile?.username || 'You', avatar: profile?.avatar_url || '' });
 };
 load();
 }, []);

 // Sync chat disabled status
 useEffect(() => {
 if (!roomId) return;
 const fetchSettings = async () => {
 const { data } = await supabase.from('session_rooms').select('chat_disabled').eq('id', roomId).single();
 if (data) setChatDisabled(data.chat_disabled || false);
 };
 fetchSettings();

 const channel = supabase.channel(`room-settings-drawer-${roomId}`)
 .on('broadcast', { event: 'host_control' }, (payload) => {
 const { key, value } = payload.payload || {};
 if (key === 'chat_disabled') {
 setChatDisabled(!!value);
 }
 })
 .subscribe();
 
 return () => { supabase.removeChannel(channel); };
 }, [roomId]);

 // Subscribe to live chat channel when room is active
 useEffect(() => {
 if (!roomId) { setChatMessages([]); return; }

 const channelName = `room-chat-${roomId}`;
 const channel = supabase.channel(channelName);

 channel
 .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
 const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 setChatMessages(prev => [
 ...prev,
 {
 id: payload.id || String(Date.now()),
 sender_name: payload.sender_name,
 sender_avatar: payload.sender_avatar,
 text: payload.text,
 time: now,
 self: payload.sender_id === currentUser?.id,
 },
 ]);
 })
 .subscribe();

 return () => { supabase.removeChannel(channel); };
 }, [roomId, currentUser?.id]);

 // Auto-scroll chat
 useEffect(() => {
 chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [chatMessages]);

 const sendChat = async () => {
 if (!chatInput.trim() || !roomId || !currentUser) return;
 const text = chatInput.trim();
 setChatInput('');

 const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 const msgId = String(Date.now());

 // Optimistic local update
 setChatMessages(prev => [
 ...prev,
 { id: msgId, sender_name: currentUser.name, sender_avatar: currentUser.avatar, text, time: now, self: true },
 ]);

 // Broadcast to all peers
 await supabase.channel(`room-chat-${roomId}`).send({
 type: 'broadcast',
 event: 'chat_message',
 payload: { id: msgId, sender_id: currentUser.id, sender_name: currentUser.name, sender_avatar: currentUser.avatar, text },
 });
 };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !roomId || !currentUser) return;
 setUploading(true);
 try {
 const path = `meeting_assets/${roomId}/${Date.now()}_${file.name}`;
 const { error } = await supabase.storage.from('meeting-assets').upload(path, file, { upsert: true });
 if (error) throw error;
 const { data: urlData } = supabase.storage.from('meeting-assets').getPublicUrl(path);
 const newFile: SharedFile = {
 id: path,
 name: file.name,
 size: file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`,
 url: urlData.publicUrl,
 uploaded_by: currentUser.name,
 };
 setSharedFiles(prev => [...prev, newFile]);
 // Notify peers via channel
 await supabase.channel(`room-chat-${roomId}`).send({
 type: 'broadcast',
 event: 'chat_message',
 payload: {
 id: String(Date.now()),
 sender_id: currentUser.id,
 sender_name: currentUser.name,
 sender_avatar: currentUser.avatar,
 text: `📎 Shared a file: ${file.name}`,
 },
 });
 toast.success(`${file.name} uploaded!`);
 } catch (err) {
 toast.error('File upload failed.');
 } finally {
 setUploading(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
 }
 };

 return (
 <div className={cn('border-t border-white/[0.07] bg-zinc-950 flex flex-col transition-all duration-300 shrink-0', isOpen ? 'h-[260px]' : 'h-9')}>
 {/* Toggle Bar */}
 <button
 onClick={onToggle}
 className="h-9 w-full flex items-center gap-3 px-4 hover:bg-white/[0.02] transition-colors shrink-0"
 >
 <div className="flex gap-1.5 items-center">
 {MEETING_TABS.map((t, i) => (
 <div
 key={i}
 onClick={(e) => { e.stopPropagation(); setActiveTab(i); if (!isOpen) onToggle(); }}
 className={cn(
 'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer',
 activeTab === i && isOpen
 ? 'bg-white/[0.08] text-white'
 : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
 )}
 >
 <t.icon className="w-3 h-3" />
 <span className="hidden sm:inline">{t.label}</span>
 {t.label === 'Waiting' && waitingRoom.length > 0 && (
 <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
 {waitingRoom.length}
 </span>
 )}
 </div>
 ))}
 </div>
 <div className="flex-1" />
 {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronUp className="w-3.5 h-3.5 text-white/40" />}
 </button>

 {/* Content */}
 {isOpen && (
 <div className="flex-1 overflow-hidden flex flex-col">
 {/* Chat Tab — Live Supabase Realtime */}
 {activeTab === 0 && (
 <>
 <ScrollArea className="flex-1">
 <div className="px-4 py-3 space-y-3">
 {chatMessages.length === 0 && (
 <p className="text-center text-label text-white/30 py-4">No messages yet. Say hello! 👋</p>
 )}
 {chatMessages.map((msg) => (
 <div key={msg.id} className={cn('flex items-start gap-2', msg.self && 'flex-row-reverse')}>
 {!msg.self && (
 <Avatar className="w-6 h-6 shrink-0">
 <AvatarImage src={msg.sender_avatar} />
 <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-[9px] font-bold text-white">
 {(msg.sender_name || '?')[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 )}
 <div className={cn('max-w-[70%]', msg.self && 'items-end flex flex-col')}>
 {!msg.self && <div className="text-[9px] text-white/40 mb-1">{msg.sender_name} · {msg.time}</div>}
 <div className={cn('px-3 py-2 rounded-2xl text-label', msg.self ? 'bg-purple-600/80 text-white' : 'bg-white/[0.06] text-white/80')}>
 {msg.text}
 </div>
 {msg.self && <div className="text-[9px] text-white/30 mt-1">{msg.time}</div>}
 </div>
 </div>
 ))}
 <div ref={chatEndRef} />
 </div>
 </ScrollArea>
 <div className="px-4 py-2 border-t border-white/[0.05] flex gap-2">
 {chatDisabled ? (
 <div className="flex-1 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2 text-label text-white/40 flex items-center justify-center gap-2">
 <UserX className="w-3.5 h-3.5" />
 Chat is disabled by the host
 </div>
 ) : (
 <>
 <input
 type="text"
 value={chatInput}
 onChange={(e) => setChatInput(e.target.value)}
 onKeyDown={(e) => { if (e.key === 'Enter' && chatInput.trim()) sendChat(); }}
 placeholder={roomId ? 'Message everyone...' : 'Join a call to chat...'}
 disabled={!roomId}
 className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-1.5 text-label text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/40 disabled:opacity-40"
 />
 <button
 onClick={sendChat}
 disabled={!chatInput.trim() || !roomId}
 className="w-8 h-8 rounded-xl bg-purple-600/80 hover:bg-purple-500 disabled:opacity-40 flex items-center justify-center transition-all"
 >
 <Send className="w-3.5 h-3.5 text-white" />
 </button>
 </>
 )}
 </div>
 </>
 )}

 {/* Activity Tab — Real logEvents from parent */}
 {activeTab === 1 && (
 <ScrollArea className="flex-1">
 <div className="px-4 py-3 space-y-2">
 <h4 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">Meeting Activity</h4>
 {logEvents.length === 0 && (
 <p className="text-label text-white/30 text-center py-4">No activity recorded yet.</p>
 )}
 {logEvents.map((event, i) => (
 <div key={i} className="flex items-center gap-3">
 <span className="text-[9px] font-mono text-white/30 w-12 shrink-0">{event.time}</span>
 <div className="shrink-0">{LOG_ICONS[event.type]}</div>
 <span className={cn('text-label', LOG_COLORS[event.type])}>{event.message}</span>
 </div>
 ))}
 </div>
 </ScrollArea>
 )}

 {/* Files Tab — Real Supabase Storage uploads */}
 {activeTab === 2 && (
 <ScrollArea className="flex-1">
 <div className="px-4 py-3 space-y-2">
 <div className="flex items-center justify-between mb-2">
 <h4 className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Shared Files</h4>
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={!roomId || uploading}
 className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-600/40 hover:bg-purple-500/60 disabled:opacity-40 text-purple-300 text-[9px] font-bold transition-all"
 >
 <Upload className="w-2.5 h-2.5" />
 {uploading ? 'Uploading…' : 'Share File'}
 </button>
 <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
 </div>
 {sharedFiles.length === 0 && (
 <p className="text-label text-white/30 text-center py-4">No files shared yet.</p>
 )}
 {sharedFiles.map((file) => (
 <a
 key={file.id}
 href={file.url}
 target="_blank"
 rel="noopener noreferrer"
 className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-left group"
 >
 <div className="w-8 h-8 rounded-lg flex items-center justify-center text-section shrink-0 bg-purple-500/10 border border-purple-500/20">
 📎
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-label text-white/90 truncate">{file.name}</div>
 <div className="text-[9px] text-white/40">{file.size} · by {file.uploaded_by}</div>
 </div>
 <div className="text-[9px] font-bold text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">Open</div>
 </a>
 ))}
 </div>
 </ScrollArea>
 )}

 {/* Polls Tab */}
 {activeTab === 3 && (
 <MeetingPolls />
 )}

 {/* Apps Tab */}
 {activeTab === 4 && (
 <ScrollArea className="flex-1">
 <div className="px-4 py-3">
 <h4 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-3">Meeting Apps</h4>
 <div className="grid grid-cols-4 gap-2">
 {[
 { name: 'Jira', icon: '🎯', url: 'https://jira.atlassian.com' },
 { name: 'Notion', icon: '📝', url: 'https://notion.so' },
 { name: 'Salesforce', icon: '💼', url: 'https://login.salesforce.com' },
 { name: 'ServiceNow', icon: '🔧', url: 'https://servicenow.com' },
 { name: 'GitHub', icon: '🐙', url: 'https://github.com' },
 { name: 'Google Docs', icon: '📄', url: 'https://docs.google.com' },
 { name: 'Power BI', icon: '📊', url: 'https://powerbi.microsoft.com' },
 { name: 'Outlook', icon: '📅', url: 'https://outlook.office.com' }
 ].map((app, i) => (
 <button 
 key={i} 
 onClick={() => window.open(app.url, '_blank')} 
 className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all"
 title={`Open ${app.name} in browser`}
 >
 <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-body">
 {app.icon}
 </div>
 <span className="text-[8px] text-white/50 truncate w-full text-center">{app.name}</span>
 </button>
 ))}
 </div>
 </div>
 </ScrollArea>
 )}

 {/* Waiting Room Tab */}
 {activeTab === 5 && (
 <ScrollArea className="flex-1">
 <div className="px-4 py-3">
 <h4 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-3">
 Waiting Room {waitingRoom.length > 0 && `(${waitingRoom.length})`}
 </h4>
 {waitingRoom.length === 0 ? (
 <div className="text-center py-6">
 <Users className="w-6 h-6 text-white/20 mx-auto mb-2" />
 <p className="text-label text-white/30">No one is waiting</p>
 </div>
 ) : (
 <div className="space-y-2">
 {waitingRoom.map((person) => (
 <div key={person.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-amber-500/20">
 <div className="w-8 h-8 rounded-full flex items-center justify-center text-label font-bold text-white shrink-0" style={{ background: person.avatarColor }}>
 {person.name[0]}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-label text-white/90 truncate">{person.name}</div>
 <div className="flex items-center gap-1">
 <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
 <span className="text-[9px] text-amber-400">Waiting...</span>
 </div>
 </div>
 <div className="flex gap-1.5">
 <button onClick={() => onAdmit(person.id)} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-500 rounded-lg text-white text-[10px] font-bold transition-all">
 <UserCheck className="w-3 h-3" />
 Admit
 </button>
 <button onClick={() => onReject(person.id)} className="flex items-center gap-1 px-2.5 py-1 bg-red-600/80 hover:bg-red-500 rounded-lg text-white text-[10px] font-bold transition-all">
 <UserX className="w-3 h-3" />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </ScrollArea>
 )}
 </div>
 )}
 </div>
 );
};
