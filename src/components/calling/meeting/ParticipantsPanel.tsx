import React, { useState } from 'react';
import { X, Mic, MicOff, Video, VideoOff, Crown, Clock, AlertCircle, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface Participant {
 id: string;
 name: string;
 role: 'host' | 'co-host' | 'participant';
 status: 'active' | 'muted' | 'video-off' | 'away' | 'presenting';
 avatarColor?: string;
 isSpeaking?: boolean;
}

interface ParticipantsPanelProps {
 participants: Participant[];
 isHost: boolean;
 onClose: () => void;
 onInvite: () => void;
 onMuteParticipant?: (id: string) => void;
 onRemoveParticipant?: (id: string) => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
 active: <div className="w-2 h-2 rounded-full bg-emerald-400" />,
 muted: <MicOff className="w-3 h-3 text-amber-400" />,
 'video-off': <VideoOff className="w-3 h-3 text-zinc-500" />,
 away: <Clock className="w-3 h-3 text-yellow-400" />,
 presenting: <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />,
};

const STATUS_LABEL: Record<string, string> = {
 active: 'Active',
 muted: 'Muted',
 'video-off': 'Camera Off',
 away: 'Away',
 presenting: 'Presenting',
};

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
 participants,
 isHost,
 onClose,
 onInvite,
 onMuteParticipant,
 onRemoveParticipant,
}) => {
 const [hoveredId, setHoveredId] = useState<string | null>(null);
 const [search, setSearch] = useState('');

 const filtered = participants.filter((p) =>
 p.name.toLowerCase().includes(search.toLowerCase())
 );

 return (
 <div className="w-[280px] shrink-0 border-l border-white/[0.07] bg-[#09090F] flex flex-col h-full animate-in slide-in-from-right-4 duration-300 shadow-[-20px_0_40px_rgba(0,0,0,0.4)]">
 {/* Header */}
 <div className="p-4 border-b border-white/[0.07] flex items-center justify-between shrink-0">
 <div>
 <h3 className="text-secondary font-semibold text-white/90">Participants</h3>
 <p className="text-[10px] text-white/40 mt-0.5">{participants.length} in this call</p>
 </div>
 <button
 onClick={onClose}
 className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
 >
 <X className="w-3.5 h-3.5 text-white/60" />
 </button>
 </div>

 {/* Search */}
 <div className="px-3 py-2 shrink-0">
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search participants..."
 className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-1.5 text-label text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/40"
 />
 </div>

 {/* List */}
 <ScrollArea className="flex-1">
 <div className="px-2 py-1 space-y-0.5">
 {filtered.map((p) => (
 <div
 key={p.id}
 onMouseEnter={() => setHoveredId(p.id)}
 onMouseLeave={() => setHoveredId(null)}
 className={cn(
 'flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all group',
 p.isSpeaking
 ? 'bg-emerald-500/[0.07] border border-emerald-500/20'
 : 'hover:bg-white/[0.04] border border-transparent'
 )}
 >
 {/* Avatar */}
 <div
 className={cn(
 'w-8 h-8 rounded-full flex items-center justify-center text-label font-bold shrink-0 relative',
 p.isSpeaking ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#09090F]' : ''
 )}
 style={{ background: p.avatarColor || 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}
 >
 {p.name[0]?.toUpperCase()}
 {p.role === 'host' && (
 <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center">
 <Crown className="w-2 h-2 text-amber-900" />
 </div>
 )}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="text-[12px] font-medium text-white/90 truncate">{p.name}</span>
 {p.isSpeaking && (
 <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">Speaking</span>
 )}
 </div>
 <div className="flex items-center gap-1 mt-0.5">
 <span className="text-[9px] text-white/40">{STATUS_LABEL[p.status]}</span>
 {p.role !== 'participant' && (
 <span className={cn(
 'text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-wider',
 p.role === 'host' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
 )}>
 {p.role}
 </span>
 )}
 </div>
 </div>

 {/* Status icon */}
 <div className="shrink-0">
 {STATUS_ICONS[p.status]}
 </div>

 {/* Host actions (on hover) */}
 {isHost && hoveredId === p.id && p.role !== 'host' && (
 <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
 <button
 onClick={() => onMuteParticipant?.(p.id)}
 className="w-6 h-6 rounded bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors"
 title="Mute"
 >
 <MicOff className="w-3 h-3 text-white/60" />
 </button>
 <button
 onClick={() => onRemoveParticipant?.(p.id)}
 className="w-6 h-6 rounded bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
 title="Remove"
 >
 <X className="w-3 h-3 text-red-400" />
 </button>
 </div>
 )}
 </div>
 ))}
 </div>
 </ScrollArea>

 {/* Invite Button */}
 <div className="p-3 shrink-0 border-t border-white/[0.07]">
 <button
 onClick={onInvite}
 className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/80 hover:bg-purple-500 border border-purple-500/30 text-white text-button font-bold transition-all shadow-lg shadow-purple-900/20"
 >
 <UserPlus className="w-3.5 h-3.5" />
 Invite People
 </button>
 </div>
 </div>
 );
};
