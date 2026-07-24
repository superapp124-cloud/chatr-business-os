import React from 'react';
import { CheckCircle2, Circle, Clock, AlertTriangle, Check, X, ShieldAlert, Sparkles, ChevronRight, Activity } from 'lucide-react';
import { ExecutionPlan, ExecutionStep, aiEngine } from '@/lib/ai/ExecutionEngine';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ApprovalQueueProps {
 plan: ExecutionPlan;
 onUpdatePlan: (plan: ExecutionPlan) => void;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ plan, onUpdatePlan }) => {
 const getStatusIcon = (status: ExecutionStep['status'], confidence: number) => {
 switch (status) {
 case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
 case 'running': return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />;
 case 'awaiting_approval': return <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce" />;
 case 'failed': return <X className="w-5 h-5 text-rose-500" />;
 default: 
 if (confidence < 90) return <ShieldAlert className="w-5 h-5 text-slate-400" />;
 return <Circle className="w-5 h-5 text-slate-300" />;
 }
 };

 const handleApprove = (stepId: string) => {
 aiEngine.approveStep(plan, stepId, onUpdatePlan);
 };

 const handleReject = (stepId: string) => {
 aiEngine.rejectStep(plan, stepId, onUpdatePlan);
 };

 return (
 <div className="flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-hidden">
 <div className="p-4 border-b bg-slate-50/50">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2">
 <div className="p-1.5 bg-[#5c22ff]/10 rounded-lg">
 <Sparkles className="w-4 h-4 text-[#5c22ff]" />
 </div>
 <h3 className="font-semibold text-slate-800">AI Execution Engine</h3>
 </div>
 <span className="text-label px-2 py-1 bg-slate-100 text-slate-600 rounded-full border">
 {plan.status.replace('_', ' ').toUpperCase()}
 </span>
 </div>
 <p className="text-secondary font-medium text-slate-900 line-clamp-1">Goal: {plan.goal}</p>
 </div>

 <ScrollArea className="flex-1 p-4">
 <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[1.375rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
 {plan.steps.map((step, index) => (
 <div key={step.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
 
 {/* Icon Marker */}
 <div className={cn(
 "flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-slate-50 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2",
 step.status === 'running' && "bg-blue-50 text-blue-500 border-blue-100",
 step.status === 'completed' && "bg-emerald-50 text-emerald-500 border-emerald-100",
 step.status === 'awaiting_approval' && "bg-amber-50 text-amber-500 border-amber-100 ring-2 ring-amber-500/20"
 )}>
 {getStatusIcon(step.status, step.confidence)}
 </div>
 
 {/* Card */}
 <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-white shadow-sm transition-all hover:shadow-md">
 <div className="flex items-center justify-between mb-1">
 <h4 className="font-semibold text-secondary text-slate-800">{step.name}</h4>
 <div className="flex items-center gap-2">
 <span className={cn(
 "text-[10px] font-bold px-1.5 py-0.5 rounded",
 step.confidence >= 95 ? "bg-emerald-100 text-emerald-700" :
 step.confidence >= 85 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
 )}>
 {step.confidence}% Conf.
 </span>
 </div>
 </div>
 
 <p className="text-label text-slate-500 mb-2">{step.description}</p>
 
 {/* Explainability Section */}
 <div className="bg-slate-50 rounded p-2 border border-slate-100 mb-3">
 <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
 <ChevronRight className="w-3 h-3" /> Why this step?
 </p>
 <p className="text-label text-slate-700 ">{step.explanation}</p>
 </div>

 {/* Status & Actions */}
 <div className="flex flex-col gap-2">
 <div className="flex items-center gap-2 text-label text-slate-400">
 <Clock className="w-3 h-3" />
 <span>Est: {step.estimatedCostMs / 1000}s</span>
 <span className="capitalize px-1.5 py-0.5 bg-slate-100 rounded ml-auto text-[10px]">{step.agentId}</span>
 </div>

 {step.status === 'awaiting_approval' && (
 <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
 <Button 
 size="sm" 
 onClick={() => handleApprove(step.id)}
 className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8"
 >
 <Check className="w-3.5 h-3.5 mr-1" /> Approve
 </Button>
 <Button 
 size="sm" 
 variant="outline"
 onClick={() => handleReject(step.id)}
 className="flex-1 text-rose-600 hover:bg-rose-50 h-8"
 >
 <X className="w-3.5 h-3.5 mr-1" /> Reject
 </Button>
 </div>
 )}
 {step.status === 'completed' && step.result?.message && (
 <p className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded mt-1">
 {step.result.message}
 </p>
 )}
 </div>
 </div>

 </div>
 ))}
 </div>
 </ScrollArea>
 </div>
 );
};
