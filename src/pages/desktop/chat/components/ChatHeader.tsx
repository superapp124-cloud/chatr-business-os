import React from 'react';
import { Phone, Video, Search, Pin, BellOff, MoreVertical, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PresenceIndicator } from './PresenceIndicator';
import type { Room } from '../types';

interface ChatHeaderProps {
 selectedRoom: Room;
 peerUsername?: string | null;
 onStartCall: (username: string, video: boolean) => void;
 onSearch: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
 selectedRoom,
 peerUsername,
 onStartCall,
 onSearch
}) => {
 return (
 <div className="h-14 shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-5 relative z-10">
 <div className="flex items-center gap-3">
 <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-label font-bold text-white shadow-lg",
 selectedRoom.name === 'AI Assistant' ? 'bg-violet-600' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
 )}>
 {selectedRoom.name === 'AI Assistant' ? <BrainCircuit className="w-4 h-4 text-white" /> : (selectedRoom.name?.slice(0, 2).toUpperCase() || '??')}
 </div>
 <div>
 <h2 className="text-secondary font-bold text-white/90 flex items-center gap-2">
 {selectedRoom.name}
 </h2>
 <div className="flex items-center gap-1.5 mt-0.5">
 {selectedRoom.type === 'dm' && selectedRoom.name !== 'AI Assistant' ? (
 <>
 <div className="relative w-2 h-2 rounded-full mt-0.5">
 <PresenceIndicator status={(selectedRoom.otherUserPresence || 'offline') as any} />
 </div>
 <p className="text-[10px] text-white/60 capitalize font-medium">
 {selectedRoom.otherUserPresence || 'offline'}
 </p>
 </>
 ) : (
 <p className="text-[10px] text-white/40">{selectedRoom.type === 'channel' ? 'Workspace Channel' : 'Direct Message'}</p>
 )}
 </div>
 </div>
 </div>
 
 <div className="flex items-center gap-1">
 {selectedRoom.type === 'dm' && peerUsername && (
 <>
 <button
 title="Voice Call"
 onClick={() => onStartCall(peerUsername, false)}
 className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400 transition-colors"
 >
 <Phone className="w-4 h-4" />
 </button>
 <button
 title="Video Call"
 onClick={() => onStartCall(peerUsername, true)}
 className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400 transition-colors"
 >
 <Video className="w-4 h-4" />
 </button>
 <div className="w-px h-4 bg-white/10 mx-1" />
 </>
 )}
 <button 
 onClick={onSearch}
 className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white transition-colors"
 >
 <Search className="w-4 h-4" />
 </button>
 <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white transition-colors">
 <Pin className="w-4 h-4" />
 </button>
 <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white transition-colors">
 <BellOff className="w-4 h-4" />
 </button>
 <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/50 hover:text-white transition-colors ml-1">
 <MoreVertical className="w-4 h-4" />
 </button>
 </div>
 </div>
 );
});
