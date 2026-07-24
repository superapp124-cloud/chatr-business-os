import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CallerAvatarProps {
 src?: string | null;
 initials?: string;
 band: 'safe' | 'verify' | 'block';
 isBusiness?: boolean;
 size?: 'sm' | 'md' | 'lg' | 'xl';
 className?: string;
}

const CallerAvatar: React.FC<CallerAvatarProps> = ({ 
 src, 
 initials, 
 band, 
 isBusiness, 
 size = 'md',
 className 
}) => {
 const sizeMap = {
 sm: 'w-10 h-10 text-secondary',
 md: 'w-14 h-14 text-section',
 lg: 'w-20 h-20 text-page',
 xl: 'w-24 h-24 text-display',
 };

 const ringColor = {
 safe: 'border-green-500',
 verify: 'border-amber-500',
 block: 'border-red-500',
 };

 const getIcon = () => {
 if (band === 'block') return <ShieldAlert className="text-red-500" size={16} />;
 if (band === 'verify') return <Shield className="text-amber-500" size={16} />;
 if (isBusiness) return <ShieldCheck className="text-blue-500" size={16} />;
 return <ShieldCheck className="text-green-500" size={16} />;
 };

 return (
 <div className={cn("relative", className)}>
 <motion.div
 animate={band === 'block' ? { 
 rotate: [0, -3, 3, -2, 2, 0],
 transition: { repeat: Infinity, duration: 2 }
 } : {}}
 className={cn(
 "rounded-full border-2 p-1 bg-zinc-900 flex items-center justify-center overflow-hidden",
 sizeMap[size],
 ringColor[band],
 band === 'verify' && "animate-pulse"
 )}
 >
 {src ? (
 <img src={src} alt="Caller" className="w-full h-full object-cover rounded-full" />
 ) : initials ? (
 <span className="font-bold text-white uppercase">{initials}</span>
 ) : (
 <User className="text-zinc-500" />
 )}
 </motion.div>
 
 <div className={cn(
 "absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-lg",
 band === 'block' && "bg-red-950/20 border-red-500/30",
 band === 'verify' && "bg-amber-950/20 border-amber-500/30",
 band === 'safe' && "bg-green-950/20 border-green-500/30"
 )}>
 {getIcon()}
 </div>
 </div>
 );
};

export default CallerAvatar;
