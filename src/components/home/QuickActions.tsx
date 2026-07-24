import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
 MessageCircle, 
 Heart, 
 Stethoscope, 
 Utensils,
 Briefcase,
 Grid3x3,
 MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const QuickActions = () => {
 const navigate = useNavigate();

 const actions = [
 {
 icon: MessageCircle,
 label: 'Chats',
 color: 'text-green-500',
 action: () => navigate('/chat')
 },
 {
 icon: Briefcase,
 label: 'Jobs',
 color: 'text-blue-500',
 action: () => navigate('/jobs')
 },
 {
 icon: Heart,
 label: 'Care',
 color: 'text-red-500',
 action: () => navigate('/local-healthcare')
 },
 {
 icon: Grid3x3,
 label: 'Services',
 color: 'text-orange-500',
 action: () => navigate('/food-ordering')
 },
 {
 icon: MoreHorizontal,
 label: 'More',
 color: 'text-gray-400',
 action: () => navigate('/more')
 }
 ];

 return (
 <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
 {actions.map((action) => (
 <button
 key={action.label}
 onClick={action.action}
 className="flex flex-col items-center gap-2 min-w-[72px] group"
 >
 <div className={cn(
 "w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all",
 "bg-white shadow-sm border border-border/40 group-hover:shadow-md group-hover:scale-105 group-active:scale-95",
 )}>
 <action.icon className={cn("w-6 h-6", action.color)} strokeWidth={2} />
 </div>
 <span className="text-[11px] font-bold text-foreground/80 group-hover:text-foreground transition-colors leading-tight text-center">
 {action.label}
 </span>
 </button>
 ))}
 </div>
 );
};
