import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Star, Clock, Users, Grid, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';

const dialerItems = [
 { name: 'Chatr Shield', path: '/calls', icon: ShieldCheck },
 { name: 'Favorites', path: '/calls/favorites', icon: Star },
 { name: 'Recents', path: '/calls/recents', icon: Clock },
 { name: 'Contacts', path: '/calls/contacts', icon: Users },
 { name: 'Keypad', path: '/calls/keypad', icon: Grid },
];

export const StandaloneCallsNav = ({ themeColor }: { themeColor: string }) => {
 const location = useLocation();
 const haptics = useNativeHaptics();

 return (
 <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full sm:max-w-[430px] z-[120] pb-[env(safe-area-inset-bottom)] px-3 mb-3">
 <nav className="flex items-center justify-around h-[72px] px-2 rounded-[28px] bg-[#121214]/80 border border-white/10 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
 {dialerItems.map((item) => {
 const isActive = location.pathname === item.path || (item.path === '/calls' && location.pathname === '/calls/');
 const Icon = item.icon;

 return (
 <NavLink
 key={item.path}
 to={item.path}
 onClick={() => haptics.light()}
 className={cn(
 "flex flex-col items-center justify-center flex-1 gap-1.5 transition-all duration-300",
 isActive ? "scale-105" : "hover:scale-105"
 )}
 >
 <div className="relative flex items-center justify-center">
 {isActive && (
 <div className="absolute inset-0 rounded-full scale-[1.5]" style={{ backgroundColor: themeColor + '33' }} />
 )}
 <Icon 
 className={cn(
 "w-6 h-6 transition-colors duration-300 relative z-10"
 )} 
 style={{ color: isActive ? themeColor : 'rgba(255, 255, 255, 0.4)', fill: isActive ? themeColor : 'none' }}
 strokeWidth={isActive ? 2 : 1.5} 
 />
 </div>
 <span className={cn(
 "text-[10px] font-medium tracking-tight mt-1 transition-colors duration-300",
 isActive ? "text-white" : "text-white/40"
 )}>{item.name}</span>
 </NavLink>
 );
 })}
 </nav>
 </div>
 );
};
