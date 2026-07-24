import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { 
 Shield, 
 Smartphone, 
 Sparkles, 
 Palette, 
 Bell, 
 HardDrive,
 User,
 Globe,
 Lock,
 ChevronRight
} from 'lucide-react';

import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { cn } from '@/lib/utils';

export const DesktopSettings: React.FC = () => {
 const navigate = useNavigate();
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';

 const settingCards = [
 {
 title: 'Account & Privacy',
 description: 'Manage your personal info and security.',
 icon: <User className="w-6 h-6 text-blue-500" />,
 items: [
 { label: 'Profile', path: '/desktop/profile' },
 { label: 'Privacy settings', path: '/desktop/privacy' },
 { label: 'Two-step verification', path: '/desktop/account' }
 ]
 },
 {
 title: 'Connected Devices',
 description: 'Manage phones, tablets, and sessions.',
 icon: <Smartphone className="w-6 h-6 text-emerald-500" />,
 items: [
 { label: 'Manage all devices', path: '/desktop/device-management' },
 { label: 'Link new device', path: '/desktop/connect' },
 { label: 'Active sessions', path: '/desktop/account' }
 ]
 },
 {
 title: 'AI Intelligence',
 description: 'Configure how AI assists your workspace.',
 icon: <Sparkles className="w-6 h-6 text-[#5c22ff]" />,
 items: [
 { label: 'Smart summaries', path: '/desktop/intelligence' },
 { label: 'Auto-replies', path: '/desktop/intelligence' },
 { label: 'Contextual search', path: '/desktop/intelligence' }
 ]
 },
 {
 title: 'Appearance',
 description: 'Customize the look and feel.',
 icon: <Palette className="w-6 h-6 text-rose-500" />,
 items: [
 { label: 'Theme (Dark)', path: '/desktop/settings/appearance' },
 { label: 'Chat wallpaper', path: '/desktop/settings/wallpaper' },
 { label: 'Compact mode', path: '/desktop/settings/appearance' }
 ]
 },
 {
 title: 'Notifications',
 description: 'Control when and how you are alerted.',
 icon: <Bell className="w-6 h-6 text-amber-500" />,
 items: [
 { label: 'Sounds', path: '/desktop/settings/notifications' },
 { label: 'Desktop badges', path: '/desktop/settings/notifications' },
 { label: 'Muted chats', path: '/desktop/settings/notifications' }
 ]
 },
 {
 title: 'Storage & Data',
 description: 'Manage files and media downloads.',
 icon: <HardDrive className="w-6 h-6 text-indigo-500" />,
 items: [
 { label: 'Auto-download', path: '/desktop/settings' },
 { label: 'Clear cache', path: '/desktop/settings' },
 { label: 'Network usage', path: '/desktop/settings' }
 ]
 }
 ];

 return (
 <div className={cn("flex-1 p-8 h-full overflow-y-auto", isDark ? "bg-transparent" : "bg-slate-50/50")}>
 <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="mb-8">
 <h1 className={cn("text-display font-black tracking-tight", isDark ? "text-white" : "text-slate-800")}>Settings</h1>
 <p className={cn("font-medium", isDark ? "text-white/50" : "text-slate-500")}>Manage your Communication Workspace.</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {settingCards.map((card, idx) => (
 <Card key={idx} className={cn("p-6 transition-all cursor-pointer group", isDark ? "border-white/[0.05] bg-white/[0.02] backdrop-blur-md shadow-lg hover:bg-white/[0.04]" : "border-slate-200/60 shadow-sm hover:shadow-md bg-white")}>
 <div className="flex items-center gap-4 mb-4">
 <div className={cn("p-3 rounded-xl group-hover:scale-110 transition-transform", isDark ? "bg-white/[0.05] border border-white/[0.05]" : "bg-slate-50")}>
 {card.icon}
 </div>
 <div>
 <h2 className={cn("font-bold", isDark ? "text-white/90" : "text-slate-800")}>{card.title}</h2>
 <p className={cn("text-[11px] leading-tight mt-0.5", isDark ? "text-white/40" : "text-slate-500")}>{card.description}</p>
 </div>
 </div>

 <div className="space-y-2 mt-4">
 {card.items.map((item, i) => (
 <div 
 key={i} 
 onClick={() => navigate(item.path)}
 className={cn("flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer group/item", isDark ? "hover:bg-white/[0.05]" : "hover:bg-slate-50")}
 >
 <span className={cn("text-secondary font-medium transition-colors", isDark ? "text-white/70 group-hover/item:text-white" : "text-slate-700")}>{item.label}</span>
 <ChevronRight className={cn("w-4 h-4", isDark ? "text-white/30 group-hover/item:text-white/70" : "text-slate-400")} />
 </div>
 ))}
 </div>
 </Card>
 ))}
 </div>
 </div>
 </div>
 );
};
