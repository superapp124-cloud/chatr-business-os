import React, { useState, useEffect } from 'react';
import { Shield, Zap, Users, Globe, BarChart3, TrendingUp, ChevronRight, ShieldCheck, ShieldAlert, ShieldX, Palette, Check } from 'lucide-react';
import { runShieldPipeline, submitCommunityReport, ScoreOutput } from '@/lib/chatr-shield/shield-pipeline';
import { ThemeOption, THEMES } from '@/components/dialer/chatr-calls/theme';
import { cn } from '@/lib/utils';

interface ShieldTabProps {
 onThemeChange?: (theme: ThemeOption) => void;
 currentTheme?: ThemeOption;
}

const ShieldTab: React.FC<ShieldTabProps> = ({ onThemeChange, currentTheme }) => {
 const [testNumber, setTestNumber] = useState('');
 const [testResult, setTestResult] = useState<ScoreOutput | null>(null);
 const [testing, setTesting] = useState(false);

 const themeList: { id: ThemeOption; name: string; bg: string; accent: string }[] = [
 { id: 'midnight', name: 'Midnight', bg: '#0a0d1a', accent: '#8B5CF6' },
 { id: 'daylight', name: 'Daylight', bg: '#FFFFFF', accent: '#007AFF' },
 { id: 'noir_gold', name: 'Noir Gold', bg: '#0A0A0A', accent: '#D4AF37' },
 { id: 'nordic', name: 'Nordic', bg: '#2E3440', accent: '#88C0D0' },
 { id: 'royal', name: 'Royal', bg: '#0F0C29', accent: '#A78BFA' },
 { id: 'blush', name: 'Blush', bg: '#FFF1F2', accent: '#FB7185' },
 { id: 'cyber', name: 'Cyber', bg: '#050505', accent: '#00FFC2' },
 ];

 const stats = [
 { label: 'Total Scanned', value: '1,247', icon: Shield, color: 'text-[#8B5CF6]' },
 { label: 'Spam Blocked', value: '89', icon: ShieldX, color: 'text-red-400' },
 { label: 'Community Reports', value: '342', icon: Users, color: 'text-amber-400' },
 { label: 'Verified Safe', value: '4,891', icon: ShieldCheck, color: 'text-green-400' },
 ];

 const runTest = async () => {
 if (!testNumber || testNumber.length < 5) return;
 setTesting(true);
 setTestResult(null);
 const result = await runShieldPipeline(testNumber);
 setTestResult(result);
 setTesting(false);
 };

 const resultColor = !testResult ? '#6B7280' :
 testResult.label === 'SAFE' ? '#22C55E' :
 testResult.label === 'SUSPICIOUS' ? '#F59E0B' :
 (testResult.label === 'SPAM' || testResult.label === 'FRAUD') ? '#EF4444' : '#6B7280';

 return (
 <div className="screen-container pb-24 overflow-y-auto overflow-x-hidden bg-black text-white">
 {/* Header with animated background */}
 <div className="relative pt-12 pb-8 px-6 mb-4 overflow-hidden rounded-b-[40px] bg-gradient-to-br from-[#0a0c24] via-black to-black border-b border-[#8B5CF6]/20">
 <div className="absolute top-[-50px] right-[-50px] w-48 h-48 blur-[80px] rounded-full" style={{ background: 'rgba(139,92,246,0.1)' }} />
 <div className="absolute bottom-[-30px] left-[-30px] w-32 h-32 blur-[60px] rounded-full" style={{ background: 'rgba(139,92,246,0.06)' }} />
 
 <div className="flex items-center gap-4 mb-4 relative z-10">
 <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-3" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6d28d9 100%)', boxShadow: '0 16px 40px rgba(139,92,246,0.35)' }}>
 <Shield size={28} className="text-white drop-shadow-md" />
 </div>
 <div>
 <h1 className="text-[28px] font-black tracking-tight leading-none text-white">Chatr Shield</h1>
 <div className="flex items-center gap-2 mt-1">
 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
 <p className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: '#c084fc' }}>
 Active Intelligence Engine
 </p>
 </div>
 </div>
 </div>
 </div>

 <div className="px-5 space-y-6">
 {/* Real-time Global Threats */}
 <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-inner">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <TrendingUp size={14} style={{ color: '#8B5CF6' }} />
 <span className="text-[11px] font-black tracking-widest text-zinc-400 uppercase">Threat Landscape</span>
 </div>
 <div className="px-2 py-0.5 rounded-full text-[9px] font-black" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#c084fc' }}>
 LIVE · GLOBAL
 </div>
 </div>
 
 <div className="grid grid-cols-2 gap-4">
 {stats.map(({ label, value, icon: Icon, color }) => (
 <div key={label} className="group relative overflow-hidden rounded-2xl bg-black/40 border border-white/5 p-4 hover:border-indigo-500/30 transition-all">
 <div className="absolute top-[-20px] right-[-20px] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
 <Icon size={64} />
 </div>
 <Icon size={18} className={cn(color, "mb-2")} />
 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</p>
 <p className="text-[20px] font-black text-white mt-1">{value}</p>
 </div>
 ))}
 </div>
 </div>

 {/* Live Number Scanner */}
 <div className="bg-gradient-to-b from-zinc-900/60 to-zinc-900/20 border border-white/5 rounded-3xl p-5 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] rounded-full pointer-events-none" />
 
 <div className="flex items-center gap-2 mb-4">
 <Zap size={14} className="text-amber-400" />
 <span className="text-[11px] font-black tracking-widest text-zinc-400 uppercase">Intelligence Lookup</span>
 </div>

 <div className="flex gap-2 mb-4 bg-black/40 rounded-2xl p-1.5 border border-white/5">
 <input
 type="tel"
 value={testNumber}
 onChange={e => setTestNumber(e.target.value)}
 placeholder="Enter number (e.g. +91...)"
 className="flex-1 bg-transparent px-4 py-2.5 text-[15px] font-semibold text-white outline-none placeholder:text-zinc-600"
 />
 <button
 onClick={runTest}
 disabled={testing || testNumber.length < 5}
 className="text-white px-5 rounded-xl font-black text-[11px] tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-40"
 style={{ background: testing || testNumber.length < 5 ? '#27272a' : '#8B5CF6', boxShadow: testing || testNumber.length < 5 ? 'none' : '0 4px 16px rgba(139,92,246,0.25)' }}
 >
 {testing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'SCAN'}
 </button>
 </div>

 {testResult && (
 <div className="mt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className={cn(
 "rounded-2xl p-4 border relative overflow-hidden",
 testResult.label === 'SAFE' ? "bg-green-500/5 border-green-500/20" : 
 testResult.label === 'SUSPICIOUS' ? "bg-amber-500/5 border-amber-500/20" : "bg-red-500/5 border-red-500/20"
 )}>
 <div className="flex items-center justify-between mb-3 relative z-10">
 <div>
 <p className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter mb-1">Resulting Identity</p>
 <h3 className="text-section font-black text-white">{testResult.display_name || testNumber}</h3>
 </div>
 <div className={cn(
 "px-4 py-1.5 rounded-full text-[11px] font-black shadow-lg",
 testResult.label === 'SAFE' ? "bg-green-600 text-white shadow-green-600/20" : 
 testResult.label === 'SUSPICIOUS' ? "bg-amber-600 text-white shadow-amber-600/20" : "bg-red-600 text-white shadow-red-600/20"
 )}>
 {testResult.label}
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4 mt-4 py-4 border-y border-white/5 relative z-10">
 <div className="flex flex-col">
 <span className="text-[9px] font-black text-zinc-500 uppercase">Trust Score</span>
 <span className={cn("text-workspace font-black", 
 testResult.trust_score > 80 ? "text-green-400" : testResult.trust_score > 50 ? "text-amber-400" : "text-red-400"
 )}>{testResult.trust_score}%</span>
 </div>
 <div className="flex flex-col">
 <span className="text-[9px] font-black text-zinc-500 uppercase">Analysis Latency</span>
 <span className="text-workspace font-black" style={{ color: '#8B5CF6' }}>{testResult.latency_ms}ms</span>
 </div>
 </div>

 <div className="mt-4 flex flex-wrap gap-2 relative z-10">
 {testResult.risk_flags.map(flag => (
 <span key={flag} className="px-3 py-1 rounded-lg bg-black/40 border border-white/5 text-[9px] font-black text-zinc-400 uppercase tracking-wider">
 {flag}
 </span>
 ))}
 <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ml-auto" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#c084fc' }}>
 {testResult.country} · {testResult.carrier || 'N/A'}
 </span>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Engine Transparency */}
 <div className="bg-zinc-900/20 border border-white/5 rounded-3xl overflow-hidden">
 <div className="p-5 border-b border-white/5">
 <div className="flex items-center gap-2">
 <Globe size={14} style={{ color: '#8B5CF6' }} />
 <span className="text-[11px] font-black tracking-widest text-zinc-400 uppercase">5-Layer Pipeline Architecture</span>
 </div>
 </div>
 <div className="divide-y divide-white/5">
 {[
 { num: 1, name: 'L1: On-Device Intelligence', desc: 'Instant local cache & blacklists', time: '~1ms', active: true, icon: Zap },
 { num: 2, name: 'L2: Collective Trust', desc: 'Crowdsourced spam signatures', time: '~12ms', active: true, icon: Users },
 { num: 3, name: 'L3: Network Forensics', desc: 'VoIP, age & carrier metadata', time: '~45ms', active: true, icon: Globe },
 { num: 4, name: 'L4: AI Enrichment', desc: 'Async Gemini enrichment — processes post-call, cached for future lookups', time: 'QUEUED', active: false, icon: Shield },
 { num: 5, name: 'L5: Voice Biometrics', desc: 'Deepfake & synthetic voice detection — not yet implemented', time: 'ROADMAP', active: false, icon: BarChart3 },
 ].map(({ num, name, desc, time, active, icon: Icon }) => (
 <div key={num} className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
 <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
 <Icon size={18} style={{ color: '#8B5CF6' }} />
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between mb-1">
 <p className={cn("text-[13px] font-black", active ? "text-white" : "text-zinc-500")}>{name}</p>
 <span className={cn(
 "text-[9px] font-black px-2 py-0.5 rounded-full",
 active
 ? "bg-zinc-800 text-zinc-400"
 : time === 'QUEUED'
 ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
 : "bg-zinc-900 text-zinc-600 border border-zinc-700/50"
 )}>{time}</span>
 </div>
 <p className="text-[11px] font-medium text-zinc-500 leading-relaxed">{desc}</p>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Theme Settings */}
 <div className="pb-12">
 <div className="flex items-center gap-2 mb-4 px-1">
 <Palette size={14} style={{ color: '#8B5CF6' }} />
 <span className="text-[11px] font-black tracking-widest text-zinc-400 uppercase">Interface Customization</span>
 </div>
 <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1">
 {themeList.map(theme => (
 <button
 key={theme.id}
 onClick={() => onThemeChange?.(theme.id)}
 className={cn(
 "flex-shrink-0 flex flex-col items-center gap-3 transition-all",
 currentTheme === theme.id ? "scale-110" : "opacity-40 hover:opacity-70"
 )}
 >
 <div 
 className="w-14 h-14 rounded-2xl p-0.5 bg-white/5 border border-white/10"
 >
 <div 
 className="w-full h-full rounded-[14px] flex items-center justify-center"
 style={{ background: `linear-gradient(135deg, ${theme.bg} 30%, ${theme.accent} 100%)` }}
 >
 {currentTheme === theme.id && <Check size={20} className="text-white drop-shadow-md" />}
 </div>
 </div>
 <span className="text-[9px] font-black text-white uppercase tracking-tighter">{theme.name}</span>
 </button>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
};

export default ShieldTab;
