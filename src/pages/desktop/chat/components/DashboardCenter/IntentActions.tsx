import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Calendar, IndianRupee, Plane, FileText, Zap, BarChart3, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useExperience, IntentAction } from '@/providers/ExperienceProvider';
import { useCHATROS } from '@/core/os/hooks';
import { triggerCalendarMeeting } from '@/core/capabilities/calendar/CalendarMeetingWorkflow';
import { triggerCabBooking } from '@/core/capabilities/travel/CabBookingWorkflow';

const ICON_MAP: Record<string, React.FC<any>> = {
  UserPlus,
  Calendar,
  IndianRupee,
  Plane,
  FileText,
  Zap,
  BarChart3,
  Search,
};

const GLOW_MAP: Record<string, { bg: string; icon: string; shadow: string }> = {
  UserPlus:     { bg: 'bg-sky-500/15 border-sky-500/20',     icon: 'text-sky-400',     shadow: 'group-hover:shadow-sky-500/20' },
  Calendar:     { bg: 'bg-blue-500/15 border-blue-500/20',   icon: 'text-blue-400',    shadow: 'group-hover:shadow-blue-500/20' },
  IndianRupee:  { bg: 'bg-emerald-500/15 border-emerald-500/20', icon: 'text-emerald-400', shadow: 'group-hover:shadow-emerald-500/20' },
  Plane:        { bg: 'bg-orange-500/15 border-orange-500/20', icon: 'text-orange-400', shadow: 'group-hover:shadow-orange-500/20' },
  FileText:     { bg: 'bg-violet-500/15 border-violet-500/20', icon: 'text-violet-400', shadow: 'group-hover:shadow-violet-500/20' },
  Zap:          { bg: 'bg-yellow-500/15 border-yellow-500/20', icon: 'text-yellow-400', shadow: 'group-hover:shadow-yellow-500/20' },
  BarChart3:    { bg: 'bg-pink-500/15 border-pink-500/20',   icon: 'text-pink-400',    shadow: 'group-hover:shadow-pink-500/20' },
  Search:       { bg: 'bg-indigo-500/15 border-indigo-500/20', icon: 'text-indigo-400', shadow: 'group-hover:shadow-indigo-500/20' },
};

export const IntentActions: React.FC = () => {
  const navigate = useNavigate();
  const { experience } = useExperience();
  const chatrOS = useCHATROS();

  const handleExecuteIntent = (intentLabel: string) => {
    chatrOS.submitIntent(intentLabel);
    const labelLower = intentLabel.toLowerCase();

    if (labelLower.includes('hire') || labelLower.includes('recruitment')) {
      toast.success('Opening Recruiter Workspace...');
      navigate('/desktop/recruitment');
    } else if (labelLower.includes('meeting') || labelLower.includes('calendar')) {
      toast.info('Triggering Calendar Meeting Workflow...');
      triggerCalendarMeeting({ title: 'Workspace Synch', date: '2026-07-24', time: '10:00 AM', participants: ['Team'] });
      navigate('/desktop/calendar');
    } else if (labelLower.includes('vendor') || labelLower.includes('pay') || labelLower.includes('payroll')) {
      toast.success('Opening Finance & Vendor Payments...');
      navigate('/desktop/business-os');
    } else if (labelLower.includes('trip') || labelLower.includes('flight') || labelLower.includes('plan')) {
      toast.info('Launching Trip & Cab Booking Workflow...');
      triggerCabBooking({ pickup: 'Office', destination: 'Airport' });
    } else if (labelLower.includes('invoice')) {
      toast.success('Opening Invoices in CRM...');
      navigate('/desktop/pro/business/crm');
    } else if (labelLower.includes('workflow') || labelLower.includes('build')) {
      toast.success('Opening Workflow Studio...');
      navigate('/desktop/studio');
    } else if (labelLower.includes('sales') || labelLower.includes('analyze')) {
      toast.success('Opening Sales Analytics...');
      navigate('/desktop/pro/business/crm');
    } else if (labelLower.includes('search')) {
      toast.info('Opening Global Search Command Palette (⌘K)...');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    } else {
      toast.info(`Executing intent: ${intentLabel}`);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {experience.primaryIntents.map((intent: IntentAction) => {
        const Icon = ICON_MAP[intent.iconName] || Search;
        const colors = GLOW_MAP[intent.iconName] || GLOW_MAP.Search;

        return (
          <button
            key={intent.id}
            onClick={() => handleExecuteIntent(intent.label)}
            className={`group flex items-center gap-3.5 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all text-left shadow-md hover:shadow-lg ${colors.shadow} hover:scale-[1.01] active:scale-[0.99] cursor-pointer`}
          >
            {/* Icon container */}
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${colors.bg}`}>
              <Icon className={`w-5 h-5 ${colors.icon}`} />
            </div>
            {/* Text */}
            <div className="min-w-0">
              <span className="text-sm font-bold text-white/90 group-hover:text-white transition-colors block truncate">
                {intent.label}
              </span>
              <span className="text-xs text-white/35 font-medium">Tap to execute</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
