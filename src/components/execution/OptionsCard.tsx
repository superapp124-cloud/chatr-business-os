import React, { useState } from 'react';
import { Zap, DollarSign, Star, Train, Car, Plane, Clock, MapPin, Users, ChevronRight, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UniversalOption {
 optionId: string;
 provider: string;
 providerName: string;
 title: string;
 subtitle?: string;
 price: number;
 currency: string;
 departureTime?: string;
 arrivalTime?: string;
 durationMinutes?: number;
 eta?: number;
 availability?: 'available' | 'limited' | 'waitlisted' | 'sold_out';
 seatsLeft?: number;
 confidence?: number;
 badges?: string[];
 from?: string;
 to?: string;
 class?: string;
 // Cab-specific
 driverName?: string;
 driverRating?: string;
 vehicleType?: string;
 vehicleModel?: string;
}

interface OptionsCardProps {
 intent: string;
 options: UniversalOption[];
 from?: string;
 to?: string;
 date?: string;
 onBook: (option: UniversalOption) => void;
 isBooking?: boolean;
 bookingOptionId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BADGE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
 FASTEST: { label: 'Fastest', icon: <Zap className="w-3 h-3" />, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
 CHEAPEST: { label: 'Cheapest', icon: <DollarSign className="w-3 h-3" />, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
 BEST_VALUE: { label: 'Best Value', icon: <Star className="w-3 h-3" />, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
 ECO: { label: 'Eco', icon: <span>🌿</span>, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
 POPULAR: { label: 'Popular', icon: <span>🔥</span>, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

const PROVIDER_EMOJI: Record<string, string> = {
 irctc: '🚂', ixigo: '🎫', confirmtkt: '✅', railyatri: '🛤️',
 uber: '🚗', ola: '🚕', rapido: '🏍️', blusmart: '⚡',
 indigo: '✈️', airindia: '🛫', akasa: '🚀',
 swiggy: '🛵', zomato: '🍽️', blinkit: '⚡',
};

function formatTime(iso?: string): string {
 if (!iso) return '--:--';
 try {
 return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
 } catch { return '--:--'; }
}

function formatDuration(mins?: number): string {
 if (!mins) return '--';
 const h = Math.floor(mins / 60);
 const m = mins % 60;
 return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m}m`;
}

function formatPrice(price: number, currency: string): string {
 const symbol = currency === 'INR' ? '₹' : currency;
 return `${symbol}${price.toLocaleString('en-IN')}`;
}

const isTrain = (intent: string) => intent.includes('transport') || intent.includes('train');
const isCab = (intent: string) => intent.includes('cab') || intent.includes('ride');

// ─── OptionRow ────────────────────────────────────────────────────────────────

function OptionRow({
 option, intent, onBook, isBooking, isSelected
}: {
 option: UniversalOption;
 intent: string;
 onBook: (o: UniversalOption) => void;
 isBooking: boolean;
 isSelected: boolean;
}) {
 const emoji = PROVIDER_EMOJI[option.provider] || '🔷';
 const train = isTrain(intent);

 return (
 <div className={`
 group relative rounded-2xl border transition-all duration-200 overflow-hidden
 ${isSelected
 ? 'border-violet-500/60 bg-violet-500/5 ring-1 ring-violet-500/30'
 : 'border-border/50 bg-card/60 hover:border-border hover:bg-card/90'
 }
 `}>
 {/* Badge row */}
 {option.badges && option.badges.length > 0 && (
 <div className="flex gap-1.5 px-4 pt-3 pb-0">
 {option.badges.map(badge => {
 const cfg = BADGE_CONFIG[badge];
 if (!cfg) return null;
 return (
 <span key={badge} className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color}`}>
 {cfg.icon}{cfg.label}
 </span>
 );
 })}
 </div>
 )}

 <div className="flex items-center gap-4 p-4">
 {/* Provider icon */}
 <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center text-workspace shrink-0">
 {emoji}
 </div>

 {/* Main info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-semibold text-foreground text-[14px] truncate">{option.title}</span>
 {option.availability === 'limited' && (
 <span className="text-[10px] text-amber-400 font-medium shrink-0">
 {option.seatsLeft} seats left
 </span>
 )}
 </div>
 <div className="text-label text-muted-foreground mt-0.5 truncate">{option.subtitle || option.providerName}</div>

 {/* Train: departure → arrival */}
 {train && option.departureTime && (
 <div className="flex items-center gap-2 mt-2">
 <span className="text-secondary font-semibold text-foreground">{formatTime(option.departureTime)}</span>
 <div className="flex items-center gap-1 text-label text-muted-foreground">
 <div className="h-px w-6 bg-border" />
 <Clock className="w-3 h-3" />
 <span>{formatDuration(option.durationMinutes)}</span>
 <div className="h-px w-6 bg-border" />
 </div>
 <span className="text-secondary font-semibold text-foreground">{formatTime(option.arrivalTime)}</span>
 </div>
 )}

 {/* Cab: ETA */}
 {!train && option.eta && (
 <div className="flex items-center gap-1.5 mt-1.5 text-label text-muted-foreground">
 <Clock className="w-3 h-3" />
 <span>{option.eta} min away · {option.vehicleModel || option.vehicleType}</span>
 </div>
 )}
 </div>

 {/* Price + Book */}
 <div className="flex flex-col items-end gap-2 shrink-0">
 <span className="text-section font-bold text-foreground">
 {formatPrice(option.price, option.currency)}
 </span>
 <button
 onClick={() => onBook(option)}
 disabled={isBooking}
 className={`
 flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-secondary font-semibold transition-all duration-200
 ${isSelected && isBooking
 ? 'bg-violet-500/20 text-violet-400 cursor-not-allowed'
 : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md hover:shadow-violet-500/20 active:scale-95'
 }
 `}
 >
 {isSelected && isBooking ? (
 <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Booking...</>
 ) : (
 <>Book <ChevronRight className="w-3.5 h-3.5" /></>
 )}
 </button>
 </div>
 </div>
 </div>
 );
}

// ─── OptionsCard ─────────────────────────────────────────────────────────────

export function OptionsCard({ intent, options, from, to, date, onBook, isBooking = false, bookingOptionId }: OptionsCardProps) {
 if (!options || options.length === 0) return null;

 const train = isTrain(intent);
 const providerCount = new Set(options.map(o => o.provider)).size;

 return (
 <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
 {/* Header */}
 <div className="flex items-center justify-between mb-3">
 <div>
 <h3 className="text-[15px] font-semibold text-foreground">
 {options.length} option{options.length !== 1 ? 's' : ''} found
 </h3>
 <p className="text-label text-muted-foreground mt-0.5">
 Searched {providerCount} provider{providerCount !== 1 ? 's' : ''} simultaneously
 {from && to ? ` · ${from} → ${to}` : ''}
 </p>
 </div>
 <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
 <span className="text-[10px] font-medium text-emerald-400">LIVE</span>
 </div>
 </div>

 {/* Options list */}
 <div className="flex flex-col gap-2">
 {options.map(opt => (
 <OptionRow
 key={opt.optionId}
 option={opt}
 intent={intent}
 onBook={onBook}
 isBooking={isBooking}
 isSelected={bookingOptionId === opt.optionId}
 />
 ))}
 </div>

 <p className="text-[11px] text-muted-foreground/60 text-center mt-3">
 Prices are inclusive of all taxes · Availability updates every 60s
 </p>
 </div>
 );
}

// ─── SearchProgress Card ──────────────────────────────────────────────────────

export function SearchProgressCard({ from, to, providers = ['IRCTC', 'ixigo', 'ConfirmTkt'] }: { from?: string; to?: string; providers?: string[] }) {
 return (
 <div className="w-full p-5 rounded-2xl border border-border/50 bg-card/60 animate-in fade-in duration-300">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
 <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
 </div>
 <div>
 <p className="text-[14px] font-medium text-foreground">Searching live availability...</p>
 {from && to && (
 <p className="text-label text-muted-foreground mt-0.5">{from} → {to}</p>
 )}
 </div>
 </div>
 <div className="flex flex-wrap gap-2">
 {providers.map((p, i) => (
 <span key={p} className={`inline-flex items-center gap-1.5 text-label px-2.5 py-1 rounded-full border ${i === 0 ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'bg-muted/40 border-border/40 text-muted-foreground'}`}>
 <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-violet-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
 {p}
 </span>
 ))}
 </div>
 </div>
 );
}
