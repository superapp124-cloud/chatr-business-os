import React, { useState, useEffect } from 'react';
import { 
 X, 
 MessageCircle, 
 FileText, 
 Calendar, 
 CreditCard,
 CheckCircle2,
 ArrowRight,
 Clock,
 Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspaceTasks, WorkspaceTask } from '@/hooks/useWorkspaceTasks';

interface StartMyDayModalProps {
 isOpen: boolean;
 onClose: () => void;
}

export const StartMyDayModal: React.FC<StartMyDayModalProps> = ({ isOpen, onClose }) => {
 const [currentStep, setCurrentStep] = useState(0);
 const { tasks, completeTask, isLoading } = useWorkspaceTasks();
 
 // Create a priority-sorted list of tasks to go through
 const modalTasks = [...tasks].sort((a, b) => {
 const order = { 'quick_win': 1, 'prepared_by_ai': 2, 'waiting_for_you': 3, 'in_progress': 4 };
 return (order[a.state as keyof typeof order] || 5) - (order[b.state as keyof typeof order] || 5);
 });

 useEffect(() => {
 if (isOpen && modalTasks.length > 0 && currentStep >= modalTasks.length) {
 setCurrentStep(0);
 }
 }, [isOpen, modalTasks.length, currentStep]);

 if (!isOpen) return null;

 const getTaskIcon = (type: string) => {
 switch (type) {
 case 'reply': return MessageCircle;
 case 'quotation': return FileText;
 case 'payment': return CreditCard;
 case 'appointment': return Calendar;
 case 'reminder': return Clock;
 default: return FileText;
 }
 };

 const getTaskColor = (type: string) => {
 switch (type) {
 case 'reply': return { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-400/10' };
 case 'quotation': return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-400/10' };
 case 'payment': return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-400/10' };
 case 'appointment': return { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-400/10' };
 default: return { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-400/10' };
 }
 };

 const getActionText = (task: WorkspaceTask) => {
 if (task.task_type === 'reply') return 'Review & Send';
 if (task.task_type === 'quotation') return 'Approve & Send';
 if (task.task_type === 'payment') return 'Send Reminder';
 return 'Mark as Done';
 };

 const handleAction = async (skip: boolean = false) => {
 const task = modalTasks[currentStep];
 
 if (!skip && task) {
 await completeTask(task.id);
 }

 if (currentStep < modalTasks.length - 1) {
 setCurrentStep(prev => prev + 1);
 } else {
 onClose();
 setTimeout(() => setCurrentStep(0), 300);
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
 <div className="w-full max-w-lg bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300">
 
 <div className="flex items-center justify-between p-6 pb-2">
 <div className="text-secondary font-medium text-muted-foreground uppercase tracking-wider">
 {modalTasks.length > 0 ? `Step ${currentStep + 1} of ${modalTasks.length}` : 'All caught up!'}
 </div>
 <button 
 onClick={onClose}
 className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent hover:text-foreground transition-colors text-muted-foreground"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {modalTasks.length === 0 ? (
 <div className="p-12 flex flex-col items-center text-center space-y-6">
 <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
 <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
 </div>
 <div className="space-y-2">
 <h2 className="text-page font-bold text-foreground">You're all caught up!</h2>
 <p className="text-muted-foreground">There are no pending tasks in your queue for today.</p>
 </div>
 <Button onClick={onClose} className="mt-4 px-8 rounded-full">Close</Button>
 </div>
 ) : (
 <>
 <div className="p-8 flex flex-col items-center text-center space-y-6">
 <div className={cn(
 "w-20 h-20 rounded-full flex items-center justify-center", 
 getTaskColor(modalTasks[currentStep].task_type).bg, 
 getTaskColor(modalTasks[currentStep].task_type).color
 )}>
 {React.createElement(getTaskIcon(modalTasks[currentStep].task_type), { className: "w-10 h-10" })}
 </div>
 
 <div className="space-y-2">
 <div className="flex items-center justify-center gap-2 mb-2">
 {modalTasks[currentStep].state === 'prepared_by_ai' && (
 <span className="flex items-center gap-1 text-label text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
 <Sparkles className="w-3 h-3" /> AI Prepared
 </span>
 )}
 {modalTasks[currentStep].state === 'quick_win' && (
 <span className="flex items-center gap-1 text-label text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
 Quick Win
 </span>
 )}
 </div>
 <h2 className="text-page font-bold text-foreground">{modalTasks[currentStep].title}</h2>
 <p className="text-muted-foreground max-w-xs mx-auto">{modalTasks[currentStep].description}</p>
 </div>
 </div>

 <div className="p-6 pt-2 bg-secondary/50 flex flex-col gap-4">
 <Button 
 onClick={() => handleAction(false)}
 size="lg" 
 className="w-full h-14 rounded-xl text-body font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg"
 >
 {getActionText(modalTasks[currentStep])}
 <ArrowRight className="w-5 h-5 ml-2" />
 </Button>
 
 <button 
 onClick={() => handleAction(true)}
 className="text-secondary text-muted-foreground hover:text-foreground transition-colors font-medium"
 >
 Skip for now
 </button>
 </div>
 </>
 )}
 </div>
 </div>
 );
};
