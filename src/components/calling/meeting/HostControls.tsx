import React, { useState, useEffect } from 'react';
import { X, MicOff, Lock, LogOut, UserCog, MessageSquareOff, Shield, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface HostControlsProps {
 onClose: () => void;
 onMuteAll: () => void;
 onEndMeeting: () => void;
 roomId?: string | null;
}

export const HostControls: React.FC<HostControlsProps> = ({ onClose, onMuteAll, onEndMeeting, roomId }) => {
 const [locked, setLocked] = useState(false);
 const [chatDisabled, setChatDisabled] = useState(false);
 const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
 
 const [showTransfer, setShowTransfer] = useState(false);
 const [participants, setParticipants] = useState<{user_id: string, name: string}[]>([]);

 useEffect(() => {
 if (!roomId) return;
 
 const fetchState = async () => {
 const { data } = await supabase.from('session_rooms').select('is_locked, chat_disabled, waiting_room_enabled').eq('id', roomId).single();
 if (data) {
 setLocked(data.is_locked || false);
 setChatDisabled(data.chat_disabled || false);
 setWaitingRoomEnabled(data.waiting_room_enabled || false);
 }
 };
 fetchState();
 }, [roomId]);

 const updateRoomSetting = async (key: string, value: boolean) => {
 if (!roomId) {
 toast.error('No active room to update.');
 return;
 }
 try {
 await supabase.channel(`room-settings-${roomId}`).send({
 type: 'broadcast',
 event: 'host_control',
 payload: { key, value },
 });
 await supabase.from('session_rooms').update({ [key]: value }).eq('id', roomId);
 } catch {
 // Non-critical
 }
 };

 const handleLockMeeting = async () => {
 const next = !locked;
 setLocked(next);
 await updateRoomSetting('is_locked', next);
 toast.success(next ? 'Meeting locked — no new participants can join.' : 'Meeting unlocked.');
 };

 const handleDisableChat = async () => {
 const next = !chatDisabled;
 setChatDisabled(next);
 await updateRoomSetting('chat_disabled', next);
 toast.success(next ? 'Chat disabled for all participants.' : 'Chat re-enabled.');
 };

 const handleWaitingRoom = async () => {
 const next = !waitingRoomEnabled;
 setWaitingRoomEnabled(next);
 await updateRoomSetting('waiting_room_enabled', next);
 toast.success(next ? 'Waiting room enabled. New joiners need approval.' : 'Waiting room disabled.');
 };

 const handleMuteAll = () => {
 onMuteAll();
 };

 const handleTransferHostClick = async () => {
 if (!roomId) return;
 const { data: srp } = await supabase.from('session_room_participants').select('user_id, users(raw_user_meta_data)').eq('room_id', roomId);
 if (srp) {
 const parts = srp.map((p: any) => ({
 user_id: p.user_id,
 name: p.users?.raw_user_meta_data?.full_name || p.users?.raw_user_meta_data?.username || 'Participant'
 }));
 const { data: { user } } = await supabase.auth.getUser();
 setParticipants(parts.filter(p => p.user_id !== user?.id));
 setShowTransfer(true);
 }
 };

 const submitTransfer = async (newHostId: string) => {
 if (!roomId) return;
 try {
 await supabase.from('session_rooms').update({ host_id: newHostId }).eq('id', roomId);
 await supabase.channel(`room-settings-${roomId}`).send({
 type: 'broadcast',
 event: 'host_control',
 payload: { key: 'host_transferred', value: newHostId },
 });
 toast.success('Host transferred successfully.');
 onClose();
 } catch (e) {
 toast.error('Failed to transfer host.');
 }
 };

 const handleEndMeeting = () => {
 onEndMeeting();
 onClose();
 };

 const ACTIONS = [
 {
 icon: MicOff,
 label: 'Mute All Participants',
 desc: 'All participants will be muted',
 color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', hoverBg: 'hover:bg-amber-500/15',
 action: handleMuteAll,
 active: false,
 },
 {
 icon: Lock,
 label: locked ? 'Unlock Meeting' : 'Lock Meeting',
 desc: locked ? 'Allow new participants to join' : 'Prevent new participants from joining',
 color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', hoverBg: 'hover:bg-blue-500/15',
 action: handleLockMeeting,
 active: locked,
 },
 {
 icon: MessageSquareOff,
 label: chatDisabled ? 'Enable Chat' : 'Disable Chat',
 desc: chatDisabled ? 'Allow participants to send messages' : 'Participants cannot send messages',
 color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', hoverBg: 'hover:bg-orange-500/15',
 action: handleDisableChat,
 active: chatDisabled,
 },
 {
 icon: Shield,
 label: waitingRoomEnabled ? 'Disable Waiting Room' : 'Enable Waiting Room',
 desc: waitingRoomEnabled ? 'New joiners enter immediately' : 'Approve new joiners before they enter',
 color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', hoverBg: 'hover:bg-emerald-500/15',
 action: handleWaitingRoom,
 active: waitingRoomEnabled,
 },
 {
 icon: UserCog,
 label: 'Transfer Host Role',
 desc: 'Give another participant host controls',
 color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', hoverBg: 'hover:bg-purple-500/15',
 action: handleTransferHostClick,
 active: false,
 },
 {
 icon: LogOut,
 label: 'End Meeting for All',
 desc: 'Close the meeting and disconnect everyone',
 color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', hoverBg: 'hover:bg-red-500/15',
 action: handleEndMeeting,
 active: false,
 danger: true,
 }
 ];

 return (
 <div className="absolute bottom-24 right-4 w-80 bg-[#1A1A1D] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-5">
 <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
 <h3 className="text-secondary font-semibold text-white/90">Host Controls</h3>
 <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/5">
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="p-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
 {showTransfer ? (
 <div className="space-y-3">
 <h4 className="text-label font-bold text-white/70">Select New Host</h4>
 {participants.length === 0 ? (
 <p className="text-label text-white/40">No other participants.</p>
 ) : (
 participants.map(p => (
 <button 
 key={p.user_id} 
 onClick={() => submitTransfer(p.user_id)}
 className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
 >
 <span className="text-secondary text-white/90">{p.name}</span>
 </button>
 ))
 )}
 <button onClick={() => setShowTransfer(false)} className="w-full mt-2 py-1.5 text-label text-white/50 hover:text-white/90 transition-colors">Back</button>
 </div>
 ) : (
 <div className="flex flex-col gap-2">
 {ACTIONS.map((action, idx) => (
 <button
 key={idx}
 onClick={action.action}
 className={cn(
 "w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left group",
 action.bg, action.border, action.hoverBg
 )}
 >
 <div className={cn("p-2 rounded-lg shrink-0 mt-0.5 relative", action.bg, action.color)}>
 <action.icon className="w-4 h-4" />
 {action.active && (
 <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#1A1A1D] rounded-full flex items-center justify-center">
 <CheckCircle className="w-3 h-3 text-emerald-400" />
 </div>
 )}
 </div>
 <div>
 <div className={cn("text-secondary font-semibold mb-0.5", action.danger ? 'text-red-400' : 'text-white/90')}>
 {action.label}
 </div>
 <div className="text-[11px] text-white/40 leading-tight">
 {action.desc}
 </div>
 </div>
 </button>
 ))}
 </div>
 )}
 </div>
 </div>
 );
};
