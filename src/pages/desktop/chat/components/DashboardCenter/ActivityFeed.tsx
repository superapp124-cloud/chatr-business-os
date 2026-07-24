import React from 'react';
import { useLiveActivity } from '@/providers/useLiveActivity';
import { FileText, CheckCircle2, Video, AtSign, Settings, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ICON_CONFIG: Record<string, { icon: React.ReactNode; dot: string }> = {
  file:    { icon: <FileText className="w-4 h-4 text-blue-400" />,    dot: 'bg-blue-400' },
  system:  { icon: <Settings className="w-4 h-4 text-slate-400" />,   dot: 'bg-slate-400' },
  success: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, dot: 'bg-emerald-400' },
  meeting: { icon: <Video className="w-4 h-4 text-orange-400" />,     dot: 'bg-orange-400' },
  mention: { icon: <AtSign className="w-4 h-4 text-yellow-400" />,    dot: 'bg-yellow-400' },
};

export const ActivityFeed: React.FC = () => {
  const { activities, isLoading, isEmpty } = useLiveActivity(10);

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden flex-1 flex flex-col min-h-[200px] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/20 flex items-center justify-center">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Live Activity</h2>
          {/* Live pulse */}
          <span className="flex items-center gap-1 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400/80 font-semibold">Live</span>
          </span>
        </div>
        <button className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors">View all</button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {isLoading && activities.length === 0 ? (
          <div className="space-y-3 animate-pulse pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 items-start px-1">
                <div className="w-8 h-8 rounded-full bg-white/[0.06] shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 bg-white/[0.08] rounded-full w-3/4" />
                  <div className="h-2 bg-white/[0.05] rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 shadow-inner">
              <CheckCircle2 className="w-6 h-6 text-emerald-400/40" />
            </div>
            <p className="text-sm font-bold text-white/70 mb-1">Activity Feed</p>
            <p className="text-xs text-white/35 leading-relaxed max-w-[200px]">
              Real-time updates when your team sends messages, completes tasks, or joins meetings.
            </p>
          </div>
        ) : (
          activities.map(act => {
            const iconType = act.metadata?.originalType || act.entityType || 'system';
            const config = ICON_CONFIG[iconType] || ICON_CONFIG.system;
            return (
              <div key={act.id} className="flex gap-3 items-start group p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-default">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.10] transition-colors">
                    {config.icon}
                  </div>
                  {/* Colored dot */}
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0b0b14] ${config.dot}`} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-white/85 truncate leading-tight">{act.description}</p>
                  {act.metadata?.preview && (
                    <p className="text-xs text-white/40 truncate mt-0.5">{act.metadata.preview}</p>
                  )}
                </div>
                <span className="text-[10px] text-white/25 shrink-0 pt-0.5 font-mono">
                  {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
