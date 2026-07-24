import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Users, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CommunitiesScreenProps {
 userId: string;
}

export function CommunitiesScreen({ userId }: CommunitiesScreenProps) {
 const navigate = useNavigate();

 const promotedGroups = [
 { id: '1', name: 'Tech Enthusiasts Pakistan', members: 12453, image: '💻', description: 'Discuss latest tech trends' },
 { id: '2', name: 'Startup Founders Network', members: 8932, image: '🚀', description: 'Connect with entrepreneurs' },
 ];

 const myGroups = [
 { id: '3', name: 'Family', members: 8, image: '👨‍👩‍👧‍👦', unread: 3 },
 { id: '4', name: 'College Friends', members: 24, image: '🎓', unread: 12 },
 { id: '5', name: 'Work Team', members: 15, image: '💼', unread: 0 },
 ];

 const channels = [
 { id: 'c1', name: 'CHATR Updates', subscribers: 50234, image: '📢', verified: true },
 { id: 'c2', name: 'Tech News Daily', subscribers: 23456, image: '📱', verified: true },
 { id: 'c3', name: 'Motivational Quotes', subscribers: 67890, image: '✨', verified: false },
 ];

 return (
 <div className="h-screen flex flex-col bg-background">
 <div className="bg-gradient-to-r from-primary via-primary-glow to-primary text-white p-4 shadow-lg">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <button onClick={() => navigate('/chat')} className="p-1">
 <ArrowLeft className="w-6 h-6" />
 </button>
 <h1 className="text-workspace font-bold">Communities</h1>
 </div>
 <button className="p-2 rounded-full bg-white/10">
 <Plus className="w-5 h-5" />
 </button>
 </div>
 </div>

 <Tabs defaultValue="groups" className="flex-1 flex flex-col">
 <TabsList className="w-full rounded-none border-b">
 <TabsTrigger value="groups" className="flex-1">Groups</TabsTrigger>
 <TabsTrigger value="channels" className="flex-1">Channels</TabsTrigger>
 </TabsList>

 <TabsContent value="groups" className="flex-1 overflow-y-auto p-4 space-y-6">
 {/* Promoted */}
 <div>
 <h2 className="text-secondary font-semibold text-muted-foreground mb-3">PROMOTED</h2>
 <div className="space-y-3">
 {promotedGroups.map(group => (
 <div key={group.id} className="bg-white rounded-xl p-4 shadow-sm border border-border">
 <div className="flex items-start gap-3">
 <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-page">
 {group.image}
 </div>
 <div className="flex-1">
 <h3 className="font-semibold">{group.name}</h3>
 <p className="text-secondary text-muted-foreground">{group.description}</p>
 <p className="text-label text-muted-foreground mt-1">{group.members.toLocaleString()} members</p>
 </div>
 </div>
 <Button className="w-full mt-3" variant="outline">
 Join Group
 </Button>
 </div>
 ))}
 </div>
 </div>

 {/* My Groups */}
 <div>
 <h2 className="text-secondary font-semibold text-muted-foreground mb-3">MY GROUPS</h2>
 <div className="space-y-2">
 {myGroups.map(group => (
 <div key={group.id} className="bg-white rounded-xl p-3 shadow-sm border border-border flex items-center gap-3">
 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-workspace">
 {group.image}
 </div>
 <div className="flex-1">
 <h3 className="font-medium">{group.name}</h3>
 <p className="text-label text-muted-foreground">{group.members} members</p>
 </div>
 {group.unread > 0 && (
 <div className="bg-primary text-primary-foreground text-label font-bold rounded-full w-6 h-6 flex items-center justify-center">
 {group.unread}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 </TabsContent>

 <TabsContent value="channels" className="flex-1 overflow-y-auto p-4">
 <div className="space-y-3">
 {channels.map(channel => (
 <div key={channel.id} className="bg-white rounded-xl p-4 shadow-sm border border-border">
 <div className="flex items-start gap-3">
 <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-page">
 {channel.image}
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <h3 className="font-semibold">{channel.name}</h3>
 {channel.verified && <span className="text-primary">✓</span>}
 </div>
 <p className="text-label text-muted-foreground flex items-center gap-1 mt-1">
 <Radio className="w-3 h-3" />
 {channel.subscribers.toLocaleString()} subscribers
 </p>
 </div>
 </div>
 <Button className="w-full mt-3" variant="default">
 Subscribe
 </Button>
 </div>
 ))}
 </div>
 </TabsContent>
 </Tabs>
 </div>
 );
}
