import React from 'react';
import { Sparkles, Plus, Zap, MessageSquare, FileText, CheckCheck, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EmptyState: React.FC<{ setShowCreateModal: (v: boolean) => void }> = React.memo(({ setShowCreateModal }) => {
 const navigate = useNavigate();

 return (
 <div className="flex-1 flex flex-col relative z-10 p-8 overflow-y-auto">
 <div className="max-w-5xl mx-auto w-full">
 <div className="flex items-center gap-4 mb-8">
 <div className="w-16 h-16 rounded-[20px] bg-gradient-to-tr from-violet-600 to-indigo-500 p-0.5 shadow-2xl shadow-violet-500/20">
 <div className="w-full h-full bg-[#0b0b14] rounded-[18px] flex items-center justify-center">
 <Sparkles className="w-6 h-6 text-violet-400" />
 </div>
 </div>
 <div>
 <h2 className="text-page font-bold text-white mb-1">Welcome back.</h2>
 <p className="text-white/50 text-secondary">Here's your intelligent workspace overview for today.</p>
 </div>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
 <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group text-left">
 <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
 <Plus className="w-5 h-5" />
 </div>
 <div>
 <span className="text-secondary font-bold text-white/90 block mb-0.5">Create Channel</span>
 <span className="text-label text-white/50">Start a new project space</span>
 </div>
 </button>
 <button onClick={() => navigate('/desktop/intelligence')} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group text-left">
 <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
 <Zap className="w-5 h-5" />
 </div>
 <div>
 <span className="text-secondary font-bold text-white/90 block mb-0.5">AI Insights</span>
 <span className="text-label text-white/50">View network intelligence</span>
 </div>
 </button>
 <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group text-left">
 <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
 <MessageSquare className="w-5 h-5" />
 </div>
 <div>
 <span className="text-secondary font-bold text-white/90 block mb-0.5">New Direct Message</span>
 <span className="text-label text-white/50">Chat with a coworker</span>
 </div>
 </button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 {/* Activity Feed */}
 <div className="bg-zinc-900/50 border border-white/[0.04] rounded-2xl p-6">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-secondary font-bold text-white/90 uppercase tracking-wider">Live Activity</h3>
 <button className="text-button text-violet-400 hover:text-violet-300">View All</button>
 </div>
 <div className="space-y-4">
 {[
 { icon: <FileText className="w-4 h-4 text-blue-400" />, title: 'Quotation_v2.pdf uploaded', desc: 'Sanobar shared a file in #sales', time: '10m ago' },
 { icon: <CheckCheck className="w-4 h-4 text-emerald-400" />, title: 'Action Item Completed', desc: 'You resolved "Update pricing model"', time: '1h ago' },
 { icon: <Video className="w-4 h-4 text-orange-400" />, title: 'Sync Call Scheduled', desc: 'Marketing team sync starts in 30m', time: 'Just now' }
 ].map((act, i) => (
 <div key={i} className="flex gap-4 items-start group">
 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mt-0.5 shrink-0 group-hover:bg-white/10 transition-colors">
 {act.icon}
 </div>
 <div className="flex-1">
 <p className="text-secondary font-medium text-white/90">{act.title}</p>
 <p className="text-label text-white/50">{act.desc}</p>
 </div>
 <span className="text-[10px] text-white/30">{act.time}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Extracted Context */}
 <div className="bg-zinc-900/50 border border-white/[0.04] rounded-2xl p-6">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-secondary font-bold text-white/90 uppercase tracking-wider">AI Priority Context</h3>
 <Sparkles className="w-4 h-4 text-violet-400" />
 </div>
 <div className="space-y-3">
 <div className="p-4 rounded-xl bg-violet-600/10 border border-violet-500/20">
 <p className="text-secondary text-white/90 font-medium mb-1">Awaiting your approval on Q3 Marketing Budget.</p>
 <p className="text-label text-white/50">Requested by Sanobar in #marketing 2 hours ago.</p>
 <div className="flex gap-2 mt-3">
 <button className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-button font-bold transition-colors">Approve</button>
 <button className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-button transition-colors">Review Thread</button>
 </div>
 </div>
 <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
 <p className="text-secondary text-white/90 font-medium mb-1">Unread mention in #engineering.</p>
 <p className="text-label text-white/50">"Could you take a look at the deployment logs?"</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
});
