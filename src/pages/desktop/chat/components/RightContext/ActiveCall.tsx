import React from 'react';
import { useCall } from '@/contexts/CallContext';
import { Signal, MicOff, Video, Share2, PhoneOff } from 'lucide-react';

export const ActiveCall: React.FC = () => {
 // Tapping into the real WebRTC context!
 const { isInCall, callRoomId, callRoomName, isVideo, endCall } = useCall();

 if (!isInCall) return null; // Only show when there is actually a live call

 return (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-label font-semibold text-white/90">Active Call</span>
 <Signal className="w-4 h-4 text-emerald-500 animate-pulse" />
 </div>
 <div className="bg-white/[0.02] border border-emerald-500/20 rounded-xl p-4 space-y-4">
 <div>
 <h3 className="text-secondary font-semibold text-white/90 truncate">{callRoomName || callRoomId}</h3>
 <p className="text-label text-emerald-400/80">Connected {isVideo ? '(Video)' : '(Audio)'}</p>
 </div>
 
 <div className="flex items-center gap-2 pt-2">
 <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
 <MicOff className="w-4 h-4 text-white/80" />
 </button>
 <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
 <Video className="w-4 h-4 text-white/80" />
 </button>
 <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
 <Share2 className="w-4 h-4 text-white/80" />
 </button>
 <button 
 onClick={() => endCall()}
 className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors ml-auto"
 >
 <PhoneOff className="w-4 h-4 text-white" />
 </button>
 </div>
 </div>
 </div>
 );
};
