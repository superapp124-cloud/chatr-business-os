import React, { useState } from 'react';
import {
  Brain, Users, FileText, Calendar, Sparkles, Search,
  ArrowRight, Clock, Hash, Link2, Loader2, Plus, BookOpen,
  Network, Lightbulb, ChevronRight, AlertTriangle, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCHATROS } from '@/core/os/hooks';

interface KnowledgeBrainPanelProps {
  onNodeClick?: (node: any) => void;
}

const AI_OBSERVATIONS = [
  { text: 'Project Apollo has 3 active blockers', type: 'risk', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  { text: 'Rajesh Kumar connected to 2 active requisitions', type: 'candidate', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { text: 'Invoice INV-304 affects Project Apollo budget', type: 'invoice', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { text: '4 meetings reference Master Service Agreement.pdf', type: 'contract', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  { text: 'Candidate score (94%) matches Backend Lead position', type: 'ai', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
];

export const KnowledgeBrainPanel: React.FC<KnowledgeBrainPanelProps> = ({ onNodeClick }) => {
  const { observeText } = useCHATROS();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="w-[280px] shrink-0 flex flex-col border-l border-white/[0.06] bg-[#0d0f1a] overflow-hidden select-none">
      {/* Header */}
      <div className="px-3.5 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-wider text-white">AI Reasoning Engine</span>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Active</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search AI memory & reasoning..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3.5 space-y-4">

          {/* Graph Health Telemetry Card */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Knowledge Health</span>
              </div>
              <span className="text-xs font-black text-emerald-400 font-mono">94%</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full w-[94%]" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {[
                { label: 'Broken Links', val: '2', color: 'text-amber-400' },
                { label: 'Orphan Nodes', val: '4', color: 'text-slate-400' },
                { label: 'Missing Owners', val: '6', color: 'text-purple-400' },
                { label: 'Duplicate Docs', val: '3', color: 'text-rose-400' },
              ].map((metric, i) => (
                <div key={i} className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] text-white/50">{metric.label}</span>
                  <span className={cn("text-[10px] font-bold font-mono", metric.color)}>{metric.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Observations Panel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-purple-400" /> AI Observations
              </span>
              <span className="text-[9px] text-purple-400 font-mono">Live Sync</span>
            </div>

            <div className="space-y-2">
              {AI_OBSERVATIONS.map((obs, i) => (
                <div
                  key={i}
                  onClick={() => observeText(obs.text)}
                  className={cn(
                    'p-2.5 rounded-xl border text-[11px] font-medium leading-snug cursor-pointer transition-all hover:scale-[1.01]',
                    obs.color
                  )}
                >
                  <p>{obs.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Graph Exploration Prompts */}
          <div>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">
              Suggested Graph Queries
            </span>
            <div className="space-y-1.5">
              {[
                'Why is Project Apollo delayed?',
                'Show everyone connected to Rajesh',
                'Which documents relate to Legal MSA?',
                'Explain candidate offer pipeline'
              ].map((query, i) => (
                <button
                  key={i}
                  onClick={() => observeText(query)}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] text-[10px] text-white/60 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span className="truncate">{query}</span>
                  <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/60 shrink-0" />
                </button>
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};
