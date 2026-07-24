import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Play, Pause, Settings, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import WorkflowBuilder from '@/components/business/automation/WorkflowBuilder';
import { systemEventBus, BusinessEvents } from '@/lib/events/EventBus';
import { useBusinessWorkflows, BusinessWorkflow } from '@/hooks/useBusinessWorkflows';
import { formatDistanceToNow } from 'date-fns';

export default function Automations() {
 const navigate = useNavigate();
 const { toast } = useToast();
 const { workflows, isLoading, createWorkflow, updateWorkflow } = useBusinessWorkflows();
 const [selectedWorkflow, setSelectedWorkflow] = useState<BusinessWorkflow | null>(null);

 useEffect(() => {
 // Verify Event Bus Integration
 const unsubscribe = systemEventBus.subscribe(BusinessEvents.WORKFLOW_TRIGGERED, (payload) => {
 toast({
 title: 'Workflow Engine Triggered',
 description: `Running automation for: ${payload.name}`,
 });
 });

 return () => unsubscribe();
 }, [toast]);

 const handleActivate = async () => {
 if (!selectedWorkflow) return;
 const newStatus = selectedWorkflow.status === 'active' ? 'paused' : 'active';
 await updateWorkflow(selectedWorkflow.id, { status: newStatus });
 if (newStatus === 'active') {
 systemEventBus.emit(BusinessEvents.WORKFLOW_TRIGGERED, { id: selectedWorkflow.id, name: selectedWorkflow.name });
 }
 };

 const handleCreateNew = async () => {
 const newWf = await createWorkflow('New Automation Workflow', 'Created via Automations Hub');
 if (newWf) {
 setSelectedWorkflow(newWf);
 }
 };

 if (selectedWorkflow) {
 return (
 <div className="flex flex-col h-full bg-white dark:bg-[#0B0F19]">
 <div className="h-16 border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6 bg-white/50 dark:bg-black/20 backdrop-blur-md">
 <div className="flex items-center gap-4">
 <Button variant="ghost" size="icon" onClick={() => setSelectedWorkflow(null)}>
 <ArrowLeft className="h-5 w-5" />
 </Button>
 <div>
 <h2 className="text-section text-gray-900 dark:text-white">
 {selectedWorkflow.name}
 </h2>
 <p className="text-label text-gray-500 dark:text-white/40">Visual Workflow Builder</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <Button variant="outline" size="sm">
 <Settings className="w-4 h-4 mr-2" />
 Settings
 </Button>
 <Button 
 size="sm" 
 className={selectedWorkflow.status === 'active' ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"} 
 onClick={handleActivate}
 >
 {selectedWorkflow.status === 'active' ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
 {selectedWorkflow.status === 'active' ? 'Pause' : 'Activate'}
 </Button>
 </div>
 </div>
 <div className="flex-1 overflow-hidden relative">
 <WorkflowBuilder workflowId={selectedWorkflow.id} />
 </div>
 </div>
 );
 }

 return (
 <div className="p-8 max-w-7xl mx-auto">
 <div className="flex justify-between items-center mb-8">
 <div>
 <h1 className="text-display text-gray-900 dark:text-white flex items-center gap-2">
 <Workflow className="w-8 h-8 text-emerald-500" />
 Automations
 </h1>
 <p className="text-gray-500 mt-1">Design powerful, multi-channel workflows driven by AI.</p>
 </div>
 <Button onClick={handleCreateNew} className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2">
 <Plus className="w-4 h-4" />
 Create Automation
 </Button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {isLoading ? (
 <div className="col-span-3 text-center py-12 text-gray-500">Loading workflows...</div>
 ) : workflows.length === 0 ? (
 <div className="col-span-3 text-center py-12">
 <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
 <Workflow className="w-8 h-8 text-gray-400" />
 </div>
 <h3 className="text-section font-medium text-gray-900 dark:text-white mb-2">No Automations Yet</h3>
 <p className="text-gray-500 max-w-md mx-auto mb-6">Create your first automated workflow to save time and scale your business operations.</p>
 <Button onClick={handleCreateNew} variant="outline">Get Started</Button>
 </div>
 ) : (
 workflows.map(workflow => (
 <Card key={workflow.id} className="glass-card hover-lift hover:border-emerald-500/50 cursor-pointer transition-all dark:border-white/10 shadow-sm" onClick={() => setSelectedWorkflow(workflow)}>
 <CardHeader className="pb-4">
 <div className="flex justify-between items-start">
 <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
 <Workflow className="w-5 h-5 text-emerald-500" />
 </div>
 <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'} className={workflow.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
 {(workflow.status || 'draft').toUpperCase()}
 </Badge>
 </div>
 <CardTitle className="text-section mt-2">{workflow.name || 'Untitled'}</CardTitle>
 <CardDescription className="line-clamp-2 mt-1 h-10">
 {workflow.description || 'No description provided.'}
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="flex items-center justify-between text-secondary text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-800">
 <div className="flex items-center gap-1">
 <Play className="w-3.5 h-3.5" />
 {workflow.run_count || 0} runs
 </div>
 <span>
 {(() => {
 if (!workflow.updated_at) return 'Recently';
 try {
 const d = new Date(workflow.updated_at);
 if (isNaN(d.getTime())) return 'Recently';
 return formatDistanceToNow(d, { addSuffix: true });
 } catch (e) {
 return 'Recently';
 }
 })()}
 </span>
 </div>
 </CardContent>
 </Card>
 ))
 )}
 </div>
 </div>
 );
}
