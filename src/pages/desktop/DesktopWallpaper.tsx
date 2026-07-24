import React, { useState, useEffect } from 'react';
import { Image, Check, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { cn } from '@/lib/utils';

const PRESET_WALLPAPERS = [
 { id: 'none', label: 'None (Default)', gradient: 'bg-[#0d0f1a]', value: '' },
 { id: 'cosmos', label: 'Cosmos', gradient: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950', value: 'cosmos' },
 { id: 'aurora', label: 'Aurora', gradient: 'bg-gradient-to-br from-emerald-950 via-teal-900 to-cyan-950', value: 'aurora' },
 { id: 'sunset', label: 'Sunset', gradient: 'bg-gradient-to-br from-rose-950 via-orange-900 to-amber-950', value: 'sunset' },
 { id: 'midnight', label: 'Midnight', gradient: 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950', value: 'midnight' },
 { id: 'forest', label: 'Forest', gradient: 'bg-gradient-to-br from-green-950 via-emerald-900 to-teal-950', value: 'forest' },
];

export const DesktopWallpaper: React.FC = () => {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const [selected, setSelected] = useState('none');
 const [uploading, setUploading] = useState(false);
 const [customUrl, setCustomUrl] = useState('');

 useEffect(() => {
 const fetchWallpaper = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 const { data } = await supabase.from('profiles').select('metadata').eq('id', user.id).single();
 if (data?.metadata?.wallpaper) {
 setSelected(data.metadata.wallpaper);
 }
 if (data?.metadata?.wallpaper_url) {
 setCustomUrl(data.metadata.wallpaper_url);
 }
 }
 };
 fetchWallpaper();
 }, []);

 const bg = isDark ? 'bg-[#0d0f1a]' : 'bg-slate-50';
 const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-slate-200';
 const labelColor = isDark ? 'text-white/60' : 'text-slate-500';
 const headingColor = isDark ? 'text-white' : 'text-slate-900';

 const selectWallpaper = async (id: string, value: string) => {
 setSelected(id);
 toast.success('Wallpaper applied');
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 await supabase.from('profiles').update({
 metadata: { wallpaper: id, wallpaper_url: value }
 }).eq('id', user.id);
 }
 };

 const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
 setUploading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('Not authenticated');
 const ext = file.name.split('.').pop();
 const path = `wallpapers/${user.id}/chat-bg.${ext}`;
 const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: true });
 if (uploadError) throw uploadError;
 const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
 setCustomUrl(publicUrl);
 setSelected('custom');
 toast.success('Custom wallpaper uploaded and applied!');
 await supabase.from('profiles').update({
 metadata: { wallpaper: 'custom', wallpaper_url: publicUrl }
 }).eq('id', user.id);
 } catch (err: any) {
 toast.error(err.message || 'Upload failed');
 } finally {
 setUploading(false);
 }
 };

 return (
 <div className={cn('flex-1 overflow-y-auto p-8', bg)}>
 <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="mb-8">
 <h1 className={cn('text-display font-black tracking-tight', headingColor)}>Chat Wallpaper</h1>
 <p className={labelColor}>Choose a background for your chats</p>
 </div>

 {/* Presets */}
 <div className={cn('rounded-2xl border p-6', cardBg)}>
 <h2 className={cn('font-bold mb-4', headingColor)}>Presets</h2>
 <div className="grid grid-cols-3 gap-3">
 {PRESET_WALLPAPERS.map(w => (
 <button key={w.id} onClick={() => selectWallpaper(w.id, w.value)}
 className={cn('relative aspect-video rounded-xl overflow-hidden border-2 transition-all', w.gradient,
 selected === w.id ? 'border-indigo-500 scale-[1.02]' : 'border-transparent hover:border-white/20')}>
 {selected === w.id && (
 <div className="absolute inset-0 flex items-center justify-center">
 <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
 <Check className="w-4 h-4 text-white" />
 </div>
 </div>
 )}
 <div className="absolute bottom-0 inset-x-0 p-2 bg-black/40">
 <p className="text-white text-[10px] font-medium text-center">{w.label}</p>
 </div>
 </button>
 ))}
 </div>
 </div>

 {/* Custom Upload */}
 <div className={cn('rounded-2xl border p-6', cardBg)}>
 <div className="flex items-center gap-2 mb-4">
 <Upload className="w-5 h-5 text-indigo-400" />
 <h2 className={cn('font-bold', headingColor)}>Custom Wallpaper</h2>
 </div>

 {customUrl && selected === 'custom' && (
 <div className="mb-4 rounded-xl overflow-hidden aspect-video">
 <img src={customUrl} alt="Custom wallpaper" className="w-full h-full object-cover" />
 </div>
 )}

 <label className={cn('flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
 isDark ? 'border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50')}>
 {uploading ? (
 <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
 ) : (
 <Image className={cn('w-8 h-8', labelColor)} />
 )}
 <p className={cn('text-secondary font-medium', labelColor)}>
 {uploading ? 'Uploading…' : 'Click to upload an image'}
 </p>
 <p className={cn('text-label', labelColor)}>PNG, JPG, WebP up to 10MB</p>
 <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
 </label>
 </div>
 </div>
 </div>
 );
};

export default DesktopWallpaper;
