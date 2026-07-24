import React, { useState } from 'react';
import {
 Plane, Hotel, Car, MapPin, Calendar, CheckCircle,
 AlertTriangle, ChevronDown, ChevronRight, Clock, Shield
} from 'lucide-react';
import { ItineraryArtifact, FlightArtifact, HotelArtifact, TaxiArtifact } from '@/core/capabilities/travel/types';
import { formatMoney } from '@/core/capabilities/finance/types';
import { cn } from '@/lib/utils';

interface ItineraryCardProps {
 itinerary: Partial<ItineraryArtifact>;
 flight?: Partial<FlightArtifact>;
 hotel?: Partial<HotelArtifact>;
 taxi?: Partial<TaxiArtifact>;
 onApprove?: () => void;
}

export function ItineraryCard({ itinerary, flight, hotel, taxi, onApprove }: ItineraryCardProps) {
 const [checkpointsExpanded, setCheckpointsExpanded] = useState(false);

 const statusConfig = {
 DRAFT: { color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
 APPROVED: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
 ACTIVE: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
 COMPLETED: { color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
 COMPENSATED: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
 } as const;

 const cfg = statusConfig[(itinerary.status || 'DRAFT') as keyof typeof statusConfig];

 return (
 <div className="w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">

 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-sky-950/30 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
 <Plane className="w-5 h-5 text-sky-400" />
 </div>
 <div>
 <h3 className="text-white font-semibold text-secondary">
 {flight ? `${flight.origin} → ${flight.destination}` : 'Travel Itinerary'}
 </h3>
 <p className="text-slate-400 text-label">{itinerary.travelerName} · {flight?.departureDate}</p>
 </div>
 </div>
 <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border', cfg.bg, cfg.color)}>
 {itinerary.status}
 </span>
 </div>

 {/* AI Summary */}
 {itinerary.summary && (
 <div className="px-4 py-3 bg-slate-800/20 border-b border-slate-700/50">
 <p className="text-[11px] text-slate-500 mb-1 font-medium flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
 AI Travel Briefing
 </p>
 <p className="text-secondary text-slate-300 ">{itinerary.summary}</p>
 </div>
 )}

 {/* Booking Summary */}
 <div className="p-4 space-y-3 border-b border-slate-700/50">

 {/* Flight */}
 {flight && (
 <div className="flex items-center gap-3 bg-slate-800/40 rounded-xl p-3 border border-slate-700/40">
 <Plane className="w-4 h-4 text-sky-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-secondary text-slate-200 font-medium">{flight.airline} {flight.flightNumber}</p>
 <p className="text-label text-slate-400">{flight.seatClass} · {flight.departureDate}</p>
 </div>
 <div className="flex flex-col items-end">
 <span className="text-secondary font-semibold text-sky-400">
 {flight.price ? formatMoney(flight.price) : '—'}
 </span>
 <span className={cn('text-[10px] font-medium mt-0.5',
 flight.status === 'RESERVED' ? 'text-emerald-400' :
 flight.status === 'CANCELLED' ? 'text-rose-400' : 'text-slate-400'
 )}>
 {flight.status}
 </span>
 </div>
 </div>
 )}

 {/* Hotel */}
 {hotel && (
 <div className="flex items-center gap-3 bg-slate-800/40 rounded-xl p-3 border border-slate-700/40">
 <Hotel className="w-4 h-4 text-violet-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-secondary text-slate-200 font-medium">{hotel.hotelName}</p>
 <p className="text-label text-slate-400">{hotel.checkIn} → {hotel.checkOut}</p>
 </div>
 <div className="flex flex-col items-end">
 <span className="text-secondary font-semibold text-violet-400">
 {hotel.totalPrice ? formatMoney(hotel.totalPrice) : '—'}
 </span>
 <span className={cn('text-[10px] font-medium mt-0.5',
 hotel.status === 'RESERVED' ? 'text-emerald-400' :
 hotel.status === 'CANCELLED' ? 'text-rose-400' : 'text-slate-400'
 )}>
 {hotel.status}
 </span>
 </div>
 </div>
 )}

 {/* Taxi */}
 {taxi && (
 <div className="flex items-center gap-3 bg-slate-800/40 rounded-xl p-3 border border-slate-700/40">
 <Car className="w-4 h-4 text-amber-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-secondary text-slate-200 font-medium">{taxi.provider}</p>
 <p className="text-label text-slate-400">{taxi.pickupLocation}</p>
 </div>
 <div className="flex flex-col items-end">
 <span className="text-secondary font-semibold text-amber-400">
 {taxi.estimatedPrice ? formatMoney(taxi.estimatedPrice) : '—'}
 </span>
 <span className={cn('text-[10px] font-medium mt-0.5',
 taxi.status === 'RESERVED' ? 'text-emerald-400' :
 taxi.status === 'CANCELLED' ? 'text-rose-400' : 'text-slate-400'
 )}>
 {taxi.status}
 </span>
 </div>
 </div>
 )}
 </div>

 {/* Total */}
 <div className="px-4 py-3 flex justify-between items-center border-b border-slate-700/50">
 <div className="flex items-center gap-2">
 <span className="text-secondary font-bold text-slate-300 uppercase tracking-wider">Total</span>
 {itinerary.policyCompliant && (
 <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
 <Shield className="w-3 h-3" /> Policy Compliant
 </span>
 )}
 </div>
 <span className="text-section font-bold text-sky-400">
 {itinerary.totalCost ? formatMoney(itinerary.totalCost) : '—'}
 </span>
 </div>

 {/* Checkpoints */}
 {(itinerary.checkpoints?.length ?? 0) > 0 && (
 <div className="border-b border-slate-700/50">
 <button onClick={() => setCheckpointsExpanded(v => !v)}
 className="w-full p-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
 <span className="text-label text-slate-400 flex items-center gap-2">
 <Clock className="w-3.5 h-3.5 text-sky-400" />
 Workflow Checkpoints ({itinerary.checkpoints?.length})
 </span>
 {checkpointsExpanded
 ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
 : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
 </button>
 {checkpointsExpanded && (
 <div className="px-3 pb-3 space-y-1.5">
 {itinerary.checkpoints?.map((cp, i) => (
 <div key={i} className="flex items-center gap-2.5 text-label text-slate-400">
 <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
 <span className="font-medium text-slate-300">{cp.label}</span>
 <span className="text-slate-600 ml-auto">{new Date(cp.snapshotTimestamp).toLocaleTimeString()}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Action */}
 {itinerary.status === 'DRAFT' && onApprove && (
 <div className="p-3 bg-slate-950/50">
 <button onClick={onApprove}
 className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-button rounded-xl flex items-center justify-center gap-2 transition-colors">
 <CheckCircle className="w-4 h-4" /> Approve Travel
 </button>
 </div>
 )}
 </div>
 );
}
