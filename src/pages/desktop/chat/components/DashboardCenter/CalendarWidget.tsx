import React from 'react';
import { useLiveCalendar } from '@/providers/useLiveCalendar';
import { format } from 'date-fns';
import { CalendarDays, Clock, Users } from 'lucide-react';

// Fallback colors if event doesn't have one
const SLOT_COLORS = ['#6d5df6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

export const CalendarWidget: React.FC = () => {
  const { events, isLoading, isEmpty } = useLiveCalendar();

  return (
    <div className="w-full mt-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
            <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Upcoming Schedule</h2>
        </div>
        <button className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors">View calendar</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {isLoading && events.length === 0 ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 animate-pulse">
              <div className="h-2 bg-white/[0.08] rounded-full w-1/4 mb-3" />
              <div className="h-3.5 bg-white/[0.10] rounded-full w-3/4 mb-2" />
              <div className="h-2.5 bg-white/[0.06] rounded-full w-1/2 mb-4" />
              <div className="flex gap-1">
                <div className="w-6 h-6 rounded-full bg-white/[0.08]" />
                <div className="w-6 h-6 rounded-full bg-white/[0.06]" />
              </div>
            </div>
          ))
        ) : isEmpty ? (
          <div className="col-span-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 shadow-inner">
              <CalendarDays className="w-6 h-6 text-blue-400/40" />
            </div>
            <p className="text-sm font-bold text-white/70 mb-1">Upcoming Schedule</p>
            <p className="text-xs text-white/35 leading-relaxed max-w-[240px]">
              Connect your calendar and your upcoming meetings will automatically appear here.
            </p>
          </div>
        ) : (
          events.slice(0, 4).map((slot, i) => {
            const color = slot.color || SLOT_COLORS[i % SLOT_COLORS.length];
            const timeString = format(new Date(slot.startAt), 'h:mm a');
            return (
              <div
                key={slot.id}
                className="group relative bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] rounded-2xl p-4 hover:bg-white/[0.07] transition-all cursor-pointer overflow-hidden shadow-md hover:shadow-lg"
                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
              >
                {/* Subtle color glow at top */}
                <div className="absolute top-0 left-0 right-0 h-0.5 opacity-60 rounded-t-2xl" style={{ background: color }} />

                {/* Time */}
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3 h-3" style={{ color }} />
                  <span className="text-[11px] font-bold font-mono" style={{ color }}>{timeString}</span>
                </div>

                {/* Title */}
                <p className="text-sm font-bold text-white/90 mb-1 truncate leading-tight">{slot.title}</p>

                {/* Description */}
                {slot.description && (
                  <p className="text-xs text-white/40 mb-3 truncate">{slot.description}</p>
                )}

                {/* Attendees */}
                {slot.attendees?.length > 0 && (
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <div className="flex -space-x-1.5">
                      {slot.attendees.slice(0, 3).map((p: any, idx: number) => (
                        <div
                          key={idx}
                          className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-[#0b0b14] flex items-center justify-center text-[9px] text-white/60 font-bold uppercase"
                        >
                          {p.userId?.slice(0, 2) || '?'}
                        </div>
                      ))}
                    </div>
                    {slot.attendees.length > 3 && (
                      <span className="text-[10px] text-white/30 font-medium">+{slot.attendees.length - 3} more</span>
                    )}
                    {slot.attendees.length === 1 && (
                      <span className="text-[10px] text-white/30">1 attendee</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
