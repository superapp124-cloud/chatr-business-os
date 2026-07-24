import React from 'react';
import { Sparkles, FileText, IndianRupee, ShieldAlert, Calendar, SendHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIAssistantSidebarProps {
 firstName?: string;
}

export const AIAssistantSidebar: React.FC<AIAssistantSidebarProps> = ({ firstName = 'Guest' }) => {
 const actions = [
 { label: 'Summarize unread', icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/20' },
 { label: 'Find invoices', icon: IndianRupee, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
 { label: 'Show suspicious', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/20' },
 { label: 'Bills due this week', icon: Calendar, color: 'text-amber-400', bg: 'bg-amber-500/20' },
 { label: 'Find meeting invites', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/20' },
 ];

 return (
 <div className="w-[320px] h-screen bg-[#0f0f13] border-l border-white/5 flex flex-col hidden xl:flex shrink-0">
 {/* Header */}
 <div className="p-5 flex items-center gap-2 border-b border-white/5">
 <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_10px_rgba(99,102,241,0.5)]">
 <Sparkles className="w-3 h-3 text-white" />
 </div>
 <span className="text-secondary font-semibold text-white">AI Assistant</span>
 </div>

 {/* Hero */}
 <div className="flex flex-col items-center justify-center p-8 mt-4">
 <div className="relative mb-6">
 <div className="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full scale-150 animate-pulse" />
 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center relative shadow-[0_0_30px_rgba(99,102,241,0.4)] border border-white/10">
 <Sparkles className="w-10 h-10 text-white" />
 </div>
 </div>
 <h2 className="text-workspace font-bold text-white mb-2">Hi {firstName}! 👋</h2>
 <p className="text-secondary text-slate-400">How can I help you?</p>
 </div>

 {/* Action Chips */}
 <div className="flex-1 overflow-y-auto px-5 space-y-3 custom-scrollbar">
 {actions.map((action, i) => (
 <button
 key={i}
 className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#15151c] border border-white/5 hover:border-indigo-500/30 hover:bg-white/5 transition-all group"
 >
 <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", action.bg)}>
 <action.icon className={cn("w-4 h-4", action.color)} />
 </div>
 <span className="text-secondary font-medium text-slate-300 group-hover:text-white transition-colors">{action.label}</span>
 </button>
 ))}
 </div>

 {/* Input */}
 <div className="p-5 border-t border-white/5 bg-[#0f0f13]">
 <div className="relative">
 <input
 type="text"
 placeholder="Ask anything..."
 className="w-full pl-4 pr-12 py-3.5 bg-[#15151c] border border-white/10 rounded-2xl text-input text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
 />
 <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
 <SendHorizontal className="w-4 h-4 text-slate-400" />
 </button>
 </div>
 <p className="text-[10px] text-center text-slate-500 mt-3 flex items-center justify-center gap-1">
 <Sparkles className="w-3 h-3" /> Local AI • Private
 </p>
 </div>
 </div>
 );
};
