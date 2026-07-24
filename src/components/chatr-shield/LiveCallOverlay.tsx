import React, { useState, useEffect } from 'react';
import { Phone, Mic, MicOff, Volume2, Camera, Plus, Sparkles, RefreshCcw, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScoreOutput } from '@/lib/chatr-shield/shield-pipeline';

interface LiveCallOverlayProps {
 phoneNumber: string;
 callerName?: string;
 onEnd: () => void;
 isMuted: boolean;
 onToggleMute: () => void;
 isSpeaker: boolean;
 onToggleSpeaker: () => void;
 onToggleVideo?: () => void;
}

const LiveCallOverlay: React.FC<LiveCallOverlayProps> = ({ 
 phoneNumber, 
 callerName,
 onEnd,
 isMuted,
 onToggleMute,
 isSpeaker,
 onToggleSpeaker,
 onToggleVideo
}) => {
 const [elapsed, setElapsed] = useState(0);

 useEffect(() => {
 const timer = setInterval(() => setElapsed(e => e + 1), 1000);
 return () => clearInterval(timer);
 }, []);

 const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

 const displayName = callerName || 'Unknown Caller';
 const displayPhone = phoneNumber || '+1 000 000 0000';

 return (
 <div className="fixed inset-0 z-[1000] bg-black text-white flex flex-col pointer-events-auto">
 {/* Background Gradient */}
 <div className="absolute inset-0 bg-gradient-to-b from-[#1E1B2C] to-black opacity-80" />

 <div className="relative z-10 flex flex-col h-full items-center pt-16 pb-12">
 {/* Top Bar */}
 <div className="flex flex-col items-center mb-12">
 <h1 className="text-[26px] font-bold text-white drop-shadow-md">{displayName}</h1>
 <p className="text-[#A0AEC0] mt-1">{formatTime(elapsed)}</p>
 </div>

 {/* Avatar */}
 <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-[#536DFE] to-[#8C52FF] p-[4px] shadow-[0_0_24px_rgba(83,109,254,0.3)] flex-shrink-0">
 <div className="w-full h-full rounded-full bg-[#1A2035] flex items-center justify-center overflow-hidden">
 {/* Use first letter as placeholder */}
 <span className="text-display text-white">{displayName.charAt(0).toUpperCase()}</span>
 </div>
 </div>

 {/* Trusted Contact Row */}
 <div className="flex items-center mt-6 gap-2">
 <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
 <span className="text-white font-bold text-[16px]">Trusted Contact</span>
 </div>
 <p className="text-[#A0AEC0] text-secondary mt-2">{displayPhone}</p>

 {/* Cards Row */}
 <div className="flex w-full px-6 mt-12 gap-4 max-w-md">
 <div className="flex-1 bg-[#1A1A2E] rounded-2xl p-4 flex flex-col border border-white/5">
 <div className="w-8 h-8 rounded-full bg-[#536DFE] flex items-center justify-center mb-3">
 <Shield size={16} className="text-white" />
 </div>
 <p className="text-[#A0AEC0] text-label">AI Confidence</p>
 <p className="text-[#4CAF50] text-section font-bold mt-1">High</p>
 </div>
 
 <div className="flex-1 bg-[#1A1A2E] rounded-2xl p-4 flex flex-col border border-white/5">
 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-3">
 <Camera size={16} className="text-[#A0AEC0]" />
 </div>
 <p className="text-[#A0AEC0] text-label">Call Intelligence</p>
 <p className="text-[#536DFE] text-section font-bold mt-1">Active</p>
 </div>
 </div>

 <div className="flex-1" />

 {/* Bottom Controls Card */}
 <div className="bg-[#1A1A2E] rounded-full px-3 py-2 flex items-center justify-between shadow-2xl w-max gap-1">
 <button onClick={onToggleMute} className={`p-[12px] rounded-full transition-colors ${isMuted ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white'}`}>
 {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
 </button>
 <button onClick={onToggleVideo} className="p-[12px] rounded-full hover:bg-white/10 text-white transition-colors">
 <Camera size={24} />
 </button>
 <button className="p-[12px] rounded-full hover:bg-white/10 text-white transition-colors">
 <Plus size={24} />
 </button>
 <button className="p-[12px] rounded-full bg-[#536DFE] text-white mx-1 shadow-[0_0_15px_rgba(83,109,254,0.4)]">
 <Sparkles size={24} />
 </button>
 <button onClick={onToggleSpeaker} className={`p-[12px] rounded-full transition-colors ${isSpeaker ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white'}`}>
 <Volume2 size={24} />
 </button>
 <button className="p-[12px] rounded-full hover:bg-white/10 text-white transition-colors">
 <RefreshCcw size={24} />
 </button>
 <button onClick={onEnd} className="p-[12px] rounded-full bg-[#EF4444] text-white shadow-lg ml-2 hover:bg-red-600 transition-colors">
 <Phone size={24} className="rotate-[135deg] fill-current" />
 </button>
 </div>
 </div>
 </div>
 );
};

export default LiveCallOverlay;
