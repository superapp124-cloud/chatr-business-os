import React from 'react';
import {
 Mic, MicOff, Video, VideoOff, MonitorUp, Hand, Radio,
 UserPlus, MoreHorizontal, PhoneOff, Smile, Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MeetingControlsProps {
 isMuted: boolean;
 isVideoOff: boolean;
 isRecording: boolean;
 isHandRaised: boolean;
 isScreenSharing: boolean;
 showAddParticipant: boolean;
 onToggleMute: () => void;
 onToggleVideo: () => void;
 onToggleRecord: () => void;
 onToggleHand: () => void;
 onToggleScreen: () => void;
 onAddParticipant: () => void;
 onReactions: () => void;
 onMoreOptions: () => void;
 onEndCall: () => void;
 callDuration: string;
}

interface ControlButtonProps {
 icon: React.ReactNode;
 activeIcon?: React.ReactNode;
 label: string;
 isActive?: boolean;
 isDanger?: boolean;
 isHighlight?: boolean;
 onClick: () => void;
 badge?: string;
}

const ControlButton: React.FC<ControlButtonProps> = ({
 icon,
 activeIcon,
 label,
 isActive,
 isDanger,
 isHighlight,
 onClick,
 badge,
}) => (
 <div className="flex flex-col items-center gap-1">
 <button
 onClick={onClick}
 title={label}
 className={cn(
 'relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 group',
 isDanger
 ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
 : isActive
 ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'
 : isHighlight
 ? 'bg-purple-600/80 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 border border-purple-500/30'
 : 'bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.06]'
 )}
 >
 {isActive && activeIcon ? activeIcon : icon}
 {badge && (
 <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
 {badge}
 </span>
 )}
 </button>
 <span className="text-[8px] text-white/40 font-medium">{label}</span>
 </div>
);

export const MeetingControls: React.FC<MeetingControlsProps> = ({
 isMuted,
 isVideoOff,
 isRecording,
 isHandRaised,
 isScreenSharing,
 showAddParticipant,
 onToggleMute,
 onToggleVideo,
 onToggleRecord,
 onToggleHand,
 onToggleScreen,
 onAddParticipant,
 onReactions,
 onMoreOptions,
 onEndCall,
 callDuration,
}) => {
 return (
 <div className="h-[88px] bg-zinc-950/95 backdrop-blur-xl border-t border-white/[0.07] flex items-center justify-between px-6 relative z-30 shrink-0">
 {/* Left: Duration + Network */}
 <div className="flex items-center gap-3 w-[180px]">
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
 <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
 <span className="text-white font-mono text-secondary tracking-wider">{callDuration}</span>
 </div>
 <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
 <div className="flex gap-0.5 items-end h-4">
 {[3, 5, 4, 6, 4].map((h, i) => (
 <div key={i} className="w-1 rounded-sm bg-emerald-400" style={{ height: `${h * 3}px` }} />
 ))}
 </div>
 <span className="text-[9px] text-emerald-400 font-bold">HD</span>
 </div>
 </div>

 {/* Center: Controls */}
 <div className="flex items-center gap-2">
 <ControlButton
 icon={<Mic className="w-5 h-5" />}
 activeIcon={<MicOff className="w-5 h-5" />}
 label={isMuted ? 'Unmute' : 'Mute'}
 isActive={isMuted}
 onClick={onToggleMute}
 />
 <ControlButton
 icon={<Video className="w-5 h-5" />}
 activeIcon={<VideoOff className="w-5 h-5" />}
 label={isVideoOff ? 'Start Cam' : 'Stop Cam'}
 isActive={isVideoOff}
 onClick={onToggleVideo}
 />
 <ControlButton
 icon={<MonitorUp className="w-5 h-5" />}
 label="Share"
 isActive={isScreenSharing}
 isHighlight={isScreenSharing}
 onClick={() => { onToggleScreen(); toast.info('Screen share — coming soon!'); }}
 />
 <ControlButton
 icon={<Hand className="w-5 h-5" />}
 label="Raise Hand"
 isActive={isHandRaised}
 onClick={onToggleHand}
 />
 <ControlButton
 icon={<Radio className="w-5 h-5" />}
 label={isRecording ? 'Stop Rec' : 'Record'}
 isActive={isRecording}
 onClick={onToggleRecord}
 />

 {/* Separator */}
 <div className="w-px h-8 bg-white/[0.08] mx-1" />

 <div className="relative">
 <ControlButton
 icon={<UserPlus className="w-5 h-5" />}
 label="Invite"
 isHighlight={showAddParticipant}
 onClick={onAddParticipant}
 />
 </div>
 <ControlButton
 icon={<Smile className="w-5 h-5" />}
 label="React"
 onClick={onReactions}
 />
 <ControlButton
 icon={<MoreHorizontal className="w-5 h-5" />}
 label="More"
 onClick={onMoreOptions}
 />

 {/* Separator */}
 <div className="w-px h-8 bg-white/[0.08] mx-1" />

 <div className="flex flex-col items-center gap-1">
 <button
 onClick={onEndCall}
 className="w-14 h-11 rounded-2xl flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all shadow-xl shadow-red-500/30"
 >
 <PhoneOff className="w-5 h-5" />
 </button>
 <span className="text-[8px] text-red-400/70 font-medium">Leave</span>
 </div>
 </div>

 {/* Right: Settings */}
 <div className="flex items-center justify-end gap-2 w-[180px]">
 <button
 onClick={() => toast.info('Device settings — coming soon!')}
 className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
 title="Device Settings"
 >
 <Settings2 className="w-4 h-4 text-white/50" />
 </button>
 </div>
 </div>
 );
};
