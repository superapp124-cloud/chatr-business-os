import React, { useEffect, useRef, useState } from "react";
import { Phone, MessageSquare, Bell, ShieldCheck, Video, Lock, RefreshCcw } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useNativeRingtone } from "@/hooks/useNativeRingtone";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";

interface IncomingCallScreenProps {
 callerName: string;
 callerAvatar?: string;
 callType: "voice" | "video" | "audio";
 onAnswer: () => void;
 onReject: () => void;
 onSendMessage?: () => void;
 ringtoneUrl?: string;
 callerCity?: string;
 callerCountry?: string;
 callerLocationSharing?: boolean;
 callerLocationPrecision?: 'exact' | 'city' | 'off';
}

const SlideToAnswer = ({ onAnswer }: { onAnswer: () => void }) => {
 const containerRef = useRef<HTMLDivElement>(null);
 const [containerWidth, setContainerWidth] = useState(0);
 const x = useMotionValue(0);
 const controls = useAnimation();

 useEffect(() => {
 const updateWidth = () => {
 if (containerRef.current) {
 setContainerWidth(containerRef.current.offsetWidth);
 }
 };
 updateWidth();
 window.addEventListener('resize', updateWidth);
 setTimeout(updateWidth, 100);
 return () => window.removeEventListener('resize', updateWidth);
 }, []);

 const buttonWidth = 56;
 const padding = 10;
 const maxDrag = Math.max(0, containerWidth - buttonWidth - padding);

 const handleDragEnd = async (e: any, info: any) => {
 if (maxDrag === 0) return;
 if (info.offset.x > maxDrag * 0.6) {
 await controls.start({ x: maxDrag });
 onAnswer();
 } else {
 controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 20 } });
 }
 };

 const textOpacity = useTransform(x, [0, maxDrag * 0.4 || 100], [1, 0]);

 return (
 <div
 ref={containerRef}
 className="relative w-full h-[64px] bg-[#1b1c28] border border-white/5 rounded-full flex items-center p-1.5 overflow-hidden shadow-2xl"
 >
 <motion.span
 style={{ opacity: textOpacity }}
 className="absolute w-full text-center text-[#9496a8] text-body font-medium pointer-events-none select-none"
 >
 Slide to answer
 </motion.span>
 <motion.div
 drag="x"
 dragConstraints={{ left: 0, right: maxDrag > 0 ? maxDrag : 250 }}
 dragElastic={0.05}
 dragMomentum={false}
 onDragEnd={handleDragEnd}
 animate={controls}
 style={{ x }}
 className="w-[52px] h-[52px] rounded-full bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)] cursor-grab active:cursor-grabbing z-10"
 >
 <div className="w-[42px] h-[42px] rounded-full border-[4px] border-[#eff2ff] bg-white shadow-inner" />
 </motion.div>
 </div>
 );
};

export function IncomingCallScreen({
 callerName = "Unknown",
 callerAvatar,
 callType,
 onAnswer,
 onReject,
 onSendMessage,
 ringtoneUrl = "/ringtone.mp3",
}: IncomingCallScreenProps) {
 const hapticIntervalRef = useRef<NodeJS.Timeout | null>(null);
 const [ringtoneEnabled, setRingtoneEnabled] = useState(true);

 useNativeRingtone({
 enabled: ringtoneEnabled,
 ringtoneUrl,
 volume: 1.0
 });

 useEffect(() => {
 console.log('🔔 Ringtone active for incoming call');
 if (Capacitor.isNativePlatform()) {
 const hapticPattern = async () => {
 await Haptics.impact({ style: ImpactStyle.Heavy });
 await new Promise(resolve => setTimeout(resolve, 150));
 await Haptics.impact({ style: ImpactStyle.Medium });
 await new Promise(resolve => setTimeout(resolve, 150));
 await Haptics.impact({ style: ImpactStyle.Heavy });
 };
 hapticPattern();
 hapticIntervalRef.current = setInterval(hapticPattern, 2000);
 }
 return () => {
 if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
 };
 }, []);

 useEffect(() => {
 const timer = setTimeout(() => {
 console.log('🕒 [IncomingCall] Safety timeout reached - auto-rejecting');
 handleReject();
 }, 45000);
 return () => clearTimeout(timer);
 }, []);

 const handleAnswerWrapper = async () => {
 setRingtoneEnabled(false);
 if (hapticIntervalRef.current) {
 clearInterval(hapticIntervalRef.current);
 hapticIntervalRef.current = null;
 }
 if (Capacitor.isNativePlatform()) {
 await Haptics.impact({ style: ImpactStyle.Medium });
 }
 await new Promise(resolve => setTimeout(resolve, 150));
 onAnswer();
 };

 const handleReject = async () => {
 setRingtoneEnabled(false);
 if (hapticIntervalRef.current) {
 clearInterval(hapticIntervalRef.current);
 hapticIntervalRef.current = null;
 }
 if (Capacitor.isNativePlatform()) {
 await Haptics.impact({ style: ImpactStyle.Light });
 }
 await new Promise(resolve => setTimeout(resolve, 150));
 onReject();
 };

 const handleMessage = async () => {
 if (Capacitor.isNativePlatform()) {
 await Haptics.impact({ style: ImpactStyle.Light });
 }
 onSendMessage?.();
 };

 return (
 <div
 className="fixed inset-0 z-[100000] bg-[#16141a] flex flex-col overflow-hidden"
 style={{ width: '100vw', height: '100dvh' }}
 >
 {/* Background blobs */}
 <div className="absolute inset-0 z-0 pointer-events-none opacity-80 overflow-hidden">
 <div className="absolute -top-[10%] -left-[20%] w-[140%] h-[60%] bg-[#22232a] rounded-[100%] rotate-[-15deg] blur-[100px]" />
 <div className="absolute -bottom-[10%] -right-[20%] w-[140%] h-[60%] bg-[#1a1725] rounded-[100%] rotate-[15deg] blur-[100px]" />
 </div>

 {/* Content — scrollable if needed, flex-col fills height exactly */}
 <div className="z-10 w-full h-full flex flex-col px-5 pt-8 pb-4 gap-3 overflow-y-auto">

 {/* Caller info */}
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5 }}
 className="flex flex-col items-center gap-1"
 >
 <span className="text-[#9496a8] text-[14px]">Incoming call</span>
 <h1 className="text-white text-[28px] font-bold tracking-tight leading-tight">{callerName}</h1>
 <div className="mt-1 flex items-center gap-1.5 bg-[#171b30] border border-[#2d3b6a] rounded-full px-3 py-1">
 <ShieldCheck className="w-3.5 h-3.5 text-[#4b7bff]" />
 <span className="text-[11px] font-bold text-[#4b7bff] tracking-wide">CHATR Verified</span>
 </div>
 </motion.div>

 {/* Avatar */}
 <motion.div
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ delay: 0.1, duration: 0.6, type: "spring" }}
 className="flex flex-col items-center gap-2"
 >
 <div className="relative">
 <div className="absolute -inset-1 bg-[#7e22ce] rounded-full blur-xl opacity-40 animate-pulse" />
 <div className="relative w-[110px] h-[110px] rounded-full bg-gradient-to-br from-[#c084fc] to-[#7e22ce] border-[4px] border-white flex items-center justify-center shadow-2xl overflow-hidden">
 {callerAvatar ? (
 <img src={callerAvatar} alt={callerName} className="w-full h-full rounded-full object-cover" />
 ) : (
 <div className="w-full h-full rounded-full bg-gradient-to-br from-[#b06cf7] to-[#8b31d8] flex items-center justify-center shadow-inner">
 <Phone className="w-[48px] h-[48px] text-white fill-white -rotate-[15deg]" />
 </div>
 )}
 </div>
 </div>
 <div className="flex flex-col items-center gap-0.5">
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
 <span className="text-white font-semibold text-[15px]">Trusted Contact</span>
 </div>
 <span className="text-[#9496a8] text-[13px]">+91 99999 99999</span>
 </div>
 </motion.div>

 {/* Info cards — horizontal row */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2, duration: 0.5 }}
 className="w-full flex gap-3"
 >
 <div className="flex-1 bg-[#14151f] border border-white/5 rounded-[16px] p-3 flex flex-col gap-1.5">
 <div className="w-[24px] h-[24px] rounded-full bg-[#4b7bff] flex items-center justify-center">
 <ShieldCheck className="w-3.5 h-3.5 text-white" />
 </div>
 <div className="flex flex-col">
 <span className="text-[#9496a8] text-[11px]">ChatrAI Confidence</span>
 <span className="text-[#10b981] font-bold text-[13px]">High</span>
 </div>
 </div>
 <div className="flex-1 bg-[#14151f] border border-white/5 rounded-[16px] p-3 flex flex-col gap-1.5">
 <div className="w-[24px] h-[24px] flex items-center justify-start">
 <Video className="w-4 h-4 text-[#d1d5db] fill-[#d1d5db]" />
 </div>
 <div className="flex flex-col">
 <span className="text-[#9496a8] text-[11px]">Call Intelligence</span>
 <span className="text-[#4b7bff] font-bold text-[13px]">Active</span>
 </div>
 </div>
 <div className="flex-1 bg-[#14151f] border border-white/5 rounded-[16px] p-3 flex flex-col gap-1.5">
 <div className="w-[24px] h-[24px] rounded-full bg-[#4b7bff] flex items-center justify-center">
 <ShieldCheck className="w-3.5 h-3.5 text-white" />
 </div>
 <div className="flex flex-col">
 <span className="text-[#9496a8] text-[11px]">ChatrAI Assistant</span>
 <span className="text-white text-[13px] leading-tight">Insights active</span>
 </div>
 </div>
 </motion.div>

 {/* Quick action buttons */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.3 }}
 className="flex items-center justify-center gap-6 w-full px-2"
 >
 <button className="flex flex-col items-center gap-1.5 group w-[64px]">
 <div className="w-[52px] h-[52px] rounded-[16px] bg-[#14151f] border border-white/5 flex items-center justify-center group-active:scale-95 transition-transform">
 <Bell className="w-[20px] h-[20px] text-white fill-white" />
 </div>
 <span className="text-white text-[11px]">Remind me</span>
 </button>
 <button onClick={handleMessage} className="flex flex-col items-center gap-1.5 group w-[64px]">
 <div className="w-[52px] h-[52px] rounded-[16px] bg-[#14151f] border border-white/5 flex items-center justify-center group-active:scale-95 transition-transform">
 <MessageSquare className="w-[20px] h-[20px] text-white fill-white" />
 </div>
 <span className="text-white text-[11px]">Message</span>
 </button>
 <button className="flex flex-col items-center gap-1.5 group w-[64px]">
 <div className="w-[52px] h-[52px] rounded-[16px] bg-[#14151f] border border-white/5 flex items-center justify-center group-active:scale-95 transition-transform">
 <Video className="w-[20px] h-[20px] text-white fill-white" />
 </div>
 <span className="text-white text-[11px]">Video call</span>
 </button>
 </motion.div>

 {/* Spacer pushes controls to bottom */}
 <div className="flex-1 min-h-0" />

 {/* Slide to answer */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4, duration: 0.5 }}
 className="w-full"
 >
 <SlideToAnswer onAnswer={handleAnswerWrapper} />
 </motion.div>

 {/* Decline row */}
 <div className="w-full flex items-center justify-between px-2">
 <button className="p-2 rounded-full active:bg-white/10 transition-colors">
 <RefreshCcw className="w-[20px] h-[20px] text-white" />
 </button>
 <div className="flex items-center gap-1.5">
 <Lock className="w-3.5 h-3.5 text-[#6b7280]" />
 <span className="text-[#6b7280] text-[12px]">Secured by ChatrAI</span>
 </div>
 <button
 onClick={handleReject}
 className="w-[52px] h-[52px] rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 flex items-center justify-center transition-colors shadow-lg"
 >
 <Phone className="w-5 h-5 text-white rotate-[135deg] fill-white" />
 </button>
 </div>

 </div>
 </div>
 );
}
