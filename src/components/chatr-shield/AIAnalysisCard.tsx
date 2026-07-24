import React from 'react';
import { Shield, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIAnalysisCardProps {
 summary: string;
 flags: string[];
 band: 'safe' | 'verify' | 'block';
 className?: string;
}

const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({ summary, flags, band, className }) => {
 const bandColors = {
 safe: 'bg-green-500/5 border-green-500/10 text-green-500/80',
 verify: 'bg-amber-500/5 border-amber-500/10 text-amber-500/80',
 block: 'bg-red-500/5 border-red-500/10 text-red-500/80',
 };

 return (
 <div className={cn(
 "rounded-xl border p-4 bg-zinc-900/50 backdrop-blur-sm",
 className
 )}>
 <div className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
 <Shield size={12} className="text-primary" />
 <span>Chatr AI Analysis</span>
 </div>
 
 <p className="text-[15px] leading-relaxed text-zinc-200 mb-4">
 <span className="text-primary font-bold">Chatr AI:</span> {summary}
 </p>
 
 {flags.length > 0 && (
 <div className="space-y-2">
 {flags.map((flag, i) => (
 <div key={i} className="flex items-start gap-2 text-label text-zinc-400">
 <div className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
 <span>{flag}</span>
 </div>
 ))}
 </div>
 )}
 
 <div className="mt-4 flex items-center gap-1 text-[10px] text-zinc-600">
 <Info size={10} />
 <span>Powered by Chatr Shield Architecture</span>
 </div>
 </div>
 );
};

export default AIAnalysisCard;
