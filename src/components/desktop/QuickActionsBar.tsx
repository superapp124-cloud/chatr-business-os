import React, { useState } from 'react';
import { MessageSquare, Phone, Video, Users, Sparkles, Calendar, Plus, Hash, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  hoverColor: string;
  bg: string;
  path?: string;
  event?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: MessageSquare, label: 'New Chat', color: 'text-emerald-400', hoverColor: 'hover:bg-emerald-500/20', bg: 'bg-emerald-500/10 border-emerald-500/20', event: 'open-new-chat' },
  { icon: Phone, label: 'Call', color: 'text-blue-400', hoverColor: 'hover:bg-blue-500/20', bg: 'bg-blue-500/10 border-blue-500/20', event: 'open-new-call' },
  { icon: Video, label: 'Video Meeting', color: 'text-violet-400', hoverColor: 'hover:bg-violet-500/20', bg: 'bg-violet-500/10 border-violet-500/20', event: 'open-new-video' },
  { icon: Users, label: 'New Group', color: 'text-amber-400', hoverColor: 'hover:bg-amber-500/20', bg: 'bg-amber-500/10 border-amber-500/20', event: 'open-new-group' },
  { icon: Sparkles, label: 'Ask AI', color: 'text-pink-400', hoverColor: 'hover:bg-pink-500/20', bg: 'bg-pink-500/10 border-pink-500/20', path: '/ai-agents/chat/new' },
  { icon: Calendar, label: 'Schedule', color: 'text-cyan-400', hoverColor: 'hover:bg-cyan-500/20', bg: 'bg-cyan-500/10 border-cyan-500/20', path: '/desktop/calendar' },
  { icon: Hash, label: 'New Ticket', color: 'text-orange-400', hoverColor: 'hover:bg-orange-500/20', bg: 'bg-orange-500/10 border-orange-500/20', path: '/desktop/smart-inbox' },
];

interface QuickActionsBarProps {
  isDark: boolean;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({ isDark }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAction = (action: QuickAction) => {
    if (action.path) {
      navigate(action.path);
    } else if (action.event) {
      window.dispatchEvent(new CustomEvent(action.event));
      if (['open-new-chat', 'open-new-call', 'open-new-video', 'open-new-group'].includes(action.event)) {
        if (!window.location.pathname.includes('/desktop/chat')) {
          navigate('/desktop/chat');
        }
      }
    } else {
      toast.info(`${action.label} coming soon!`);
    }
  };

  return (
    <div 
      className="fixed right-3 top-1/2 -translate-y-1/2 z-40 pointer-events-auto"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* ── Collapsed Vertical Tab ────────────────────────── */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className={cn(
            'flex flex-col items-center gap-2 py-3 px-2 rounded-2xl border transition-all duration-300 shadow-xl cursor-pointer group hover:scale-105',
            isDark 
              ? 'border-white/10 bg-black/40 backdrop-blur-xl text-white/80 hover:bg-black/60 hover:border-indigo-500/40 shadow-black/80' 
              : 'border-zinc-200 bg-white/60 backdrop-blur-xl text-zinc-700 hover:bg-white/90 shadow-zinc-300/40'
          )}
          title="Quick Actions"
        >
          <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 [writing-mode:vertical-lr] rotate-180 my-1">
            Quick Actions
          </span>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      ) : (
        /* ── Expanded Glass Panel ───────────────────────────── */
        <div 
          className={cn(
            'w-56 p-3.5 rounded-3xl border shadow-2xl transition-all duration-300 animate-in slide-in-from-right-4 duration-200 flex flex-col gap-2.5',
            isDark 
              ? 'border-white/15 bg-black/65 backdrop-blur-2xl text-white shadow-black/90' 
              : 'border-zinc-200 bg-white/85 backdrop-blur-2xl text-zinc-900 shadow-zinc-400/50'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-white/90">Quick Actions</span>
            </div>
            <button 
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Action List */}
          <div className="flex flex-col gap-1.5">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => handleAction(action)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-bold transition-all duration-150 cursor-pointer group text-left hover:translate-x-1',
                    action.hoverColor,
                    isDark ? 'text-white/90 hover:text-white bg-white/[0.03] border border-white/5' : 'text-zinc-800 hover:text-zinc-950 bg-zinc-50 border border-zinc-200/60'
                  )}
                >
                  <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center border shrink-0 group-hover:scale-110 transition-transform', action.bg)}>
                    <Icon className={cn('w-3.5 h-3.5', action.color)} />
                  </div>
                  <span className="flex-1 truncate">{action.label}</span>
                </button>
              );
            })}
          </div>

          {/* Footer Customize Button */}
          <button 
            onClick={() => navigate('/settings')}
            className={cn(
              'flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold transition-all mt-1 border cursor-pointer',
              isDark ? 'text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border-white/10' : 'text-zinc-500 hover:text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border-zinc-200'
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Customize Actions</span>
          </button>
        </div>
      )}
    </div>
  );
};
