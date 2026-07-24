import React, { useState, useEffect } from 'react';
import {
 Users, UserPlus, MoreVertical, Crown, Shield, User,
 Mail, MessageSquare, Loader2, X, CheckCircle2, Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
 DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface TeamMember {
 id: string;
 user_id: string;
 role: 'owner' | 'admin' | 'agent' | 'viewer';
 status: string;
 joined_at: string;
 conversations_handled: number;
 profile: {
 full_name: string | null;
 username: string | null;
 avatar_url: string | null;
 email?: string | null;
 } | null;
}

const ROLE_CONFIG = {
 owner: { icon: Crown, label: 'Owner', color: 'text-amber-500' },
 admin: { icon: Shield, label: 'Admin', color: 'text-blue-500' },
 agent: { icon: User, label: 'Agent', color: 'text-green-500' },
 viewer: { icon: User, label: 'Viewer', color: 'text-slate-400' },
};

export default function BusinessTeam() {
 const { toast } = useToast();
 const [members, setMembers] = useState<TeamMember[]>([]);
 const [loading, setLoading] = useState(true);
 const [businessId, setBusinessId] = useState<string | null>(null);
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 const [showInvite, setShowInvite] = useState(false);
 const [inviteEmail, setInviteEmail] = useState('');
 const [inviteRole, setInviteRole] = useState<'admin' | 'agent' | 'viewer'>('agent');
 const [inviting, setInviting] = useState(false);

 useEffect(() => {
 init();
 }, []);

 useEffect(() => {
 if (businessId) loadMembers();
 }, [businessId]);

 const init = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 setCurrentUserId(user.id);
 const { data } = await supabase
 .from('business_profiles')
 .select('id')
 .eq('user_id', user.id)
 .single();
 if (data) setBusinessId(data.id);
 };

 const loadMembers = async () => {
 if (!businessId) return;
 setLoading(true);
 try {
 const { data, error } = await supabase
 .from('business_team_members')
 .select(`
 id, user_id, role, status, joined_at, conversations_handled,
 profiles:user_id ( full_name, username, avatar_url )
 `)
 .eq('business_id', businessId)
 .order('joined_at', { ascending: true });

 if (error) throw error;
 setMembers((data || []).map((m: any) => ({
 ...m,
 profile: m.profiles || null,
 })));
 } catch (e) {
 console.error('Error loading team:', e);
 } finally {
 setLoading(false);
 }
 };

 const inviteMember = async () => {
 if (!businessId || !inviteEmail) return;
 setInviting(true);
 try {
 // Look up user by email via profiles
 const { data: profile } = await supabase
 .from('profiles')
 .select('id, full_name, username')
 .eq('username', inviteEmail.split('@')[0])
 .single();

 // Insert team member record (invite pending)
 const { error } = await supabase.from('business_team_members').insert({
 business_id: businessId,
 user_id: profile?.id || null,
 role: inviteRole,
 status: 'invited',
 invite_email: inviteEmail,
 });

 if (error) throw error;
 toast({ title: 'Invitation sent', description: `${inviteEmail} has been invited as ${inviteRole}` });
 setShowInvite(false);
 setInviteEmail('');
 loadMembers();
 } catch (e: any) {
 toast({ title: 'Error', description: e.message, variant: 'destructive' });
 } finally {
 setInviting(false);
 }
 };

 const removeMember = async (memberId: string) => {
 const { error } = await supabase
 .from('business_team_members')
 .delete()
 .eq('id', memberId);
 if (!error) {
 toast({ title: 'Member removed' });
 loadMembers();
 }
 };

 const changeRole = async (memberId: string, newRole: string) => {
 const { error } = await supabase
 .from('business_team_members')
 .update({ role: newRole })
 .eq('id', memberId);
 if (!error) {
 toast({ title: 'Role updated' });
 loadMembers();
 }
 };

 const displayName = (m: TeamMember) =>
 m.profile?.full_name || m.profile?.username || 'Invited User';

 const initials = (m: TeamMember) => {
 const name = displayName(m);
 return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
 };

 return (
 <div className="min-h-screen bg-background">
 <div className="border-b glass-card relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-hero opacity-5" />
 <div className="max-w-7xl mx-auto px-4 py-6 relative">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-display ">Team</h1>
 <p className="text-muted-foreground mt-1">Manage your business team members and roles</p>
 </div>
 <Button onClick={() => setShowInvite(true)}>
 <UserPlus className="h-4 w-4 mr-2" />
 Invite Member
 </Button>
 </div>
 </div>
 </div>

 <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
 {/* Stats */}
 <div className="grid grid-cols-3 gap-4 mb-6">
 <Card className="glass-card">
 <CardContent className="pt-4">
 <p className="text-secondary text-muted-foreground">Total Members</p>
 <p className="text-display mt-1">{members.length}</p>
 </CardContent>
 </Card>
 <Card className="glass-card">
 <CardContent className="pt-4">
 <p className="text-secondary text-muted-foreground">Active</p>
 <p className="text-display mt-1 text-green-500">
 {members.filter(m => m.status === 'active').length}
 </p>
 </CardContent>
 </Card>
 <Card className="glass-card">
 <CardContent className="pt-4">
 <p className="text-secondary text-muted-foreground">Invited</p>
 <p className="text-display mt-1 text-amber-500">
 {members.filter(m => m.status === 'invited').length}
 </p>
 </CardContent>
 </Card>
 </div>

 {/* Members List */}
 {loading ? (
 <div className="flex justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 ) : members.length === 0 ? (
 <div className="text-center py-16 text-muted-foreground">
 <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
 <p className="text-section font-medium">No team members yet</p>
 <p className="text-secondary mt-1">Invite your first team member to get started</p>
 <Button className="mt-4" onClick={() => setShowInvite(true)}>
 <UserPlus className="h-4 w-4 mr-2" />
 Invite Member
 </Button>
 </div>
 ) : (
 <div className="space-y-3">
 {members.map(member => {
 const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.agent;
 const RoleIcon = roleCfg.icon;
 const isMe = member.user_id === currentUserId;

 return (
 <Card key={member.id} className="glass-card">
 <CardContent className="pt-4">
 <div className="flex items-center gap-4">
 <Avatar className="h-10 w-10">
 <AvatarFallback className="bg-primary/10 text-primary font-semibold">
 {initials(member)}
 </AvatarFallback>
 </Avatar>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-semibold">{displayName(member)}</span>
 {isMe && <Badge variant="outline" className="text-label">You</Badge>}
 <Badge
 variant={member.status === 'active' ? 'default' : 'secondary'}
 className="text-label"
 >
 {member.status}
 </Badge>
 </div>
 <div className="flex items-center gap-3 mt-1">
 <span className={`flex items-center gap-1 text-label ${roleCfg.color}`}>
 <RoleIcon className="h-3 w-3" />
 {roleCfg.label}
 </span>
 {member.joined_at && (
 <span className="text-label text-muted-foreground">
 Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
 </span>
 )}
 {member.conversations_handled > 0 && (
 <span className="text-label text-muted-foreground">
 {member.conversations_handled} conversations
 </span>
 )}
 </div>
 </div>

 {!isMe && member.role !== 'owner' && (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon">
 <MoreVertical className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => changeRole(member.id, 'admin')}>
 <Shield className="h-4 w-4 mr-2 text-blue-500" />
 Make Admin
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => changeRole(member.id, 'agent')}>
 <User className="h-4 w-4 mr-2 text-green-500" />
 Make Agent
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => removeMember(member.id)}
 className="text-destructive"
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Remove
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 )}
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}
 </div>

 {/* Invite Dialog */}
 <Dialog open={showInvite} onOpenChange={setShowInvite}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Invite Team Member</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label>Email Address *</Label>
 <Input
 type="email"
 placeholder="colleague@company.com"
 value={inviteEmail}
 onChange={e => setInviteEmail(e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label>Role</Label>
 <select
 value={inviteRole}
 onChange={e => setInviteRole(e.target.value as any)}
 className="w-full px-3 py-2 border rounded-md text-secondary bg-background"
 >
 <option value="admin">Admin — Full access</option>
 <option value="agent">Agent — Handle conversations</option>
 <option value="viewer">Viewer — Read only</option>
 </select>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
 <Button onClick={inviteMember} disabled={inviting || !inviteEmail}>
 {inviting
 ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
 : <CheckCircle2 className="h-4 w-4 mr-2" />
 }
 Send Invite
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
