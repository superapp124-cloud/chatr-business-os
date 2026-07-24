import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Bell, BrainCircuit, Activity, Zap, RefreshCw, CheckCircle2, AlertCircle, Clock, Undo2, Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEOHead } from '@/components/SEOHead';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import chatrIconLogo from '@/assets/chatr-icon-logo.png';

// ─── Outcome Driven Data Types ──────────────────────────────────────────────
interface CompletedOutcome {
 id: string;
 text: string;
 canUndo?: boolean;
}

interface AttentionOutcome {
 id: string;
 text: string;
}

interface ExecutiveBriefing {
 greeting: string;
 completed: CompletedOutcome[];
 attention: AttentionOutcome[];
 estimatedTime: string;
}

// ─── Main Desktop Home 2 ──────────────────────────────────────────────────────────
export default function DesktopHome2() {
 const navigate = useNavigate();
 const haptics = useNativeHaptics();
 const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);
 const [scenarioLoading, setScenarioLoading] = useState(false);
 const [fixing, setFixing] = useState(false);
 const [completedItemsAnimated, setCompletedItemsAnimated] = useState<number>(0);

 // Generate greeting based on time of day
 const getGreeting = () => {
 const hour = new Date().getHours();
 if (hour >= 5 && hour < 12) return 'Good morning';
 if (hour >= 12 && hour < 17) return 'Good afternoon';
 if (hour >= 17 && hour < 21) return 'Good evening';
 return 'Good night';
 };

 const triggerScenario = async () => {
 setScenarioLoading(true);
 haptics.light();
 try {
 if (window.electronAPI?.intelligence?.syncContext) {
 await window.electronAPI.intelligence.syncContext();
 const data = await window.electronAPI.intelligence.getExecutiveFeed();
 if (data) {
 setBriefing({
 greeting: `${getGreeting()}, Arshid.`,
 completed: data.completed || [],
 attention: data.attention || [],
 estimatedTime: data.estimatedTime || '0 minutes'
 });
 }
 } else {
 // No more mocks. We require the real OS Kernel.
 console.warn("Electron API not found");
 setBriefing({
 greeting: `${getGreeting()}, Arshid.`,
 completed: [],
 attention: [
 { id: 'err1', text: 'CHATR OS Kernel disconnected.' },
 { id: 'err2', text: 'Please launch the Desktop App to sync real data.' }
 ],
 estimatedTime: 'N/A'
 });
 }
 } catch (e) {
 console.error("Failed to sync context:", e);
 } finally {
 setScenarioLoading(false);
 setCompletedItemsAnimated(0);
 }
 };

 // Staggered animation effect for "completed" items
 useEffect(() => {
 if (briefing && completedItemsAnimated < briefing.completed.length) {
 const timer = setTimeout(() => {
 setCompletedItemsAnimated(prev => prev + 1);
 }, 150); // 150ms delay between each item appearing
 return () => clearTimeout(timer);
 }
 }, [briefing, completedItemsAnimated]);

 const handleFixEverything = () => {
 haptics.medium();
 setFixing(true);
 
 // Simulate AI rapidly executing the pending items
 setTimeout(() => {
 if (briefing) {
 setBriefing({
 ...briefing,
 completed: [
 ...briefing.completed,
 { id: 'c_fixed_1', text: 'Approved ₹45,000 travel booking', canUndo: true },
 { id: 'c_fixed_2', text: 'Drafted reply to Rajesh', canUndo: true },
 { id: 'c_fixed_3', text: 'Summarized contract for review', canUndo: false },
 { id: 'c_fixed_4', text: 'Adjusted Goa trip itinerary to fit budget', canUndo: true },
 { id: 'c_fixed_5', text: 'Updated nutrition plan to meet weight goal', canUndo: true },
 ],
 attention: [],
 estimatedTime: '0 minutes'
 });
 setCompletedItemsAnimated(briefing.completed.length);
 }
 setFixing(false);
 }, 1500);
 };

 const handleUndo = (id: string) => {
 haptics.light();
 if (!briefing) return;
 // In a real app, this would dispatch an undo intent to the backend
 setBriefing({
 ...briefing,
 completed: briefing.completed.map(item => 
 item.id === id ? { ...item, text: `[Undone] ${item.text}`, canUndo: false } : item
 )
 });
 };

 return (
 <div className="flex h-full w-full bg-[#f8fafc] font-sans">
 <SEOHead title="Executive Briefing | CHATR OS" />

 {/* Sidebar / Navigation Area */}
 <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 relative z-20">
 <div className="p-5 flex items-center gap-3">
 <img src={chatrIconLogo} alt="Chatr" className="h-8 w-8 rounded-xl shadow-sm" />
 <div>
 <h1 className="text-[16px] font-black tracking-tight text-slate-900 leading-none">CHATR OS</h1>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">v2.0 Desktop</p>
 </div>
 </div>

 <nav className="px-3 mt-4 space-y-1">
 <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-r from-[#5c22ff]/10 to-transparent border-l-2 border-[#5c22ff] text-[#5c22ff] font-bold text-[13px]">
 <BrainCircuit className="w-4 h-4" /> Executive Briefing
 </button>
 <button onClick={() => navigate('/chat')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-[13px] transition-colors border-l-2 border-transparent">
 <Bell className="w-4 h-4 text-slate-400" /> Communications
 </button>
 <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-[13px] transition-colors border-l-2 border-transparent">
 <Activity className="w-4 h-4 text-slate-400" /> Platform Services
 </button>
 </nav>
 
 <div className="mt-auto p-5">
 <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center shadow-inner">
 <p className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-wider">Testing Controls</p>
 <button 
 onClick={triggerScenario}
 disabled={scenarioLoading}
 className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-[#5c22ff] text-white rounded-lg py-2.5 text-[12px] font-bold active:scale-95 transition-all shadow-md disabled:opacity-50"
 >
 {scenarioLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
 {scenarioLoading ? 'Syncing...' : 'Sync Sources'}
 </button>
 </div>
 </div>
 </div>

 {/* Main Content Area */}
 <div className="flex-1 bg-slate-50/50 flex justify-center items-start overflow-y-auto relative h-full">
 {/* Premium Background Elements */}
 <div className="absolute top-[-150px] left-[-100px] w-[500px] h-[500px] bg-[#5c22ff] opacity-5 rounded-full blur-[100px] pointer-events-none" />
 <div className="absolute bottom-[-150px] right-[-100px] w-[500px] h-[500px] bg-[#00d2ff] opacity-5 rounded-full blur-[100px] pointer-events-none" />

 <div className="w-full max-w-[850px] mx-auto px-12 py-20 relative z-10">
 
 {!briefing ? (
 <div className="flex flex-col items-center justify-center h-[50vh] text-center animate-fade-in">
 <div className="w-24 h-24 bg-white/80 backdrop-blur-md rounded-[28px] shadow-xl border border-white flex items-center justify-center mb-8 relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-tr from-[#5c22ff]/5 to-transparent" />
 <BrainCircuit className="w-12 h-12 text-[#5c22ff]" />
 </div>
 <h2 className="text-[36px] font-black text-slate-900 tracking-tight">Your OS is idle.</h2>
 <p className="text-[16px] text-slate-500 max-w-md mt-4 leading-relaxed font-medium">
 Click 'Sync Sources' to generate your personalized Outcome-Driven Executive Briefing from your real-world data.
 </p>
 <button
 onClick={triggerScenario}
 disabled={scenarioLoading}
 className="mt-10 flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-10 py-4 text-[16px] font-bold active:scale-95 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.12)] disabled:opacity-50 hover:shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
 >
 {scenarioLoading ? <RefreshCw className="w-5 h-5 animate-spin text-[#00d2ff]" /> : <Zap className="w-5 h-5 text-amber-400" />}
 {scenarioLoading ? 'Syncing Context...' : 'Sync Sources'}
 </button>
 </div>
 ) : (
 <div className="animate-fade-in">
 {/* Header */}
 <div className="mb-16">
 <h1 className="text-[48px] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-800 to-slate-500 drop-shadow-sm">
 {briefing.greeting}
 </h1>
 </div>

 {/* Today I Completed */}
 {briefing.completed.length > 0 && (
 <div className="mb-16">
 <h3 className="text-[12px] font-black tracking-[0.2em] text-slate-400 uppercase mb-8 flex items-center gap-3">
 <CheckCircle2 className="w-4 h-4 text-[#5c22ff]" />
 Today I Completed
 </h3>
 <div className="space-y-4">
 {briefing.completed.map((item, idx) => {
 const isVisible = idx < completedItemsAnimated;
 const isUndone = item.text.startsWith('[Undone]');
 return (
 <div 
 key={item.id} 
 className={cn(
 "group flex items-center gap-5 transition-all duration-700 ease-out p-4 rounded-2xl border bg-white/40 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.02)]",
 isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
 isUndone ? 'border-slate-100 opacity-50 grayscale' : 'border-white/80 hover:border-white hover:bg-white/70 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)]'
 )}
 >
 <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 shadow-inner">
 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
 </div>
 <span className={cn(
 "text-[17px] font-semibold transition-colors duration-300",
 isUndone ? "text-slate-400 line-through" : "text-slate-800"
 )}>
 {item.text}
 </span>
 {item.canUndo && !isUndone && (
 <button 
 onClick={() => handleUndo(item.id)}
 className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[12px] font-black text-slate-400 hover:text-rose-500 hover:bg-rose-50 uppercase tracking-widest px-4 py-2 rounded-xl border border-transparent hover:border-rose-100 active:scale-95"
 >
 Undo
 </button>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Attention Needed */}
 {briefing.attention.length > 0 && (
 <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.04)] border border-white p-12 relative overflow-hidden group">
 <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-400 via-rose-500 to-orange-400" />
 
 <h3 className="text-[13px] font-black tracking-[0.2em] text-rose-500 uppercase mb-10 flex items-center gap-3">
 <AlertCircle className="w-5 h-5" />
 Attention Needed
 </h3>
 
 <ol className="space-y-6 list-decimal list-inside text-[18px] text-slate-700 font-semibold marker:text-slate-300 marker:font-black">
 {briefing.attention.map((item) => (
 <li key={item.id} className="pl-3 hover:text-slate-900 transition-colors cursor-default leading-relaxed">
 {item.text}
 </li>
 ))}
 </ol>

 <div className="mt-12 pt-10 border-t border-slate-200/60 flex items-center justify-between">
 <div className="flex items-center gap-4 text-slate-500">
 <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center">
 <Clock className="w-5 h-5 text-slate-400" />
 </div>
 <div>
 <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-0.5">Estimated Time</p>
 <p className="text-[16px] font-bold text-slate-800">{briefing.estimatedTime} to resolve</p>
 </div>
 </div>
 
 <button 
 onClick={handleFixEverything}
 disabled={fixing}
 className="bg-slate-900 hover:bg-[#5c22ff] text-white rounded-2xl px-8 py-4 text-[15px] font-black tracking-wide shadow-[0_8px_16px_rgba(0,0,0,0.12)] hover:shadow-[0_16px_32px_rgba(92,34,255,0.25)] transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-3 overflow-hidden relative"
 >
 {fixing ? (
 <>
 <RefreshCw className="w-5 h-5 animate-spin relative z-10" />
 <span className="relative z-10">Executing Intents...</span>
 <div className="absolute inset-0 bg-white/20 animate-pulse" />
 </>
 ) : (
 <>
 <Zap className="w-5 h-5 text-amber-400" />
 Fix everything
 </>
 )}
 </button>
 </div>
 </div>
 )}
 
 {/* All Clear State */}
 {briefing.attention.length === 0 && completedItemsAnimated === briefing.completed.length && (
 <div className="mt-16 flex flex-col items-center justify-center text-center p-12 bg-emerald-50/50 backdrop-blur-sm rounded-[32px] border border-emerald-100 animate-in zoom-in-95 duration-500 shadow-sm">
 <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200">
 <CheckCircle2 className="w-8 h-8 text-emerald-600" />
 </div>
 <h3 className="text-[24px] font-black text-emerald-900 tracking-tight">You're all caught up!</h3>
 <p className="text-[16px] font-medium text-emerald-700/80 mt-2">CHATR OS has successfully managed your pending tasks.</p>
 </div>
 )}

 {/* Re-sync button for testing */}
 <div className="mt-16 flex justify-center pb-20">
 <button
 onClick={triggerScenario}
 disabled={scenarioLoading}
 className="flex items-center gap-2 text-[14px] font-bold text-slate-400 hover:text-[#5c22ff] transition-colors hover:bg-white px-4 py-2 rounded-xl"
 >
 <RefreshCw className={`w-4 h-4 ${scenarioLoading ? 'animate-spin' : ''}`} />
 Sync Sources Again
 </button>
 </div>

 </div>
 )}
 </div>
 </div>
 </div>
 );
}
