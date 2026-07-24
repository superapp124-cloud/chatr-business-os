import React from 'react';
import { useLiveTasks } from '@/providers/useLiveTasks';

export const AIContext: React.FC = () => {
 const { tasks, isLoading } = useLiveTasks();
 
 // Find the top priority critical task
 const topPriority = tasks.find(t => t.priority === 'critical' && t.status !== 'done');

 if (isLoading || !topPriority) return null;

 return (
 <div className="space-y-3">
 <span className="text-label font-semibold text-violet-400">Top Priority</span>
 <div className="bg-violet-900/20 border border-violet-500/20 rounded-xl p-4">
 <h3 className="text-secondary font-semibold text-white/90 mb-1 line-clamp-2">{topPriority.title}</h3>
 {topPriority.description && (
 <p className="text-label text-white/50 mb-3 line-clamp-2">{topPriority.description}</p>
 )}
 <button className="bg-violet-600 hover:bg-violet-500 text-white text-button font-bold py-1.5 px-4 rounded-lg transition-colors mt-2">
 Review Now
 </button>
 </div>
 </div>
 );
};
