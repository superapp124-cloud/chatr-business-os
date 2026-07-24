import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation2, Wifi, ShieldAlert, Sparkles, CheckCircle2, ChevronRight, Activity } from 'lucide-react';

export default function LocationConsent() {
 const navigate = useNavigate();
 const [step, setStep] = useState(1);
 const [isScanning, setIsScanning] = useState(true);

 useEffect(() => {
 if (step === 2) {
 localStorage.setItem('chatr_location_consent', 'true');
 setIsScanning(true);
 const timer = setTimeout(() => setIsScanning(false), 2500);
 return () => clearTimeout(timer);
 }
 }, [step]);

 return (
 <div className="min-h-full bg-[#0a0a0c] text-white font-sans overflow-hidden flex items-center justify-center p-6 relative">
 {/* Dynamic Animated Background */}
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-600/10 blur-[150px] rounded-full mix-blend-screen animate-pulse pointer-events-none" />
 
 <AnimatePresence mode="wait">
 {step === 1 ? (
 <motion.div
 key="step1"
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
 transition={{ duration: 0.5, ease: 'easeOut' }}
 className="max-w-2xl w-full relative z-10"
 >
 <div className="bg-[#111116]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 md:p-14 shadow-2xl overflow-hidden relative">
 {/* Corner accent */}
 <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 blur-[60px] rounded-full" />
 
 <div className="relative z-10 space-y-10">
 <div className="text-center space-y-6">
 <motion.div 
 initial={{ y: -20, opacity: 0 }}
 animate={{ y: 0, opacity: 1 }}
 transition={{ delay: 0.2 }}
 className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/5 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]"
 >
 <MapPin className="w-10 h-10 text-emerald-400" />
 </motion.div>
 
 <div className="space-y-4">
 <h1 className="text-display md:text-display font-black tracking-tighter">
 Semantic <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">Location</span>
 </h1>
 <p className="text-section text-slate-400 max-w-md mx-auto font-medium">
 CHATR fuses GPS, Wi-Fi, and motion to understand your context so you never have to type <span className="text-emerald-300 italic">"from home to the office"</span> again.
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <FeatureBox icon={<Navigation2 />} title="Ultra-Precise" delay={0.4} />
 <FeatureBox icon={<Wifi />} title="Indoor Sync" delay={0.5} />
 <FeatureBox icon={<ShieldAlert />} title="E2E Encrypted" delay={0.6} />
 </div>

 <div className="space-y-4 pt-6">
 <motion.button 
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 onClick={() => setStep(2)}
 className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-section py-4 rounded-2xl shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center gap-3"
 >
 <Sparkles className="w-5 h-5" />
 Enable Always-On Context
 </motion.button>
 <motion.button 
 whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' }}
 whileTap={{ scale: 0.98 }}
 onClick={() => setStep(2)}
 className="w-full bg-white/5 border border-white/10 text-slate-300 font-semibold text-section py-4 rounded-2xl transition-all"
 >
 Only While Using CHATR
 </motion.button>
 </div>
 </div>
 </div>
 </motion.div>
 ) : (
 <motion.div
 key="step2"
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.5, ease: 'easeOut' }}
 className="max-w-md w-full relative z-10"
 >
 <div className="bg-[#111116]/80 backdrop-blur-2xl border border-emerald-500/30 rounded-[2.5rem] p-12 shadow-[0_0_80px_-20px_rgba(16,185,129,0.2)] text-center relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent" />
 
 <div className="relative z-10 flex flex-col items-center">
 <AnimatePresence mode="wait">
 {isScanning ? (
 <motion.div
 key="scanning"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0, scale: 0.5 }}
 className="w-24 h-24 rounded-full border border-emerald-500/50 border-t-emerald-400 border-r-emerald-400 animate-spin flex items-center justify-center mb-8 relative"
 >
 <div className="absolute inset-2 rounded-full border border-emerald-500/20 border-b-emerald-400 animate-spin-slow" />
 <Activity className="w-8 h-8 text-emerald-400 animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
 </motion.div>
 ) : (
 <motion.div
 key="done"
 initial={{ opacity: 0, scale: 0.5 }}
 animate={{ opacity: 1, scale: 1 }}
 className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(52,211,153,0.3)]"
 >
 <CheckCircle2 className="w-12 h-12 text-emerald-400" />
 </motion.div>
 )}
 </AnimatePresence>

 <h2 className="text-display mb-4">
 {isScanning ? 'Fusing Context...' : 'You\'re all set.'}
 </h2>
 <p className="text-slate-400 font-medium mb-8">
 {isScanning ? 'Mapping Wi-Fi nodes and GPS satellites to create your semantic graph.' : 'Semantic Location Intelligence is active. Return to the Intent OS to start executing.'}
 </p>

 <AnimatePresence>
 {!isScanning && (
 <motion.button 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 whileHover={{ scale: 1.05 }}
 whileTap={{ scale: 0.95 }}
 onClick={() => navigate('/hero')}
 className="bg-white text-black font-bold text-section px-8 py-4 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all flex items-center gap-2"
 >
 Return to Command Line <ChevronRight className="w-5 h-5" />
 </motion.button>
 )}
 </AnimatePresence>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}

function FeatureBox({ icon, title, delay }: any) {
 return (
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay }}
 className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-colors"
 >
 <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
 {icon}
 </div>
 <span className="text-secondary font-bold tracking-wide text-slate-300">{title}</span>
 </motion.div>
 );
}
