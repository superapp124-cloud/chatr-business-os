import React, { useRef } from 'react';
import { Phone, PhoneMissed, Video, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useCall } from '@/contexts/CallContext';

interface CallTimelineItemProps {
 payload: any;
 isOwn: boolean;
 currentUser?: any;
 otherUser?: any;
}

export const CallTimelineItem = ({ payload, isOwn, currentUser, otherUser }: CallTimelineItemProps) => {
 const { initiateCall } = useCall();
 const isVideo = payload.call_type === 'video';
 const isMissed = payload.status === 'missed' || payload.status === 'declined';
 const Icon = isVideo ? Video : (isMissed ? PhoneMissed : Phone);
 
 const formatDuration = (seconds?: number) => {
 if (!seconds) return '';
 const m = Math.floor(seconds / 60);
 const s = seconds % 60;
 if (m === 0) return `${s}s`;
 return `${m}m ${s}s`;
 };

 const lastCallTime = useRef<number>(0);

 const handleCall = () => {
 const now = Date.now();
 if (now - lastCallTime.current < 1000) {
 console.log("🔥 [CallTimelineItem] Ignoring double-tap");
 return;
 }
 lastCallTime.current = now;
 
 console.log("🔥 [CallTimelineItem] handleCall clicked!");
 const receiverId = otherUser?.id || (isOwn ? payload.receiver_id : payload.caller_id);
 const callerId = currentUser?.id || (isOwn ? payload.caller_id : payload.receiver_id);
 
 console.log("🔥 [CallTimelineItem] receiverId:", receiverId, "callerId:", callerId);
 
 if (!receiverId) {
 console.warn("🔥 [CallTimelineItem] No receiverId found! Aborting call.");
 return;
 }
 
 const displayName = otherUser?.username || otherUser?.display_name || otherUser?.full_name || 'Unknown';
 
 console.log("🔥 [CallTimelineItem] Calling initiateCall for:", displayName);
 initiateCall({
 partnerId: receiverId,
 partnerName: displayName,
 partnerAvatar: otherUser?.avatar_url,
 partnerPhone: otherUser?.phone || undefined,
 callType: payload.call_type || 'voice',
 conversationId: payload.conversation_id
 });
 };

 return (
 <div className={`flex flex-col mb-[2px] px-[4px] w-full ${isOwn ? 'items-end' : 'items-start'}`}>
 <button 
 type="button"
 onPointerDown={(e) => {
 // Prevent useGesture from capturing the pointer and eating clicks
 e.stopPropagation();
 }}
 onClick={(e) => {
 e.stopPropagation();
 e.preventDefault();
 handleCall();
 }}
 onPointerUp={(e) => {
 e.stopPropagation();
 handleCall();
 }}
 className={`flex flex-col gap-2 p-3 min-w-[200px] shadow-sm rounded-2xl cursor-pointer active:scale-95 transition-transform text-left border-none outline-none ${
 isOwn 
 ? 'bg-blue-50/50 border border-blue-100 rounded-tr-sm hover:bg-blue-100/50' 
 : 'bg-white border border-gray-100 rounded-tl-sm hover:bg-gray-50'
 }`}>
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-full ${
 isMissed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
 }`}>
 <Icon className="w-4 h-4" />
 </div>
 <div>
 <p className={`text-secondary font-medium ${isMissed ? 'text-red-600' : 'text-gray-900'}`}>
 {isVideo ? 'Video Call' : 'Voice Call'}
 </p>
 <p className="text-label text-gray-500 flex items-center gap-1 mt-0.5">
 <Clock className="w-3 h-3" />
 {payload.started_at ? format(new Date(payload.started_at), 'h:mm a') : 'Unknown time'}
 </p>
 </div>
 </div>
 
 {payload.duration && !isMissed && (
 <div className="mt-1 pt-2 border-t border-gray-100 flex justify-between items-center">
 <span className="text-label text-gray-500">Duration</span>
 <span className="text-label text-gray-700">{formatDuration(payload.duration)}</span>
 </div>
 )}
 </button>
 </div>
 );
};
