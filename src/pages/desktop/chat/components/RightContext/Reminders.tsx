import React from 'react';
import { useLiveTasks } from '@/providers/useLiveTasks';
import { CheckSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const Reminders: React.FC = () => {
 const { tasks, isLoading, isEmpty } = useLiveTasks();
 
 // Filter for upcoming tasks/reminders that are not done
 const reminders = tasks.filter(t => t.status !== 'done' && t.dueDate).slice(0, 4);

 if (isEmpty || (!isLoading && reminders.length === 0)) return null;

 return (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-label font-semibold text-white/90">Upcoming Reminders</span>
 </div>
 <div className="space-y-2">
 {isLoading && reminders.length === 0 ? (
 <div className="animate-pulse flex gap-3 items-center">
 <div className="w-4 h-4 rounded bg-white/10 shrink-0" />
 <div className="space-y-2 flex-1">
 <div className="h-3 bg-white/10 rounded w-full" />
 <div className="h-2 bg-white/10 rounded w-1/2" />
 </div>
 </div>
 ) : (
 reminders.map(rem => (
 <div key={rem.id} className="flex items-start gap-3 group">
 <button className="mt-0.5 w-4 h-4 rounded border border-white/20 group-hover:border-white/40 flex items-center justify-center transition-colors shrink-0">
 {/* Empty square for todo */}
 </button>
 <div className="flex-1 min-w-0">
 <p className="text-label text-white/80 truncate">{rem.title}</p>
 <p className="text-[10px] text-white/40 mt-0.5">
 {rem.dueDate ? formatDistanceToNow(new Date(rem.dueDate), { addSuffix: true }) : ''}
 </p>
 </div>
 </div>
 ))
 )}
 </div>
 {!isLoading && reminders.length > 0 && (
 <button className="text-[10px] text-violet-400 hover:text-violet-300">View all reminders</button>
 )}
 </div>
 );
};
