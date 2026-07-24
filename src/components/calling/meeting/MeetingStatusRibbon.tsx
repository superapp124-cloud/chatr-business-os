import React from 'react';
import { Radio, Bot, MonitorUp, Wifi, Lock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusItem {
 icon: React.ElementType;
 label: string;
 value: string;
 color: string;
 bg: string;
 border: string;
 active: boolean;
}

interface MeetingStatusRibbonProps {
 isRecording: boolean;
 isAiTranscribing: boolean;
 isScreenSharing: boolean;
 networkQuality: 'excellent' | 'good' | 'poor';
 isEncrypted: boolean;
 onDismiss?: () => void;
}

export const MeetingStatusRibbon: React.FC<MeetingStatusRibbonProps> = ({
 isRecording,
 isAiTranscribing,
 isScreenSharing,
 networkQuality,
 isEncrypted,
 onDismiss,
}) => {
 const networkColor =
 networkQuality === 'excellent'
 ? { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }
 : networkQuality === 'good'
 ? { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' }
 : { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };

 const networkLabel =
 networkQuality === 'excellent' ? 'Excellent' : networkQuality === 'good' ? 'Good' : 'Poor';

 const items: StatusItem[] = [
 {
 icon: Radio,
 label: 'Recording',
 value: 'Active',
 color: 'text-red-400',
 bg: 'bg-red-500/10',
 border: 'border-red-500/20',
 active: isRecording,
 },
 {
 icon: Bot,
 label: 'AI Transcript',
 value: 'Listening',
 color: 'text-emerald-400',
 bg: 'bg-emerald-500/10',
 border: 'border-emerald-500/20',
 active: isAiTranscribing,
 },
 {
 icon: MonitorUp,
 label: 'Screen Share',
 value: 'On',
 color: 'text-blue-400',
 bg: 'bg-blue-500/10',
 border: 'border-blue-500/20',
 active: isScreenSharing,
 },
 {
 icon: Wifi,
 label: `Network`,
 value: networkLabel,
 color: networkColor.text,
 bg: networkColor.bg,
 border: networkColor.border,
 active: true,
 },
 {
 icon: Lock,
 label: 'Encrypted',
 value: 'E2EE',
 color: 'text-emerald-400',
 bg: 'bg-emerald-500/8',
 border: 'border-emerald-500/15',
 active: isEncrypted,
 },
 ];

 const visibleItems = items.filter((i) => i.active);

 if (visibleItems.length === 0) return null;

 return (
 <div className="h-8 shrink-0 bg-zinc-950/90 backdrop-blur-sm border-b border-white/[0.05] flex items-center px-4 gap-2 overflow-x-auto scrollbar-none">
 {visibleItems.map((item, i) => (
 <div
 key={i}
 className={cn(
 'flex items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0',
 item.bg,
 item.border
 )}
 >
 <item.icon className={cn('w-2.5 h-2.5', item.color)} />
 <span className={cn('text-[9px] font-bold uppercase tracking-wider', item.color)}>
 {item.label}
 </span>
 <span className="text-[9px] text-white/40">·</span>
 <span className={cn('text-[9px] font-medium', item.color)}>{item.value}</span>
 </div>
 ))}

 <div className="flex-1" />

 {isRecording && (
 <div className="flex items-center gap-1.5 shrink-0">
 <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
 <span className="text-[9px] text-white/40 font-mono">Auto Summary: Enabled</span>
 </div>
 )}
 </div>
 );
};
