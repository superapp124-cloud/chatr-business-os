import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Eye, EyeOff, Bell, MapPin, Users, Lock, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface PrivacySettings {
 last_seen: 'everyone' | 'contacts' | 'nobody';
 profile_photo: 'everyone' | 'contacts' | 'nobody';
 about: 'everyone' | 'contacts' | 'nobody';
 read_receipts: boolean;
 location_sharing: boolean;
 online_status: boolean;
}

const DEFAULT_SETTINGS: PrivacySettings = {
 last_seen: 'contacts',
 profile_photo: 'everyone',
 about: 'contacts',
 read_receipts: true,
 location_sharing: false,
 online_status: true,
};

export const DesktopPrivacy: React.FC = () => {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const navigate = useNavigate();
 const [loading, setLoading] = useState(true);
 const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);

 useEffect(() => {
 const fetchSettings = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 navigate('/auth');
 return;
 }
 const { data, error } = await supabase
 .from('profiles')
 .select('privacy_settings')
 .eq('id', user.id)
 .single();
 
 if (data && data.privacy_settings) {
 // Merge with defaults in case of missing fields
 setSettings({ ...DEFAULT_SETTINGS, ...(data.privacy_settings as any) });
 }
 setLoading(false);
 };
 fetchSettings();
 }, [navigate]);

 const save = async (newSettings: PrivacySettings) => {
 setSettings(newSettings);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 
 const { error } = await supabase
 .from('profiles')
 .update({ privacy_settings: newSettings as any })
 .eq('id', user.id);
 
 if (error) throw error;
 toast.success('Privacy settings updated');
 } catch (e: any) {
 toast.error('Failed to save settings to cloud');
 console.error(e);
 }
 };

 const bg = isDark ? 'bg-[#0d0f1a]' : 'bg-slate-50';
 const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-slate-200';
 const labelColor = isDark ? 'text-white/60' : 'text-slate-500';
 const headingColor = isDark ? 'text-white' : 'text-slate-900';
 const textColor = isDark ? 'text-white/80' : 'text-slate-700';

 const VisibilitySelect = ({ label, value, icon: Icon, onChange }: any) => (
 <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
 <div className="flex items-center gap-3">
 <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', isDark ? 'bg-white/[0.06]' : 'bg-slate-100')}>
 <Icon className="w-4 h-4 text-indigo-400" />
 </div>
 <span className={cn('text-secondary font-medium', textColor)}>{label}</span>
 </div>
 <select
 value={value}
 onChange={e => onChange(e.target.value)}
 className={cn('text-label px-3 py-1.5 rounded-lg border outline-none cursor-pointer', isDark ? 'bg-white/[0.05] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-700')}
 >
 <option value="everyone" className={isDark ? 'bg-slate-900' : ''}>Everyone</option>
 <option value="contacts" className={isDark ? 'bg-slate-900' : ''}>My Contacts</option>
 <option value="nobody" className={isDark ? 'bg-slate-900' : ''}>Nobody</option>
 </select>
 </div>
 );

 const Toggle = ({ label, description, checked, onChange, icon: Icon }: any) => (
 <div className="flex items-center justify-between py-4 border-b border-border/50 last:border-0">
 <div className="flex items-start gap-3">
 <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', isDark ? 'bg-white/[0.06]' : 'bg-slate-100')}>
 <Icon className="w-4 h-4 text-indigo-400" />
 </div>
 <div>
 <h4 className={cn('text-secondary font-medium', textColor)}>{label}</h4>
 <p className={cn('text-label mt-0.5 max-w-[240px]', labelColor)}>{description}</p>
 </div>
 </div>
 <button
 onClick={() => onChange(!checked)}
 className={cn(
 'w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out shrink-0',
 checked ? 'bg-indigo-500' : isDark ? 'bg-white/[0.1]' : 'bg-slate-200'
 )}
 >
 <div
 className={cn(
 'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm',
 checked ? 'translate-x-5' : 'translate-x-0'
 )}
 />
 </button>
 </div>
 );

 if (loading) {
 return (
 <div className={cn('flex-1 flex items-center justify-center h-full', bg)}>
 <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
 </div>
 );
 }

 return (
 <div className={cn('flex-1 flex flex-col h-full overflow-hidden', bg)}>
 <div className={cn('h-14 border-b flex items-center px-4 shrink-0', cardBg)}>
 <Button variant="ghost" size="icon" onClick={() => navigate('/desktop/settings')} className="mr-2">
 <ArrowLeft className="w-5 h-5 text-slate-500" />
 </Button>
 <h1 className={cn('text-secondary font-semibold', headingColor)}>Privacy & Security</h1>
 </div>

 <div className="flex-1 overflow-y-auto p-8">
 <div className="max-w-2xl mx-auto space-y-8 pb-12">
 
 <div>
 <div className="flex items-center gap-3 mb-6">
 <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
 <Shield className="w-5 h-5 text-indigo-500" />
 </div>
 <div>
 <h2 className={cn('text-section font-bold', headingColor)}>Privacy Settings</h2>
 <p className={cn('text-secondary', labelColor)}>Control who can see your information</p>
 </div>
 </div>

 <div className="grid gap-6">
 <div className={cn('p-2 rounded-2xl border', cardBg)}>
 <div className="px-4 py-2 border-b border-border/50">
 <h3 className={cn('text-label font-bold uppercase tracking-wider', labelColor)}>Visibility</h3>
 </div>
 <div className="px-4">
 <VisibilitySelect
 icon={Eye}
 label="Last Seen"
 value={settings.last_seen}
 onChange={(v: any) => save({ ...settings, last_seen: v })}
 />
 <VisibilitySelect
 icon={Users}
 label="Profile Photo"
 value={settings.profile_photo}
 onChange={(v: any) => save({ ...settings, profile_photo: v })}
 />
 <VisibilitySelect
 icon={Lock}
 label="About Info"
 value={settings.about}
 onChange={(v: any) => save({ ...settings, about: v })}
 />
 </div>
 </div>

 <div className={cn('p-2 rounded-2xl border', cardBg)}>
 <div className="px-4 py-2 border-b border-border/50">
 <h3 className={cn('text-label font-bold uppercase tracking-wider', labelColor)}>Activity</h3>
 </div>
 <div className="px-4">
 <Toggle
 icon={CheckCircle}
 label="Read Receipts"
 description="If turned off, you won't send or receive read receipts."
 checked={settings.read_receipts}
 onChange={(v: boolean) => save({ ...settings, read_receipts: v })}
 />
 <Toggle
 icon={MapPin}
 label="Live Location Sharing"
 description="Allow CHATR Kernel to use your location for context."
 checked={settings.location_sharing}
 onChange={(v: boolean) => save({ ...settings, location_sharing: v })}
 />
 <Toggle
 icon={Bell}
 label="Online Status"
 description="Show when you are active on the platform."
 checked={settings.online_status}
 onChange={(v: boolean) => save({ ...settings, online_status: v })}
 />
 </div>
 </div>
 </div>
 </div>

 </div>
 </div>
 </div>
 );
};
