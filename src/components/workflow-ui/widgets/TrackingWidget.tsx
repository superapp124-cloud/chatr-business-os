/**
 * TrackingWidget — Live tracking card (driver, delivery, service agent).
 *
 * Shows: agent info, OTP, ETA, mini map SVG, action buttons.
 * Works for: cab tracking, food delivery, home service, courier.
 * Lifecycle: ACTIVE (live) → COMPLETED (arrived/delivered).
 */

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Copy, Check, Phone, Share2, X, MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps, TrackingWidgetPayload } from '@/core/workflow-ui';

// ─── Mini Map SVG ─────────────────────────────────────────────────────────────

const MiniMap = memo(({ progress = 0 }: { progress?: number }) => {
 // Simple interpolation along the path: 30,110 -> 160,30
 const startX = 30;
 const endX = 160;
 const startY = 110;
 const endY = 30;
 const currentX = startX + (endX - startX) * progress;
 const currentY = startY + (endY - startY) * progress;

 return (
 <div className="relative h-full w-full bg-[#0D1117] rounded-2xl overflow-hidden">
 {/* Grid lines */}
 <svg className="absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
 <defs>
 <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
 <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4B5563" strokeWidth="0.5" />
 </pattern>
 </defs>
 <rect width="100%" height="100%" fill="url(#grid)" />
 </svg>

 {/* Route line */}
 <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
 <polyline
 points="30,110 50,85 80,70 110,55 140,40 160,30"
 fill="none"
 stroke="#22C55E"
 strokeWidth="2.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 </svg>

 {/* Animated vehicle dot */}
 <motion.div
 className="absolute w-4 h-4 rounded-full bg-violet-500 border-2 border-white shadow-[0_0_8px_rgba(124,58,237,0.8)] -translate-x-1/2 -translate-y-1/2"
 animate={{ left: currentX, top: currentY }}
 transition={{ duration: 0.5, ease: 'easeOut' }}
 />

 {/* Destination pin */}
 <div className="absolute right-4 top-4">
 <div className="relative">
 <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
 <MapPin className="h-2.5 w-2.5 text-white" />
 </div>
 <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-transparent border-t-red-500" />
 </div>
 </div>

 {/* Origin dot */}
 <div className="absolute left-5 bottom-6 w-3.5 h-3.5 rounded-full bg-blue-400 border-2 border-white" />

 {/* Live tracking badge */}
 <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-[9px] font-bold text-white uppercase tracking-wide">Live</span>
 </div>
 </div>
 );
});
MiniMap.displayName = 'MiniMap';

// ─── TrackingWidget ───────────────────────────────────────────────────────────

const TrackingWidget = memo(function TrackingWidget({ instance, workflowId, onAction }: WidgetProps) {
 const payload = instance.payload as TrackingWidgetPayload;
 const [copied, setCopied] = useState(false);
 const isCompleted = instance.lifecycle === 'COMPLETED';

 const copyOtp = () => {
 if (!payload.otp) return;
 navigator.clipboard.writeText(payload.otp).catch(() => {});
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 const handleAction = (actionId: string) => {
 onAction({
 widgetId: instance.id,
 workflowId,
 action: actionId.toUpperCase(),
 data: { actionId },
 });
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3, ease: 'easeOut' }}
 className="rounded-3xl overflow-hidden border border-white/[0.06] bg-[#111118]"
 >
 {/* Success header */}
 <div className={cn(
 'px-4 py-3 flex items-center justify-between',
 isCompleted ? 'bg-emerald-500/10' : 'bg-emerald-500/[0.07]',
 )}>
 <div>
 <p className="text-[13px] font-bold text-emerald-300">
 {payload.title ?? 'Your booking is confirmed! 🎉'}
 </p>
 {payload.status && (
 <p className="text-[11px] text-emerald-400/70 mt-0.5">{payload.status}</p>
 )}
 </div>
 <div className="flex items-center gap-1.5">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Live Tracking</span>
 </div>
 </div>

 {/* Two-column: driver + map */}
 <div className="grid grid-cols-[1fr_130px] gap-3 p-4">
 {/* Driver info */}
 <div className="space-y-3">
 {/* Agent */}
 {payload.agentName && (
 <div className="flex items-center gap-2.5">
 <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold text-secondary shrink-0">
 {payload.agentName.charAt(0)}
 </div>
 <div className="min-w-0">
 <p className="text-[13px] font-bold text-white leading-tight">{payload.agentName}</p>
 {payload.agentRating !== undefined && (
 <div className="flex items-center gap-1 mt-0.5">
 <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
 <span className="text-[11px] text-white/60">{payload.agentRating.toFixed(1)}</span>
 {payload.agentPlate && (
 <>
 <span className="text-white/20 text-[11px]">•</span>
 <span className="text-[11px] text-white/50">{payload.agentPlate}</span>
 </>
 )}
 </div>
 )}
 {payload.agentVehicle && (
 <p className="text-[11px] text-white/40 mt-0.5">{payload.agentVehicle}</p>
 )}
 </div>
 </div>
 )}

 {/* OTP */}
 {payload.otp && (
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-3 py-1.5">
 <span className="text-[11px] text-white/40 font-medium">OTP</span>
 <span className="text-[16px] font-black text-white tracking-widest">{payload.otp}</span>
 </div>
 <button
 onClick={copyOtp}
 className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
 >
 {copied
 ? <Check className="h-3.5 w-3.5 text-emerald-400" />
 : <Copy className="h-3.5 w-3.5 text-white/50" />}
 </button>
 </div>
 )}

 {/* ETA / Distance */}
 {(payload.eta || payload.driverDistance) && (
 <div className="flex items-center gap-1.5">
 <Navigation className="h-3.5 w-3.5 text-violet-400" />
 <span className="text-[13px] font-semibold text-white">
 {payload.driverDistance ? payload.driverDistance : `Arriving in ${payload.eta}`}
 {payload.driverDistance && payload.eta && ` · ETA ${payload.eta}`}
 </span>
 </div>
 )}
 </div>

 {/* Mini Map */}
 <div className="h-[110px] rounded-2xl overflow-hidden">
 <MiniMap progress={payload.driverProgress ?? 0} />
 </div>
 </div>

 {/* Action buttons */}
 {payload.actions && payload.actions.length > 0 && (
 <div className="px-4 pb-4 grid grid-cols-2 gap-2">
 {payload.actions.slice(0, 4).map(action => (
 <motion.button
 key={action.id}
 whileTap={{ scale: 0.96 }}
 onClick={() => handleAction(action.id)}
 className={cn(
 'flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[12px] font-semibold transition-all',
 action.variant === 'danger'
 ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15'
 : 'bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.07]',
 )}
 >
 {action.icon === 'phone' && <Phone className="h-3.5 w-3.5" />}
 {action.icon === 'share' && <Share2 className="h-3.5 w-3.5" />}
 {action.icon === 'cancel' && <X className="h-3.5 w-3.5" />}
 {action.label}
 </motion.button>
 ))}
 </div>
 )}
 </motion.div>
 );
});

export default TrackingWidget;
