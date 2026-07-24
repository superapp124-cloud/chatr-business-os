import { useCallback, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 BadgeIndianRupee,
 Bell,
 BriefcaseBusiness,
 CalendarDays,
 Gamepad2,
 HeartPulse,
 LayoutGrid,
 MessageCircle,
 Phone,
 Search,
 ShieldCheck,
 ShoppingBag,
 Sparkles,
 Stethoscope,
 Store,
 UserRound,
 Users,
 Wallet,
 Coins,
 Flame,
 User,
 Clock,
 Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInstantCache } from '@/hooks/useInstantCache';
import { supabase } from '@/integrations/supabase/client';
import { formatCoinAmount } from '@/core/platformParity/sharedBalanceFormatter';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import chatrIconLogo from '@/assets/chatr-icon-logo.png';
import { SEOHead } from '@/components/SEOHead';

const categories = [
 { key: 'all', label: 'All' },
 { key: 'communication', label: 'Communication' },
 { key: 'care', label: 'Care' },
 { key: 'work', label: 'Work' },
 { key: 'money', label: 'Money' },
] as const;

const services = [
 { icon: Clock, label: 'Timeline', route: '/timeline', group: 'communication', color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
 { icon: MessageCircle, label: 'Chats', route: '/chat', group: 'communication', color: 'text-green-600', bg: 'bg-green-500/10' },
 { icon: ShieldCheck, label: 'Safe SMS', route: '/smart-inbox', group: 'communication', color: 'text-blue-600', bg: 'bg-blue-500/10' },
 { icon: Phone, label: 'Calls', route: '/call-history', group: 'communication', color: 'text-emerald-700', bg: 'bg-emerald-500/10' },
 { icon: LayoutGrid, label: 'Status', route: '/status', group: 'communication', color: 'text-violet-600', bg: 'bg-violet-500/10' },
 { icon: ShieldCheck, label: 'Caller ID', route: '/caller-id', group: 'communication', color: 'text-red-600', bg: 'bg-red-500/10' },
 { icon: Zap, label: 'Automations', route: '/automations', group: 'communication', color: 'text-blue-600', bg: 'bg-blue-500/10' },
 { icon: Sparkles, label: 'AI Assistant', route: '/ai-assistant', group: 'all', color: 'text-violet-600', bg: 'bg-violet-500/10' },
 { icon: Store, label: 'Services', route: '/marketplace', group: 'work', color: 'text-orange-600', bg: 'bg-orange-500/10' },
 { icon: BriefcaseBusiness, label: 'Jobs', route: '/jobs', group: 'work', color: 'text-blue-600', bg: 'bg-blue-500/10' },
 { icon: Users, label: 'Community', route: '/community', group: 'communication', color: 'text-teal-700', bg: 'bg-teal-500/10' },
 { icon: HeartPulse, label: 'Health Hub', route: '/health', group: 'care', color: 'text-rose-600', bg: 'bg-rose-500/10' },
 { icon: Stethoscope, label: 'Care Access', route: '/care', group: 'care', color: 'text-cyan-700', bg: 'bg-cyan-500/10' },
 { icon: CalendarDays, label: 'Appointments', route: '/care/appointments', group: 'care', color: 'text-blue-600', bg: 'bg-blue-500/10' },
 { icon: ShoppingBag, label: 'Marketplace', route: '/marketplace', group: 'work', color: 'text-orange-600', bg: 'bg-orange-500/10' },
 { icon: Wallet, label: 'Wallet', route: '/chatr-wallet', group: 'money', color: 'text-violet-600', bg: 'bg-violet-500/10' },
 { icon: BadgeIndianRupee, label: 'Earn', route: '/earn', group: 'money', color: 'text-green-700', bg: 'bg-green-500/10' },
 { icon: Gamepad2, label: 'Games', route: '/chatr-games', group: 'all', color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
 { icon: Bell, label: 'Notifications', route: '/notifications', group: 'all', color: 'text-red-600', bg: 'bg-red-500/10' },
 { icon: UserRound, label: 'Profile', route: '/profile', group: 'all', color: 'text-slate-700', bg: 'bg-slate-500/10' },
] as const;

export default function More() {
 const navigate = useNavigate();
 const [query, setQuery] = useState('');
 const [category, setCategory] = useState<(typeof categories)[number]['key']>('all');
 const [unreadNotifications, setUnreadNotifications] = useState(0);

 const { data: profile } = useInstantCache('user-profile-more', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return null;
 const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
 return data;
 });

 const { data: pointsData } = useInstantCache('user-points-more', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return { balance: 0, streak: 0 };
 const [points, streaks] = await Promise.all([
 supabase.from('user_points').select('balance').eq('user_id', user.id).maybeSingle(),
 supabase.from('user_streaks').select('current_streak').eq('user_id', user.id).maybeSingle()
 ]);
 return {
 balance: points.data?.balance || 0,
 streak: streaks.data?.current_streak || 0
 };
 }, { pollingInterval: 60000 });

 useEffect(() => {
 const fetchNotifications = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { count } = await supabase
 .from('notifications')
 .select('*', { count: 'exact', head: true })
 .eq('user_id', user.id)
 .eq('read', false);
 setUnreadNotifications(count || 0);
 };
 fetchNotifications();
 }, []);

 const filteredServices = useMemo(() => {
 const normalizedQuery = query.trim().toLowerCase();
 return services.filter((service) => {
 const matchesCategory = category === 'all' || service.group === category || service.group === 'all';
 const matchesSearch = !normalizedQuery || service.label.toLowerCase().includes(normalizedQuery);
 return matchesCategory && matchesSearch;
 });
 }, [category, query]);

 const openService = useCallback(
 (route: string) => {
 try {
 navigator.vibrate?.(8);
 } catch {}
 navigate(route);
 },
 [navigate]
 );

 return (
 <main className="min-h-[100dvh] overflow-y-auto bg-[#F2F2F7] pb-28 text-slate-950">
 <SEOHead title="Chatr+ | More" description="Explore all Chatr tools" />
 
 {/* Unified Header */}
 <div className="sticky top-0 z-50 bg-[#F2F2F7]/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div onClick={() => navigate('/home')} className="flex items-center gap-2 cursor-pointer">
 <img src={chatrIconLogo} alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
 <span className="text-workspace font-bold tracking-tight text-slate-900">chatr+</span>
 </div>
 <div className="flex items-center gap-1.5 ml-2">
 <button 
 onClick={() => navigate('/chatr-points')}
 className="h-7 px-2 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-1 transition-all"
 >
 <Coins className="w-3 h-3 text-amber-500" />
 <span className="text-[10px] font-bold text-amber-600">
 {formatCoinAmount(pointsData?.balance || 0)}
 </span>
 </button>
 {(pointsData?.streak || 0) > 0 && (
 <div className="h-7 px-2 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center gap-1">
 <Flame className="w-3 h-3 text-orange-500" />
 <span className="text-[10px] font-bold text-orange-600">{pointsData?.streak}</span>
 </div>
 )}
 </div>
 </div>
 
 <div className="flex items-center gap-3">
 <button 
 onClick={() => navigate('/notifications')}
 className="relative p-2 rounded-full bg-white shadow-sm"
 >
 <Bell className="w-5 h-5 text-slate-700" />
 {unreadNotifications > 0 && (
 <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
 )}
 </button>
 
 <button onClick={() => navigate('/profile')} className="w-8 h-8 rounded-full overflow-hidden border border-white shadow-sm">
 {profile?.avatar_url ? (
 <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
 ) : (
 <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
 {profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
 </div>
 )}
 </button>
 </div>
 </div>

 <div className="mx-auto max-w-[540px] space-y-6 px-4 pt-4">
 <header className="space-y-4">
 <div>
 <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5c22ff]">Discover</p>
 <h1 className="mt-1 text-page font-bold tracking-tight text-slate-900">
 All Chatr Tools
 </h1>
 <p className="mt-1 text-secondary font-medium text-slate-500">
 AI, services, care, and community in one place.
 </p>
 </div>

 <div className="relative">
 <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
 <input
 value={query}
 onChange={(event) => setQuery(event.target.value)}
 placeholder="Search chats, jobs, people, services..."
 className="h-12 w-full rounded-[22px] border border-slate-200/80 bg-white pl-12 pr-4 text-[15px] font-medium text-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.05)] outline-none focus:border-[#5c22ff]/40"
 />
 </div>

 <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
 {categories.map((item) => (
 <button
 key={item.key}
 type="button"
 onClick={() => setCategory(item.key)}
 className={cn(
 'h-10 shrink-0 rounded-full px-4 text-[13px] font-bold transition active:scale-95',
 category === item.key
 ? 'bg-[#5c22ff] text-white shadow-[0_10px_24px_rgba(92,34,255,0.22)]'
 : 'border border-slate-200 bg-white text-slate-600'
 )}
 >
 {item.label}
 </button>
 ))}
 </div>
 </header>

 <section className="grid grid-cols-3 gap-3">
 {filteredServices.map((service) => (
 <button
 key={service.label}
 type="button"
 onClick={() => openService(service.route)}
 className="flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-[24px] border border-white/80 bg-white px-2 py-4 text-center shadow-[0_16px_34px_rgba(15,23,42,0.06)] transition active:scale-95"
 >
 <span className={cn('flex h-12 w-12 items-center justify-center rounded-full', service.bg)}>
 <service.icon className={cn('h-6 w-6', service.color)} />
 </span>
 <span className="line-clamp-2 text-[12px] font-bold leading-tight text-slate-950">
 {service.label}
 </span>
 </button>
 ))}
 </section>
 </div>
 </main>
 );
}
