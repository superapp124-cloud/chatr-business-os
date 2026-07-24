import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Shield, ShieldCheck, Phone, MessageCircle, Calendar,
 Wallet, Briefcase, Sparkles, ChevronRight, TrendingUp,
 AlertTriangle, CheckCircle2, X, Bot, Heart, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ─── Card Types ─────────────────────────────────────────────────────────────
type CardType =
 | 'shield'
 | 'appointment'
 | 'message'
 | 'payment'
 | 'job'
 | 'missed_call'
 | 'ai_insight';

interface IntelCard {
 id: string;
 type: CardType;
 priority: number;
 title: string;
 subtitle: string;
 action: string;
 route: string;
 icon: React.ElementType;
 accentColor: string;
 accentBg: string;
 dark?: boolean;
 badge?: string;
 value?: string;
 dismissible?: boolean;
}

// ─── Shield Hero Card ────────────────────────────────────────────────────────
function ShieldHeroCard({ spamBlocked, onNavigate }: { spamBlocked: number; onNavigate: (r: string) => void }) {
 return (
 <button
 id="shield-hero-card"
 onClick={() => onNavigate('/chatr-shield')}
 className="intel-card card-enter card-enter-1 w-full rounded-[28px] overflow-hidden relative text-left active:scale-[0.98] transition-transform"
 >
 {/* Background */}
 <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#1a1f2e] to-[#0f1729]" />
 {/* Ambient glows */}
 <div className="absolute top-0 left-0 w-48 h-48 bg-[#5c22ff]/20 rounded-full blur-[60px] -translate-x-1/3 -translate-y-1/3" />
 <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-[40px] translate-x-1/4 translate-y-1/4" />

 <div className="relative px-5 py-5">
 {/* Header row */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2.5">
 <div className="relative w-10 h-10 flex items-center justify-center rounded-[14px] bg-[#5c22ff]/20 shield-pulse">
 <Shield className="w-5 h-5 text-[#5c22ff]" />
 {/* Live dot */}
 <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
 <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 m-auto" />
 </span>
 </div>
 <div>
 <p className="text-white font-black text-[14px] tracking-tight">ChatrShield</p>
 <p className="text-slate-400 text-[10px] font-medium tracking-wider uppercase">Active Protection</p>
 </div>
 </div>
 <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-full uppercase tracking-widest">
 LIVE
 </span>
 </div>

 {/* Stats row */}
 <div className="grid grid-cols-3 gap-2">
 <div className="rounded-2xl bg-white/5 border border-white/8 p-3 text-center">
 <p className="text-[20px] font-black text-red-400">{spamBlocked}</p>
 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">Blocked</p>
 </div>
 <div className="rounded-2xl bg-white/5 border border-white/8 p-3 text-center">
 <p className="text-[20px] font-black text-[#5c22ff]">90</p>
 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">Score</p>
 </div>
 <div className="rounded-2xl bg-white/5 border border-white/8 p-3 text-center">
 <p className="text-[20px] font-black text-emerald-400">99%</p>
 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">Accuracy</p>
 </div>
 </div>

 {/* CTA */}
 <div className="flex items-center justify-between mt-4">
 <p className="text-[12px] font-medium text-slate-400">
 {spamBlocked > 0 ? `${spamBlocked} calls screened today` : 'Identity & fraud defense active'}
 </p>
 <div className="flex items-center gap-1 text-[#5c22ff]">
 <span className="text-[11px] font-bold">View Shield</span>
 <ChevronRight className="w-3.5 h-3.5" />
 </div>
 </div>
 </div>
 </button>
 );
}

// ─── Generic Intelligence Card ───────────────────────────────────────────────
function IntelligenceCard({
 card,
 index,
 onNavigate,
 onDismiss,
}: {
 card: IntelCard;
 index: number;
 onNavigate: (r: string) => void;
 onDismiss: (id: string) => void;
}) {
 const Icon = card.icon;

 if (card.dark) {
 return (
 <button
 id={`intel-card-${card.type}`}
 onClick={() => onNavigate(card.route)}
 className={cn(
 'intel-card w-full rounded-[24px] overflow-hidden relative text-left active:scale-[0.98] transition-transform',
 `card-enter card-enter-${Math.min(index + 2, 6)}`
 )}
 >
 <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] to-[#1a1f2e]" />
 <div className="relative px-4 py-4 flex items-center gap-3">
 <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl shrink-0', card.accentBg)}>
 <Icon className={cn('h-5 w-5', card.accentColor)} />
 </span>
 <div className="flex-1 min-w-0">
 <p className="text-[14px] font-bold text-white leading-tight">{card.title}</p>
 <p className="text-[12px] text-slate-400 mt-0.5 truncate">{card.subtitle}</p>
 </div>
 {card.value && <p className={cn('text-[16px] font-black shrink-0', card.accentColor)}>{card.value}</p>}
 <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
 </div>
 </button>
 );
 }

 return (
 <button
 id={`intel-card-${card.type}-${index}`}
 onClick={() => onNavigate(card.route)}
 className={cn(
 'intel-card w-full rounded-[24px] bg-white border border-slate-100 text-left active:scale-[0.98] transition-transform relative overflow-hidden',
 'shadow-[0_2px_12px_rgba(15,23,42,0.06)]',
 `card-enter card-enter-${Math.min(index + 2, 6)}`
 )}
 >
 {card.badge && (
 <div className="absolute top-3 right-10">
 <span className={cn('text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full', card.accentBg, card.accentColor)}>
 {card.badge}
 </span>
 </div>
 )}
 {card.dismissible && (
 <div
 onClick={(e) => { e.stopPropagation(); onDismiss(card.id); }}
 className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer z-10"
 role="button"
 tabIndex={0}
 >
 <X className="w-3.5 h-3.5 text-slate-400" />
 </div>
 )}
 <div className="px-4 py-4 flex items-center gap-3">
 <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shrink-0', card.accentBg)}>
 <Icon className={cn('h-5.5 w-5.5', card.accentColor)} />
 </span>
 <div className="flex-1 min-w-0 pr-2">
 <p className="text-[14px] font-bold text-slate-900 leading-tight">{card.title}</p>
 <p className="text-[12px] text-slate-500 mt-0.5 truncate">{card.subtitle}</p>
 </div>
 <div className="flex flex-col items-end gap-1 shrink-0">
 {card.value && <p className={cn('text-[15px] font-black', card.accentColor)}>{card.value}</p>}
 <ChevronRight className="h-4 w-4 text-slate-300" />
 </div>
 </div>
 {/* Bottom action strip */}
 <div className={cn('px-4 py-2.5 border-t border-slate-50 flex items-center justify-between', card.accentBg + '/30')}>
 <span className={cn('text-[11px] font-bold uppercase tracking-wide', card.accentColor)}>{card.action}</span>
 <Zap className={cn('w-3 h-3', card.accentColor)} />
 </div>
 </button>
 );
}

// ─── Main Component ──────────────────────────────────────────────────────────
interface IntelligentHomeFeedProps {
 onNavigate: (route: string) => void;
 spamBlocked?: number;
 appointmentCount?: number;
 walletBalance?: number;
 unreadCount?: number;
}

export function IntelligentHomeFeed({
 onNavigate,
 spamBlocked = 0,
 appointmentCount = 0,
 walletBalance = 0,
 unreadCount = 0,
}: IntelligentHomeFeedProps) {
 const [cards, setCards] = useState<IntelCard[]>([]);
 const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

 const handleDismiss = useCallback((id: string) => {
 setDismissedIds(prev => new Set(prev).add(id));
 }, []);

 useEffect(() => {
 const builtCards: IntelCard[] = [];

 // AI Insight card — always show
 builtCards.push({
 id: 'ai-insight',
 type: 'ai_insight',
 priority: 10,
 title: 'AI is learning your patterns',
 subtitle: 'Personalized suggestions activate after 3 days',
 action: 'Explore AI Features',
 route: '/ai-assistant',
 icon: Bot,
 accentColor: 'text-[#5c22ff]',
 accentBg: 'bg-[#5c22ff]/10',
 badge: 'NEW',
 dismissible: true,
 });

 // Unread messages card
 if (unreadCount > 0) {
 builtCards.push({
 id: 'messages',
 type: 'message',
 priority: 90,
 title: `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`,
 subtitle: 'People are waiting for your reply',
 action: 'Open Chats',
 route: '/chat',
 icon: MessageCircle,
 accentColor: 'text-emerald-600',
 accentBg: 'bg-emerald-500/10',
 value: `${unreadCount}`,
 });
 }

 // Appointment card
 if (appointmentCount > 0) {
 builtCards.push({
 id: 'appointment',
 type: 'appointment',
 priority: 85,
 title: `${appointmentCount} upcoming appointment${appointmentCount > 1 ? 's' : ''}`,
 subtitle: 'Your health calendar has upcoming visits',
 action: 'View Care',
 route: '/care',
 icon: Calendar,
 accentColor: 'text-blue-600',
 accentBg: 'bg-blue-500/10',
 value: `${appointmentCount}`,
 badge: 'TODAY',
 });
 }

 // Wallet / balance card
 if (walletBalance > 0) {
 builtCards.push({
 id: 'wallet',
 type: 'payment',
 priority: 70,
 title: `${walletBalance.toLocaleString()} Chatr Points`,
 subtitle: 'Redeem for services, pay merchants',
 action: 'Open Wallet',
 route: '/chatr-wallet',
 icon: Wallet,
 accentColor: 'text-violet-600',
 accentBg: 'bg-violet-500/10',
 value: `${walletBalance > 999 ? (walletBalance / 1000).toFixed(1) + 'K' : walletBalance} PTS`,
 });
 }

 // Jobs discovery card — always show as contextual
 builtCards.push({
 id: 'jobs',
 type: 'job',
 priority: 50,
 title: 'Jobs near you',
 subtitle: 'Discover local opportunities matching your skills',
 action: 'Browse Jobs',
 route: '/jobs',
 icon: Briefcase,
 accentColor: 'text-amber-600',
 accentBg: 'bg-amber-500/10',
 badge: 'LIVE',
 dismissible: true,
 });

 // Health card
 builtCards.push({
 id: 'health',
 type: 'ai_insight',
 priority: 40,
 title: 'Health Hub ready',
 subtitle: 'Connect with doctors, track vitals, manage care',
 action: 'Open Care',
 route: '/care',
 icon: Heart,
 accentColor: 'text-rose-600',
 accentBg: 'bg-rose-500/10',
 dismissible: true,
 });

 // Sort by priority descending
 builtCards.sort((a, b) => b.priority - a.priority);
 setCards(builtCards);
 }, [unreadCount, appointmentCount, walletBalance, spamBlocked]);

 const visibleCards = cards.filter(c => !dismissedIds.has(c.id));

 return (
 <div className="space-y-3">
 {/* Shield is always first — it's the emotional anchor */}
 <ShieldHeroCard spamBlocked={spamBlocked} onNavigate={onNavigate} />

 {/* Dynamic AI cards */}
 {visibleCards.map((card, index) => (
 <IntelligenceCard
 key={card.id}
 card={card}
 index={index}
 onNavigate={onNavigate}
 onDismiss={handleDismiss}
 />
 ))}
 </div>
 );
}
