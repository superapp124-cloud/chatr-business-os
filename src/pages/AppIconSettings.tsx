import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { AppleIconButton } from '@/components/ui/AppleButton';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface AppIcon {
 id: string;
 name: string;
 alias: string;
 preview: string; // Tailwind gradient/color class for placeholder
}

const APP_ICONS: AppIcon[] = [
 { id: 'default', name: 'Default CHATR', alias: '.MainActivity', preview: 'bg-primary' },
 { id: 'minimal_white', name: 'Minimal White', alias: '.MainActivityMinimalWhite', preview: 'bg-white border-2 border-gray-200' },
 { id: 'minimal_black', name: 'Minimal Black', alias: '.MainActivityMinimalBlack', preview: 'bg-black border-2 border-gray-800' },
 { id: 'neon_blue', name: 'Neon Blue', alias: '.MainActivityNeonBlue', preview: 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]' },
 { id: 'neon_green', name: 'Neon Green', alias: '.MainActivityNeonGreen', preview: 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]' },
 { id: 'amoled_black', name: 'AMOLED Black', alias: '.MainActivityAmoledBlack', preview: 'bg-[#000000]' },
 { id: 'glass', name: 'Glassmorphism', alias: '.MainActivityGlassmorphism', preview: 'bg-white/20 backdrop-blur-md border border-white/30' }
];

export default function AppIconSettings() {
 const navigate = useNavigate();
 const [activeIcon, setActiveIcon] = useState<string>('default');

 useEffect(() => {
 // In a real app, this would read from Capacitor Preferences or native bridge
 const savedIcon = localStorage.getItem('chatr-app-icon') || 'default';
 setActiveIcon(savedIcon);
 }, []);

 const handleChangeIcon = async (icon: AppIcon) => {
 try {
 setActiveIcon(icon.id);
 localStorage.setItem('chatr-app-icon', icon.id);
 
 // Change Favicon manually for Web
 const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
 if (link) {
 let bgColor = '#6200ee';
 if (icon.id === 'minimal_white') bgColor = '#ffffff';
 if (icon.id === 'minimal_black') bgColor = '#000000';
 if (icon.id === 'neon_blue') bgColor = '#3b82f6';
 if (icon.id === 'neon_green') bgColor = '#22c55e';
 if (icon.id === 'amoled_black') bgColor = '#000000';
 
 const textColor = icon.id === 'minimal_white' ? '#000' : '#fff';
 const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${bgColor}"/><text x="32" y="44" font-size="36" font-family="system-ui, sans-serif" font-weight="bold" fill="${textColor}" text-anchor="middle">C</text></svg>`;
 link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
 }
 
 // Dispatch event
 window.dispatchEvent(new Event('chatr-app-icon-changed'));
 
 toast.success(`App icon changed to ${icon.name}`, {
 description: 'Your browser favicon has been updated instantly!'
 });
 } catch (error) {
 console.error('Failed to change app icon', error);
 toast.error('Failed to change app icon');
 }
 };

 return (
 <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
 {/* Header */}
 <div className="flex items-center p-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-xl z-10">
 <AppleIconButton
 variant="ghost"
 icon={<ArrowLeft className="w-6 h-6" />}
 onClick={() => navigate('/settings')}
 />
 <h1 className="text-workspace ml-2 flex-1">App Icon</h1>
 </div>

 <div className="p-4 overflow-y-auto pb-24">
 <div className="text-center py-6 px-4">
 <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
 {/* Mock preview of the current icon */}
 <div className={`absolute inset-0 ${APP_ICONS.find(i => i.id === activeIcon)?.preview}`} />
 <div className="relative font-bold text-page z-10 text-primary-foreground drop-shadow-md">C</div>
 </div>
 <h2 className="text-section font-bold mb-2">Customize your homescreen</h2>
 <p className="text-secondary text-muted-foreground">
 Choose an app icon that perfectly matches your phone's aesthetic.
 </p>
 </div>

 <div className="grid grid-cols-2 gap-4 mt-4">
 {APP_ICONS.map((icon) => (
 <Card 
 key={icon.id}
 onClick={() => handleChangeIcon(icon)}
 className={`p-4 flex flex-col items-center gap-3 cursor-pointer transition-all ${
 activeIcon === icon.id 
 ? 'border-primary ring-2 ring-primary/20 bg-primary/5' 
 : 'hover:bg-accent border-transparent bg-card'
 }`}
 >
 <div className={`w-16 h-16 rounded-2xl relative overflow-hidden flex items-center justify-center ${icon.preview}`}>
 <span className="font-bold text-workspace drop-shadow-md z-10 mix-blend-overlay opacity-80">C</span>
 {activeIcon === icon.id && (
 <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 z-20">
 <Check className="w-3 h-3" />
 </div>
 )}
 </div>
 <span className="text-secondary font-medium text-center">{icon.name}</span>
 </Card>
 ))}
 </div>
 </div>
 </div>
 );
}
