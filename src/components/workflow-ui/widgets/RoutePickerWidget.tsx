/**
 * RoutePickerWidget — Dynamic route and location selection.
 *
 * Used for cab booking, food delivery, courier, etc.
 * Lifecycle: WAITING_USER → EXECUTING → COMPLETED.
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, CalendarClock, Clock, ArrowDownUp, Train, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps, RoutePickerWidgetPayload } from '@/core/workflow-ui';

// ─── Mini Map SVG ─────────────────────────────────────────────────────────────

const MiniMap = memo(() => (
 <div className="relative h-[120px] w-full bg-[#0D1117] rounded-2xl overflow-hidden mt-3">
 {/* Grid lines */}
 <svg className="absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
 <defs>
 <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
 <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4B5563" strokeWidth="0.5" />
 </pattern>
 </defs>
 <rect width="100%" height="100%" fill="url(#grid)" />
 </svg>

 {/* Abstract Route line */}
 <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
 <polyline
 points="40,80 120,60 200,90 280,40"
 fill="none"
 stroke="#7C3AED"
 strokeWidth="3"
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeDasharray="6 6"
 />
 </svg>

 {/* Origin pin */}
 <div className="absolute left-[34px] top-[74px] w-3 h-3 rounded-full bg-violet-400 border-2 border-[#0D1117]" />
 
 {/* Destination pin */}
 <div className="absolute left-[274px] top-[34px] w-3 h-3 rounded-full bg-red-400 border-2 border-[#0D1117]" />
 </div>
));
MiniMap.displayName = 'MiniMap';

// ─── Train Visual SVG ─────────────────────────────────────────────────────────

const TrainVisual = memo(() => (
 <div className="relative h-[80px] w-full bg-[#0D1117] rounded-2xl overflow-hidden mt-3 flex flex-col justify-center px-6">
 {/* Abstract Train Track */}
 <div className="relative h-[4px] w-full bg-white/10 rounded-full">
 <div className="absolute left-0 top-0 bottom-0 w-[40%] bg-violet-500 rounded-full opacity-50" />
 
 {/* Stations along the track */}
 <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-violet-400 border-2 border-[#0D1117]" />
 <div className="absolute left-[30%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/30" />
 <div className="absolute left-[60%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/30" />
 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-400 border-2 border-[#0D1117]" />
 
 {/* Train icon moving */}
 <div className="absolute left-[40%] top-1/2 -translate-y-1/2 -translate-x-1/2 text-white">
 <Train className="w-5 h-5 text-violet-400" />
 </div>
 </div>
 </div>
));
TrainVisual.displayName = 'TrainVisual';

// ─── Component ────────────────────────────────────────────────────────────────

const RoutePickerWidget = memo(function RoutePickerWidget({ instance, workflowId, onAction }: WidgetProps) {
 const payload = instance.payload as RoutePickerWidgetPayload;
 
 const [origin, setOrigin] = useState(payload.origin ?? '');
 const [destination, setDestination] = useState(payload.destination ?? '');
 const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>(() => 
 (payload.mode === 'train' || payload.mode === 'flight') ? 'schedule' : 'now'
 );
 const [scheduleDate, setScheduleDate] = useState('');
 const [scheduleTime, setScheduleTime] = useState('');

 const isExecuting = instance.lifecycle === 'EXECUTING';
 const isCompleted = instance.lifecycle === 'COMPLETED';

 const mode = payload.mode || 'cab';

 // Dynamic labels based on mode
 let originLabel = 'Pickup location';
 let destLabel = 'Where to?';
 let ctaNow = 'Ride Now';
 let originIcon = <Navigation className="w-3.5 h-3.5 text-violet-400" />;
 let destIcon = <MapPin className="w-3.5 h-3.5 text-red-400" />;

 if (mode === 'train') {
 originLabel = 'From Station';
 destLabel = 'To Station';
 ctaNow = 'Search Trains';
 originIcon = <Train className="w-4 h-4 text-violet-400" />;
 destIcon = <MapPin className="w-3.5 h-3.5 text-red-400" />;
 } else if (mode === 'flight') {
 originLabel = 'From Airport';
 destLabel = 'To Airport';
 ctaNow = 'Search Flights';
 originIcon = <Plane className="w-4 h-4 text-violet-400" />;
 destIcon = <MapPin className="w-3.5 h-3.5 text-red-400" />;
 }

 const handleSwap = () => {
 setOrigin(destination);
 setDestination(origin);
 };

 const handleSubmit = () => {
 if (!origin || !destination) return;
 
 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'SUBMIT',
 data: { 
 from: origin, // Required by decision-engine
 to: destination, // Required by decision-engine
 origin, // Keep for backward compatibility
 destination, // Keep for backward compatibility
 mode: payload.mode,
 isScheduled: scheduleMode === 'schedule',
 scheduleDate: scheduleMode === 'schedule' ? scheduleDate : undefined,
 scheduleTime: scheduleMode === 'schedule' ? scheduleTime : undefined,
 },
 });
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -6 }}
 transition={{ duration: 0.3, ease: 'easeOut' }}
 className="rounded-3xl border border-white/[0.06] bg-[#111118]"
 >
 {/* Header */}
 <div className="px-4 pt-4 pb-2">
 <h3 className="text-[13px] font-bold text-white leading-tight">
 {payload.title ?? (mode === 'train' ? 'Book Train Ticket' : mode === 'flight' ? 'Book Flight' : 'Route Details')}
 </h3>
 {payload.subtitle && (
 <p className="text-[11px] text-white/50 mt-0.5">{payload.subtitle}</p>
 )}
 </div>

 <div className="p-4 space-y-4">
 {/* Routing Inputs */}
 <div className="relative">
 {/* Vertical connection line */}
 <div className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px] bg-white/10" />
 
 <div className="flex flex-col gap-3">
 {/* Origin Input */}
 <div className="flex items-center gap-3 relative">
 <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 z-10">
 {originIcon}
 </div>
 <input
 type="text"
 value={origin}
 onChange={e => setOrigin(e.target.value)}
 placeholder={originLabel}
 className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
 />
 </div>

 {/* Destination Input */}
 <div className="flex items-center gap-3 relative">
 <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 z-10">
 {destIcon}
 </div>
 <input
 type="text"
 value={destination}
 onChange={e => setDestination(e.target.value)}
 placeholder={destLabel}
 className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
 />
 </div>
 </div>

 {/* Swap Button */}
 {!(isExecuting || isCompleted) && (
 <button 
 onClick={handleSwap}
 className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 text-white/50 hover:text-white transition-colors"
 >
 <ArrowDownUp className="w-3.5 h-3.5" />
 </button>
 )}
 </div>

 {/* Map/Visual */}
 {mode === 'train' ? <TrainVisual /> : <MiniMap />}

 {/* Train Options Row */}
 {!isCompleted && mode === 'train' && (
 <div className="flex flex-col gap-3 pt-2">
 <div className="flex gap-2">
 <select className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:border-violet-500/40 appearance-none">
 <option value="ALL">All Classes</option>
 <option value="1AC">1AC</option>
 <option value="2AC">2AC</option>
 <option value="3AC">3AC</option>
 <option value="SL">Sleeper (SL)</option>
 </select>
 <select className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:border-violet-500/40 appearance-none">
 <option value="GN">General Quota</option>
 <option value="TQ">Tatkal</option>
 <option value="LD">Ladies</option>
 </select>
 </div>
 
 <div className="flex gap-2">
 <input
 type="date"
 value={scheduleDate}
 onChange={e => setScheduleDate(e.target.value)}
 className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:border-violet-500/40"
 />
 <input
 type="time"
 value={scheduleTime}
 onChange={e => setScheduleTime(e.target.value)}
 className="flex-[0.7] bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:border-violet-500/40"
 />
 </div>
 </div>
 )}

 {/* Schedule Mode Toggle (Only for cabs/flights) */}
 {!isCompleted && mode !== 'train' && (
 <div className="space-y-3 pt-2">
 <div className="flex items-center gap-2 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
 <button
 onClick={() => setScheduleMode('now')}
 className={cn(
 'flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-label font-semibold transition-all',
 scheduleMode === 'now' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
 )}
 >
 <Clock className="w-3.5 h-3.5" />
 {ctaNow}
 </button>
 <button
 onClick={() => setScheduleMode('schedule')}
 className={cn(
 'flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-label font-semibold transition-all',
 scheduleMode === 'schedule' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
 )}
 >
 <CalendarClock className="w-3.5 h-3.5" />
 {mode === 'flight' ? 'Travel Later' : 'Schedule'}
 </button>
 </div>

 {/* Expandable Schedule Inputs */}
 <AnimatePresence>
 {scheduleMode === 'schedule' && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="flex gap-2 overflow-hidden"
 >
 <input
 type="date"
 value={scheduleDate}
 onChange={e => setScheduleDate(e.target.value)}
 className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:border-violet-500/40"
 />
 <input
 type="time"
 value={scheduleTime}
 onChange={e => setScheduleTime(e.target.value)}
 className="flex-[0.7] bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:border-violet-500/40"
 />
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 )}

 {/* Actions */}
 {!isCompleted && (
 <motion.button
 whileTap={{ scale: 0.98 }}
 onClick={handleSubmit}
 disabled={isExecuting || !origin || !destination || (mode === 'train' && !scheduleDate)}
 className={cn(
 'w-full py-3 rounded-xl text-[13px] font-bold text-white transition-all',
 'bg-pink-600 shadow-[0_4px_16px_rgba(219,39,119,0.3)]',
 'hover:bg-pink-500',
 'mt-2'
 )}
 >
 {isExecuting ? 'Processing...' : (mode === 'train' ? 'Search Trains' : (payload.ctaLabel ?? 'Continue'))}
 </motion.button>
 )}
 </div>
 </motion.div>
 );
});

export default RoutePickerWidget;
