import React, { useMemo } from 'react';
import { useLiveTasks } from '@/providers/useLiveTasks';

export const AIInsights: React.FC = () => {
 const { tasks, isLoading } = useLiveTasks();

 const { chartData, productivity, onTrack, needAttention } = useMemo(() => {
 // Generate derived stats based on live tasks
 const total = tasks.length;
 const completed = tasks.filter(t => t.status === 'done').length;
 const critical = tasks.filter(t => t.priority === 'critical' && t.status !== 'done').length;
 
 // Generate chart data with smooth trend based on completion % and index
 const base = total > 0 ? (completed / total) * 100 : 50;
 const chart = Array.from({ length: 7 }).map((_, i) => {
   // Smooth deterministic curve trending upwards towards current completion rate
   const trendFactor = (i / 6) * 0.4 + 0.8;
   const value = Math.min(100, Math.max(10, Math.round(base * trendFactor)));
   return { value };
 });

 return {
 chartData: chart,
 productivity: total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%',
 onTrack: total - completed - critical,
 needAttention: critical
 };
 }, [tasks]);

 // Render SVG area chart
 const maxValue = 100;
 const points = chartData.map((d, i) => {
 const x = (i / (chartData.length - 1)) * 100;
 const y = 100 - (d.value / maxValue) * 100;
 return `${x},${y}`;
 });
 const pathData = `M 0,100 L ${points.join(' L ')} L 100,100 Z`;
 const lineData = `M ${points.join(' L ')}`;

 return (
 <div className="bg-gradient-to-br from-violet-900/40 to-indigo-900/20 border border-violet-500/20 rounded-2xl p-4 relative overflow-hidden group flex-1 flex flex-col h-full min-h-[150px]">
 <div className="relative z-10 flex-1 flex flex-col">
 <div className="flex items-center justify-between mb-2">
 <h2 className="text-secondary font-bold text-white/90">AI Insights</h2>
 <button className="text-[10px] text-violet-400 hover:text-violet-300">View all</button>
 </div>
 
 {isLoading ? (
 <div className="animate-pulse space-y-4">
 <div className="h-6 bg-white/10 rounded w-3/4 mb-4" />
 <div className="h-4 bg-white/5 rounded w-1/2" />
 <div className="h-4 bg-white/5 rounded w-2/3" />
 </div>
 ) : tasks.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center text-center px-4 min-h-[120px]">
 <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
 <span className="text-workspace">✨</span>
 </div>
 <p className="text-secondary font-semibold text-white/90">AI Intelligence</p>
 <p className="text-label text-white/50 mt-2">Start collaborating and CHATR will analyze your team's productivity and automatically highlight critical items here.</p>
 </div>
 ) : (
 <>
 <p className="text-workspace font-bold text-white mb-2">
 {parseInt(productivity) > 50 ? 'Your team productivity is high 🚀' : 'There is room for improvement 👀'}
 </p>
 
 <ul className="space-y-1 mb-6 max-h-[80px] overflow-hidden">
 <li className="text-label text-white/70 flex items-center gap-2">
 <span className="w-1 h-1 rounded-full bg-violet-400" />
 {needAttention > 0 ? `${needAttention} critical tasks need your attention.` : 'All critical tasks are cleared!'}
 </li>
 <li className="text-label text-white/70 flex items-center gap-2">
 <span className="w-1 h-1 rounded-full bg-violet-400" />
 {onTrack} tasks are currently on track for completion.
 </li>
 </ul>

 <div className="grid grid-cols-3 gap-4 mt-auto">
 <div>
 <p className="text-page font-bold text-white">{productivity}</p>
 <p className="text-[10px] text-white/50 uppercase tracking-wider">Productivity</p>
 </div>
 <div>
 <p className="text-page font-bold text-white">{onTrack}</p>
 <p className="text-[10px] text-white/50 uppercase tracking-wider">On Track</p>
 </div>
 <div>
 <p className="text-page font-bold text-white">{needAttention}</p>
 <p className="text-[10px] text-white/50 uppercase tracking-wider">Need Attention</p>
 </div>
 </div>
 </>
 )}
 </div>

 <div className="absolute inset-x-0 bottom-0 h-[150px] pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-500">
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
 <defs>
 <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
 <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.4" />
 <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.0" />
 </linearGradient>
 </defs>
 <path d={pathData} fill="url(#chartGradient)" />
 <path d={lineData} fill="none" stroke="rgb(139, 92, 246)" strokeWidth="1.5" className="drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
 </svg>
 </div>
 </div>
 );
};
