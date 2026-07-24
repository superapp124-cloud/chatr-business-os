import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { IntentActions } from './IntentActions';
import { AIBriefHero } from './AIBriefHero';
import { AIInsights } from './AIInsights';
import { ActivityFeed } from './ActivityFeed';
import { ProjectsWidget } from './ProjectsWidget';
import { TasksWidget } from './TasksWidget';
import { CalendarWidget } from './CalendarWidget';
import { UniversalCommandBar } from './UniversalCommandBar';
import { useExperience } from '@/providers/ExperienceProvider';

export const DashboardCenterPanel: React.FC<{
  onCreateNew?: () => void;
  onNewChat?: () => void;
}> = ({ onCreateNew, onNewChat }) => {
  const { experience } = useExperience();

  return (
    <div className="flex-1 flex flex-col relative z-10 bg-[#0b0b14] overflow-hidden">
      {/* Subtle ambient background orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6 lg:p-8 flex flex-col gap-7 min-h-full">

          {/* ── 1. Header ─────────────────────────────────────────── */}
          <DashboardHeader onCreateNew={onCreateNew} />

          {/* ── 2. Command Bar ────────────────────────────────────── */}
          <UniversalCommandBar />

          {/* ── 3. AI Brief Hero ──────────────────────────────────── */}
          {experience.dashboard.showAIBrief && <AIBriefHero />}

          {/* ── 4. Primary Actions ────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.22em] mb-4 pl-0.5">
              Primary Actions
            </p>
            <IntentActions />
          </div>

          {/* ── 5. Widgets Row ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-5">
            {/* Left column */}
            <div className="flex flex-col gap-5">
              {experience.dashboard.widgets.includes('activity') && <ActivityFeed />}
              {experience.dashboard.widgets.includes('projects') && <ProjectsWidget />}
            </div>
            {/* Right column */}
            <div className="flex flex-col gap-5">
              {experience.dashboard.widgets.includes('tasks') && <TasksWidget />}
            </div>
          </div>

          {/* ── 6. Calendar (full-width) ──────────────────────────── */}
          {experience.dashboard.widgets.includes('calendar') && <CalendarWidget />}

        </div>
      </div>
    </div>
  );
};
