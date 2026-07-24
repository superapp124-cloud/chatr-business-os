import React, { useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Shield, LayoutGrid, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { prefetchRoute } from '@/routes/lazyPages';
import { useInstantCache } from '@/hooks/useInstantCache';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Ecosystem Architecture: Home | Chats | Shield | Services | Me
const navItems = [
 { name: 'Home', path: '/home', icon: Home, id: 'nav-home' },
 { name: 'Chats', path: '/chat', icon: MessageCircle, id: 'nav-chats' },
 { name: 'Shield', path: '/chatr-shield', icon: Shield, id: 'nav-shield', isShield: true },
 { name: 'Services', path: '/more', icon: LayoutGrid, id: 'nav-services' },
 { name: 'Me', path: '/profile', icon: User, id: 'nav-me', isMe: true },
];

export const BottomNav = () => {
 const location = useLocation();
 const haptics = useNativeHaptics();
 const [isKeyboardVisible, setKeyboardVisible] = React.useState(false);
 const [spamBlocked, setSpamBlocked] = React.useState(0);
 const searchParams = new URLSearchParams(location.search);

 React.useEffect(() => {
 if (!Capacitor.isNativePlatform()) return;
 let cancelled = false;
 const listeners: PluginListenerHandle[] = [];

 const registerKeyboardListeners = async () => {
 const showListener = await Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
 const hideListener = await Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));

 if (cancelled) {
 showListener.remove();
 hideListener.remove();
 return;
 }

 listeners.push(showListener, hideListener);
 };

 void registerKeyboardListeners();

 return () => {
 cancelled = true;
 listeners.forEach((listener) => listener.remove());
 };
 }, []);

 // Fetch live spam count for Shield badge
 React.useEffect(() => {
 const fetchSpamCount = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { count } = await supabase
 .from('caller_reports')
 .select('*', { count: 'exact', head: true })
 .eq('reporter_id', user.id)
 .eq('report_type', 'spam');
 setSpamBlocked(count || 0);
 } catch { /* silent */ }
 };
 fetchSpamCount();
 }, []);

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

 const hasLegacyConversationQuery =
 location.pathname === '/chat' && searchParams.has('conversation');

 const shouldHide =
 location.pathname === '/calls' ||
 location.pathname === '/auth' ||
 location.pathname === '/onboarding' ||
 location.pathname === '/admin' ||
 location.pathname.startsWith('/chat/') ||
 hasLegacyConversationQuery ||
 location.pathname.startsWith('/standalone-messenger/') ||
 location.pathname.startsWith('/status/create') ||
 location.pathname.startsWith('/stories/create') ||
 isKeyboardVisible;

 const handleNavClick = useCallback(() => { /* haptics disabled */ }, []);

 const handlePrefetch = useCallback((path: string) => {
 switch (path) {
 case '/chat': prefetchRoute(() => import('@/pages/Chat')); break;
 case '/chatr-shield': prefetchRoute(() => import('@/pages/ChatrShield')); break;
 case '/profile': prefetchRoute(() => import('@/pages/Profile')); break;
 default: break;
 }
 }, []);

 if (shouldHide) return null;

 return (
 <div
 className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center"
 style={{
 paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
 transform: 'translateZ(0)',
 WebkitTransform: 'translateZ(0)'
 }}
 >
 <nav
 className={cn(
 "pointer-events-auto w-[calc(100%-32px)] max-w-[460px] relative",
 "rounded-[36px] border border-white/70",
 "shadow-[0_8px_32px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.08)]"
 )}
 style={{
 backgroundColor: 'rgba(255,255,255,0.96)',
 backdropFilter: 'blur(24px)',
 WebkitBackdropFilter: 'blur(24px)',
 isolation: 'isolate'
 }}
 >
 <div className="flex items-center justify-around px-3 py-2">
 {navItems.map((item) => {
 const isActive =
 location.pathname === item.path ||
 location.pathname.startsWith(item.path + '/') ||
 (item.path === '/chat' && location.pathname.startsWith('/chat'));

 const Icon = item.icon;
 const isShieldTab = (item as any).isShield;
 const isMeTab = (item as any).isMe;

 // ── Shield Tab — elevated hero button ──────────────────
 if (isShieldTab) {
 return (
 <NavLink
 key={item.path}
 to={item.path}
 id={item.id}
 onClick={handleNavClick}
 onMouseEnter={() => handlePrefetch(item.path)}
 onTouchStart={() => handlePrefetch(item.path)}
 className="relative flex flex-col items-center justify-center -mt-5"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
 {/* Elevated Shield pill */}
 <div className={cn(
 'relative flex h-14 w-14 items-center justify-center rounded-[22px]',
 'bg-gradient-to-br from-[#0d1117] via-[#1a1f2e] to-[#0f1729]',
 'transition-all duration-300',
 isActive
 ? 'shadow-[0_8px_28px_rgba(92,34,255,0.50)]'
 : 'shadow-[0_6px_20px_rgba(15,23,42,0.38)]'
 )}>
 {/* Pulse rings when active */}
 {isActive && (
 <>
 <span className="absolute inset-[-3px] rounded-[25px] border border-primary/25 animate-ping"
 style={{ animationDuration: '2.5s' }} />
 <span className="absolute inset-[-7px] rounded-[29px] border border-emerald-500/10 animate-ping"
 style={{ animationDuration: '3.8s' }} />
 </>
 )}

 <Shield
 className={cn(
 'h-6 w-6 transition-all duration-300',
 isActive
 ? 'text-primary drop-shadow-[0_0_10px_rgba(139,92,246,0.9)]'
 : 'text-slate-300'
 )}
 strokeWidth={isActive ? 2.5 : 2}
 />

 {/* Live green dot */}
 <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
 <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 m-auto" />
 </span>

 {/* Spam count badge */}
 {spamBlocked > 0 && (
 <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-1 ring-white">
 {spamBlocked > 99 ? '99+' : spamBlocked}
 </span>
 )}
 </div>

 <span className={cn(
 'mt-1.5 text-[9px] font-black uppercase tracking-[0.06em] transition-colors duration-300',
 isActive ? 'text-[#5c22ff]' : 'text-black/40'
 )}>
 Shield
 </span>
 </NavLink>
 );
 }

 // ── Standard Tab ───────────────────────────────────────
 return (
 <NavLink
 key={item.path}
 to={item.path}
 id={item.id}
 onClick={handleNavClick}
 onMouseEnter={() => handlePrefetch(item.path)}
 onTouchStart={() => handlePrefetch(item.path)}
 className={cn(
 'relative flex flex-col items-center justify-center py-2 px-3',
 'transition-all duration-300 ease-out active:scale-90',
 'rounded-2xl'
 )}
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
 {/* Active background */}
 {isActive && (
 <span className="absolute inset-0 rounded-2xl bg-primary/[0.07]" />
 )}

 <div className={cn(
 'relative flex h-8 w-8 items-center justify-center transition-transform duration-300',
 isActive ? 'scale-110' : 'scale-100'
 )}>
 {isMeTab ? (
 <Avatar className={cn(
 'h-6 w-6 border-2 transition-all duration-300',
 isActive
 ? 'border-primary shadow-[0_0_10px_rgba(92,34,255,0.4)]'
 : 'border-slate-200'
 )}>
 <AvatarImage src={profile?.avatar_url} />
 <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
 {profile?.full_name?.[0] || 'U'}
 </AvatarFallback>
 </Avatar>
 ) : (
 <Icon
 className={cn(
 'h-5 w-5 transition-all duration-300',
 isActive
 ? 'text-primary drop-shadow-[0_0_6px_rgba(92,34,255,0.5)]'
 : 'text-black/30'
 )}
 strokeWidth={isActive ? 2.5 : 2}
 />
 )}

 {isActive && (
 <div className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary animate-in fade-in zoom-in duration-500" />
 )}
 </div>

 <span className={cn(
 'mt-0.5 text-[9px] font-black uppercase tracking-[0.05em] transition-colors duration-300',
 isActive ? 'text-primary' : 'text-black/20'
 )}>
 {item.name}
 </span>
 </NavLink>
 );
 })}
 </div>
 </nav>
 </div>
 );
};
