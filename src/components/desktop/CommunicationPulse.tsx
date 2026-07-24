import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Activity, RefreshCw, CheckCircle2 } from 'lucide-react';

export type PulseState = 'receiving' | 'ai-thinking' | 'syncing' | 'connected';

interface CommunicationPulseProps {
 state?: PulseState;
 className?: string;
}

export const CommunicationPulse: React.FC<CommunicationPulseProps> = ({ 
 state = 'connected',
 className 
}) => {
 const getPulseConfig = () => {
 switch (state) {
 case 'receiving':
 return {
 icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
 ringColor: 'border-emerald-400/30',
 glowColor: 'bg-emerald-400/20',
 innerColor: 'bg-emerald-400',
 animate: 'animate-pulse'
 };
 case 'ai-thinking':
 return {
 icon: <Sparkles className="w-3.5 h-3.5 text-blue-400" />,
 ringColor: 'border-blue-400/30',
 glowColor: 'bg-blue-400/20',
 innerColor: 'bg-blue-400',
 animate: 'animate-spin-slow' // We'll add this to tailwind config or just use spin
 };
 case 'syncing':
 return {
 icon: <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />,
 ringColor: 'border-purple-400/30',
 glowColor: 'bg-purple-400/20',
 innerColor: 'bg-purple-400',
 animate: 'animate-pulse'
 };
 case 'connected':
 default:
 return {
 icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />,
 ringColor: 'border-slate-400/20',
 glowColor: 'bg-slate-400/10',
 innerColor: 'bg-slate-400',
 animate: ''
 };
 }
 };

 const config = getPulseConfig();

 return (
 <div className={cn("relative flex items-center justify-center w-8 h-8 group cursor-pointer", className)}>
 {/* Outer Glow */}
 <div className={cn("absolute inset-0 rounded-full blur-md transition-colors duration-700", config.glowColor, config.animate)} />
 
 {/* Structural Ring */}
 <div className={cn("absolute inset-0 rounded-full border-[1.5px] transition-colors duration-500", config.ringColor)} />
 
 {/* Inner Dot / Icon */}
 <div className={cn("relative flex items-center justify-center w-full h-full rounded-full transition-transform duration-300 group-hover:scale-110")}>
 {config.icon}
 </div>
 </div>
 );
};
