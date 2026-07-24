import React, { useState } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Zap, ArrowDown, Save, BrainCircuit, Play, Cloud, Share2, Mail, MessageSquare, Box } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RuleBuilderDialogProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: () => void;
 initialRule?: any;
 userId: string | null;
}

export const RuleBuilderDialog = ({ isOpen, onClose, onSave, initialRule, userId }: RuleBuilderDialogProps) => {
 const { toast } = useToast();
 const [isSaving, setIsSaving] = useState(false);
 
 const [name, setName] = useState(initialRule?.name || '');
 const [triggerType, setTriggerType] = useState(initialRule?.trigger_type || 'message_received');
 const [conditions, setConditions] = useState<any[]>(initialRule?.conditions || []);
 const [actionType, setActionType] = useState(initialRule?.action_type || 'auto_reply');
 const [actionPayload, setActionPayload] = useState<any>(initialRule?.action_payload || { reply_text: '' });

 const handleSave = async () => {
 if (!name.trim() || !userId) return;
 
 setIsSaving(true);
 try {
 const ruleData = {
 user_id: userId,
 name,
 trigger_type: triggerType,
 conditions,
 action_type: actionType,
 action_payload: actionPayload,
 is_active: true
 };

 if (initialRule?.id) {
 const { error } = await supabase.from('automation_rules').update(ruleData).eq('id', initialRule.id);
 if (error) throw error;
 } else {
 const { error } = await supabase.from('automation_rules').insert(ruleData);
 if (error) throw error;
 }

 toast.success('Automation rule saved!');
 onSave();
 onClose();
 } catch (err: any) {
 toast.error(err.message || 'Failed to save rule');
 } finally {
 setIsSaving(false);
 }
 };

 const addCondition = () => {
 setConditions([...conditions, { field: 'content', operator: 'matches_ai', value: 'Invoice' }]);
 };

 const removeCondition = (index: number) => {
 setConditions(conditions.filter((_, i) => i !== index));
 };

 const updateCondition = (index: number, key: string, val: string) => {
 const newConds = [...conditions];
 newConds[index] = { ...newConds[index], [key]: val };
 setConditions(newConds);
 };

 // Node UI Components
 const NodeConnection = () => (
 <div className="flex justify-center -my-1 py-1">
 <div className="h-6 w-px bg-purple-200"></div>
 <ArrowDown className="w-4 h-4 text-purple-300 absolute mt-3 -ml-2" />
 </div>
 );

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="sm:max-w-[500px] bg-[#fdfcff] p-0 overflow-hidden border-0 sm:border sm:border-purple-100 rounded-none sm:rounded-xl h-[100dvh] sm:h-auto sm:max-h-[85vh] w-full flex flex-col">
 
 <div className="bg-gradient-to-br from-[#8b5cf6] to-[#5c22ff] p-5 pb-8 relative shrink-0">
 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
 <DialogTitle className="flex items-center gap-2 text-workspace font-bold text-white z-10 relative">
 <BrainCircuit className="w-5 h-5" />
 {initialRule ? 'Edit Workflow' : 'Create AI Workflow'}
 </DialogTitle>
 <p className="text-purple-100 text-[13px] mt-1 relative z-10">Build automation logic using visual nodes.</p>
 </div>

 <div className="px-6 py-4 -mt-4 bg-[#fdfcff] rounded-t-3xl relative z-20 space-y-4 flex-1 min-h-0 overflow-y-auto pb-8">
 
 <div className="mb-4">
 <Input 
 placeholder="Name this workflow (e.g. Save Invoices)" 
 value={name} 
 onChange={e => setName(e.target.value)} 
 className="text-section font-bold border-0 border-b-2 border-gray-100 rounded-none px-1 shadow-none focus-visible:ring-0 focus-visible:border-purple-500 h-12"
 />
 </div>

 {/* TRIGGER NODE */}
 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
 <div className="bg-indigo-50/50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
 <Play className="w-2.5 h-2.5 text-indigo-600 ml-0.5" />
 </span>
 <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">WHEN</span>
 </div>
 </div>
 <div className="p-4">
 <Select value={triggerType} onValueChange={setTriggerType}>
 <SelectTrigger className="w-full bg-gray-50/50 border-gray-200">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="message_received">Message is received</SelectItem>
 <SelectItem value="call_missed">Call is missed</SelectItem>
 <SelectItem value="email_received">Email is received</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* CONDITIONS (AI MEMORY NODES) */}
 {conditions.map((cond, idx) => (
 <React.Fragment key={idx}>
 <NodeConnection />
 <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
 <div className="bg-purple-50/50 px-4 py-2 border-b border-purple-50 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
 <BrainCircuit className="w-3 h-3 text-purple-600" />
 </span>
 <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">AI EXTRACT</span>
 </div>
 <button onClick={() => removeCondition(idx)} className="text-gray-400 hover:text-red-500">
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 <div className="p-4 flex gap-2">
 <Select value={cond.operator} onValueChange={v => updateCondition(idx, 'operator', v)}>
 <SelectTrigger className="w-[120px] bg-gray-50/50">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="matches_ai">Matches AI</SelectItem>
 <SelectItem value="contains">Contains</SelectItem>
 </SelectContent>
 </Select>

 <Input 
 placeholder="e.g. Invoice, OTP, Urgent" 
 value={cond.value}
 onChange={e => updateCondition(idx, 'value', e.target.value)}
 className="flex-1 bg-gray-50/50"
 />
 </div>
 </div>
 </React.Fragment>
 ))}

 <div className="flex justify-center -my-2 relative z-10">
 <button 
 onClick={addCondition}
 className="w-8 h-8 bg-white border border-dashed border-purple-300 rounded-full flex items-center justify-center text-purple-500 hover:bg-purple-50 transition-colors shadow-sm"
 >
 <Plus className="w-4 h-4" />
 </button>
 </div>

 {conditions.length > 0 && <NodeConnection />}

 {/* ACTION NODE */}
 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-4">
 <div className="bg-emerald-50/50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
 <Zap className="w-3 h-3 text-emerald-600" />
 </span>
 <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">THEN DO</span>
 </div>
 </div>
 <div className="p-4 space-y-3">
 <Select value={actionType} onValueChange={(val) => {
 setActionType(val);
 if (val === 'auto_reply') setActionPayload({ reply_text: '' });
 if (val === 'forward') setActionPayload({ forward_to: '' });
 if (val === 'save_memory') setActionPayload({ memory_key: '' });
 }}>
 <SelectTrigger className="w-full bg-gray-50/50">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="save_to_cloud">Save to CHATR Cloud</SelectItem>
 <SelectItem value="save_memory">Save to Communication Memory</SelectItem>
 <SelectItem value="auto_reply">Send auto-reply</SelectItem>
 <SelectItem value="archive">Archive conversation</SelectItem>
 <SelectItem value="forward">Forward message</SelectItem>
 </SelectContent>
 </Select>

 {actionType === 'auto_reply' && (
 <Input 
 placeholder="Reply message text..." 
 className="bg-gray-50/50"
 value={actionPayload.reply_text || ''}
 onChange={e => setActionPayload({ ...actionPayload, reply_text: e.target.value })}
 />
 )}
 {actionType === 'forward' && (
 <Input 
 placeholder="Forward to phone number or username..." 
 className="bg-gray-50/50"
 value={actionPayload.forward_to || ''}
 onChange={e => setActionPayload({ ...actionPayload, forward_to: e.target.value })}
 />
 )}
 {actionType === 'save_memory' && (
 <Input 
 placeholder="Context tag (e.g. Health, Finance)..." 
 className="bg-gray-50/50"
 value={actionPayload.memory_key || ''}
 onChange={e => setActionPayload({ ...actionPayload, memory_key: e.target.value })}
 />
 )}
 </div>
 </div>
 
 </div>

 <DialogFooter className="px-6 py-4 bg-white border-t border-gray-100 shrink-0 mt-auto pb-safe">
 <Button variant="ghost" onClick={onClose} disabled={isSaving} className="text-gray-500 font-bold">Cancel</Button>
 <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="bg-[#5c22ff] hover:bg-purple-700 rounded-full px-6 shadow-md shadow-purple-500/20">
 {isSaving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Workflow</>}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
};
