import React from 'react';
import { X, Search, CheckCheck, Loader2, Forward } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message, Room } from '../types';

interface ForwardModalProps {
 forwardMessage: Message | null;
 rooms: Room[];
 selectedId: string | null;
 forwardSearchQuery: string;
 setForwardSearchQuery: (q: string) => void;
 forwardSelectedRooms: Set<string>;
 setForwardSelectedRooms: (set: Set<string>) => void;
 isForwarding: boolean;
 onClose: () => void;
 onForward: () => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = React.memo(({
 forwardMessage,
 rooms,
 selectedId,
 forwardSearchQuery,
 setForwardSearchQuery,
 forwardSelectedRooms,
 setForwardSelectedRooms,
 isForwarding,
 onClose,
 onForward
}) => {
 if (!forwardMessage) return null;

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
 <div className="w-full max-w-md bg-[#0f0f13] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
 <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
 <h3 className="font-semibold text-white/90">Forward Message</h3>
 <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
 <X className="w-4 h-4 text-white/60" />
 </button>
 </div>
 
 <div className="p-4 bg-black/20 border-b border-white/[0.05]">
 <div className="text-label text-white/50 mb-1 uppercase tracking-wider font-semibold">Original Message</div>
 <div className="text-secondary text-white/80 bg-white/5 p-3 rounded-xl border border-white/10 max-h-24 overflow-y-auto line-clamp-3">
 {forwardMessage.content || (forwardMessage.attachments?.length ? `[${forwardMessage.attachments.length} Attachment${forwardMessage.attachments.length > 1 ? 's' : ''}]` : 'Empty message')}
 </div>
 </div>

 <div className="p-4 border-b border-white/10">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
 <input 
 type="text" 
 value={forwardSearchQuery}
 onChange={(e) => setForwardSearchQuery(e.target.value)}
 placeholder="Search chats to forward to..." 
 className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-secondary text-white focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
 />
 </div>
 </div>
 
 <div className="flex-1 overflow-y-auto p-2">
 {rooms
 .filter(r => r.id !== selectedId && r.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()))
 .map(room => {
 const isSelected = forwardSelectedRooms.has(room.id);
 return (
 <button 
 key={room.id}
 onClick={() => {
 const next = new Set(forwardSelectedRooms);
 if (isSelected) next.delete(room.id);
 else next.add(room.id);
 setForwardSelectedRooms(next);
 }}
 className={cn(
 "w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left mt-1",
 isSelected ? "bg-violet-500/10 border border-violet-500/20" : "hover:bg-white/5 border border-transparent"
 )}
 >
 <div className="relative">
 <img 
 src={room.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${room.name}&backgroundColor=0f0f13,1a1a24`} 
 className="w-10 h-10 rounded-full object-cover border border-white/10" 
 alt={room.name} 
 />
 {isSelected && (
 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-500 rounded-full border-2 border-[#0f0f13] flex items-center justify-center">
 <CheckCheck className="w-3 h-3 text-white" />
 </div>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-secondary font-semibold text-white/90 truncate">{room.name}</div>
 <div className="text-[11px] text-white/40 capitalize">{room.type === 'dm' ? 'Direct Message' : 'Channel'}</div>
 </div>
 </button>
 );
 })}
 {rooms.filter(r => r.id !== selectedId && r.name.toLowerCase().includes(forwardSearchQuery.toLowerCase())).length === 0 && (
 <div className="p-8 text-center text-secondary text-white/40">No chats found.</div>
 )}
 </div>
 
 <div className="p-4 border-t border-white/10 bg-white/[0.02]">
 <button
 disabled={forwardSelectedRooms.size === 0 || isForwarding}
 onClick={onForward}
 className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-button transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/20"
 >
 {isForwarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Forward className="w-4 h-4" />}
 Forward to {forwardSelectedRooms.size} chat{forwardSelectedRooms.size !== 1 ? 's' : ''}
 </button>
 </div>
 </div>
 </div>
 );
});
