import React, { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { useCHATROS } from '@/core/os/hooks';

export const UniversalCommandBar: React.FC = () => {
 const [query, setQuery] = useState('');
 const chatrOS = useCHATROS();

 return (
 <div className="w-full mt-4 mb-2">
 <div className="bg-[#11111a] border border-white/10 hover:border-violet-500/50 transition-colors rounded-2xl p-4 flex items-center gap-4 shadow-xl group">
 <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
 <Sparkles className="w-5 h-5 text-violet-400" />
 </div>
 
 <input 
 type="text" 
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && query.trim()) {
 chatrOS.submitIntent(query.trim());
 setQuery('');
 }
 }}
 placeholder='Search anything... try "book hotel in Srinagar" or "create payroll"' 
 className="flex-1 bg-transparent border-none outline-none text-section text-white placeholder-white/30 font-medium"
 />

 <div className="flex items-center gap-2 pr-2">
 <span className="text-label font-bold text-white/30 bg-white/5 px-2 py-1 rounded border border-white/5">⌘ K</span>
 </div>
 </div>
 </div>
 );
};
