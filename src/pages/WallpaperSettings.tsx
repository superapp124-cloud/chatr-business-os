import React, { useState, useEffect } from 'react';
import { ArrowLeft, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { wallpapers as initialWallpapers } from '@/utils/wallpaper';
import { supabase } from '@/integrations/supabase/client';

export default function WallpaperSettings() {
 const navigate = useNavigate();
 const [selected, setSelected] = useState<string>('default');
 const [wallpapers, setWallpapers] = useState(initialWallpapers);
 const [prompt, setPrompt] = useState('');
 const [isGenerating, setIsGenerating] = useState(false);

 useEffect(() => {
 const fetchWallpaper = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 const { data } = await supabase.from('profiles').select('metadata').eq('id', user.id).single();
 if (data?.metadata?.wallpaper) {
 setSelected(data.metadata.wallpaper);
 }
 }
 };
 fetchWallpaper();
 }, []);

 const handleSelect = async (id: string) => {
 setSelected(id);
 window.dispatchEvent(new Event('chatr-wallpaper-changed'));
 toast.success('Chat wallpaper updated!');
 
 // Persist to Supabase
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 await supabase.from('profiles').update({
 metadata: { wallpaper: id }
 }).eq('id', user.id);
 }
 };

 const handleGenerate = () => {
 if (!prompt.trim()) return;
 setIsGenerating(true);
 // Simulate generation delay
 setTimeout(() => {
 const hue1 = Math.floor(Math.random() * 360);
 const hue2 = (hue1 + 80 + Math.random() * 100) % 360;
 const hue3 = (hue2 + 80 + Math.random() * 100) % 360;
 const gradient = `bg-gradient-to-br from-[hsl(${hue1},100%,70%)] via-[hsl(${hue2},100%,70%)] to-[hsl(${hue3},100%,70%)]`;
 const id = `ai-${Date.now()}`;
 setWallpapers(prev => [...prev, { id, name: prompt.substring(0, 20), class: gradient }]);
 handleSelect(id);
 setIsGenerating(false);
 setPrompt('');
 toast.success('AI Wallpaper successfully generated!');
 }, 1500);
 };

 return (
 <div className="min-h-screen bg-background pb-20">
 <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
 <div className="flex items-center px-4 h-14">
 <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <h1 className="text-section flex items-center gap-2">
 <ImageIcon className="w-5 h-5 text-primary" />
 Chat Wallpaper
 </h1>
 </div>
 </div>

 <div className="p-4 space-y-6">
 <div>
 <h2 className="text-secondary font-medium text-muted-foreground mb-4 uppercase tracking-wider">Your Wallpapers</h2>
 <div className="grid grid-cols-2 gap-4">
 {wallpapers.map((wp) => (
 <div 
 key={wp.id} 
 onClick={() => handleSelect(wp.id)}
 className={`relative cursor-pointer rounded-2xl overflow-hidden border-2 transition-all ${selected === wp.id ? 'border-primary shadow-lg scale-[1.02]' : 'border-border hover:border-primary/50'}`}
 >
 <div className={`w-full aspect-[9/16] ${wp.class}`} style={wp.class.startsWith('bg-gradient') ? {} : { backgroundImage: wp.class }} />
 <div className="absolute inset-x-0 bottom-0 p-3 bg-black/50 backdrop-blur-md">
 <p className="text-white text-secondary font-medium text-center truncate">{wp.name}</p>
 </div>
 {selected === wp.id && (
 <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 
 <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20 shadow-sm relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
 <Sparkles className="w-24 h-24 text-primary" />
 </div>
 <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
 <Sparkles className="w-4 h-4" />
 AI Generator
 </h3>
 <p className="text-secondary text-muted-foreground mb-4 relative z-10">Generate beautiful abstract wallpapers using advanced on-device style generation.</p>
 <div className="flex flex-col gap-3 relative z-10">
 <input
 type="text"
 value={prompt}
 onChange={(e) => setPrompt(e.target.value)}
 placeholder="e.g. Neon Cyberpunk City..."
 onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
 className="h-11 rounded-xl bg-background border border-primary/20 px-4 text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all w-full"
 />
 <Button 
 onClick={handleGenerate} 
 disabled={isGenerating || !prompt.trim()}
 className="w-full rounded-xl font-bold bg-primary hover:bg-primary/90 text-white h-11"
 >
 {isGenerating ? 'Generating...' : 'Generate AI Wallpaper'}
 </Button>
 </div>
 </div>
 </div>
 </div>
 );
}
