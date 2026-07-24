import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Paintbrush, MessageSquare, Monitor, Smartphone, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeCustomization, THEME_PRESETS, ChatBubbleStyle } from '@/contexts/ThemeCustomizationContext';
import { Label } from '@/components/ui/label';

export default function AppearanceSettings() {
 const navigate = useNavigate();
 const { 
 primaryColor, 
 chatBubbleStyle, 
 activeThemeName, 
 setPrimaryColor, 
 setChatBubbleStyle, 
 applyPresetTheme 
 } = useThemeCustomization();

 const [customHex, setCustomHex] = useState(primaryColor);

 const bubbleStyles: { value: ChatBubbleStyle; label: string; icon: React.ReactNode }[] = [
 { value: 'rounded', label: 'Rounded (Modern)', icon: <MessageSquare className="w-5 h-5" /> },
 { value: 'square', label: 'Square (Classic)', icon: <Monitor className="w-5 h-5" /> },
 { value: 'telegram', label: 'Telegram Style', icon: <Smartphone className="w-5 h-5" /> },
 { value: 'imessage', label: 'iMessage Style', icon: <MessageSquare className="w-5 h-5 fill-current" /> },
 { value: 'gaming', label: 'Gaming (Sharp)', icon: <Sparkles className="w-5 h-5" /> },
 { value: 'glass', label: 'Glassmorphism', icon: <ImageIcon className="w-5 h-5" /> },
 ];

 const handleCustomHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const val = e.target.value;
 setCustomHex(val);
 if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
 setPrimaryColor(val);
 }
 };

 return (
 <div className="flex flex-col h-full bg-background app-viewport safe-area-all">
 {/* Header */}
 <header className="flex items-center justify-between p-4 border-b bg-card z-10 glass-card sticky top-0">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
 <ArrowLeft className="w-6 h-6" />
 </Button>
 <div>
 <h1 className="text-workspace font-bold">Appearance</h1>
 <p className="text-label text-muted-foreground">Customize CHATR infinitely</p>
 </div>
 </div>
 </header>

 <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar pb-24">
 
 {/* Curated Themes */}
 <section className="space-y-4">
 <div className="flex items-center gap-2 mb-2">
 <Paintbrush className="w-5 h-5 text-primary" />
 <h2 className="text-section ">Curated Themes</h2>
 </div>
 <p className="text-secondary text-muted-foreground mb-4">Choose from our premium aesthetic collections.</p>
 
 <div className="grid grid-cols-2 gap-3">
 {THEME_PRESETS.map((preset) => (
 <div 
 key={preset.name}
 onClick={() => applyPresetTheme(preset)}
 className={`relative flex flex-col items-center p-4 rounded-2xl cursor-pointer border-2 transition-all duration-200 hover-scale ${
 activeThemeName === preset.name ? 'border-primary shadow-glow' : 'border-border bg-card hover:border-primary/50'
 }`}
 >
 <div 
 className="w-12 h-12 rounded-full mb-3 shadow-md"
 style={{ backgroundColor: preset.primaryColor }}
 />
 <span className="text-secondary font-medium text-center">{preset.name}</span>
 <span className="text-label text-muted-foreground mt-1">
 {preset.isDark ? 'Dark Mode' : 'Light Mode'}
 </span>
 {activeThemeName === preset.name && (
 <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
 <Check className="w-3 h-3" />
 </div>
 )}
 </div>
 ))}
 </div>
 </section>

 {/* Custom Color Picker */}
 <section className="p-5 rounded-2xl bg-card border shadow-sm">
 <h2 className="text-section mb-2">Custom Accent Color</h2>
 <p className="text-secondary text-muted-foreground mb-4">Make it truly yours. Enter any HEX code.</p>
 <div className="flex items-center gap-4">
 <div 
 className="w-16 h-16 rounded-2xl shadow-md border"
 style={{ backgroundColor: primaryColor }}
 />
 <div className="flex-1 space-y-2">
 <Label>HEX Color Code</Label>
 <div className="flex gap-2">
 <input 
 type="text" 
 value={customHex}
 onChange={handleCustomHexChange}
 className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-secondary ring-offset-background file:border-0 file:bg-transparent file:text-input file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
 placeholder="#6200ee"
 />
 <input 
 type="color" 
 value={primaryColor} 
 onChange={(e) => {
 setCustomHex(e.target.value);
 setPrimaryColor(e.target.value);
 }}
 className="h-10 w-14 rounded cursor-pointer"
 />
 </div>
 </div>
 </div>
 </section>

 {/* Chat Bubble Style */}
 <section className="space-y-4">
 <div className="flex items-center gap-2 mb-2">
 <MessageSquare className="w-5 h-5 text-primary" />
 <h2 className="text-section ">Chat Bubble Style</h2>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 {bubbleStyles.map((style) => (
 <div 
 key={style.value}
 onClick={() => setChatBubbleStyle(style.value)}
 className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer border-2 transition-all ${
 chatBubbleStyle === style.value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:bg-accent/50'
 }`}
 >
 <div className={`p-3 rounded-full mb-2 ${chatBubbleStyle === style.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
 {style.icon}
 </div>
 <span className="text-secondary font-medium text-center">{style.label}</span>
 </div>
 ))}
 </div>
 </section>
 
 {/* Preview Area */}
 <section className="p-4 rounded-2xl bg-chat-background border relative overflow-hidden h-48 flex flex-col justify-end">
 <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
 
 <div className="relative z-10 flex flex-col gap-3">
 <div className="self-start bg-card text-foreground px-4 py-2 rounded-2xl max-w-[80%] shadow-sm" style={{ 
 borderBottomLeftRadius: chatBubbleStyle === 'telegram' ? '0' : undefined,
 borderRadius: chatBubbleStyle === 'square' ? '0.25rem' : chatBubbleStyle === 'gaming' ? '0 0.5rem 0.5rem 0.5rem' : undefined,
 }}>
 <p className="text-secondary">Hey, look at my new theme! 🎨</p>
 </div>
 
 <div className="self-end bg-primary text-primary-foreground px-4 py-2 rounded-2xl max-w-[80%] shadow-md" style={{ 
 borderBottomRightRadius: chatBubbleStyle === 'telegram' ? '0' : undefined,
 borderRadius: chatBubbleStyle === 'square' ? '0.25rem' : chatBubbleStyle === 'gaming' ? '0.5rem 0 0.5rem 0.5rem' : undefined,
 }}>
 <p className="text-secondary">Whoa, that is so clean! No extra cost? ✨</p>
 </div>
 </div>
 </section>

 </div>
 </div>
 );
}
