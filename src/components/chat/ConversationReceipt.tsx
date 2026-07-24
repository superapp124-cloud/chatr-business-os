import React from 'react';
import { CheckCircle2, RotateCcw, Calendar, Bell, Plane, Building2 } from 'lucide-react';

interface ConversationReceiptProps {
 type: string;
 title: string;
 details: { label: string; value: string }[];
 onUndo?: () => void;
}

const ICONS: Record<string, React.ReactNode> = {
 REMINDER: <Bell className="w-4 h-4" />,
 MEETING: <Calendar className="w-4 h-4" />,
 FLIGHT: <Plane className="w-4 h-4" />,
 HOTEL: <Building2 className="w-4 h-4" />,
 DEFAULT: <CheckCircle2 className="w-4 h-4" />
};

export const ConversationReceipt: React.FC<ConversationReceiptProps> = ({ type, title, details, onUndo }) => {
 const icon = ICONS[type.toUpperCase()] || ICONS.DEFAULT;

 return (
 <div className="w-full flex justify-center my-4">
 <div className="max-w-[320px] w-full bg-emerald-500/[0.03] border border-emerald-500/20 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm relative group">
 <div className="px-4 py-3 border-b border-emerald-500/10 flex items-center gap-2">
 <div className="text-emerald-500">
 {icon}
 </div>
 <span className="text-[12px] font-bold tracking-widest uppercase text-emerald-500/90">{type} Created</span>
 </div>
 
 <div className="px-4 py-3 space-y-3">
 <p className="text-[14px] font-semibold text-white/90 leading-tight">
 {title}
 </p>
 
 {details.length > 0 && (
 <div className="space-y-1.5">
 {details.map((detail, idx) => (
 <div key={idx} className="flex items-center justify-between text-[11px]">
 <span className="text-white/40 font-medium">{detail.label}</span>
 <span className="text-white/80">{detail.value}</span>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="px-4 py-2.5 bg-black/20 flex items-center justify-between border-t border-emerald-500/10">
 <div className="flex items-center gap-1.5 text-emerald-500/80">
 <CheckCircle2 className="w-3 h-3" />
 <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
 </div>
 
 {onUndo && (
 <button 
 onClick={onUndo}
 className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors"
 >
 <RotateCcw className="w-3 h-3" />
 <span className="text-[10px] font-bold uppercase tracking-wider">Undo</span>
 </button>
 )}
 </div>
 </div>
 </div>
 );
};
