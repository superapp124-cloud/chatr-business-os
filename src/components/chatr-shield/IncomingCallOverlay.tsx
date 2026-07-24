import React, { useState, useEffect } from 'react';
import { Mic, X, MessageSquare, Maximize2, Search, User, Clock, Shield, CheckCircle, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { runShieldPipeline, submitCommunityReport, ScoreOutput } from '@/lib/chatr-shield/shield-pipeline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface IncomingCallOverlayProps {
 phoneNumber: string;
 onAnswer?: () => void;
 onDecline?: () => void;
 onScreen?: () => void;
 onFullView?: (score: ScoreOutput) => void;
 onAddNote?: () => void;
}

const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
 phoneNumber,
 onScreen,
 onDecline,
 onFullView,
 onAddNote,
}) => {
 const [score, setScore] = useState<ScoreOutput | null>(null);
 const [scanning, setScanning] = useState(true);
 const [scanPhase, setScanPhase] = useState(0);

 const SCAN_PHASES = [
 "Chatr AI scanning caller ID, spam reports, and local history...",
 "Cross-checking global community database...",
 "Analyzing carrier metadata and registration signals...",
 "Finalizing trust score...",
 ];

 useEffect(() => {
 setScanning(true);
 const interval = setInterval(() => {
 setScanPhase(p => (p + 1) % SCAN_PHASES.length);
 }, 400);

 // Hard timeout: 4 seconds max. If Supabase is slow/down (common on Indian LTE/CGNAT)
 // we fail open — show nothing, call controls are never blocked.
 const timeoutId = setTimeout(() => {
 clearInterval(interval);
 setScanning(false); // Let overlay disappear silently — IncomingCallScreen takes over
 }, 4000);

 runShieldPipeline(phoneNumber)
 .then(result => {
 clearTimeout(timeoutId);
 clearInterval(interval);
 setScore(result);
 setScanning(false);
 })
 .catch(() => {
 // Pipeline failed (network error, Supabase down, etc.)
 // Fail open: clear scanning state, overlay shows nothing, call proceeds normally.
 clearTimeout(timeoutId);
 clearInterval(interval);
 setScanning(false);
 });

 return () => {
 clearTimeout(timeoutId);
 clearInterval(interval);
 };
 }, [phoneNumber]);

 const getBadge = () => {
 if (!score) return null;
 const { label } = score;
 if (label === 'SAFE') return { text: 'VERIFIED', bg: 'bg-green-500', icon: <CheckCircle size={12} fill="white" /> };
 if (label === 'UNKNOWN') return { text: 'UNKNOWN', bg: 'bg-zinc-400', icon: null };
 if (label === 'SUSPICIOUS') return { text: 'SUSPICIOUS', bg: 'bg-amber-500', icon: <AlertTriangle size={12} /> };
 return { text: 'SPAM', bg: 'bg-red-500', icon: <XCircle size={12} fill="white" /> };
 };

 const getAISummary = () => {
 if (!score) return "Analyzing...";
 if (score.label === 'SAFE') return `${score.display_name || 'This caller'} is a verified contact. Safe to answer.`;
 if (score.label === 'UNKNOWN') return `Unknown ${score.country} number via ${score.carrier}. No spam reports found.`;
 if (score.label === 'SUSPICIOUS') return `Suspicious signals detected. ${score.risk_flags.slice(0,2).join(', ')}. Use caution.`;
 return `High risk! ${score.risk_flags.includes('community_spam_flagged') ? 'Over 500 community spam reports' : 'Spam pattern detected'}. Likely telemarketer or fraud.`;
 };

 const accentColor = !score ? 'bg-zinc-200' :
 score.label === 'SAFE' ? 'bg-green-500' :
 score.label === 'SUSPICIOUS' ? 'bg-amber-500' :
 (score.label === 'SPAM' || score.label === 'FRAUD') ? 'bg-red-500' :
 'bg-zinc-300';

 const badge = getBadge();

 return (
 <motion.div
 initial={{ y: -120, opacity: 0, scale: 0.95 }}
 animate={{ y: 0, opacity: 1, scale: 1 }}
 exit={{ y: -120, opacity: 0, scale: 0.95 }}
 transition={{ type: 'spring', damping: 18, stiffness: 200 }}
 className="fixed top-0 left-0 right-0 z-[1000] p-4 bg-transparent pointer-events-none"
 style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
 >
 <div className="max-w-sm mx-auto bg-black/80 backdrop-blur-2xl rounded-[32px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-auto border border-white/10"
 >
 {/* Trust Accent Strip - Animated Glow */}
 <div className={cn("h-[4px] w-full transition-all duration-1000", accentColor, "shadow-[0_0_20px_rgba(255,255,255,0.1)]")} />

 <div className="p-6">
 {/* Header Row */}
 <div className="flex items-center gap-4 mb-6">
 {/* Avatar with Glow */}
 <div className="relative">
 <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner">
 <span className="text-white font-black text-page drop-shadow-md">
 {score?.display_name?.charAt(0) || phoneNumber.charAt(0)}
 </span>
 </div>
 {/* Shield Icon overlay - teal brand */}
 <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl flex items-center justify-center border-[3px] border-black shadow-lg" style={{ background: '#8B5CF6' }}>
 <Shield size={12} className="text-white" fill="currentColor" />
 </div>
 </div>

 {/* Name & Number */}
 <div className="flex-1 min-w-0">
 <div className="flex flex-col">
 <h2 className="text-[20px] font-black text-white truncate leading-none tracking-tight mb-1">
 {scanning ? phoneNumber : (score?.display_name || 'Identifying...')}
 </h2>
 <div className="flex items-center gap-2">
 <p className="text-[14px] text-zinc-500 font-bold font-mono">{phoneNumber}</p>
 {badge && !scanning && (
 <span className={cn("px-2 py-0.5 rounded-full text-white text-[9px] font-black tracking-widest flex-shrink-0 uppercase", badge.bg)}>
 {badge.text}
 </span>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Scanning Animation Row - Cinematic */}
 <div className="relative mb-6 rounded-2xl bg-white/5 border border-white/5 p-4 overflow-hidden">
 <div className="flex items-center gap-3 relative z-10">
 <div className="flex gap-1.5 flex-shrink-0">
 <motion.div
 animate={{ rotate: 360 }}
 transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
 >
 <Search size={14} style={{ color: '#8B5CF6' }} />
 </motion.div>
 </div>
 <p className="text-[12px] text-zinc-300 leading-tight font-black tracking-wide uppercase italic">
 {scanning ? SCAN_PHASES[scanPhase] : "Intelligence Acquisition Complete"}
 </p>
 </div>
 {/* Scanning light sweep */}
 {scanning && (
 <motion.div 
 className="absolute inset-0 bg-gradient-to-r from-transparent to-transparent w-full"
 style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.12), transparent)' }}
 animate={{ x: ['-100%', '100%'] }}
 transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
 />
 )}
 </div>

 {/* AI Result Card - High Fidelity */}
 <div className={cn(
 "rounded-2xl p-4 mb-6 border transition-all duration-500",
 scanning ? "bg-white/5 border-white/5 animate-pulse" :
 score?.label === 'SAFE' ? "bg-green-500/10 border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.1)]" :
 score?.label === 'SUSPICIOUS' ? "bg-amber-500/10 border-amber-500/20 shadow-[0_0_40px_rgba(245,158,11,0.1)]" :
 (score?.label === 'SPAM' || score?.label === 'FRAUD') ? "bg-red-500/10 border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.1)]" :
 "bg-white/5 border-white/5"
 )}>
 <div className="flex items-center gap-2 mb-2">
 <Zap size={12} style={{ color: '#8B5CF6' }} fill="currentColor" />
 <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: '#c084fc' }}>Intelligence Report</span>
 </div>
 <p className="text-[14px] leading-relaxed font-bold text-white">
 {getAISummary()}
 </p>
 </div>

 {/* Action Grid - Premium Buttons */}
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={onScreen}
 className="group relative flex flex-col items-center justify-center gap-1 py-4 rounded-2xl overflow-hidden active:scale-95 transition-all shadow-xl"
 style={{ background: '#8B5CF6', boxShadow: '0 8px 24px rgba(139,92,246,0.25)' }}
 >
 <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
 <Mic size={18} className="text-white relative z-10" fill="white" stroke="none" />
 <span className="text-[10px] font-black text-white tracking-widest relative z-10">SCREEN CALL</span>
 </button>
 <button
 onClick={() => {
 submitCommunityReport(phoneNumber, 'SPAM');
 toast.error("Caller Reported to Global Registry");
 onDecline?.();
 }}
 className="flex flex-col items-center justify-center gap-1 py-4 bg-zinc-900 border border-white/5 rounded-2xl active:scale-95 transition-all"
 >
 <X size={18} className="text-red-500" strokeWidth={3} />
 <span className="text-[10px] font-black text-zinc-400 tracking-widest">DECLINE</span>
 </button>
 <button
 onClick={onAddNote}
 className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/5 text-zinc-300 rounded-xl font-black text-[11px] tracking-widest active:scale-95 transition-all"
 >
 <MessageSquare size={14} />
 NOTE
 </button>
 <button
 onClick={() => score && onFullView?.(score)}
 className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/5 text-zinc-300 rounded-xl font-black text-[11px] tracking-widest active:scale-95 transition-all"
 >
 <Maximize2 size={14} />
 FULL ANALYTICS
 </button>
 </div>
 </div>
 </div>
 </motion.div>
 );
};

export default IncomingCallOverlay;
