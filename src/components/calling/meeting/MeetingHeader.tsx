import React from 'react';
import {
 Shield, Copy, Users, Video, Mic, MonitorUp,
 Radio, Bot, LayoutGrid, MoreHorizontal, ChevronDown, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MeetingHeaderProps {
 title?: string;
 meetingId?: string;
 hostName?: string;
 startedAt?: string;
 duration: string;
 participantCount: number;
 isRecording: boolean;
 isAiActive: boolean;
 isSpeakerView: boolean;
 onInviteClick: () => void;
 onParticipantsClick: () => void;
 onLayoutClick: () => void;
 onMoreClick: () => void;
 onRecordingToggle: () => void;
}

export const MeetingHeader: React.FC<MeetingHeaderProps> = ({
 title = 'Weekly Project Review',
 meetingId = 'CHATR-8F4K-219A',
 hostName = 'Arshid',
 startedAt,
 duration,
 participantCount,
 isRecording,
 isAiActive,
 onInviteClick,
 onParticipantsClick,
 onLayoutClick,
 onMoreClick,
 onRecordingToggle,
}) => {
 const copyMeetingId = () => {
 navigator.clipboard.writeText(meetingId).catch(() => {});
 toast.success('Meeting ID copied!');
 };

 return (
 <div className="h-12 shrink-0 bg-zinc-950/95 backdrop-blur-xl border-b border-white/[0.07] flex items-center px-4 gap-3 z-40 relative">
 {/* Org / Title */}
 <div className="flex items-center gap-2.5 min-w-0 mr-2">
 <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shrink-0">
 <Video className="w-3.5 h-3.5 text-white" />
 </div>
 <div className="min-w-0">
 <div className="text-[12px] font-semibold text-white/90 truncate leading-tight">{title}</div>
 <div className="text-[9px] text-white/35 leading-tight">Acme Corporation</div>
 </div>
 </div>

 <div className="w-px h-6 bg-white/[0.08] shrink-0" />

 {/* Meeting ID */}
 <button
 onClick={copyMeetingId}
 className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors group"
 title="Click to copy meeting ID"
 >
 <span className="text-[10px] font-mono text-white/50 group-hover:text-white/80 transition-colors">{meetingId}</span>
 <Copy className="w-2.5 h-2.5 text-white/30 group-hover:text-white/60 transition-colors" />
 </button>

 {/* Host */}
 <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-white/40">
 <span>Host:</span>
 <span className="text-white/70 font-medium">{hostName}</span>
 </div>

 <div className="w-px h-6 bg-white/[0.08] shrink-0 hidden lg:block" />

 {/* Duration */}
 <div className="flex items-center gap-1.5 text-[10px] text-white/50">
 <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
 <span className="font-mono text-white/80">{duration}</span>
 </div>

 {/* Divider */}
 <div className="flex-1" />

 {/* Status pills */}
 {isRecording && (
 <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
 <Radio className="w-3 h-3 text-red-400" />
 <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">REC</span>
 </div>
 )}

 {isAiActive && (
 <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
 <Bot className="w-3 h-3 text-emerald-400" />
 <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">AI</span>
 </div>
 )}

 {/* Security */}
 <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.03] border border-white/[0.06]" title="End-to-End Encrypted">
 <Lock className="w-3 h-3 text-emerald-400" />
 <span className="text-[9px] text-white/40 hidden lg:inline">E2E</span>
 </div>

 <div className="w-px h-6 bg-white/[0.08] shrink-0" />

 {/* Action Buttons */}
 <button
 onClick={onParticipantsClick}
 className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.09] transition-all text-[10px] text-white/70 hover:text-white"
 >
 <Users className="w-3.5 h-3.5" />
 <span className="font-semibold">{participantCount}</span>
 </button>

 <button
 onClick={onInviteClick}
 className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 border border-purple-500/30 transition-all text-[10px] font-bold text-white shadow-lg shadow-purple-900/20"
 >
 <Copy className="w-3 h-3" />
 Invite
 </button>

 <button
 onClick={onLayoutClick}
 className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.09] transition-all text-white/60 hover:text-white"
 title="Switch Layout"
 >
 <LayoutGrid className="w-3.5 h-3.5" />
 </button>

 <button
 onClick={onMoreClick}
 className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.09] transition-all text-white/60 hover:text-white"
 title="More options"
 >
 <MoreHorizontal className="w-3.5 h-3.5" />
 </button>
 </div>
 );
};
