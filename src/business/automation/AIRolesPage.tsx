import React, { useState, useEffect } from 'react';
import { Bot, Plus, Settings2, Database, Wrench, Loader2, CheckCircle2, Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIRole {
 id: string;
 name: string;
 status: 'active' | 'training' | 'paused' | 'draft';
 objective: string;
 knowledge_sources: string[];
 tools: string[];
 escalation_rule: string;
 confidence_threshold: number;
 allowed_actions: string[];
 system_prompt?: string;
 model: string;
}

const STATUS_CONFIG = {
 active: { label: 'ACTIVE', class: 'bg-green-500 hover:bg-green-600 text-white' },
 training: { label: 'TRAINING', class: 'bg-amber-500 hover:bg-amber-600 text-white' },
 paused: { label: 'PAUSED', class: '' },
 draft: { label: 'DRAFT', class: '' },
};

export const AIRoles = () => {
 const { toast } = useToast();
 const [roles, setRoles] = useState<AIRole[]>([]);
 const [loading, setLoading] = useState(true);
 const [businessId, setBusinessId] = useState<string | null>(null);
 const [showCreate, setShowCreate] = useState(false);
 const [saving, setSaving] = useState(false);
 const [newRole, setNewRole] = useState({
 name: '',
 objective: '',
 escalation_rule: 'If confidence < 80% or user asks for a human',
 confidence_threshold: 80,
 system_prompt: '',
 });

 useEffect(() => {
 loadBusinessId();
 }, []);

 useEffect(() => {
 if (businessId) loadRoles();
 }, [businessId]);

 const loadBusinessId = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data } = await supabase.from('business_profiles').select('id').eq('user_id', user.id).single();
 if (data) setBusinessId(data.id);
 };

 const loadRoles = async () => {
 if (!businessId) return;
 setLoading(true);
 try {
 const { data, error } = await supabase
 .from('business_ai_roles')
 .select('*')
 .eq('business_id', businessId)
 .order('created_at', { ascending: false });
 if (error) throw error;
 setRoles((data || []).map(r => ({
 ...r,
 knowledge_sources: r.knowledge_sources || [],
 tools: r.tools || [],
 allowed_actions: r.allowed_actions || [],
 })));
 } catch (e) {
 console.error('Error loading AI roles:', e);
 } finally {
 setLoading(false);
 }
 };

 const createRole = async () => {
 if (!businessId || !newRole.name || !newRole.objective) return;
 setSaving(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 const { error } = await supabase.from('business_ai_roles').insert({
 business_id: businessId,
 name: newRole.name,
 objective: newRole.objective,
 escalation_rule: newRole.escalation_rule,
 confidence_threshold: newRole.confidence_threshold,
 system_prompt: newRole.system_prompt,
 status: 'draft',
 model: 'llama3.2',
 knowledge_sources: [],
 tools: [],
 allowed_actions: [],
 created_by: user?.id,
 });
 if (error) throw error;
 toast({ title: 'AI Role created', description: `${newRole.name} is in draft mode.` });
 setShowCreate(false);
 setNewRole({ name: '', objective: '', escalation_rule: 'If confidence < 80% or user asks for a human', confidence_threshold: 80, system_prompt: '' });
 loadRoles();
 } catch (e: any) {
 toast({ title: 'Error', description: e.message, variant: 'destructive' });
 } finally {
 setSaving(false);
 }
 };

 const toggleStatus = async (role: AIRole) => {
 const nextStatus = role.status === 'active' ? 'paused' : 'active';
 const { error } = await supabase.from('business_ai_roles').update({ status: nextStatus }).eq('id', role.id);
 if (!error) {
 toast({ title: `Role ${nextStatus}` });
 loadRoles();
 }
 };

 const deleteRole = async (roleId: string) => {
 const { error } = await supabase.from('business_ai_roles').delete().eq('id', roleId);
 if (!error) {
 toast({ title: 'Role deleted' });
 loadRoles();
 }
 };

 return (
 <div className="p-8 max-w-7xl mx-auto">
 <div className="flex justify-between items-center mb-8">
 <div>
 <h1 className="text-display flex items-center gap-2">
 <Bot className="w-8 h-8 text-primary" />
 AI Team Roles
 </h1>
 <p className="text-muted-foreground mt-1">Configure and manage AI employees for your business.</p>
 </div>
 <Button className="flex items-center gap-2" onClick={() => setShowCreate(true)}>
 <Plus className="w-4 h-4" />
 Create New Role
 </Button>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="h-8 w-8 animate-spin text-primary" />
 </div>
 ) : roles.length === 0 ? (
 <div className="text-center py-16 text-muted-foreground">
 <Bot className="h-16 w-16 mx-auto mb-4 opacity-30" />
 <p className="text-section font-medium">No AI Roles configured</p>
 <p className="text-secondary mt-1">Create your first AI team member to start automating customer interactions</p>
 <Button className="mt-4" onClick={() => setShowCreate(true)}>
 <Plus className="w-4 h-4 mr-2" />
 Create First Role
 </Button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {roles.map(role => {
 const statusCfg = STATUS_CONFIG[role.status] || STATUS_CONFIG.draft;
 return (
 <Card key={role.id} className="border flex flex-col">
 <CardHeader className="pb-4">
 <div className="flex justify-between items-start">
 <div>
 <CardTitle className="text-workspace">{role.name}</CardTitle>
 <CardDescription className="mt-2 line-clamp-2">{role.objective}</CardDescription>
 </div>
 <Badge className={statusCfg.class}>{statusCfg.label}</Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-4 flex-1">
 {role.knowledge_sources.length > 0 && (
 <div>
 <p className="text-label font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
 <Database className="w-3 h-3" /> Knowledge Sources
 </p>
 <div className="flex flex-wrap gap-1">
 {role.knowledge_sources.map((s, i) => (
 <Badge key={i} variant="outline" className="text-label">{s}</Badge>
 ))}
 </div>
 </div>
 )}
 {role.tools.length > 0 && (
 <div>
 <p className="text-label font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
 <Wrench className="w-3 h-3" /> Tools
 </p>
 <div className="flex flex-wrap gap-1">
 {role.tools.map((t, i) => (
 <Badge key={i} variant="secondary" className="text-label">{t}</Badge>
 ))}
 </div>
 </div>
 )}
 <div className="text-label text-muted-foreground">
 <span className="font-medium">Escalates when:</span> {role.escalation_rule}
 </div>
 <div className="text-label text-muted-foreground">
 <span className="font-medium">Confidence threshold:</span> {role.confidence_threshold}%
 </div>
 </CardContent>
 <CardFooter className="gap-2 pt-4">
 <Button
 variant="outline"
 size="sm"
 onClick={() => toggleStatus(role)}
 className="flex-1"
 >
 {role.status === 'active' ? (
 <><Pause className="w-4 h-4 mr-1" />Pause</>
 ) : (
 <><Play className="w-4 h-4 mr-1" />Activate</>
 )}
 </Button>
 <Button variant="outline" size="sm">
 <Settings2 className="w-4 h-4 mr-1" />Configure
 </Button>
 <Button variant="ghost" size="icon" onClick={() => deleteRole(role.id)}>
 <Trash2 className="w-4 h-4 text-destructive" />
 </Button>
 </CardFooter>
 </Card>
 );
 })}
 </div>
 )}

 {/* Create Role Dialog */}
 <Dialog open={showCreate} onOpenChange={setShowCreate}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Create AI Role</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label>Role Name *</Label>
 <Input
 placeholder="e.g. Front Desk Receptionist"
 value={newRole.name}
 onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))}
 />
 </div>
 <div className="space-y-2">
 <Label>Objective *</Label>
 <Textarea
 placeholder="Describe what this AI role should do..."
 value={newRole.objective}
 onChange={e => setNewRole(p => ({ ...p, objective: e.target.value }))}
 rows={3}
 />
 </div>
 <div className="space-y-2">
 <Label>System Prompt</Label>
 <Textarea
 placeholder="Advanced: Provide a custom system prompt for this AI..."
 value={newRole.system_prompt}
 onChange={e => setNewRole(p => ({ ...p, system_prompt: e.target.value }))}
 rows={3}
 />
 </div>
 <div className="space-y-2">
 <Label>Escalation Rule</Label>
 <Input
 value={newRole.escalation_rule}
 onChange={e => setNewRole(p => ({ ...p, escalation_rule: e.target.value }))}
 />
 </div>
 <div className="space-y-2">
 <Label>Confidence Threshold (%)</Label>
 <Input
 type="number"
 min={50}
 max={100}
 value={newRole.confidence_threshold}
 onChange={e => setNewRole(p => ({ ...p, confidence_threshold: parseInt(e.target.value) || 80 }))}
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
 <Button onClick={createRole} disabled={saving || !newRole.name || !newRole.objective}>
 {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
 Create Role
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
};

export default AIRoles;
