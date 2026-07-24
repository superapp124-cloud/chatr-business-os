import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
 Activity, 
 Search, 
 Megaphone, 
 MessageSquare, 
 UserPlus, 
 CheckCircle,
 FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export const WorkspaceActivities: React.FC = () => {
 const [search, setSearch] = useState('');

 // Mocking real operational history
 const activities = [
 { id: 1, type: 'broadcast_sent', icon: Megaphone, color: 'text-blue-500', bg: 'bg-blue-500/20', title: 'Broadcast Sent', description: 'Summer Sale Announcement sent to 450 VIP customers.', time: '10 mins ago', user: 'System' },
 { id: 2, type: 'reply_received', icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/20', title: 'Reply Received', description: 'John Doe replied to Summer Sale Announcement.', time: '15 mins ago', user: 'John Doe' },
 { id: 3, type: 'ai_action', icon: FileText, color: 'text-purple-500', bg: 'bg-purple-500/20', title: 'AI Recommendation', description: 'AI suggested sending Proposal Template to John Doe.', time: '16 mins ago', user: 'AI Assistant' },
 { id: 4, type: 'lead_created', icon: UserPlus, color: 'text-amber-500', bg: 'bg-amber-500/20', title: 'Segment Updated', description: 'Jane Smith was moved to VIP segment.', time: '2 hrs ago', user: 'System' },
 { id: 5, type: 'task_completed', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/20', title: 'Task Completed', description: 'Followed up with ABC Industries.', time: '4 hrs ago', user: 'You' },
 ];

 return (
 <div className="flex-1 flex flex-col h-full bg-background p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-page font-bold">Operational History</h2>
 <p className="text-secondary text-slate-400">The audit trail of your entire business workspace.</p>
 </div>
 <div className="flex items-center gap-3">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input 
 placeholder="Search activities..." 
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="pl-9 w-64 bg-card/50"
 />
 </div>
 <Button variant="outline">Export CSV</Button>
 </div>
 </div>

 <ScrollArea className="flex-1">
 <div className="max-w-4xl pr-4 pb-10">
 <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-slate-800 before:to-transparent space-y-6">
 
 {activities.map((activity) => (
 <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
 <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${activity.bg} ${activity.color}`}>
 <activity.icon className="w-4 h-4" />
 </div>
 <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 transition-colors shadow-sm flex flex-col">
 <div className="flex items-center justify-between space-x-2 mb-1">
 <div className="font-bold text-slate-200">{activity.title}</div>
 <time className="font-medium text-label text-slate-500">{activity.time}</time>
 </div>
 <div className="text-slate-400 text-secondary mb-2">{activity.description}</div>
 <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
 <span className="text-label text-slate-500">By {activity.user}</span>
 <Button variant="ghost" size="sm" className="h-6 text-label px-2">View Details</Button>
 </div>
 </div>
 </div>
 ))}

 </div>
 </div>
 </ScrollArea>
 </div>
 );
};
