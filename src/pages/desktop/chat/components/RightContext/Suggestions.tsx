import React from 'react';
import { useLiveActivity } from '@/providers/useLiveActivity';
import { Sparkles, X } from 'lucide-react';

export const Suggestions: React.FC = () => {
 const { activities, isLoading } = useLiveActivity(10);
 
 // Example AI logic: suggest reviewing the latest meeting or unread mentions
 const suggestion = activities.find(a => a.entityType === 'meeting' || a.action.includes('mention'));

 if (isLoading || !suggestion) return null;

 return (
 <div className="bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/20 rounded-xl p-4 relative">
 <button className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors">
 <X className="w-3.5 h-3.5" />
 </button>
 
 <div className="flex items-center gap-1.5 mb-2">
 <Sparkles className="w-3.5 h-3.5 text-blue-400" />
 <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">AI Suggestion</span>
 </div>
 
 <p className="text-secondary font-semibold text-white/90 mb-1">Recent {suggestion.entityType === 'meeting' ? 'Meeting' : 'Mention'}</p>
 <p className="text-label text-white/60 mb-3">{suggestion.description}</p>
 
 <button className="bg-blue-600 hover:bg-blue-500 text-white text-button font-bold py-1.5 px-4 rounded-lg transition-colors">
 Open Context
 </button>
 </div>
 );
};
