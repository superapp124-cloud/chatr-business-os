import React from 'react';
import { Search, UserPlus, Plus, ChevronDown, BrainCircuit, Hash, Lock, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PresenceIndicator } from './PresenceIndicator';
import type { Room } from '../types';

interface ConversationSidebarProps {
  rooms: Room[];
  selectedId: string | null;
  isLoadingRooms: boolean;
  setSelectedId: (id: string) => void;
  setShowNewDmModal: (show: boolean) => void;
  setShowCreateModal: (show: boolean) => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = React.memo(({
  rooms,
  selectedId,
  isLoadingRooms,
  setSelectedId,
  setShowNewDmModal,
  setShowCreateModal
}) => {
  const channels = rooms.filter(r => r.type === 'channel');
  const dms = rooms.filter(r => r.type === 'dm');
  const selectedRoom = rooms.find(r => r.id === selectedId);

  return (
    <div className="w-72 shrink-0 border-r border-white/[0.06] bg-[#0b0b14] flex flex-col relative z-20">
      
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
        <h2 className="text-secondary font-bold text-white/90">Messages</h2>
        <div className="flex gap-1">
          <button className="w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-white/50 transition-colors">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={() => setShowNewDmModal(true)} title="New Direct Message" className="w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-violet-300 transition-colors">
            <UserPlus className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreateModal(true)} className="w-7 h-7 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 flex items-center justify-center transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4 pb-4">
          
          {/* Favorites */}
          <div className="mb-4">
            <div className="flex items-center justify-between px-2 mb-1 group cursor-pointer">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest group-hover:text-white/50 transition-colors">Favorites</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
            </div>
            <div className="space-y-0.5">
              <button onClick={() => {
                const aiRoom = rooms.find(r => r.name === 'CHATR AI' || r.id === 'chatr-ai-room');
                setSelectedId(aiRoom ? aiRoom.id : 'chatr-ai-room');
              }} className={cn(
                'w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors group',
                (selectedRoom?.name === 'CHATR AI' || selectedId === 'chatr-ai-room') ? 'bg-violet-600/20 text-violet-300 font-semibold' : 'hover:bg-white/[0.04] text-white/70 hover:text-white/90'
              )}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-5 h-5 rounded-md object-cover shrink-0 shadow-sm" />
                  <span className="text-[13px] truncate font-bold text-white">chatrAI</span>
                </div>
              </button>
            </div>
          </div>

          {/* Channels */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1 group cursor-pointer">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest group-hover:text-white/50 transition-colors">Workspace Channels</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
            </div>
            <div className="space-y-0.5">
              {isLoadingRooms ? (
                <div className="px-2 py-2 text-label text-white/30 animate-pulse">Loading…</div>
              ) : channels.length === 0 ? (
                <div className="px-2 py-2 text-label text-white/30">No channels yet</div>
              ) : channels.map(c => (
                <button key={c.id} onClick={() => setSelectedId(c.id)} className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors group',
                  selectedId === c.id ? 'bg-violet-600/20 text-violet-300' : 'hover:bg-white/[0.04] text-white/70 hover:text-white/90',
                  c.isMuted && 'opacity-50'
                )}>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {c.isPrivate ? <Lock className="w-3.5 h-3.5 shrink-0 opacity-50" /> : <Hash className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                    <span className={cn("text-[13px] truncate", (c.unreadCount || 0) > 0 && selectedId !== c.id && "font-bold text-white")}>{c.name}</span>
                  </div>
                  {(c.unreadCount || 0) > 0 && (
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", selectedId === c.id ? "bg-violet-500/30 text-violet-200" : "bg-white/10 text-white")}>
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Contacts & Directory */}
          <div className="mt-4">
            <div className="flex items-center justify-between px-2 mb-1 group cursor-pointer" onClick={() => setShowNewDmModal(true)}>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400 opacity-80" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">Contacts & Directory</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
            </div>
            <div className="space-y-0.5">
              {dms.filter(dm => dm.name !== 'AI Assistant').length === 0 ? (
                <div className="px-2 py-2 text-label text-white/30 flex items-center justify-between">
                  <span>No contacts yet</span>
                  <button onClick={() => setShowNewDmModal(true)} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300">Add</button>
                </div>
              ) : dms.filter(dm => dm.name !== 'AI Assistant').map(dm => (
                <button key={dm.id} onClick={() => setSelectedId(dm.id)} className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors text-left group relative',
                  selectedId === dm.id ? 'bg-violet-600/20' : 'hover:bg-white/[0.04]'
                )}>
                  <div className="relative shrink-0">
                    {dm.avatarUrl ? (
                      <img src={dm.avatarUrl} alt={dm.name} className="w-6 h-6 rounded-[6px] object-cover" />
                    ) : (
                      <div className={cn("w-6 h-6 rounded-[6px] bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white")}>
                        {dm.name?.slice(0, 2).toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 border-2 border-[#0b0b14] rounded-full">
                      <PresenceIndicator status={(dm.otherUserPresence || 'offline') as any} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[13px] truncate", selectedId === dm.id ? "font-semibold text-violet-300" : (dm.unreadCount || 0) > 0 ? "font-semibold text-white" : "text-white/80")}>
                        {dm.name}
                      </span>
                      {(dm.unreadCount || 0) > 0 && (
                        <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          {dm.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
});
