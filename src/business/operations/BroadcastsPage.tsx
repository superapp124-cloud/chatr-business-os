import React, { useState, useEffect } from 'react';
import { Send, Plus, Loader2, Users, Clock, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

interface Broadcast {
 id: string;
 name: string;
 message: string;
 status: string;
 recipient_count: number;
 delivered_count: number;
 read_count: number;
 scheduled_at: string | null;
 sent_at: string | null;
 created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
 sent: { label: 'Sent', variant: 'default' },
 sending: { label: 'Sending', variant: 'default' },
 scheduled: { label: 'Scheduled', variant: 'outline' },
 draft: { label: 'Draft', variant: 'secondary' },
 cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export default function Broadcasts() {
 const { toast } = useToast();
 const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
 const [loading, setLoading] = useState(true);
 const [businessId, setBusinessId] = useState<string | null>(null);
 const [showCreate, setShowCreate] = useState(false);
 const [saving, setSaving] = useState(false);
 const [newBroadcast, setNewBroadcast] = useState({ name: '', message: '' });

 useEffect(() => {
 loadBusinessId();
 }, []);

 useEffect(() => {
 if (businessId) loadBroadcasts();
 }, [businessId]);

 const loadBusinessId = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data } = await supabase.from('business_profiles').select('id').eq('user_id', user.id).single();
 if (data) setBusinessId(data.id);
 };

 const loadBroadcasts = async () => {
 if (!businessId) return;
 setLoading(true);
 try {
 const { data, error } = await supabase
 .from('business_broadcasts')
 .select('*')
 .eq('business_id', businessId)
 .order('created_at', { ascending: false });
 if (error) throw error;
 setBroadcasts(data || []);
 } catch (e) {
 console.error('Error loading broadcasts:', e);
 } finally {
 setLoading(false);
 }
 };

 const createBroadcast = async () => {
 if (!businessId || !newBroadcast.name || !newBroadcast.message) return;
 setSaving(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 const { error } = await supabase.from('business_broadcasts').insert({
 business_id: businessId,
 name: newBroadcast.name,
 message: newBroadcast.message,
 status: 'draft',
 created_by: user?.id,
 });
 if (error) throw error;
 toast({ title: 'Broadcast saved as draft' });
 setShowCreate(false);
 setNewBroadcast({ name: '', message: '' });
 loadBroadcasts();
 } catch (e: any) {
 toast({ title: 'Error', description: e.message, variant: 'destructive' });
 } finally {
 setSaving(false);
 }
 };

 const sendBroadcast = async (broadcast: Broadcast) => {
 const { error } = await supabase
 .from('business_broadcasts')
 .update({ status: 'sending', sent_at: new Date().toISOString() })
 .eq('id', broadcast.id);
 if (!error) {
 toast({ title: 'Broadcast queued for sending' });
 loadBroadcasts();
 }
 };

 const totalRecipients = broadcasts.reduce((s, b) => s + (b.recipient_count || 0), 0);
 const totalDelivered = broadcasts.reduce((s, b) => s + (b.delivered_count || 0), 0);
 const totalSent = broadcasts.filter(b => b.status === 'sent').length;

 return (
 <div className="min-h-screen bg-background">
 <div className="border-b glass-card relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-hero opacity-5" />
 <div className="max-w-7xl mx-auto px-4 py-6 relative">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-display ">Broadcasts</h1>
 <p className="text-muted-foreground mt-1">Send messages to your customer segments</p>
 </div>
 <Button onClick={() => setShowCreate(true)}>
 <Plus className="h-4 w-4 mr-2" />
 New Broadcast
 </Button>
 </div>
 </div>
 </div>

 <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
 {/* Summary Stats */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card className="glass-card">
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-secondary font-medium">Total Broadcasts</CardTitle>
 <Send className="h-4 w-4 text-primary" />
 </CardHeader>
 <CardContent>
 <div className="text-page font-bold">{totalSent}</div>
 <p className="text-label text-muted-foreground">sent successfully</p>
 </CardContent>
 </Card>
 <Card className="glass-card">
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-secondary font-medium">Total Recipients</CardTitle>
 <Users className="h-4 w-4 text-accent" />
 </CardHeader>
 <CardContent>
 <div className="text-page font-bold">{totalRecipients}</div>
 <p className="text-label text-muted-foreground">total reached</p>
 </CardContent>
 </Card>
 <Card className="glass-card">
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-secondary font-medium">Delivered</CardTitle>
 <BarChart3 className="h-4 w-4 text-green-500" />
 </CardHeader>
 <CardContent>
 <div className="text-page font-bold">{totalDelivered}</div>
 <p className="text-label text-muted-foreground">messages delivered</p>
 </CardContent>
 </Card>
 </div>

 {/* Broadcasts List */}
 {loading ? (
 <div className="flex justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 ) : broadcasts.length === 0 ? (
 <div className="text-center py-16 text-muted-foreground">
 <Send className="h-16 w-16 mx-auto mb-4 opacity-30" />
 <p className="text-section font-medium">No broadcasts yet</p>
 <p className="text-secondary mt-1">Create your first broadcast message to reach your customers</p>
 <Button className="mt-4" onClick={() => setShowCreate(true)}>
 <Plus className="h-4 w-4 mr-2" />
 Create Broadcast
 </Button>
 </div>
 ) : (
 <div className="space-y-4">
 {broadcasts.map(broadcast => {
 const cfg = STATUS_CONFIG[broadcast.status] || STATUS_CONFIG.draft;
 return (
 <Card key={broadcast.id} className="glass-card">
 <CardContent className="pt-4">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <h3 className="font-semibold">{broadcast.name}</h3>
 <Badge variant={cfg.variant}>{cfg.label}</Badge>
 </div>
 <p className="text-secondary text-muted-foreground line-clamp-2">{broadcast.message}</p>
 <div className="flex items-center gap-4 mt-3 text-label text-muted-foreground">
 <span className="flex items-center gap-1">
 <Users className="h-3 w-3" />
 {broadcast.recipient_count} recipients
 </span>
 {broadcast.delivered_count > 0 && (
 <span className="flex items-center gap-1">
 <CheckCircle2 className="h-3 w-3 text-green-500" />
 {broadcast.delivered_count} delivered
 </span>
 )}
 <span className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {broadcast.sent_at
 ? format(new Date(broadcast.sent_at), 'MMM d, yyyy')
 : formatDistanceToNow(new Date(broadcast.created_at), { addSuffix: true })}
 </span>
 </div>
 </div>
 {broadcast.status === 'draft' && (
 <Button size="sm" onClick={() => sendBroadcast(broadcast)}>
 <Send className="h-4 w-4 mr-2" />
 Send Now
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}
 </div>

 {/* Create Dialog */}
 <Dialog open={showCreate} onOpenChange={setShowCreate}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Create Broadcast</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label>Broadcast Name *</Label>
 <Input
 placeholder="e.g. July Promo Announcement"
 value={newBroadcast.name}
 onChange={e => setNewBroadcast(p => ({ ...p, name: e.target.value }))}
 />
 </div>
 <div className="space-y-2">
 <Label>Message *</Label>
 <Textarea
 placeholder="Type your broadcast message..."
 value={newBroadcast.message}
 onChange={e => setNewBroadcast(p => ({ ...p, message: e.target.value }))}
 rows={5}
 />
 <p className="text-label text-muted-foreground">{newBroadcast.message.length} characters</p>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
 <Button onClick={createBroadcast} disabled={saving || !newBroadcast.name || !newBroadcast.message}>
 {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
 Save as Draft
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
