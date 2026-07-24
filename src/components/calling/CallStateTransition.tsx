import { motion, AnimatePresence } from "framer-motion";
import { Video, Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallStateTransitionProps {
 callState: "dialing" | "ringing" | "connecting" | "connected" | "busy" | "failed";
 contactName?: string;
 contactAvatar?: string;
 callType: "video" | "voice";
 isVideoOn?: boolean;
 isMuted?: boolean;
 duration?: number;
 partnerId?: string;
 onHoldChange?: (held: boolean) => void;
}

export function CallStateTransition({ callState, contactName = 'Unknown', contactAvatar, callType }: CallStateTransitionProps) {
 const messages = {
 dialing: "Calling...",
 ringing: "Ringing...",
 connecting: "Securing connection...",
 connected: "",
 busy: "Line busy",
 failed: "Call failed"
 };

 const icons = {
 video: Video,
 voice: Phone
 };

 const Icon = callState === "busy" || callState === "failed" ? PhoneOff : icons[callType];

 return (
 <AnimatePresence mode="wait">
 {callState !== "connected" && (
 <motion.div
 key={callState}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.4, ease: "easeInOut" }}
 className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-[#111]"
 >
 {/* Dynamic Background Blur */}
 {contactAvatar && (
 <div 
 className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-screen"
 style={{ 
 backgroundImage: `url(${contactAvatar})`,
 filter: 'blur(40px) saturate(1.5) contrast(1.2)'
 }}
 />
 )}
 <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-black/80" />

 <motion.div
 initial={{ scale: 0.8, y: 20 }}
 animate={{ scale: 1, y: 0 }}
 exit={{ scale: 0.8, y: -20 }}
 transition={{ duration: 0.3, ease: "easeOut" }}
 className="relative z-10 text-center space-y-5 px-8"
 >
 {/* Animated Icon */}
 <motion.div
 className="relative mx-auto"
 animate={{
 scale: callState === "ringing" ? [1, 1.1, 1] : 1,
 rotate: callState === "ringing" ? [0, -10, 10, -10, 0] : 0,
 }}
 transition={{
 duration: 1.5,
 repeat: Infinity,
 ease: "easeInOut"
 }}
 >
 <div className="w-24 h-24 rounded-full border border-white/15 flex items-center justify-center backdrop-blur-sm bg-black/25 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
 <Icon className={cn(
 "w-11 h-11",
 callState === "busy" || callState === "failed" ? "text-red-300" : "text-emerald-300"
 )} />
 </div>
 
 {/* Pulsing rings */}
 <motion.div
 className="absolute inset-0 rounded-full border border-emerald-300/35"
 animate={{
 scale: [1, 1.5, 1.5],
 opacity: [0.6, 0, 0],
 }}
 transition={{
 duration: 2,
 repeat: Infinity,
 ease: "easeOut"
 }}
 />
 <motion.div
 className="absolute inset-0 rounded-full border border-emerald-300/25"
 animate={{
 scale: [1, 1.5, 1.5],
 opacity: [0.6, 0, 0],
 }}
 transition={{
 duration: 2,
 repeat: Infinity,
 ease: "easeOut",
 delay: 0.5
 }}
 />
 </motion.div>

 {/* Text */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.2 }}
 >
 <p className="text-white text-page tracking-normal">{contactName}</p>
 <motion.p
 className={cn(
 "text-body mt-2",
 callState === "busy" || callState === "failed" ? "text-red-200" : "text-white/75"
 )}
 animate={{ opacity: [1, 0.5, 1] }}
 transition={{ duration: 1.5, repeat: Infinity }}
 >
 {messages[callState]}
 </motion.p>
 </motion.div>

 {/* Connection progress indicator */}
 {callState === "connecting" && (
 <motion.div
 className="w-64 h-1 bg-white/15 rounded-full overflow-hidden mx-auto"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 >
 <motion.div
 className="h-full bg-gradient-to-r from-emerald-400 to-teal-300"
 initial={{ width: "0%" }}
 animate={{ width: "100%" }}
 transition={{ duration: 2, ease: "easeInOut" }}
 />
 </motion.div>
 )}
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 );
}
