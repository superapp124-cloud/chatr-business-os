import React from 'react';
import { Search, Sparkles, Mic, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TimelineTopbarProps {
 searchQuery: string;
 setSearchQuery: (val: string) => void;
 avatarUrl?: string;
}

export const TimelineTopbar: React.FC<TimelineTopbarProps> = ({ searchQuery, setSearchQuery, avatarUrl }) => {
 return (
 <div className="h-20 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-30">
 {/* Search Bar */}
 <div className="relative w-full max-w-2xl">
 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
 <Search className="h-4 w-4 text-slate-400" />
 </div>
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Ask CHATR Intelligence..."
 className="block w-full pl-11 pr-20 py-3 bg-[#13131a] border border-white/10 rounded-full text-secondary text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
 />
 <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
 <button className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-indigo-400">
 <Sparkles className="h-4 w-4" />
 </button>
 <button className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400">
 <Mic className="h-4 w-4" />
 </button>
 </div>
 </div>

 {/* Right Actions */}
 <div className="flex items-center gap-6 ml-4">
 <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-label ">
 <ShieldCheck className="w-3.5 h-3.5" />
 <span>100% Local • Encrypted</span>
 </div>
 <Avatar className="w-9 h-9 border border-white/10 shadow-lg cursor-pointer hover:opacity-80 transition-opacity">
 <AvatarImage src={avatarUrl} />
 <AvatarFallback className="bg-indigo-600 text-white text-label">ME</AvatarFallback>
 </Avatar>
 </div>
 </div>
 );
};
