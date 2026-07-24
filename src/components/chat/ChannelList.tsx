import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

export const ChannelList = ({ userId }: { userId: string }) => {
 const [channels, setChannels] = useState<any[]>([]);
 const navigate = useNavigate();

 useEffect(() => {
 const fetchChannels = async () => {
 const { data, error } = await supabase
 .from('channel_members')
 .select(`
  channel_id,
  channels (*)
  `)
 .eq('user_id', userId);
 
 if (!error && data) {
 setChannels(data.map((d: any) => d.channels));
 }
 };
 fetchChannels();
 }, [userId]);

 if (channels.length === 0) return null;

 return (
 <div className="space-y-2">
 <h2 className="text-secondary font-semibold text-muted-foreground mb-2 px-1">Your Channels</h2>
 {channels.map((channel) => (
 <div 
 key={channel.id} 
 onClick={() => navigate(`/channels/${channel.id}`)}
 className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer"
 >
 <Avatar className="w-12 h-12">
 <AvatarImage src={channel.avatar_url} />
 <AvatarFallback>{channel.name?.[0]}</AvatarFallback>
 </Avatar>
 <div>
 <h3 className="font-medium text-secondary">{channel.name}</h3>
 <p className="text-label text-muted-foreground">{channel.description}</p>
 </div>
 </div>
 ))}
 </div>
 );
};
