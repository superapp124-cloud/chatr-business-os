import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
 TerminalSquare, 
 Activity, 
 Search, 
 Network, 
 ShoppingBag, 
 ShieldCheck, 
 Command
} from 'lucide-react';

export default function ChatrOSLayout() {
 const navigate = useNavigate();
 const location = useLocation();

 const lenses = [
 { id: 'command', icon: <TerminalSquare size={20} />, label: 'Command', path: '/os/command' },
 { id: 'mission-control', icon: <Activity size={20} />, label: 'Mission Control', path: '/os/mission-control' },
 { id: 'inspector', icon: <Search size={20} />, label: 'Inspector', path: '/os/inspector' },
 { id: 'knowledge', icon: <Network size={20} />, label: 'Knowledge', path: '/os/knowledge' },
 { id: 'marketplace', icon: <ShoppingBag size={20} />, label: 'Marketplace', path: '/os/marketplace' },
 { id: 'governance', icon: <ShieldCheck size={20} />, label: 'Governance', path: '/os/governance' },
 ];

 // If we're on the onboarding screen, we might hide the sidebar, but let's assume onboarding is full screen and routes differently.
 const isOnboarding = location.pathname.includes('/os/onboarding');

 if (isOnboarding) {
 return (
 <div className="flex h-screen bg-[#09090b] text-zinc-300 font-sans overflow-hidden">
 <Outlet />
 </div>
 );
 }

 return (
 <div className="flex h-screen bg-[#09090b] text-zinc-300 font-sans overflow-hidden">
 {/* 6-Lens Sidebar Navigation */}
 <div className="w-64 border-r border-zinc-800/60 bg-zinc-950 flex flex-col flex-shrink-0 z-20">
 <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
 <div className="flex items-center gap-2 text-white font-bold tracking-tight">
 <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
 <Command size={14} className="text-white" />
 </div>
 <span>CHATR OS</span>
 </div>
 </div>
 
 <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
 <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2">Lenses</div>
 {lenses.map((lens) => {
 const isActive = location.pathname === lens.path || location.pathname.startsWith(`${lens.path}/`);
 return (
 <button
 key={lens.id}
 onClick={() => navigate(lens.path)}
 className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-secondary font-medium transition-colors ${
 isActive 
 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm' 
 : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
 }`}
 >
 {lens.icon}
 {lens.label}
 </button>
 );
 })}
 </div>
 </div>
 
 {/* Main View Area */}
 <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
 {/* Background ambient glow */}
 <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
 <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
 
 <div className="flex-1 overflow-y-auto relative z-10 scrollbar-hide">
 <Outlet />
 </div>
 </div>
 </div>
 );
}
