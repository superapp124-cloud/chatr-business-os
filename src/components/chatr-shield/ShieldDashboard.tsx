import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Zap, BarChart3, Palette, Info, Check } from 'lucide-react';
import { ThemeOption, THEMES } from '@/components/dialer/chatr-calls/theme';
import { cn } from '@/lib/utils';

interface ShieldDashboardProps {
 onThemeChange?: (theme: ThemeOption) => void;
 currentTheme?: ThemeOption;
}

const ShieldDashboard: React.FC<ShieldDashboardProps> = ({ onThemeChange, currentTheme }) => {
 const stats = [
 { label: 'Calls Screened', value: '1,247', icon: Zap, color: 'text-primary' },
 { label: 'Spam Blocked', value: '89', icon: ShieldAlert, color: 'text-red-500' },
 { label: 'Verified Checks', value: '4,891', icon: ShieldCheck, color: 'text-green-500' },
 ];

 const themeList: { id: ThemeOption; name: string; color: string; accent: string }[] = [
 { id: 'midnight', name: 'Midnight', color: '#000000', accent: '#8B5CF6' },
 { id: 'daylight', name: 'Daylight', color: '#FFFFFF', accent: '#007AFF' },
 { id: 'noir_gold', name: 'Noir Gold', color: '#0A0A0A', accent: '#D4AF37' },
 { id: 'nordic', name: 'Nordic', color: '#2E3440', accent: '#88C0D0' },
 { id: 'royal', name: 'Royal', color: '#0F0C29', accent: '#A78BFA' },
 { id: 'blush', name: 'Blush', color: '#FFF1F2', accent: '#FB7185' },
 { id: 'cyber', name: 'Cyber', color: '#050505', accent: '#00FFC2' },
 ];

 return (
 <div className="screen-container">
 <div className="flex justify-between items-center mt-10 mb-8">
 <h1 className="large-title mb-0">Chatr Shield</h1>
 </div>
 
 {/* Theme Switcher */}
 <div className="mb-10">
 <div className="flex items-center gap-2 mb-4 px-1">
 <Palette size={18} className="text-primary" />
 <h2 className="text-secondary font-bold uppercase tracking-wider text-zinc-400">Personalize Experience</h2>
 </div>
 <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1">
 {themeList.map((theme) => (
 <button
 key={theme.id}
 onClick={() => onThemeChange?.(theme.id)}
 className={cn(
 "flex-shrink-0 w-24 h-32 rounded-[24px] border-2 transition-all flex flex-col items-center justify-center gap-3 shadow-xl",
 currentTheme === theme.id 
 ? "border-primary bg-primary/5 scale-105" 
 : "border-zinc-800/50 bg-zinc-900/30 grayscale-[0.5]"
 )}
 >
 <div 
 className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center relative overflow-hidden"
 style={{ backgroundColor: theme.color, border: '2px solid rgba(255,255,255,0.05)' }}
 >
 <div 
 className="absolute inset-0 opacity-20" 
 style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, transparent 100%)` }} 
 />
 {currentTheme === theme.id && (
 <Check size={20} className={theme.id === 'daylight' || theme.id === 'blush' ? 'text-zinc-900' : 'text-white'} />
 )}
 </div>
 <span className={cn(
 "text-[10px] font-bold uppercase tracking-widest",
 currentTheme === theme.id ? "text-primary" : "text-zinc-500"
 )}>
 {theme.name}
 </span>
 </button>
 ))}
 </div>
 </div>

 {/* Stats Grid */}
 <div className="grid grid-cols-1 gap-4 mb-8">
 {stats.map((stat, i) => (
 <div key={i} className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-[24px] flex items-center justify-between backdrop-blur-md">
 <div className="flex items-center gap-4">
 <div className="p-4 bg-zinc-950/60 rounded-2xl border border-white/5">
 <stat.icon size={28} className={stat.color} />
 </div>
 <div>
 <div className="text-zinc-500 text-label font-bold uppercase tracking-wider mb-1">{stat.label}</div>
 <div className="text-display font-black text-zinc-100">{stat.value}</div>
 </div>
 </div>
 <BarChart3 size={20} className="text-zinc-800" />
 </div>
 ))}
 </div>

 <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3">
 <Info size={16} className="text-primary mt-0.5" />
 <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
 Chatr Shield intelligence is computed locally and via privacy-preserving hashed lookups. Your contacts never leave your phone.
 </p>
 </div>
 </div>
 );
};

export default ShieldDashboard;
