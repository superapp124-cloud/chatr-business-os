import React from 'react';
import { CheckCircle2, Clock, MessageSquare, Plus, FileText, User } from 'lucide-react';

interface TimelineEvent {
 id: string;
 type: 'creation' | 'status_change' | 'comment' | 'attachment';
 actor: string;
 timestamp: string;
 details: {
 text?: string;
 from?: string;
 to?: string;
 fileName?: string;
 };
}

export const UniversalTimeline: React.FC<{ events?: TimelineEvent[] }> = ({ events = [] }) => {
 // Mock events if none provided
 const displayEvents: TimelineEvent[] = events.length > 0 ? events : [
 {
 id: 'e1',
 type: 'creation',
 actor: 'Arshid Wani',
 timestamp: '10 mins ago',
 details: { text: 'Created the request via Chat' }
 },
 {
 id: 'e2',
 type: 'status_change',
 actor: 'System Engine',
 timestamp: '9 mins ago',
 details: { from: 'Draft', to: 'Pending Approval' }
 },
 {
 id: 'e3',
 type: 'comment',
 actor: 'Sarah Jenkins',
 timestamp: '5 mins ago',
 details: { text: 'Can you provide the vendor receipt for this?' }
 }
 ];

 const getIcon = (type: string) => {
 switch (type) {
 case 'creation': return <Plus className="w-4 h-4 text-emerald-400" />;
 case 'status_change': return <CheckCircle2 className="w-4 h-4 text-violet-400" />;
 case 'comment': return <MessageSquare className="w-4 h-4 text-blue-400" />;
 case 'attachment': return <FileText className="w-4 h-4 text-rose-400" />;
 default: return <Clock className="w-4 h-4 text-slate-400" />;
 }
 };

 return (
 <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mt-6">
 <h3 className="text-label font-bold text-slate-500 uppercase tracking-widest mb-6">Audit Timeline</h3>
 
 <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
 {displayEvents.map((event) => (
 <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
 {/* Icon Marker */}
 <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-black/50 backdrop-blur-md shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
 {getIcon(event.type)}
 </div>
 
 {/* Card Content */}
 <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-black/30 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
 <div className="flex items-center justify-between mb-1">
 <div className="flex items-center gap-2">
 <User className="w-3 h-3 text-slate-400" />
 <span className="font-semibold text-slate-200 text-secondary">{event.actor}</span>
 </div>
 <time className="text-label text-slate-500 ">{event.timestamp}</time>
 </div>
 
 <div className="text-secondary text-slate-400 mt-2">
 {event.type === 'creation' && (
 <p>{event.details.text}</p>
 )}
 {event.type === 'status_change' && (
 <p>
 Changed status from <span className="bg-white/10 px-1.5 py-0.5 rounded text-slate-300">{event.details.from}</span> to <span className="bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded">{event.details.to}</span>
 </p>
 )}
 {event.type === 'comment' && (
 <p className="italic bg-black/40 p-2 rounded-lg border border-white/5">"{event.details.text}"</p>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
};
