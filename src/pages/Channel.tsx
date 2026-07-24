import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const ChannelView = () => {
 const { id } = useParams();
 const navigate = useNavigate();
 const [channel, setChannel] = useState<any>(null);
 const [messages, setMessages] = useState<any[]>([]);
 const [content, setContent] = useState('');
 const [isAdmin, setIsAdmin] = useState(false);
 const [user, setUser] = useState<any>(null);

 useEffect(() => {
 supabase.auth.getUser().then(({ data }) => {
 setUser(data.user);
 });
 }, []);

 useEffect(() => {
 if (!id || !user) return;
 
 const fetchData = async () => {
 // Get channel details
 const { data: channelData } = await supabase
 .from('channels')
 .select('*')
 .eq('id', id)
 .single();
 
 setChannel(channelData);

 // Check admin status
 const { data: memberData } = await supabase
 .from('channel_members')
 .select('role')
 .eq('channel_id', id)
 .eq('user_id', user.id)
 .single();
 
 if (memberData && (memberData.role === 'admin' || memberData.role === 'owner')) {
 setIsAdmin(true);
 }

 // Get messages
 const { data: messagesData } = await supabase
 .from('channel_messages')
 .select('*, sender:profiles!channel_messages_sender_id_fkey(*)')
 .eq('channel_id', id)
 .order('created_at', { ascending: true });
 
 setMessages(messagesData || []);
 };
 
 fetchData();

 // Subscribe to new messages
 const subscription = supabase
 .channel('channel_messages')
 .on('postgres_changes', { 
 event: 'INSERT', 
 schema: 'public', 
 table: 'channel_messages',
 filter: `channel_id=eq.${id}`
 }, async (payload) => {
 const { data: senderData } = await supabase
 .from('profiles')
 .select('*')
 .eq('id', payload.new.sender_id)
 .single();
 
 setMessages(prev => [...prev, { ...payload.new, sender: senderData }]);
 })
 .subscribe();

 return () => {
 supabase.removeChannel(subscription);
 };
 }, [id, user]);

 const handleSend = async () => {
 if (!content.trim() || !id || !user) return;
 
 await supabase.from('channel_messages').insert({
 channel_id: id,
 sender_id: user.id,
 content
 });
 
 setContent('');
 };

 if (!channel) return <div>Loading...</div>;

 return (
 <div className="flex flex-col h-screen bg-background">
 {/* Header */}
 <div className="flex items-center gap-3 p-4 border-b">
 <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <Avatar>
 <AvatarImage src={channel.avatar_url} />
 <AvatarFallback>{channel.name?.[0]}</AvatarFallback>
 </Avatar>
 <div>
 <h2 className="font-semibold">{channel.name}</h2>
 <p className="text-label text-muted-foreground">{channel.description}</p>
 </div>
 </div>

 {/* Messages */}
 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {messages.map(msg => (
 <div key={msg.id} className="bg-muted/30 p-3 rounded-xl max-w-[85%] self-start">
 <p className="text-secondary font-medium text-primary mb-1">{msg.sender?.username}</p>
 <p className="text-secondary">{msg.content}</p>
 </div>
 ))}
 </div>

 {/* Input */}
 {isAdmin && (
 <div className="p-4 border-t bg-background">
 <div className="flex gap-2">
 <Input 
 value={content}
 onChange={e => setContent(e.target.value)}
 placeholder="Broadcast a message..."
 onKeyDown={e => e.key === 'Enter' && handleSend()}
 />
 <Button onClick={handleSend} size="icon">
 <Send className="w-4 h-4" />
 </Button>
 </div>
 </div>
 )}
 </div>
 );
};
