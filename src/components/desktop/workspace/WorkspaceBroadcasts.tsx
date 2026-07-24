import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
 Megaphone, 
 Sparkles, 
 Send, 
 Clock, 
 BarChart, 
 Plus, 
 Users, 
 Wand2 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export const WorkspaceBroadcasts: React.FC = () => {
 const [isCreating, setIsCreating] = useState(false);
 const [broadcasts, setBroadcasts] = useState<any[]>([]);
 
 // Form State
 const [name, setName] = useState('');
 const [audience, setAudience] = useState('all');
 const [message, setMessage] = useState('');
 const [isAiRewriting, setIsAiRewriting] = useState(false);
 const [isPersonalizing, setIsPersonalizing] = useState(false);
 const [personalizedPreview, setPersonalizedPreview] = useState<{name: string, content: string}[] | null>(null);

 useEffect(() => {
 fetchBroadcasts();
 }, []);

 const fetchBroadcasts = async () => {
 // In Release 1, we fetch from workspace_broadcasts
 const { data, error } = await supabase
 .from('workspace_broadcasts')
 .select('*')
 .order('created_at', { ascending: false });
 
 if (data) setBroadcasts(data);
 };

 const handleAiRewrite = async () => {
 if (!message) return;
 setIsAiRewriting(true);
 // Simulate AI delay
 setTimeout(() => {
 setMessage(`🌟 ${message}\n\n(AI Enhanced: Professional & Engaging)`);
 setIsAiRewriting(false);
 }, 1000);
 };

 const handlePersonalize = async () => {
 if (!message) return;
 setIsPersonalizing(true);
 
 // In a real app, this would hit the edge function to rewrite per-customer.
 // Here we simulate the LLM rapid generation for the demo
 setTimeout(() => {
 setPersonalizedPreview([
 { name: 'John Doe', content: `Hi John,\n\nBecause you're one of our premium VIP customers, ${message.toLowerCase()}` },
 { name: 'Sarah Smith', content: `Hello Sarah,\n\nWe noticed your recent activity. ${message}` },
 { name: 'ABC Industries', content: `To the team at ABC Industries,\n\nBased on your previous orders, ${message.toLowerCase()}` }
 ]);
 setIsPersonalizing(false);
 }, 1500);
 };

 const handleSend = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 let workspaceId = '00000000-0000-0000-0000-000000000000'; 
 const { data: workspaces } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).limit(1);
 if (workspaces && workspaces.length > 0) {
 workspaceId = workspaces[0].id;
 }

 // 1. Create broadcast record
 const { data: broadcastRecord, error } = await supabase.from('workspace_broadcasts').insert({
 workspace_id: workspaceId,
 name: name || 'Untitled Broadcast',
 message_template: message,
 target_segment: audience,
 status: 'sent',
 sent_at: new Date().toISOString()
 }).select().single();

 if (!error) {
 // 2. Fetch the target customers
 const { data: customers } = await supabase
 .from('workspace_customers')
 .select('profile_id, profiles!workspace_customers_profile_id_fkey(username)')
 .eq('workspace_id', workspaceId)
 .eq('segment', audience);
 
 // 3. Send the actual messages (Simulated AI generation per customer)
 if (customers && customers.length > 0) {
 for (const customer of customers) {
 const profile = Array.isArray(customer.profiles) ? customer.profiles[0] : customer.profiles;
 const customerName = profile?.username || 'Customer';
 
 // The personalized content
 const personalizedContent = `Hi ${customerName},\n\nBecause you're one of our valued customers, ${message.toLowerCase()}`;
 
 // Check for conversation
 let convId = null;
 const { data: convs } = await supabase.rpc('get_or_create_conversation', {
 target_user_id: customer.profile_id
 });
 
 if (convs && convs.length > 0) {
 convId = convs[0].conversation_id;
 // Send message
 await supabase.from('messages').insert({
 conversation_id: convId,
 sender_id: user.id,
 content: personalizedContent
 });
 }
 }
 }

 setIsCreating(false);
 setName('');
 setMessage('');
 setPersonalizedPreview(null);
 fetchBroadcasts();
 
 await supabase.from('workspace_activities').insert({
 workspace_id: workspaceId,
 activity_type: 'broadcast_sent',
 description: `Sent personalized broadcast "${name || 'Untitled'}" to ${customers?.length || 0} ${audience} customers.`,
 });
 }
 };

 if (isCreating) {
 return (
 <div className="flex-1 flex flex-col h-full bg-background p-6">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <Button variant="ghost" onClick={() => setIsCreating(false)}>← Back</Button>
 <h2 className="text-workspace font-bold">New Campaign</h2>
 </div>
 <Button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700">
 <Send className="w-4 h-4 mr-2" /> Launch Broadcast
 </Button>
 </div>

 <div className="max-w-3xl flex-1 flex flex-col gap-6">
 <div className="space-y-4 bg-card/50 p-6 rounded-2xl border border-border/50">
 <div>
 <label className="text-secondary font-medium text-slate-400 mb-1.5 block">Campaign Name</label>
 <Input 
 value={name}
 onChange={e => setName(e.target.value)}
 placeholder="e.g. Summer Sale Announcement" 
 className="bg-background/50 border-border/50"
 />
 </div>
 
 <div>
 <label className="text-secondary font-medium text-slate-400 mb-1.5 block">Target Audience</label>
 <div className="flex gap-2">
 {['All Customers', 'VIP', 'Leads', 'Pending Payments'].map(seg => (
 <Badge 
 key={seg} 
 variant={audience === seg ? 'default' : 'outline'}
 className={`cursor-pointer px-3 py-1.5 ${audience === seg ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
 onClick={() => setAudience(seg)}
 >
 {seg}
 </Badge>
 ))}
 </div>
 </div>
 </div>

 <div className="flex-1 flex flex-col bg-card/50 p-6 rounded-2xl border border-border/50 relative">
 <div className="flex items-center justify-between mb-3">
 <label className="text-secondary font-medium text-slate-400">Message Content</label>
 <div className="flex gap-2">
 <Button variant="secondary" size="sm" onClick={handleAiRewrite} disabled={isAiRewriting || !message}>
 <Wand2 className="w-3.5 h-3.5 mr-1.5" /> 
 {isAiRewriting ? 'Enhancing...' : 'AI Rewrite'}
 </Button>
 <Button variant="secondary" size="sm" onClick={handlePersonalize} disabled={isPersonalizing || !message}>
 <Sparkles className="w-3.5 h-3.5 mr-1.5" /> 
 {isPersonalizing ? 'Generating...' : 'Smart Personalize'}
 </Button>
 </div>
 </div>
 
 <div className="flex-1 flex gap-4">
 <Textarea 
 value={message}
 onChange={e => setMessage(e.target.value)}
 placeholder="Write your baseline message here. Click 'Smart Personalize' to let AI generate unique variants for each recipient."
 className="flex-1 resize-none bg-background/50 border-border/50"
 />
 
 {personalizedPreview && (
 <div className="flex-1 border border-blue-500/30 bg-blue-900/10 rounded-xl p-4 flex flex-col">
 <h4 className="text-secondary font-medium text-blue-400 mb-3 flex items-center gap-2">
 <Sparkles className="w-4 h-4" /> AI Generated Variants
 </h4>
 <ScrollArea className="flex-1">
 <div className="space-y-3 pr-3">
 {personalizedPreview.map((preview, i) => (
 <div key={i} className="bg-background/80 p-3 rounded-lg text-secondary border border-border/50">
 <span className="text-label font-semibold text-slate-400 block mb-1">To: {preview.name}</span>
 {preview.content}
 </div>
 ))}
 </div>
 </ScrollArea>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="flex-1 flex flex-col h-full bg-background p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-page font-bold">Broadcasts</h2>
 <p className="text-secondary text-slate-400">AI-powered outreach and campaigns</p>
 </div>
 <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700">
 <Plus className="w-4 h-4 mr-2" /> New Broadcast
 </Button>
 </div>

 <ScrollArea className="flex-1">
 <div className="space-y-3 pr-4">
 {broadcasts.length === 0 ? (
 <div className="text-center py-20 bg-card/30 rounded-2xl border border-dashed border-border/50">
 <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
 <h3 className="text-section font-medium">No Broadcasts Yet</h3>
 <p className="text-slate-400 text-secondary max-w-md mx-auto mb-4">
 Launch your first AI campaign to reach your customers at scale with personalized messaging.
 </p>
 <Button onClick={() => setIsCreating(true)} variant="outline">Create Campaign</Button>
 </div>
 ) : (
 broadcasts.map(broadcast => (
 <div key={broadcast.id} className="p-4 bg-card/50 border border-border/50 rounded-xl hover:bg-card transition-colors flex items-center justify-between group">
 <div>
 <h3 className="font-semibold text-slate-200">{broadcast.name}</h3>
 <div className="flex items-center gap-3 mt-1.5 text-label text-slate-400">
 <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {broadcast.target_segment}</span>
 <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(broadcast.created_at).toLocaleDateString()}</span>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="text-right">
 <p className="text-label text-emerald-500 mb-1">Status: {broadcast.status.toUpperCase()}</p>
 <div className="flex gap-3 text-label text-slate-400">
 <span>Delivered: --</span>
 <span>Read: --</span>
 <span>Replies: --</span>
 </div>
 </div>
 <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><BarChart className="w-4 h-4" /></Button>
 </div>
 </div>
 ))
 )}
 </div>
 </ScrollArea>
 </div>
 );
};
