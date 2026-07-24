import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, ShieldCheck, Activity, Search, RefreshCw, Zap, Server, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function ProviderCloud() {
 const [pulse, setPulse] = useState(false);

 useEffect(() => {
 const interval = setInterval(() => setPulse(p => !p), 2000);
 return () => clearInterval(interval);
 }, []);

 return (
 <div className="min-h-screen bg-[#0a0a0c] text-white font-sans overflow-hidden relative">
 {/* Dynamic Animated Background */}
 <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen animate-pulse" />
 <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-600/10 blur-[150px] rounded-full mix-blend-screen" />
 
 <div className="max-w-7xl mx-auto p-10 relative z-10 space-y-12 h-full">
 <header className="flex items-center justify-between">
 <div>
 <motion.div 
 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
 className="flex items-center gap-3 mb-2"
 >
 <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
 <Network className="w-5 h-5 text-indigo-400" />
 </div>
 <h1 className="text-display tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
 Provider Intelligence
 </h1>
 </motion.div>
 <motion.p 
 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
 className="text-indigo-300/70 font-medium tracking-wide uppercase text-label ml-14"
 >
 Autonomous Discovery & Verification Mesh
 </motion.p>
 </div>
 
 <motion.div 
 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
 className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-5 py-2.5 backdrop-blur-md"
 >
 <div className={`w-2 h-2 rounded-full ${pulse ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-emerald-500/50'} transition-all duration-500`} />
 <span className="text-secondary font-semibold tracking-wide text-slate-300">SYSTEM HEALTHY</span>
 </motion.div>
 </header>

 {/* Top KPIs */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <KPICard 
 icon={<ShieldCheck className="w-6 h-6 text-emerald-400" />}
 title="Verified Manifests"
 value="2,042"
 subtitle="98.5% Freshness Score"
 delay={0.1}
 color="emerald"
 />
 <KPICard 
 icon={<Activity className="w-6 h-6 text-blue-400" />}
 title="Active Agents"
 value="8"
 subtitle="Scanning GitHub & MCPs"
 delay={0.2}
 color="blue"
 />
 <KPICard 
 icon={<Zap className="w-6 h-6 text-amber-400" />}
 title="Delegation Success"
 value="99.1%"
 subtitle="42,104 hrs saved this month"
 delay={0.3}
 color="amber"
 />
 </div>

 {/* Live Discovery Stream */}
 <section>
 <motion.div 
 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
 className="flex items-center gap-3 mb-6 ml-2"
 >
 <Search className="w-5 h-5 text-indigo-400" />
 <h2 className="text-section tracking-wide">Live Discovery Stream</h2>
 </motion.div>
 
 <div className="grid grid-cols-1 gap-4">
 <DiscoveryRow 
 agent="MCP Discovery Agent" 
 target="github.com/search?q=mcp-server" 
 status="Scanning" 
 time="2 mins ago" 
 icon={<Search />}
 delay={0.5}
 />
 <DiscoveryRow 
 agent="Pricing Intelligence Agent" 
 target="amadeus.com/api/pricing" 
 status="Verifying" 
 time="14 mins ago" 
 icon={<RefreshCw className="animate-spin-slow" />}
 delay={0.6}
 />
 <DiscoveryRow 
 agent="Coupon & Offers Agent" 
 target="retail.graph.network/endpoints" 
 status="Idle" 
 time="1 hr ago" 
 icon={<Server />}
 delay={0.7}
 />
 </div>
 </section>
 </div>
 </div>
 );
}

function KPICard({ icon, title, value, subtitle, delay, color }: any) {
 const colorMap: any = {
 emerald: 'from-emerald-500/10 to-transparent border-emerald-500/20 group-hover:border-emerald-500/40',
 blue: 'from-blue-500/10 to-transparent border-blue-500/20 group-hover:border-blue-500/40',
 amber: 'from-amber-500/10 to-transparent border-amber-500/20 group-hover:border-amber-500/40',
 };

 return (
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay, ease: 'easeOut' }}
 className={`relative overflow-hidden group bg-gradient-to-br ${colorMap[color]} bg-[#111116] border rounded-3xl p-6 hover:shadow-2xl transition-all duration-300 backdrop-blur-xl`}
 >
 <div className="flex justify-between items-start mb-4">
 <div className={`p-3 rounded-2xl bg-white/5 border border-white/10`}>
 {icon}
 </div>
 </div>
 <div className="space-y-1">
 <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
 <div className="text-display font-black tracking-tighter text-white drop-shadow-md">{value}</div>
 <p className="text-secondary font-medium text-slate-500 pt-1">{subtitle}</p>
 </div>
 <div className="absolute -bottom-10 -right-10 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-500 pointer-events-none text-white w-40 h-40">
 {icon}
 </div>
 </motion.div>
 );
}

function DiscoveryRow({ agent, target, status, time, delay, icon }: any) {
 const isScanning = status === 'Scanning';
 
 return (
 <motion.div
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.4, delay }}
 className="group bg-[#111116]/80 backdrop-blur-lg border border-white/5 hover:border-indigo-500/30 rounded-2xl p-5 flex items-center justify-between transition-all duration-300 hover:shadow-[0_0_30px_-10px_rgba(99,102,241,0.2)]"
 >
 <div className="flex items-center gap-5">
 <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${isScanning ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
 {icon}
 </div>
 <div>
 <h4 className="text-body font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">{agent}</h4>
 <p className="text-secondary font-medium text-slate-500 flex items-center gap-2 mt-0.5">
 <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
 {target}
 </p>
 </div>
 </div>
 
 <div className="flex items-center gap-8">
 <div className="text-right">
 <div className={`text-secondary font-bold uppercase tracking-wider ${isScanning ? 'text-indigo-400' : status === 'Verifying' ? 'text-blue-400' : 'text-slate-500'}`}>
 {status}
 </div>
 <div className="text-label text-slate-500 mt-0.5">{time}</div>
 </div>
 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors cursor-pointer">
 <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-300" />
 </div>
 </div>
 </motion.div>
 );
}
