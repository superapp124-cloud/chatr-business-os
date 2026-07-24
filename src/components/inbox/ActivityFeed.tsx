import React from 'react';
import { UnifiedActivityItem } from '../../core/providers/types';
import { Mail, MessageSquareText, Calendar, CheckSquare, Briefcase, Reply, CheckCircle2, ChevronRight, Hash, Globe, CreditCard } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';

const mockActivities: UnifiedActivityItem[] = [
 {
 id: 'act-1',
 provider: 'linkedin',
 providerType: 'social',
 accountId: 'li-1',
 type: 'message',
 priority: 'high',
 securityLevel: 'public',
 sender: { id: 's-1', name: 'Sarah Chen (Recruiter)' },
 participants: [],
 timestamp: Date.now() - 1000 * 60 * 15, // 15 mins ago
 preview: "Hi Arshid, I was impressed by your work on CHATR. Are you open to a Staff Engineering role at Stripe?",
 actions: ['Reply', 'Schedule Call', 'Share Resume', 'Not Interested'],
 capabilities: ['ext.linkedin.reply'],
 deepLink: 'https://linkedin.com/messaging',
 attachments: [],
 status: 'unread',
 aiSummary: "Sarah from Stripe reached out about a Staff Engineering role.",
 intent: "Hiring Backend Engineer",
 confidence: 0.95,
 labels: ['recruiting', 'urgent']
 },
 {
 id: 'act-2',
 provider: 'gmail',
 providerType: 'email',
 accountId: 'g-1',
 type: 'email',
 priority: 'normal',
 securityLevel: 'internal',
 sender: { id: 's-2', name: 'Stripe Careers', email: 'careers@stripe.com' },
 participants: [],
 timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
 preview: "Your application for Staff Engineer has been received.",
 actions: ['Archive', 'Star'],
 capabilities: ['ext.google.archive'],
 attachments: [],
 status: 'read',
 aiSummary: "Confirmation of your application to Stripe.",
 intent: "Hiring Backend Engineer",
 confidence: 0.9,
 labels: ['recruiting', 'receipt']
 },
 {
 id: 'act-3',
 provider: 'slack',
 providerType: 'chat',
 accountId: 'sl-1',
 type: 'message',
 priority: 'urgent',
 securityLevel: 'internal',
 sender: { id: 's-3', name: 'DevOps Bot' },
 participants: [],
 timestamp: Date.now() - 1000 * 60 * 5, // 5 mins ago
 preview: "[P1] API Latency spiked to 4000ms in US-East-1",
 actions: ['Acknowledge', 'Create Jira', 'Page On-Call'],
 capabilities: ['ext.slack.reply', 'ext.jira.create'],
 attachments: [],
 status: 'action_needed',
 aiSummary: "Critical API latency incident in US-East-1 region.",
 intent: "Resolve P1 Incident",
 confidence: 0.99,
 labels: ['incident', 'p1']
 }
];

export function ActivityFeed() {
 // Group by Intent
 const grouped = mockActivities.reduce((acc, item) => {
 const key = item.intent || 'General Activity';
 if (!acc[key]) acc[key] = [];
 acc[key].push(item);
 return acc;
 }, {} as Record<string, UnifiedActivityItem[]>);

 return (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">
 {Object.entries(grouped).map(([intentName, items]) => (
 <div key={intentName} className="space-y-4">
 <div className="flex items-center gap-3 mb-2">
 <div className="h-px bg-white/10 flex-1" />
 <span className="text-label font-bold uppercase tracking-widest text-indigo-400">Intent: {intentName}</span>
 <div className="h-px bg-white/10 flex-1" />
 </div>

 <div className="relative pl-6 border-l border-white/10 space-y-4">
 {items.map(item => (
 <div key={item.id} className="relative group">
 {/* Timeline Dot */}
 <div className={cn("absolute -left-[30px] top-4 w-3 h-3 rounded-full border-[2px]", 
 item.priority === 'urgent' ? "bg-rose-500 border-rose-900" :
 item.provider === 'linkedin' ? "bg-blue-500 border-blue-900" :
 item.provider === 'gmail' ? "bg-emerald-500 border-emerald-900" :
 "bg-slate-500 border-slate-900"
 )} />
 
 <div className={cn("rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300",
 item.priority === 'urgent' ? "bg-rose-500/5 border-rose-500/30" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
 )}>
 
 <div className="flex justify-between items-start mb-2">
 <div className="flex items-center gap-2">
 <span className="text-secondary font-semibold text-white">{item.sender.name}</span>
 <span className="text-label text-slate-500">via {item.provider}</span>
 </div>
 <span className="text-[10px] text-slate-500 font-medium">
 {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
 </span>
 </div>

 {item.aiSummary && (
 <div className="flex gap-2 items-center text-label text-indigo-300 mb-2">
 <CheckCircle2 className="w-3 h-3" />
 <span>{item.aiSummary}</span>
 </div>
 )}

 <p className="text-slate-300 text-secondary mb-4">{item.preview}</p>
 
 {/* AI Action Bar */}
 <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/10">
 {item.actions.map(action => (
 <button 
 key={action}
 className={cn("px-3 py-1.5 rounded-lg text-label font-semibold transition-all",
 action === 'Reply' || action === 'Acknowledge' 
 ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
 : "bg-white/5 text-slate-300 hover:bg-white/10"
 )}
 >
 {action}
 </button>
 ))}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 );
}
