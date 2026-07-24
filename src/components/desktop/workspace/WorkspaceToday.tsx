import React, { useEffect, useState } from 'react';
import { 
 CheckCircle2, 
 MessageCircle, 
 CreditCard, 
 Calendar,
 FileText,
 Clock,
 ArrowRight,
 Sparkles,
 MoreVertical,
 Play,
 Send,
 Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { StartMyDayModal } from './StartMyDayModal';
import { useWorkspaceTasks, WorkspaceTask } from '@/hooks/useWorkspaceTasks';
import { supabase } from '@/integrations/supabase/client';

export const WorkspaceToday: React.FC = () => {
 const [isStartMyDayOpen, setIsStartMyDayOpen] = useState(false);
 const [userName, setUserName] = useState<string>('there');
 
 const { 
 quickWins, 
 waitingForYou, 
 preparedByAi, 
 inProgress,
 estimatedTotalTime,
 completeTask
 } = useWorkspaceTasks();

 useEffect(() => {
 const fetchUser = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 const { data: profile } = await supabase
 .from('profiles')
 .select('full_name, username')
 .eq('id', user.id)
 .single();
 
 if (profile) {
 const name = profile.full_name || profile.username || 'there';
 setUserName(name.split(' ')[0]); // Just first name
 }
 }
 };
 fetchUser();
 }, []);

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
 case 'reply': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-400/10';
 case 'quotation': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-400/10';
 case 'payment': return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10';
 case 'appointment': return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-400/10';
 default: return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-400/10';
 }
 };

 return (
 <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
 <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-background to-purple-500/5 pointer-events-none" />
 
 <ScrollArea className="flex-1 px-8 py-8">
 <div className="max-w-4xl mx-auto space-y-10 pb-12 relative z-10">
 
 {/* Today's Assistant (The Permanent Card) */}
 <div className="bg-card border border-border/60 rounded-3xl p-8 shadow-sm relative overflow-hidden">
 <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
 <Sparkles className="w-48 h-48 text-primary" />
 </div>
 
 <div className="relative z-10 space-y-6">
 <div className="space-y-1">
 <h2 className="text-secondary font-semibold text-primary uppercase tracking-wider">Today's Assistant</h2>
 <h1 className="text-display text-foreground tracking-tight">
 Good morning, {userName}.
 </h1>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
 <div className="space-y-3">
 <h3 className="text-muted-foreground font-medium">I noticed:</h3>
 <ul className="space-y-2">
 {waitingForYou.slice(0, 3).map(task => (
 <li key={task.id} className="flex items-start gap-2 text-foreground/90 font-medium">
 <span className="text-primary mt-1">•</span> {task.title}
 </li>
 ))}
 {waitingForYou.length === 0 && (
 <li className="text-muted-foreground italic">You're all caught up!</li>
 )}
 </ul>
 </div>
 
 <div className="space-y-3">
 <h3 className="text-muted-foreground font-medium">I recommend:</h3>
 <ol className="space-y-2">
 {preparedByAi.slice(0, 3).map((task, i) => (
 <li key={task.id} className="flex items-start gap-2 text-foreground/90 font-medium">
 <span className="text-muted-foreground">{i + 1}.</span> {task.title}
 </li>
 ))}
 {preparedByAi.length === 0 && (
 <li className="text-muted-foreground italic">No immediate recommendations.</li>
 )}
 </ol>
 </div>
 </div>

 <div className="pt-4 flex items-center justify-between border-t border-border/50">
 <div className="text-secondary font-medium text-muted-foreground">
 Estimated time: {Math.ceil(estimatedTotalTime / 60)} minutes.
 </div>
 <Button 
 onClick={() => setIsStartMyDayOpen(true)}
 size="lg" 
 className="rounded-full font-semibold bg-primary text-primary-foreground hover:scale-105 transition-all shadow-md"
 >
 Start <ArrowRight className="w-4 h-4 ml-2" />
 </Button>
 </div>
 </div>
 </div>

 {/* Quick Wins */}
 {quickWins.length > 0 && (
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-secondary font-medium text-muted-foreground uppercase tracking-wider">
 <Sparkles className="w-4 h-4 text-amber-500" />
 Quick Wins
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {quickWins.map((task) => {
 const Icon = getTaskIcon(task.task_type);
 return (
 <button 
 key={task.id}
 onClick={() => completeTask(task.id)}
 className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:bg-accent hover:border-accent transition-all text-left group"
 >
 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", getTaskColor(task.task_type))}>
 <Icon className="w-5 h-5" />
 </div>
 <span className="font-medium text-secondary text-foreground/80 group-hover:text-foreground transition-colors line-clamp-2">
 {task.title}
 </span>
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Main Content Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 
 {/* Waiting for You */}
 <div className="lg:col-span-1 space-y-4">
 <h2 className="text-section text-foreground">Waiting for You</h2>
 <div className="space-y-3">
 {waitingForYou.map((task) => {
 const Icon = getTaskIcon(task.task_type);
 return (
 <div key={task.id} className="p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all flex items-start gap-4 cursor-pointer">
 <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1", getTaskColor(task.task_type))}>
 <Icon className="w-5 h-5" />
 </div>
 <div className="flex-1 space-y-1">
 <div className="font-semibold text-foreground">{task.title}</div>
 <div className="text-label text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10 inline-block px-2 py-0.5 rounded uppercase tracking-wider">
 {task.description?.split('.')[0] || 'Waiting'}
 </div>
 <div className="text-secondary text-muted-foreground">{task.task_type}</div>
 </div>
 </div>
 );
 })}
 {waitingForYou.length === 0 && (
 <div className="p-8 text-center text-muted-foreground bg-card border border-border/50 rounded-2xl">
 Nothing waiting for you!
 </div>
 )}
 </div>
 </div>

 {/* I've Already Prepared */}
 <div className="lg:col-span-1 space-y-4">
 <div className="flex items-center gap-2">
 <Sparkles className="w-5 h-5 text-blue-500" />
 <h2 className="text-section text-foreground">I've already prepared</h2>
 </div>
 <div className="space-y-3">
 {preparedByAi.map((task) => {
 return (
 <div key={task.id} className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 space-y-3">
 <div className="space-y-1">
 <div className="font-medium text-blue-950 dark:text-blue-100">{task.title}</div>
 <div className="text-label text-blue-700/70 dark:text-blue-300/70 ">Estimated: {Math.ceil(task.estimated_time_seconds / 60)} min</div>
 </div>
 <div className="pt-2 border-t border-blue-200/30 dark:border-blue-800/30">
 <button 
 onClick={() => completeTask(task.id)}
 className="w-full py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-lg text-secondary font-semibold transition-colors flex items-center justify-center gap-2"
 >
 {task.task_type === 'reply' ? <Send className="w-4 h-4" /> : <Check className="w-4 h-4" />}
 {task.task_type === 'reply' ? 'Review & Send' : 'Approve & Send'}
 </button>
 </div>
 </div>
 );
 })}
 {preparedByAi.length === 0 && (
 <div className="p-8 text-center text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 rounded-2xl">
 No items prepared currently.
 </div>
 )}
 </div>
 </div>

 {/* Continue Where You Left Off */}
 <div className="lg:col-span-1 space-y-4">
 <h2 className="text-section text-foreground">Continue where you left off</h2>
 <div className="space-y-3">
 {inProgress.map((task) => {
 const Icon = getTaskIcon(task.task_type);
 return (
 <div key={task.id} className="p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all flex items-start justify-between group cursor-pointer">
 <div className="space-y-1">
 <div className="font-medium text-foreground">{task.title}</div>
 <div className="text-secondary text-muted-foreground">{task.description}</div>
 </div>
 <button className="text-primary font-medium text-button opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
 Continue <ArrowRight className="w-4 h-4" />
 </button>
 </div>
 );
 })}
 {inProgress.length === 0 && (
 <div className="p-8 text-center text-muted-foreground bg-card border border-border/50 rounded-2xl">
 No work in progress.
 </div>
 )}
 </div>
 </div>

 </div>
 </div>
 </ScrollArea>

 <StartMyDayModal 
 isOpen={isStartMyDayOpen} 
 onClose={() => setIsStartMyDayOpen(false)} 
 />
 </div>
 );
};
