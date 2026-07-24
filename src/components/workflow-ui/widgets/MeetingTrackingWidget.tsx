import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CheckCircle2, Circle, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps, MeetingTrackingWidgetPayload, MeetingAttendee } from '@/core/workflow-ui';

// ─── AttendeeRow ─────────────────────────────────────────────────────────────

const AttendeeRow = memo(({ attendee }: { attendee: MeetingAttendee }) => {
 const isAccepted = attendee.status === 'accepted';
 const isDeclined = attendee.status === 'declined';
 const isPending = attendee.status === 'pending';

 return (
 <motion.div
 layout
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex items-center gap-3 py-2 px-3 rounded-lg bg-black/20 border border-white/[0.04]"
 >
 <div className="relative">
 <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-medium text-label border border-indigo-500/30">
 {attendee.name.charAt(0)}
 </div>
 
 {/* Status Indicator Badge */}
 <div className="absolute -bottom-0.5 -right-0.5 bg-[#12121A] rounded-full p-[2px]">
 {isAccepted && <CheckCircle2 className="w-3 h-3 text-emerald-500 fill-emerald-500/20" />}
 {isDeclined && <Circle className="w-3 h-3 text-red-500" />}
 {isPending && <Clock className="w-3 h-3 text-amber-500" />}
 </div>
 </div>

 <div className="flex-1 min-w-0">
 <p className="text-[12px] font-medium text-white truncate">{attendee.name}</p>
 <p className="text-[10px] text-white/50 truncate">{attendee.email}</p>
 </div>

 <div className="shrink-0 text-[10px] font-medium">
 {isAccepted && <span className="text-emerald-400">Accepted</span>}
 {isDeclined && <span className="text-red-400">Declined</span>}
 {isPending && <span className="text-amber-400 animate-pulse">Awaiting RSVP</span>}
 </div>
 </motion.div>
 );
});
AttendeeRow.displayName = 'AttendeeRow';

// ─── MeetingTrackingWidget ───────────────────────────────────────────────────

export const MeetingTrackingWidget = memo(function MeetingTrackingWidget({ instance }: WidgetProps) {
 const payload = instance.payload as MeetingTrackingWidgetPayload;
 
 const total = payload.attendees.length;
 const accepted = payload.attendees.filter(a => a.status === 'accepted').length;
 const isComplete = accepted === total;

 return (
 <div className="flex flex-col rounded-2xl bg-[#12121A] border border-white/10 overflow-hidden shadow-xl w-full max-w-sm">
 
 {/* Header */}
 <div className="p-4 bg-gradient-to-b from-indigo-500/10 to-transparent border-b border-white/[0.05]">
 <div className="flex justify-between items-start mb-3">
 <div>
 <h3 className="text-secondary font-semibold text-white tracking-tight">
 {payload.title}
 </h3>
 {payload.subtitle && (
 <p className="text-label text-white/60 mt-0.5">{payload.subtitle}</p>
 )}
 </div>
 <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30">
 <Users className="w-3 h-3 text-indigo-400" />
 <span className="text-[10px] font-semibold text-indigo-300">
 {accepted}/{total} Accepted
 </span>
 </div>
 </div>

 {payload.location && (
 <div className="flex items-center gap-1.5 text-label text-white/50 mt-2">
 <MapPin className="w-3.5 h-3.5" />
 <span>{payload.location}</span>
 </div>
 )}
 </div>

 {/* RSVPs List */}
 <div className="p-3 space-y-1.5 bg-black/40">
 <AnimatePresence mode="popLayout">
 {payload.attendees.map((attendee, i) => (
 <AttendeeRow key={`${attendee.email}-${i}`} attendee={attendee} />
 ))}
 </AnimatePresence>
 </div>

 {/* Footer Status */}
 <div className="p-3 border-t border-white/[0.05] flex items-center justify-center">
 {isComplete ? (
 <div className="flex items-center gap-1.5 text-emerald-400">
 <CheckCircle2 className="w-3.5 h-3.5" />
 <span className="text-[11px] font-medium">Ready for meeting</span>
 </div>
 ) : (
 <div className="flex items-center gap-1.5 text-white/50">
 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
 <span className="text-[11px] font-medium tracking-wide uppercase">Waiting for responses...</span>
 </div>
 )}
 </div>
 </div>
 );
});
