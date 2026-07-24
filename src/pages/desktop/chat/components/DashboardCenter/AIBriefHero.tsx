import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, IndianRupee, MessageSquare, FileText, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useCHATROS } from '@/core/os/hooks';
import { triggerFlightBooking } from '@/core/capabilities/travel/FlightBookingWorkflow';

const insights = [
  {
    text: <>Revenue is <span className="text-emerald-400 font-bold">12% higher</span> than yesterday.</>,
    dot: 'bg-emerald-400 shadow-emerald-400/60',
    tag: 'Revenue',
    tagColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  },
  {
    text: <>Payroll approval is <span className="text-amber-400 font-bold">pending</span>.</>,
    dot: 'bg-amber-400 shadow-amber-400/60',
    tag: 'Action Required',
    tagColor: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  },
  {
    text: <><span className="text-red-400 font-bold">6 customers</span> haven't received replies.</>,
    dot: 'bg-red-400 shadow-red-400/60',
    tag: 'Urgent',
    tagColor: 'bg-red-500/15 text-red-300 border-red-500/25',
  },
  {
    text: <>One <span className="text-orange-400 font-bold">automation failed</span>.</>,
    dot: 'bg-orange-400 shadow-orange-400/60',
    tag: 'System',
    tagColor: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  },
  {
    text: <>Your Srinagar trip can be booked <span className="text-emerald-400 font-bold">₹4,500 cheaper</span> today.</>,
    dot: 'bg-violet-400 shadow-violet-400/60',
    tag: 'Opportunity',
    tagColor: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  },
  {
    text: <>Sales team completed <span className="text-sky-400 font-bold">87%</span> of this month's target.</>,
    dot: 'bg-sky-400 shadow-sky-400/60',
    tag: 'Progress',
    tagColor: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  },
];

export const AIBriefHero: React.FC = () => {
  const navigate = useNavigate();
  const chatrOS = useCHATROS();

  const handleAction = (label: string) => {
    switch (label) {
      case 'Approve Payroll':
        toast.success('Navigating to Business OS Payroll Approval...');
        navigate('/desktop/business-os');
        break;
      case 'Reply to Customers':
        toast.success('Opening Smart Inbox unread messages...');
        navigate('/desktop/smart-inbox');
        break;
      case 'Book Flights':
        toast.info('Launching Flight Booking Workflow...');
        chatrOS.submitIntent('Book Flights to Srinagar');
        triggerFlightBooking({ origin: 'Delhi', destination: 'Srinagar', date: '2026-07-25' });
        break;
      case 'Review Sales':
        toast.success('Opening CRM Sales Analytics...');
        navigate('/desktop/pro/business/crm');
        break;
      default:
        chatrOS.submitIntent(label);
        break;
    }
  };

  const actions = [
    {
      label: 'Approve Payroll',
      icon: IndianRupee,
      iconClass: 'text-emerald-400',
      bg: 'bg-emerald-500/15 border-emerald-500/25 hover:bg-emerald-500/25 hover:border-emerald-500/40',
      glow: 'hover:shadow-emerald-500/20',
    },
    {
      label: 'Reply to Customers',
      icon: MessageSquare,
      iconClass: 'text-sky-400',
      bg: 'bg-sky-500/15 border-sky-500/25 hover:bg-sky-500/25 hover:border-sky-500/40',
      glow: 'hover:shadow-sky-500/20',
    },
    {
      label: 'Book Flights',
      icon: TrendingUp,
      iconClass: 'text-orange-400',
      bg: 'bg-orange-500/15 border-orange-500/25 hover:bg-orange-500/25 hover:border-orange-500/40',
      glow: 'hover:shadow-orange-500/20',
    },
    {
      label: 'Review Sales',
      icon: FileText,
      iconClass: 'text-violet-400',
      bg: 'bg-violet-500/15 border-violet-500/25 hover:bg-violet-500/25 hover:border-violet-500/40',
      glow: 'hover:shadow-violet-500/20',
    },
  ];

  return (
    <div className="w-full shrink-0 relative overflow-hidden rounded-2xl mt-4" style={{ background: 'linear-gradient(135deg, #1a1040 0%, #0d0b1f 50%, #0a091a 100%)' }}>
      {/* Ambient glows */}
      <div className="absolute -top-16 -left-16 w-72 h-72 bg-violet-600/20 blur-[90px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-16 -right-8 w-64 h-64 bg-indigo-600/15 blur-[80px] rounded-full pointer-events-none" />

      {/* Border gradient overlay */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.10] pointer-events-none" />

      <div className="relative z-10 p-7">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-violet-500/40 shadow-lg shadow-violet-500/20 shrink-0">
            <img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Today I noticed</h2>
            <p className="text-xs text-white/40 mt-0.5">AI-curated briefing · Updated just now</p>
          </div>
          {/* Live dot */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400/80 font-medium">Live</span>
          </div>
        </div>

        {/* Insights list */}
        <ul className="space-y-3 mb-7">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-center gap-3 group">
              <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px] ${insight.dot}`} />
              <span className="text-[15px] text-white/85 font-medium flex-1 leading-snug">{insight.text}</span>
              <span className={`hidden sm:inline-flex shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide ${insight.tagColor}`}>
                {insight.tag}
              </span>
            </li>
          ))}
        </ul>

        {/* Divider */}
        <div className="h-px bg-white/[0.07] mb-5" />

        {/* Action row */}
        <div>
          <h3 className="text-[10px] font-black text-white/35 uppercase tracking-[0.22em] mb-3">What would you like to do?</h3>
          <div className="flex flex-wrap items-center gap-2.5">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleAction(action.label)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold text-white transition-all shadow-lg ${action.bg} ${action.glow} hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
              >
                <action.icon className={`w-4 h-4 ${action.iconClass}`} />
                {action.label}
              </button>
            ))}

            {/* Primary CTA */}
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-chatr-ai'));
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-sm font-bold text-white transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] ml-auto cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Open CHATR AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
