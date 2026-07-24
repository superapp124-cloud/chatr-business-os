import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Users, Loader2, CheckCircle2, UserPlus, PlayCircle, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface CommunityGroup {
 id: string;
 name: string;
 description: string | null;
 member_count: number;
 is_active: boolean;
 created_at: string;
}

export default function BusinessGroups() {
 const navigate = useNavigate();
 const { toast } = useToast();
 const [loading, setLoading] = useState(true);
 const [groups, setGroups] = useState<CommunityGroup[]>([]);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [businessId, setBusinessId] = useState<string | null>(null);
 
 const [groupName, setGroupName] = useState('');
 const [description, setDescription] = useState('');
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 init();
 }, []);

 useEffect(() => {
 if (businessId) loadGroups();
 }, [businessId]);

 const init = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data } = await supabase
 .from('business_profiles')
 .select('id')
 .eq('user_id', user.id)
 .single();
 if (data) setBusinessId(data.id);
 };

 const loadGroups = async () => {
 if (!businessId) return;
 try {
 const { data, error } = await supabase
 .from('business_groups')
 .select('*')
 .eq('business_id', businessId)
 .order('created_at', { ascending: false });

 if (error) throw error;
 setGroups(data || []);
 } catch (error: any) {
 console.error('Error loading groups:', error);
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = async () => {
 if (!businessId || !groupName) return;
 setSaving(true);

 try {
 const { data: { user } } = await supabase.auth.getUser();
 
 const { error } = await supabase
 .from('business_groups')
 .insert([{
 business_id: businessId,
 name: groupName,
 description: description,
 member_count: 1, // Admin starting as 1 member
 created_by: user?.id
 }]);

 if (error) throw error;

 toast({ title: 'Group created successfully' });
 setDialogOpen(false);
 setGroupName('');
 setDescription('');
 loadGroups();
 } catch (error: any) {
 toast({
 title: 'Error',
 description: error.message || 'Failed to create group',
 variant: 'destructive'
 });
 } finally {
 setSaving(false);
 }
 };

 return (
 <div className="min-h-screen bg-background">
 <div className="border-b glass-card relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-hero opacity-5" />
 <div className="max-w-7xl mx-auto px-4 py-6 relative">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="icon" onClick={() => navigate('/desktop/pro/business')}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <div>
 <h1 className="text-display ">Community Groups</h1>
 <p className="text-muted-foreground mt-1">Manage private groups and broadcast to segments</p>
 </div>
 </div>
 <Button onClick={() => setDialogOpen(true)}>
 <UserPlus className="h-4 w-4 mr-2" />
 New Group
 </Button>
 </div>
 </div>
 </div>

 <div className="max-w-7xl mx-auto px-4 py-8">
 {loading ? (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 ) : groups.length === 0 ? (
 <div className="text-center py-20 text-muted-foreground glass-card rounded-xl">
 <Users className="h-16 w-16 mx-auto mb-4 opacity-30 text-primary" />
 <p className="text-workspace font-medium text-foreground">No groups found</p>
 <p className="text-secondary mt-2 max-w-sm mx-auto">Create community groups to segment your audience and send targeted broadcasts.</p>
 <Button className="mt-6" onClick={() => setDialogOpen(true)}>
 <UserPlus className="h-4 w-4 mr-2" />
 Create First Group
 </Button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {groups.map((group) => (
 <Card key={group.id} className="glass-card hover:border-primary/20 transition-all group overflow-hidden relative">
 <div className="absolute top-0 right-0 p-4">
 <Badge variant={group.is_active ? 'default' : 'secondary'} className="text-[10px]">
 {group.is_active ? 'ACTIVE' : 'ARCHIVED'}
 </Badge>
 </div>
 <CardHeader>
 <CardTitle className="text-section pr-16">{group.name}</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-secondary text-muted-foreground line-clamp-2 mb-6 h-10">
 {group.description || 'No description provided.'}
 </p>
 
 <div className="flex items-center justify-between text-secondary pt-4 border-t border-border/50">
 <div className="flex items-center gap-1.5 text-foreground font-medium">
 <Users className="h-4 w-4 text-primary" />
 {group.member_count} members
 </div>
 <div className="text-muted-foreground text-label">
 {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}
 </div>
 </div>
 
 <div className="mt-4 flex gap-2">
 <Button variant="outline" className="w-full text-label" size="sm">
 <Users className="w-3 h-3 mr-1.5" /> Manage
 </Button>
 <Button variant="outline" className="w-full text-label" size="sm">
 <PlayCircle className="w-3 h-3 mr-1.5" /> Broadcast
 </Button>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </div>

 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Create New Community Group</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-4">
 <div className="space-y-2">
 <Label>Group Name</Label>
 <Input
 placeholder="e.g. VIP Customers"
 value={groupName}
 onChange={(e) => setGroupName(e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label>Description</Label>
 <Textarea
 placeholder="What is this group for?"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 />
 </div>
 <div className="rounded-lg bg-primary/5 p-3 flex items-start gap-3 border border-primary/10">
 <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
 <p className="text-label text-muted-foreground ">
 Groups are private to your business. Only invited members and admins can view or participate in community broadcasts.
 </p>
 </div>
 </div>
 <div className="flex justify-end gap-3">
 <Button variant="outline" onClick={() => setDialogOpen(false)}>
 Cancel
 </Button>
 <Button onClick={handleCreate} disabled={saving || !groupName}>
 {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
 Create Group
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
