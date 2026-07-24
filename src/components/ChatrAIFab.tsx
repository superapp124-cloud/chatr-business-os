import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Sparkles, BrainCircuit, MessageSquare, X, Globe, CloudOff, Radio, ShieldAlert, HeartPulse, Mic, ShieldCheck, Users, Calendar, Search, Briefcase, LayoutDashboard, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCHATROS } from '@/core/os/hooks';

// Context-aware AI menu configurations — different per page
const PAGE_AI_MENUS: Record<string, { label: string; description: string; icon: React.ReactNode; route: string; color: string }[]> = {
 '/desktop/chat': [
 { label: 'Conversation AI', description: 'Detect intents, create commitments', icon: <MessageSquare className="w-5 h-5 text-white" />, route: '/chatr-ai', color: 'bg-violet-600' },
 { label: 'Intelligence Panel', description: 'See extracted people, dates, intents', icon: <BrainCircuit className="w-5 h-5 text-white" />, route: '/desktop/chat', color: 'bg-indigo-600' },
 { label: 'AI Browser', description: 'Search and verify with context', icon: <Globe className="w-5 h-5 text-white" />, route: '/ai-browser-home', color: 'bg-blue-600' },
 ],
 '/desktop/calls': [
 { label: 'Meeting Copilot', description: 'Live notes, decisions, action items', icon: <Mic className="w-5 h-5 text-white" />, route: '/desktop/calls', color: 'bg-blue-600' },
 { label: 'Pre-Call Brief', description: 'AI summary before your next call', icon: <BrainCircuit className="w-5 h-5 text-white" />, route: '/desktop/calls', color: 'bg-indigo-600' },
 { label: 'Schedule Meeting', description: 'Book time with participants', icon: <Calendar className="w-5 h-5 text-white" />, route: '/desktop/workspace', color: 'bg-teal-600' },
 ],
 '/desktop/contacts': [
 { label: 'Relationship AI', description: 'Full history with this person', icon: <Users className="w-5 h-5 text-white" />, route: '/desktop/contacts', color: 'bg-emerald-600' },
 { label: 'Find Contact', description: 'Search across all people', icon: <Search className="w-5 h-5 text-white" />, route: '/desktop/contacts', color: 'bg-cyan-600' },
 { label: 'Action Agents', description: 'Run reusable work agents', icon: <BrainCircuit className="w-5 h-5 text-white" />, route: '/ai-agents', color: 'bg-pink-600' },
 ],
 '/desktop/canvas': [
 { label: 'Knowledge AI', description: 'Connect people, docs, meetings', icon: <BrainCircuit className="w-5 h-5 text-white" />, route: '/desktop/canvas', color: 'bg-purple-600' },
 { label: 'Search Knowledge', description: 'Find anything across your work', icon: <Search className="w-5 h-5 text-white" />, route: '/desktop/canvas', color: 'bg-violet-600' },
 { label: 'AI Browser', description: 'Research with AI', icon: <Globe className="w-5 h-5 text-white" />, route: '/ai-browser-home', color: 'bg-blue-600' },
 ],
 '/desktop/smart-inbox': [
 { label: 'Command Center', description: 'Search across all channels', icon: <Search className="w-5 h-5 text-white" />, route: '/desktop/smart-inbox', color: 'bg-cyan-600' },
 { label: 'AI Triage', description: 'What needs your attention now', icon: <Sparkles className="w-5 h-5 text-white" />, route: '/desktop/smart-inbox', color: 'bg-indigo-600' },
 { label: 'Summarize Inbox', description: 'AI summary of unread messages', icon: <BrainCircuit className="w-5 h-5 text-white" />, route: '/chatr-ai', color: 'bg-violet-600' },
 ],
 '/desktop/workspace': [
 { label: 'Workspace AI', description: 'Set up and manage workspaces', icon: <LayoutDashboard className="w-5 h-5 text-white" />, route: '/desktop/workspace', color: 'bg-orange-600' },
 { label: 'Create Workspace', description: 'Sales, HR, Healthcare, and more', icon: <Briefcase className="w-5 h-5 text-white" />, route: '/desktop/workspace', color: 'bg-amber-600' },
 { label: 'Action Agents', description: 'Automate workspace tasks', icon: <BrainCircuit className="w-5 h-5 text-white" />, route: '/ai-agents', color: 'bg-pink-600' },
 ],
 '/desktop/recruitment': [
 { label: 'Recruitment AI', description: 'Track candidates, schedule interviews', icon: <Users className="w-5 h-5 text-white" />, route: '/desktop/recruitment', color: 'bg-pink-600' },
 { label: 'Screen Candidate', description: 'AI-powered resume analysis', icon: <BrainCircuit className="w-5 h-5 text-white" />, route: '/desktop/recruitment', color: 'bg-rose-600' },
 { label: 'Schedule Interview', description: 'Book interview slots automatically', icon: <Calendar className="w-5 h-5 text-white" />, route: '/desktop/recruitment', color: 'bg-indigo-600' },
 ],
};

const DEFAULT_AI_MENU = [
 { label: 'ChatrAI', description: 'Ask, summarize, plan, detect risk', icon: <MessageSquare className="w-5 h-5 text-white" />, route: '/chatr-ai', color: 'bg-blue-500' },
 { label: 'AI Browser', description: 'Search and verify with context', icon: <Globe className="w-5 h-5 text-white" />, route: '/ai-browser-home', color: 'bg-purple-500' },
 { label: 'Action Agents', description: 'Run reusable work agents', icon: <BrainCircuit className="w-5 h-5 text-white" />, route: '/ai-agents', color: 'bg-pink-500' },
];

export const ChatrAIFab = () => {
 const [isOpen, setIsOpen] = useState(false);
 const [orbIndex, setOrbIndex] = useState(0);
 const navigate = useNavigate();
 const location = useLocation();

 // Context-aware via GlobalIntentProvider (has built-in graceful fallback)
 const { pageContext } = useCHATROS();
 const contextLabel = pageContext?.aiLabel || 'CHATR AI';
 const contextEmoji = pageContext?.aiEmoji || '⚡';

 const orbStates = [
 { label: 'Calm', coreClass: 'from-indigo-600 via-purple-600 to-pink-500', ringClass: 'border-violet-500/35', dotClass: 'bg-sky-300', speed: 2.4 },
 { label: 'Listening', coreClass: 'from-sky-500 via-indigo-600 to-violet-600', ringClass: 'border-sky-500/35', dotClass: 'bg-sky-300', speed: 1.45 },
 { label: 'Active', coreClass: 'from-emerald-500 via-teal-500 to-indigo-600', ringClass: 'border-emerald-500/40', dotClass: 'bg-emerald-300', speed: 2.8 },
 ];
 const activeOrb = orbStates[orbIndex % orbStates.length];

 useEffect(() => {
 const interval = window.setInterval(() => setOrbIndex(c => c + 1), 4200);
 return () => window.clearInterval(interval);
 }, []);

 // Hide on full-screen routes
 const hiddenRoutes = ['/chat/', '/chat-ai', '/chatr-ai', '/calls', '/call-history', '/camera', '/capture', '/standalone-dialer', '/standalone-messenger', '/status/create', '/stories/create', '/auth', '/launcher', '/onboarding', '/ai-browser-home', '/ai-search', '/ai-browser', '/hero'];
 if (hiddenRoutes.some(route => location.pathname.startsWith(route))) return null;

 const isDesktop = location.pathname.startsWith('/desktop');

 // Get context-aware menu
 const getMenu = () => {
 const pathKey = Object.keys(PAGE_AI_MENUS).find(k => location.pathname.startsWith(k));
 return pathKey ? PAGE_AI_MENUS[pathKey] : DEFAULT_AI_MENU;
 };

 const aiOptions = getMenu();

 return (
 <div className={cn('fixed z-[9999] flex flex-col items-end', isDesktop ? 'bottom-6 right-6' : 'bottom-24 right-4')}>
 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0, y: 20, scale: 0.8 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 20, scale: 0.8 }}
 transition={{ duration: 0.2 }}
 className="mb-4 flex flex-col gap-3"
 >
 {/* Context label badge */}
 <motion.div
 initial={{ opacity: 0, x: 16 }}
 animate={{ opacity: 1, x: 0 }}
 className="mr-1 rounded-lg border border-emerald-500/25 bg-white/95 px-3 py-2 text-right text-label text-zinc-700 shadow-lg dark:bg-zinc-900/95 dark:text-zinc-100"
 >
 <div className="flex items-center justify-end gap-1.5">
 <span className="text-secondary">{contextEmoji}</span>
 <span className="font-bold">{contextLabel}</span>
 </div>
 <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
 <Radio className="h-3 w-3 text-violet-500" />
 Context-aware · {activeOrb.label} mode
 </div>
 </motion.div>

 {aiOptions.map((option, idx) => (
 <motion.div
 key={option.label}
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: idx * 0.05 }}
 className="flex items-center gap-3 justify-end group cursor-pointer"
 onClick={() => { setIsOpen(false); navigate(option.route); }}
 >
 <div className="max-w-[220px] rounded-lg bg-white px-3 py-2 text-right shadow-lg dark:bg-zinc-800">
 <div className="text-secondary font-semibold text-zinc-800 dark:text-white">{option.label}</div>
 <div className="mt-0.5 text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">{option.description}</div>
 </div>
 <div className={cn('w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform', option.color)}>
 {option.icon}
 </div>
 </motion.div>
 ))}
 </motion.div>
 )}
 </AnimatePresence>

 <div className="relative h-16 w-16">
 {!isOpen && (
 <>
 <motion.span
 className={cn('absolute -inset-2 rounded-full border', activeOrb.ringClass)}
 animate={{ scale: [0.92, 1.22, 0.92], opacity: [0.25, 0.75, 0.25] }}
 transition={{ duration: activeOrb.speed, repeat: Infinity, ease: 'easeInOut' }}
 />
 <motion.span
 className={cn('absolute -inset-4 rounded-full border opacity-50', activeOrb.ringClass)}
 animate={{ scale: [0.9, 1.16, 0.9], opacity: [0.16, 0.55, 0.16] }}
 transition={{ duration: activeOrb.speed + 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }}
 />
 </>
 )}

 <Button
 onClick={() => setIsOpen(!isOpen)}
 size="icon"
 aria-label={`Open ${contextLabel}`}
 title={contextLabel}
 className={cn(
 'relative h-16 w-16 overflow-visible rounded-full border-2 border-white/25 bg-gradient-to-tr shadow-2xl shadow-purple-500/30 transition-all duration-300 hover:scale-105 hover:shadow-purple-500/50',
 activeOrb.coreClass
 )}
 >
 <AnimatePresence mode="wait">
 {isOpen ? (
 <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
 <X className="w-8 h-8 text-white" />
 </motion.div>
 ) : (
 <motion.div
 key="open"
 initial={{ rotate: 90, opacity: 0 }}
 animate={{ rotate: 0, opacity: 1, scale: [1, 1.08, 1] }}
 exit={{ rotate: -90, opacity: 0 }}
 transition={{ scale: { duration: activeOrb.speed, repeat: Infinity, ease: 'easeInOut' } }}
 className="flex items-center justify-center"
 >
 <img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-10 h-10 rounded-full object-cover shadow-md border border-white/30" />
 <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-yellow-300" />
 </motion.div>
 )}
 </AnimatePresence>
 <span className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
 <CloudOff className="h-3 w-3 text-white" />
 </span>
 <motion.span
 className={cn('absolute -right-0.5 bottom-2 h-2.5 w-2.5 rounded-full', activeOrb.dotClass)}
 animate={{ opacity: [0.35, 1, 0.35] }}
 transition={{ duration: activeOrb.speed / 2, repeat: Infinity }}
 />
 </Button>
 </div>
 </div>
 );
};
