import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Bell, ChevronRight, Search, Sparkles,
 MessageCircle, Shield, Wallet, Calendar,
 Phone, Users, Folder, QrCode
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { SEOHead } from '@/components/SEOHead';
import chatrIconLogo from '@/assets/chatr-icon-logo.png';
import { useInstantCache } from '@/hooks/useInstantCache';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { IntelligentHomeFeed } from '@/components/home/IntelligentHomeFeed';

const getGreeting = () => {
 const hour = new Date().getHours();
 if (hour >= 5 && hour < 12) return 'Good morning';
 if (hour >= 12 && hour < 17) return 'Good afternoon';
 if (hour >= 17 && hour < 21) return 'Good evening';
 return 'Good night';
};

// Contextual quick actions — tight, purposeful, 4 only
const quickActions = [
 { icon: MessageCircle, label: 'New Chat', route: '/chat', color: 'text-emerald-600', bg: 'bg-emerald-500/10', id: 'qa-chat' },
 { icon: Phone, label: 'Call', route: '/calls', color: 'text-blue-600', bg: 'bg-blue-500/10', id: 'qa-call' },
 { icon: Users, label: 'Group', route: '/chat', color: 'text-violet-600', bg: 'bg-violet-500/10', id: 'qa-group' },
 { icon: Wallet, label: 'Pay', route: '/chatr-wallet',color: 'text-amber-600', bg: 'bg-amber-500/10', id: 'qa-pay' },
] as const;

const Home = memo(() => {
 const navigate = useNavigate();
 const haptics = useNativeHaptics();
 const greeting = useMemo(getGreeting, []);
 const [searchQuery, setSearchQuery] = useState('');
 const [isSearchFocused, setIsSearchFocused] = useState(false);
 const [activeFolder, setActiveFolder] = useState<string | null>(null);

 const { data: chatFolders } = useQuery({
 queryKey: ['chat-folders'],
 queryFn: async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return [];
 const { data } = await supabase
 .from('chat_folders')
 .select('*')
 .eq('user_id', user.id)
 .order('sort_order', { ascending: true });
 return data || [];
 }
 });

 const handleNavigate = useCallback((route: string) => {
 haptics.light();
 navigate(route);
 }, [haptics, navigate]);

 const handleSearchSubmit = useCallback((query: string, parsedRoute?: string) => {
 haptics.light();
 if (parsedRoute) {
 navigate(parsedRoute);
 } else {
 navigate(`/universal-search?q=${encodeURIComponent(query)}`);
 }
 }, [haptics, navigate]);

 const { data: profile } = useInstantCache('user-profile', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return null;
 const { data } = await supabase
 .from('profiles')
 .select('avatar_url, username, full_name')
 .eq('id', user.id)
 .maybeSingle();
 return data;
 }, { ttl: 10 * 60 * 1000 });

 const { data: metrics } = useInstantCache('home-metrics', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return { balance: 0, appointments: 0, unread: 0, spamBlocked: 0 };

 const [points, appointments, notifications, spam] = await Promise.all([
 supabase.from('chatr_coin_balances').select('total_coins').eq('user_id', user.id).maybeSingle(),
 supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('patient_id', user.id).gte('appointment_date', new Date().toISOString()),
 supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
 supabase.from('caller_reports').select('*', { count: 'exact', head: true }).eq('reporter_id', user.id).eq('report_type', 'spam'),
 ]);

 return {
 balance: points.data?.total_coins || 0,
 appointments: appointments.count || 0,
 unread: notifications.count || 0,
 spamBlocked: spam.count || 0,
 };
 }, { pollingInterval: 60000 });

 const { data: recentConversations } = useInstantCache('recent-conversations', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return [];
 const { data: optimizedData } = await supabase.rpc('get_user_conversations_optimized', { p_user_id: user.id });
 return optimizedData?.slice(0, 3) || [];
 }, { pollingInterval: 30000 });

 const userName = useMemo(() => {
 if (!profile) return 'there';
 return profile.full_name?.split(' ')[0] || profile.username || 'there';
 }, [profile]);

 return (
 <div className="flex flex-col min-h-screen overflow-y-auto pb-32 font-sans bg-ambient">
 <SEOHead title="Home | Chatr+" description="Your intelligent communication operating system" />

 <div className="mx-auto max-w-[540px] w-full space-y-5 px-4 pt-5">

 {/* ── Header ──────────────────────────────────────────────── */}
 <header className="space-y-4">
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-3 min-w-0">
 <img src={chatrIconLogo} alt="Chatr" className="h-9 w-9 rounded-[14px] shrink-0" />
 <div className="min-w-0">
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">
 Intelligent OS
 </p>
 <h1 className="text-[20px] font-black text-slate-950 leading-tight tracking-tight truncate">
 {greeting}, {userName}
 </h1>
 </div>
 </div>

 <div className="flex shrink-0 items-center gap-2.5">
 <button
 id="home-notifications"
 type="button"
 onClick={() => handleNavigate('/notifications')}
 className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_4px_16px_rgba(15,23,42,0.10)] active:scale-90 transition-transform"
 >
 <Bell className="h-5 w-5 text-slate-700" />
 {(metrics?.unread ?? 0) > 0 && (
 <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white">
 {(metrics?.unread ?? 0) > 9 ? '9+' : metrics?.unread}
 </span>
 )}
 </button>

 <button
 id="home-profile"
 type="button"
 onClick={() => handleNavigate('/profile')}
 className="relative h-11 w-11 overflow-hidden rounded-full shadow-[0_4px_16px_rgba(92,34,255,0.18)] active:scale-90 transition-transform"
 >
 <Avatar className="h-full w-full">
 <AvatarImage src={profile?.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-gradient-to-br from-[#ede7ff] to-[#b68cff] text-[#5c22ff] font-black">
 {userName[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 </button>
 </div>
 </div>

 {/* ── AI Search ─────────────────────────────────────────── */}
 <div className="relative z-30">
 <div className="relative">
 <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
 <input
 id="home-search"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 onFocus={() => setIsSearchFocused(true)}
 onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && searchQuery.trim()) handleSearchSubmit(searchQuery);
 }}
 placeholder="Ask CHATR+ anything..."
 className="h-[56px] w-full rounded-[22px] border border-slate-200/70 bg-white pl-12 pr-12 text-[15px] font-medium text-slate-900 shadow-[0_4px_20px_rgba(15,23,42,0.07)] outline-none transition focus:border-[#5c22ff]/40 focus:ring-4 focus:ring-[#5c22ff]/08"
 />
 {searchQuery && (
 <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-[#5c22ff]/10 px-2.5 py-1 rounded-full">
 <Sparkles className="h-3 w-3 text-[#5c22ff] animate-pulse" />
 <span className="text-[10px] font-black text-[#5c22ff] uppercase tracking-wide">AI</span>
 </div>
 )}
 </div>

 {/* Search suggestions dropdown */}
 {isSearchFocused && (
 <div className="absolute left-0 right-0 z-40 mt-2 rounded-[22px] border border-slate-100 bg-white/96 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.15)] backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200">
 <div className="flex items-center gap-2 mb-3">
 <Sparkles className="h-3.5 w-3.5 text-[#5c22ff]" />
 <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">AI Intent Parser</span>
 </div>
 {searchQuery.trim() === '' ? (
 <div className="space-y-1.5">
 {[
 { text: 'Find tech jobs near me', icon: '💼', route: '/jobs' },
 { text: 'Book a doctor appointment', icon: '🩺', route: '/care' },
 { text: 'Check spam call history', icon: '🛡️', route: '/chatr-shield' },
 { text: 'Send money to a contact', icon: '💸', route: '/chatr-wallet?action=send' },
 ].map((s, i) => (
 <button
 key={i}
 type="button"
 onMouseDown={() => handleNavigate(s.route)}
 className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[14px] hover:bg-slate-50 transition text-left active:scale-[0.98]"
 >
 <span className="text-body">{s.icon}</span>
 <span className="text-[13px] font-semibold text-slate-800">{s.text}</span>
 </button>
 ))}
 </div>
 ) : (
 <button
 type="button"
 onMouseDown={() => handleSearchSubmit(searchQuery)}
 className="flex items-center gap-3 w-full px-4 py-3 rounded-[18px] bg-[#5c22ff]/5 border border-[#5c22ff]/15 text-left active:scale-[0.98] transition"
 >
 <Sparkles className="h-5 w-5 text-[#5c22ff] shrink-0" />
 <div>
 <p className="text-[14px] font-bold text-slate-900">Search: "{searchQuery}"</p>
 <p className="text-[11px] text-slate-500 mt-0.5">Universal search across CHATR+</p>
 </div>
 <ChevronRight className="h-4 w-4 text-[#5c22ff] ml-auto shrink-0" />
 </button>
 )}
 </div>
 )}
 </div>
 </header>

 {/* ── Chat Folders (Tabs) ────────────────────────────────── */}
 <section className="overflow-x-auto no-scrollbar pb-1">
 <div className="flex gap-2 px-1">
 <button
 onClick={() => setActiveFolder(null)}
 className={cn(
 "px-4 py-1.5 rounded-full text-[13px] font-bold transition-transform active:scale-95 whitespace-nowrap flex items-center gap-1.5",
 activeFolder === null
 ? "bg-slate-900 text-white shadow-md border border-slate-900" 
 : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
 )}
 >
 All Chats
 </button>
 <button
 onClick={() => handleNavigate('/desktop-connect')}
 className="px-4 py-1.5 rounded-full text-[13px] font-bold transition-transform active:scale-95 whitespace-nowrap flex items-center gap-1.5 bg-[#5c22ff]/5 border border-[#5c22ff]/20 text-[#5c22ff] hover:bg-[#5c22ff]/10"
 >
 <QrCode className="h-4 w-4" />
 Desktop Connect
 </button>
 <button
 onClick={() => handleNavigate('/desktop/calls')}
 className="px-4 py-1.5 rounded-full text-[13px] font-bold transition-transform active:scale-95 whitespace-nowrap flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-600 hover:bg-red-500/20"
 >
 Test AI Call UI
 </button>
 {chatFolders?.map((folder: any) => (
 <button
 key={folder.id}
 onClick={() => setActiveFolder(folder.id)}
 className={cn(
 "px-4 py-1.5 rounded-full text-[13px] font-bold transition-transform active:scale-95 whitespace-nowrap flex items-center gap-1.5",
 activeFolder === folder.id
 ? "bg-[#5c22ff] text-white shadow-[0_4px_12px_rgba(92,34,255,0.3)] border border-[#5c22ff]" 
 : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
 )}
 >
 <Folder className="h-3 w-3 opacity-70" />
 {folder.name}
 </button>
 ))}
 </div>
 </section>

 {/* ── Quick Actions (4 core actions only) ────────────────── */}
 <section className="grid grid-cols-4 gap-2.5">
 {quickActions.map((item) => (
 <button
 key={item.id}
 id={item.id}
 onClick={() => handleNavigate(item.route)}
 className="flex flex-col items-center justify-center gap-2 py-4 rounded-[22px] bg-white border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.05)] active:scale-90 transition-transform"
 >
 <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', item.bg)}>
 <item.icon className={cn('h-5 w-5', item.color)} />
 </span>
 <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">{item.label}</span>
 </button>
 ))}
 </section>

 {/* ── Intelligent Living Feed ────────────────────────────── */}
 <section>
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Sparkles className="h-4 w-4 text-[#5c22ff]" />
 <h2 className="text-[14px] font-black text-slate-900 uppercase tracking-wide">
 Intelligence Feed
 </h2>
 </div>
 <div className="flex items-center gap-1">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Live</span>
 </div>
 </div>

 <IntelligentHomeFeed
 onNavigate={handleNavigate}
 spamBlocked={metrics?.spamBlocked || 0}
 appointmentCount={metrics?.appointments || 0}
 walletBalance={metrics?.balance || 0}
 unreadCount={metrics?.unread || 0}
 />
 </section>

 {/* ── Recent Conversations ───────────────────────────────── */}
 {recentConversations && recentConversations.length > 0 && (
 <section className="rounded-[28px] bg-white border border-slate-100 shadow-[0_2px_12px_rgba(15,23,42,0.05)] overflow-hidden">
 <div className="flex items-center justify-between px-5 pt-4 pb-3">
 <div className="flex items-center gap-2">
 <MessageCircle className="h-4 w-4 text-emerald-600" />
 <h2 className="text-[14px] font-black text-slate-900">Recent Chats</h2>
 </div>
 <button
 id="home-view-all-chats"
 onClick={() => handleNavigate('/chat')}
 className="flex items-center gap-0.5 text-[12px] font-bold text-[#5c22ff] active:opacity-70"
 >
 View all <ChevronRight className="h-3.5 w-3.5" />
 </button>
 </div>

 <div className="divide-y divide-slate-50 px-4">
 {recentConversations.map((conv: any) => (
 <button
 key={conv.id}
 id={`chat-${conv.id}`}
 onClick={() => handleNavigate(`/chat/${conv.id}`)}
 className="flex w-full items-center gap-3 py-3 text-left active:opacity-70 transition-opacity"
 >
 <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 overflow-hidden">
 {conv.otheruser?.avatar_url ? (
 <img src={conv.otheruser.avatar_url} alt="" className="h-full w-full object-cover" />
 ) : (
 <span className="text-[15px] font-bold text-slate-600">
 {conv.otheruser?.username?.[0]?.toUpperCase() || 'U'}
 </span>
 )}
 <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
 </div>
 <div className="min-w-0 flex-1">
 <p className="truncate text-[14px] font-bold text-slate-900">
 {conv.is_group ? conv.group_name : conv.otheruser?.username}
 </p>
 <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500">
 {conv.lastmessage || 'Tap to chat'}
 </p>
 </div>
 <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
 </button>
 ))}
 </div>

 <div className="px-4 pb-4 pt-2">
 <button
 id="home-open-chats"
 onClick={() => handleNavigate('/chat')}
 className="w-full py-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-[12px] font-black text-slate-600 uppercase tracking-wide active:scale-[0.98] transition-transform"
 >
 Open All Chats
 </button>
 </div>
 </section>
 )}

 {/* Bottom spacer */}
 <div className="h-4" />
 </div>
 </div>
 );
});

Home.displayName = 'Home';
export default Home;
