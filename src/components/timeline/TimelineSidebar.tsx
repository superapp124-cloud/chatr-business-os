import React from 'react';
import { 
 Home, Sun, Mail, MessageSquare, Phone, CheckSquare, 
 CalendarDays, FileText, Users, Bookmark, LineChart, 
 Settings, ChevronRight, Activity, Sparkles, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import chatrIconLogo from '@/assets/chatr-icon-logo.png';

export const TimelineSidebar = () => {
 const navItems = [
 { label: 'Timeline', icon: Home, active: true },
 { label: 'Daily Brief', icon: Sun },
 { label: 'Mail', icon: Mail, badge: 12 },
 { label: 'SMS', icon: MessageSquare, badge: 5 },
 { label: 'Calls', icon: Phone, badge: 3 },
 { label: 'Tasks', icon: CheckSquare, badge: 4 },
 { label: 'Meetings', icon: CalendarDays, badge: 2 },
 { label: 'Documents', icon: FileText },
 { label: 'Contacts', icon: Users },
 { label: 'Bookmarks', icon: Bookmark },
 { label: 'Insights', icon: LineChart },
 ];

 return (
 <div className="w-[280px] h-screen bg-[#0f0f13] border-r border-white/5 flex flex-col hidden lg:flex shrink-0">
 {/* Brand */}
 <div className="p-6 flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-1 shadow-lg shadow-indigo-500/20">
 <img src={chatrIconLogo} alt="Chatr+" className="w-full h-full object-contain filter brightness-0 invert" />
 </div>
 <div>
 <h1 className="text-section font-bold text-white tracking-tight">CHATR+</h1>
 <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Smart Communication OS</p>
 </div>
 </div>

 {/* Nav List */}
 <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
 {navItems.map((item) => (
 <button
 key={item.label}
 className={cn(
 "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group",
 item.active 
 ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/10 text-indigo-400 shadow-[inset_2px_0_0_0_#818cf8]" 
 : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
 )}
 >
 <div className="flex items-center gap-3">
 <item.icon className={cn("w-4 h-4", item.active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
 <span className="text-secondary font-medium">{item.label}</span>
 </div>
 {item.badge && (
 <span className="text-[10px] font-bold bg-[#1a1a24] px-2 py-0.5 rounded-full text-slate-300">
 {item.badge}
 </span>
 )}
 </button>
 ))}
 </div>

 {/* AI Status Widget */}
 <div className="p-4 mt-auto">
 <div className="bg-[#15151c] rounded-2xl p-4 border border-white/5">
 <div className="flex items-center justify-between mb-1">
 <h3 className="text-label font-semibold text-slate-300">AI Status</h3>
 </div>
 <p className="text-[10px] text-emerald-400 font-medium mb-4 flex items-center gap-1">
 <CheckCircle2 className="w-3 h-3" /> All systems active
 </p>
 
 {/* Fake sine wave graph */}
 <div className="h-12 w-full flex items-end gap-1 mb-4 opacity-70">
 {[4, 6, 3, 7, 5, 8, 4, 9, 5, 3, 6, 4].map((h, i) => (
 <div key={i} className="flex-1 bg-gradient-to-t from-indigo-500/50 to-purple-500/20 rounded-t-sm" style={{ height: `${h * 10}%` }} />
 ))}
 </div>

 <div className="space-y-2">
 <div className="flex items-center gap-2 text-label text-slate-400">
 <Activity className="w-3.5 h-3.5 text-indigo-400" />
 <span>On-device AI</span>
 </div>
 <div className="flex items-center gap-2 text-label text-slate-400">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
 <span>Gemini Nano</span>
 </div>
 </div>
 </div>
 </div>

 {/* Settings */}
 <div className="p-4 border-t border-white/5">
 <button className="w-full flex items-center justify-between px-3 py-2 text-slate-400 hover:text-slate-200 transition-colors">
 <div className="flex items-center gap-3">
 <Settings className="w-4 h-4" />
 <span className="text-secondary font-medium">Settings</span>
 </div>
 <ChevronRight className="w-4 h-4 opacity-50" />
 </button>
 </div>
 </div>
 );
};
