import React from 'react';
import { useLiveTasks } from '@/providers/useLiveTasks';
import { Layout, FolderKanban } from 'lucide-react';

const GRADIENT_COLORS = [
  'from-violet-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-sky-500 to-blue-500',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
];

const ICON_COLORS = [
  'text-violet-400 bg-violet-500/15 border-violet-500/20',
  'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
  'text-sky-400 bg-sky-500/15 border-sky-500/20',
  'text-orange-400 bg-orange-500/15 border-orange-500/20',
  'text-pink-400 bg-pink-500/15 border-pink-500/20',
];

export const ProjectsWidget: React.FC = () => {
  const { tasks, isLoading, isEmpty } = useLiveTasks();

  const lists = React.useMemo(() => {
    const grouped: Record<string, any> = {};
    tasks.forEach(t => {
      const lid = t.listId || 'uncategorized';
      if (!grouped[lid]) grouped[lid] = { id: lid, name: lid === 'uncategorized' ? 'Inbox' : `List ${lid.slice(0, 4)}`, total: 0, done: 0 };
      grouped[lid].total++;
      if (t.status === 'done') grouped[lid].done++;
    });
    return Object.values(grouped).map((g, i) => ({
      ...g,
      progress: g.total > 0 ? Math.round((g.done / g.total) * 100) : 0,
      gradient: GRADIENT_COLORS[i % GRADIENT_COLORS.length],
      iconColor: ICON_COLORS[i % ICON_COLORS.length],
    }));
  }, [tasks]);

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden flex-1 flex flex-col min-h-[200px] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/20 flex items-center justify-center">
            <FolderKanban className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Projects</h2>
          {lists.length > 0 && (
            <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
              {lists.length}
            </span>
          )}
        </div>
        <button className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors">View all</button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {isLoading && lists.length === 0 ? (
          <div className="space-y-4 animate-pulse pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 items-center px-1">
                <div className="w-9 h-9 rounded-xl bg-white/[0.08] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/[0.08] rounded-full w-1/3" />
                  <div className="h-1.5 bg-white/[0.05] rounded-full w-full" />
                </div>
                <div className="h-4 bg-white/[0.06] rounded w-8" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 shadow-inner">
              <Layout className="w-6 h-6 text-sky-400/40" />
            </div>
            <p className="text-sm font-bold text-white/70 mb-1">Projects Overview</p>
            <p className="text-xs text-white/35 leading-relaxed max-w-[200px]">
              Group your tasks into lists to automatically track project progress and milestones.
            </p>
          </div>
        ) : (
          lists.map(proj => (
            <div key={proj.id} className="flex items-center gap-3.5 group p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors">
              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${proj.iconColor}`}>
                <Layout className="w-4 h-4" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold text-white/90 truncate">{proj.name}</p>
                  <span className="text-xs font-mono text-white/50 ml-2 shrink-0">{proj.progress}%</span>
                </div>
                {/* Gradient progress bar */}
                <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r rounded-full transition-all duration-1000 ${proj.gradient}`}
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/30 mt-1">{proj.done}/{proj.total} tasks done</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
