import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle, Clock, ArrowRight, Zap, Brain, Bell } from 'lucide-react';
import { toast } from 'sonner';

const RUNNING = [
  { label: 'Sales Automation',    route: '/desktop/studio',      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { label: 'Invoice Processor',   route: '/desktop/pro/business/crm', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { label: 'Candidate Screening', route: '/desktop/recruitment', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
];

const WAITING = [
  { label: 'Approval Required',     route: '/desktop/tickets',     icon: Clock, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  { label: 'Meeting in 18 min',     route: '/desktop/calls',       icon: Bell,  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { label: '2 messages need reply', route: '/desktop/smart-inbox', icon: Clock, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
];

export const RightContextPanel: React.FC = () => {
  const navigate = useNavigate();

  const handleRunningClick = (item: typeof RUNNING[0]) => {
    toast.info(`Opening ${item.label} execution log...`);
    navigate(item.route);
  };

  const handleWaitingClick = (item: typeof WAITING[0]) => {
    toast.info(`Opening ${item.label}...`);
    navigate(item.route);
  };

  const handleSuggestedClick = () => {
    toast.success('Opening CHATR AI to compose proposal email to John...');
    window.dispatchEvent(new CustomEvent('open-chatr-ai'));
  };

  return (
    <div className="w-[300px] lg:w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col h-full overflow-hidden relative bg-[#0d0c1c]/90 backdrop-blur-2xl border-l border-white/[0.07]">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/10 blur-[70px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-600/8 blur-[60px] rounded-full pointer-events-none" />

      {/* Panel header */}
      <div className="relative z-10 px-5 py-4 flex items-center justify-between border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md overflow-hidden border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)] shrink-0">
            <img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-full h-full object-cover" />
          </div>
          <span className="text-xs font-black text-white/80 uppercase tracking-[0.18em]">AI Context</span>
        </div>
        {/* Online indicator */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400/70 font-semibold">Active</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar px-5 py-6 space-y-7">

        {/* ── Running ───────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-white/25" />
            <h3 className="text-[10px] font-black text-white/35 uppercase tracking-[0.22em]">Running</h3>
          </div>
          <ul className="space-y-2">
            {RUNNING.map((item) => (
              <li
                key={item.label}
                onClick={() => handleRunningClick(item)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] ${item.bg}`}
              >
                <CheckCircle className={`w-4 h-4 shrink-0 ${item.color}`} />
                <span className="text-sm font-semibold text-white/85 truncate">{item.label}</span>
                {/* Animated processing dots */}
                <span className="ml-auto flex gap-0.5 shrink-0">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full bg-emerald-400/50 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06]" />

        {/* ── Waiting ───────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-white/25" />
            <h3 className="text-[10px] font-black text-white/35 uppercase tracking-[0.22em]">Waiting</h3>
          </div>
          <ul className="space-y-2">
            {WAITING.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  onClick={() => handleWaitingClick(item)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] ${item.bg}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                  <span className="text-sm font-semibold text-white/85 truncate">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06]" />

        {/* ── Memory ────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-3.5 h-3.5 text-white/25" />
            <h3 className="text-[10px] font-black text-white/35 uppercase tracking-[0.22em]">Memory</h3>
          </div>
          <div className="relative p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            {/* Left accent bar */}
            <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-gradient-to-b from-violet-500 to-indigo-500 rounded-full" />
            <p className="text-sm text-white/75 leading-relaxed pl-1">
              Yesterday you promised <span className="text-violet-300 font-semibold">John</span> the proposal.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06]" />

        {/* ── Suggested Action ──────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-white/25" />
            <h3 className="text-[10px] font-black text-white/35 uppercase tracking-[0.22em]">Suggested</h3>
          </div>
          <button
            onClick={handleSuggestedClick}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all flex items-center justify-between group shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <span className="font-bold text-sm">Send proposal now</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>
    </div>
  );
};
