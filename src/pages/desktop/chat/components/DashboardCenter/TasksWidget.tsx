import React from 'react';
import { useLiveTasks } from '@/providers/useLiveTasks';
import { CheckCircle2, Circle, ListTodo, Plus } from 'lucide-react';
import { format } from 'date-fns';

const PRIORITY_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  critical: { label: 'Critical', badge: 'bg-red-500/15 text-red-400 border-red-500/25',     dot: 'bg-red-400' },
  high:     { label: 'High',     badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', dot: 'bg-orange-400' },
  medium:   { label: 'Medium',   badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25', dot: 'bg-yellow-400' },
  low:      { label: 'Low',      badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
};

export const TasksWidget: React.FC = () => {
  const { tasks, isLoading, isEmpty } = useLiveTasks();

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const totalCount = tasks.length;
  const completionPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden flex-1 flex flex-col min-h-[200px] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
            <ListTodo className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Tasks</h2>
          {totalCount > 0 && (
            <span className="text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
              {doneCount}/{totalCount}
            </span>
          )}
        </div>
        <button className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors">View all</button>
      </div>

      {/* Completion progress bar */}
      {totalCount > 0 && (
        <div className="px-5 pt-3 pb-1">
          <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-1000"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-[10px] text-white/30 mt-1 font-medium">{completionPct}% complete</p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {isLoading && tasks.length === 0 ? (
          <div className="space-y-3 animate-pulse pt-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex justify-between items-center px-1 gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-5 h-5 rounded-full bg-white/[0.08] shrink-0" />
                  <div className="h-3 bg-white/[0.08] rounded-full flex-1" />
                </div>
                <div className="h-5 bg-white/[0.06] rounded-full w-14" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 shadow-inner">
              <ListTodo className="w-6 h-6 text-violet-400/40" />
            </div>
            <p className="text-sm font-bold text-white/70 mb-1">Tasks & To-Dos</p>
            <p className="text-xs text-white/35 leading-relaxed max-w-[200px]">
              Create tasks for yourself or assign them to your team to track progress here.
            </p>
          </div>
        ) : (
          tasks.map(task => {
            const pkey = (task.priority || 'medium').toLowerCase();
            const config = PRIORITY_CONFIG[pkey] || PRIORITY_CONFIG.medium;
            const isDone = task.status === 'done';
            return (
              <div key={task.id} className="flex items-center justify-between group p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors gap-3">
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <button className="text-white/20 hover:text-emerald-400 transition-colors shrink-0">
                    {isDone
                      ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                      : <Circle className="w-4.5 h-4.5" />}
                  </button>
                  <p className={`text-sm font-semibold truncate leading-tight ${isDone ? 'line-through text-white/30' : 'text-white/85'}`}>
                    {task.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold capitalize ${config.badge}`}>
                    {config.label}
                  </span>
                  <span className="text-[11px] text-white/30 w-14 text-right font-mono">
                    {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '—'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
