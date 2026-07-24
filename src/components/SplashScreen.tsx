import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import logo from '@/assets/chatr-icon-logo.png';

export const SplashScreen = ({ onComplete }: { onComplete?: () => void }) => {
 const [isVisible, setIsVisible] = useState(true);

 useEffect(() => {
 const timer = setTimeout(() => {
 setIsVisible(false);
 onComplete?.();
 }, 1000); // 1 second splash

 return () => clearTimeout(timer);
 }, [onComplete]);

 if (!isVisible) return null;

 return (
 <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B0B0F] transition-opacity duration-700">
 <div className="relative flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-1000">
 {/* Purple Glow Icon */}
 <div className="relative">
 <div className="absolute inset-0 bg-[#5c22ff] blur-[40px] opacity-20 rounded-full" />
 <div className="relative w-24 h-24 overflow-hidden rounded-[28px] flex items-center justify-center shadow-[0_0_30px_rgba(92,34,255,0.3)] bg-white/5 backdrop-blur-sm border border-white/10">
 <img src={logo} alt="Chatr Logo" className="w-20 h-20 object-contain animate-pulse" />
 </div>
 </div>

 {/* Text Group */}
 <div className="flex flex-col items-center gap-3">
 <h1 className="text-white text-display font-black tracking-tight">chatr+</h1>
 <p className="text-slate-500 text-[10px] font-mono tracking-widest uppercase animate-pulse">
 CONNECTING CORE...
 </p>
 </div>
 </div>

 {/* Bottom Progress Indicator (Subtle) */}
 <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-white/5 overflow-hidden">
 <div className="h-full bg-[#5c22ff] animate-progress-indefinite" />
 </div>

 <style>{`
 @keyframes progress-indefinite {
 0% { transform: translateX(-100%); }
 100% { transform: translateX(100%); }
 }
 .animate-progress-indefinite {
 animation: progress-indefinite 2s infinite linear;
 }
 `}</style>
 </div>
 );
};
