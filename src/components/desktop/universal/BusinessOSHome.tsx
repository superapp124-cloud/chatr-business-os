import React, { useState, useEffect } from 'react';
import { SituationAssessmentRuntime, IAttentionItem } from '../../../sdk/engines/SituationAssessmentRuntime';
import { CheckCircle2, AlertCircle, Clock, Zap, ArrowRight, Activity, FileText, Briefcase } from 'lucide-react';

interface Props {
 onNavigateToRecord: (capabilityId: string, objectName: string, recordId: string) => void;
}

export const BusinessOSHome: React.FC<Props> = ({ onNavigateToRecord }) => {
 const [items, setItems] = useState<IAttentionItem[]>([]);
 const [briefing, setBriefing] = useState<string[]>([]);
 const [activity, setActivity] = useState<any>(null);
 const [currentTime, setCurrentTime] = useState(new Date());

 useEffect(() => {
 // Generate the SAR assessment
 const assessedItems = SituationAssessmentRuntime.assessCurrentSituation();
 setItems(assessedItems);
 setBriefing(SituationAssessmentRuntime.generateBriefing(assessedItems));
 setActivity(SituationAssessmentRuntime.getRecentActivity(24));
 
 const timer = setInterval(() => setCurrentTime(new Date()), 60000);
 return () => clearInterval(timer);
 }, []);

 const getGreeting = () => {
 const hour = currentTime.getHours();
 if (hour < 12) return 'Good morning';
 if (hour < 17) return 'Good afternoon';
 return 'Good evening';
 };

 const getUrgencyColor = (urgency: string) => {
 switch (urgency) {
 case 'critical': return 'text-rose-400 bg-rose-400/10 border-rose-500/30';
 case 'high': return 'text-amber-400 bg-amber-400/10 border-amber-500/30';
 case 'medium': return 'text-indigo-400 bg-indigo-400/10 border-indigo-500/30';
 default: return 'text-zinc-400 bg-zinc-800/50 border-zinc-700/50';
 }
 };

 const getIcon = (type: string) => {
 switch (type) {
 case 'approval': return <AlertCircle size={18} className="text-amber-400" />;
 case 'sla-breach': return <Clock size={18} className="text-rose-400" />;
 case 'bottleneck': return <Activity size={18} className="text-indigo-400" />;
 default: return <Zap size={18} className="text-emerald-400" />;
 }
 };

 const [userName, setUserName] = useState('Leader');
 useEffect(() => {
 setUserName(localStorage.getItem('chatr_user_name') || localStorage.getItem('user_name') || localStorage.getItem('chatr_user_handle') || 'Leader');
 }, []);

 return (
 <div className="h-full flex flex-col bg-[#09090b] text-zinc-300 overflow-y-auto">
 {/* Intelligent Briefing Header */}
 <div className="px-6 py-8 md:px-12 md:py-12 bg-gradient-to-b from-indigo-900/10 to-transparent">
 <div className="max-w-4xl mx-auto">
 <h1 className="text-page md:text-display text-white tracking-tight mb-4 md:mb-8">
 {getGreeting()}, {userName}.
 </h1>
 <div className="flex flex-col gap-2 md:gap-3">
 {briefing.map((line, i) => (
 <div key={i} className="text-section md:text-workspace text-zinc-400 font-medium flex items-center gap-3">
 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 shrink-0" />
 {line}
 </div>
 ))}
 </div>
 </div>
 </div>

 <div className="px-6 py-6 md:px-12 md:py-8 flex-1">
 <div className="max-w-4xl mx-auto space-y-8 md:space-y-16">
 
 {/* What changed? */}
 <section>
 <h2 className="text-secondary font-bold text-zinc-500 uppercase tracking-widest mb-6">What Changed (Last 24h)</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 hover:bg-zinc-800/50 transition-colors">
 <div className="text-page font-bold text-white mb-1">{activity?.totalChanges || 0}</div>
 <div className="text-secondary text-zinc-500">Total System Events</div>
 </div>
 <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 hover:bg-zinc-800/50 transition-colors">
 <div className="text-page font-bold text-emerald-400 mb-1">{activity?.recordsCreated || 0}</div>
 <div className="text-secondary text-zinc-500">New Records Created</div>
 </div>
 <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 hover:bg-zinc-800/50 transition-colors">
 <div className="text-page font-bold text-amber-400 mb-1">{activity?.policiesTriggered || 0}</div>
 <div className="text-secondary text-zinc-500">Policies Triggered</div>
 </div>
 <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 hover:bg-zinc-800/50 transition-colors">
 <div className="text-page font-bold text-indigo-400 mb-1">{activity?.itemsCompleted || 0}</div>
 <div className="text-secondary text-zinc-500">Items Completed</div>
 </div>
 </div>
 </section>

 {/* What needs attention? & What should I do next? */}
 <section>
 <div className="flex items-center justify-between mb-6">
 <h2 className="text-secondary font-bold text-zinc-500 uppercase tracking-widest">What Needs Attention</h2>
 </div>
 
 <div className="space-y-4">
 {items.length === 0 ? (
 <div className="p-8 border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-500">
 <CheckCircle2 size={32} className="mb-3 opacity-20" />
 <p>You're all caught up. No priorities demand immediate attention.</p>
 </div>
 ) : (
 items.map(item => (
 <div 
 key={item.id} 
 onClick={() => onNavigateToRecord(item.capabilityId, item.objectName, item.recordId)}
 className="group bg-zinc-900/40 border border-zinc-800/60 hover:bg-zinc-800/60 hover:border-zinc-700 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all"
 >
 <div className="flex items-center gap-5">
 <div className="w-12 h-12 rounded-full bg-[#09090b] flex items-center justify-center border border-zinc-800/80">
 {getIcon(item.type)}
 </div>
 <div>
 <div className="flex items-center gap-3 mb-1">
 <h3 className="text-white font-semibold text-section">{item.title}</h3>
 <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getUrgencyColor(item.urgency)}`}>
 {item.urgency}
 </span>
 </div>
 <p className="text-zinc-500 text-secondary">{item.description}</p>
 </div>
 </div>
 
 <button className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-button font-semibold rounded-xl transition-all shadow-sm group-hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]">
 {item.actionLabel} <ArrowRight size={16} />
 </button>
 </div>
 ))
 )}
 </div>
 </section>

 </div>
 </div>
 </div>
 );
};
