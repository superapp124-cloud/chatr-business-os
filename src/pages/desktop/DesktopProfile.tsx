import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { User, Camera, Mail, Phone, Globe, Briefcase, Save, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const DesktopProfile: React.FC = () => {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const navigate = useNavigate();
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);
 const [profile, setProfile] = useState({
 full_name: '',
 username: '',
 bio: '',
 phone: '',
 website: '',
 occupation: '',
 avatar_url: '',
 });

 useEffect(() => {
 const fetchProfile = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 navigate('/auth');
 return;
 }
 const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
 if (data) {
 setProfile({
 full_name: data.full_name || '',
 username: data.username || '',
 bio: (data as any).bio || '',
 phone: (data as any).phone || '',
 website: (data as any).website || '',
 occupation: (data as any).occupation || '',
 avatar_url: data.avatar_url || '',
 });
 }
 setLoading(false);
 };
 fetchProfile();
 }, [navigate]);

 const handleSave = async () => {
 setSaving(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('Not authenticated');
 
 const { error } = await supabase.from('profiles').update({
 full_name: profile.full_name,
 username: profile.username,
 avatar_url: profile.avatar_url,
 bio: profile.bio,
 phone: profile.phone,
 website: profile.website,
 occupation: profile.occupation,
 }).eq('id', user.id);
 
 if (error) throw error;
 
 setSaved(true);
 toast.success('Profile saved successfully');
 setTimeout(() => setSaved(false), 3000);
 } catch (err: any) {
 toast.error(err.message || 'Failed to save profile');
 } finally {
 setSaving(false);
 }
 };

 const bg = isDark ? 'bg-[#0d0f1a]' : 'bg-slate-50';
 const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-slate-200';
 const inputBg = isDark ? 'bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30' : 'bg-white border-slate-200 text-slate-900';
 const labelColor = isDark ? 'text-white/60' : 'text-slate-500';
 const headingColor = isDark ? 'text-white' : 'text-slate-900';

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
 <h1 className={cn('text-secondary font-semibold', headingColor)}>Edit Profile</h1>
 </div>

 <div className="flex-1 overflow-y-auto p-8">
 <div className="max-w-2xl mx-auto space-y-8">
 
 {/* Avatar Section */}
 <div className="flex items-center gap-6">
 <div className="relative group cursor-pointer">
 <div className="w-24 h-24 rounded-2xl overflow-hidden bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/20">
 {profile.avatar_url ? (
 <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
 ) : (
 <User className="w-10 h-10 text-indigo-500" />
 )}
 </div>
 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
 <Camera className="w-6 h-6 text-white" />
 </div>
 </div>
 <div>
 <h2 className={cn('text-workspace font-bold', headingColor)}>{profile.full_name || 'Your Name'}</h2>
 <p className={labelColor}>@{profile.username || 'username'}</p>
 <div className="mt-2 flex gap-2">
 <button className="text-button px-3 py-1.5 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 transition-colors">
 Upload new picture
 </button>
 <button className={cn('text-label px-3 py-1.5 rounded-full border transition-colors', isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
 Remove
 </button>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Basic Info */}
 <div className={cn('p-6 rounded-2xl border', cardBg)}>
 <h3 className={cn('text-secondary font-semibold mb-4', headingColor)}>Basic Information</h3>
 <div className="space-y-4">
 <div className="space-y-1.5">
 <label className={cn('text-label ', labelColor)}>Full Name</label>
 <div className="relative">
 <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="text"
 value={profile.full_name}
 onChange={e => setProfile({...profile, full_name: e.target.value})}
 className={cn('w-full pl-9 pr-3 py-2 rounded-lg border text-secondary outline-none transition-colors', inputBg)}
 placeholder="John Doe"
 />
 </div>
 </div>
 <div className="space-y-1.5">
 <label className={cn('text-label ', labelColor)}>Username</label>
 <div className="relative">
 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="text"
 value={profile.username}
 onChange={e => setProfile({...profile, username: e.target.value})}
 className={cn('w-full pl-9 pr-3 py-2 rounded-lg border text-secondary outline-none transition-colors', inputBg)}
 placeholder="johndoe"
 />
 </div>
 </div>
 <div className="space-y-1.5">
 <label className={cn('text-label ', labelColor)}>Bio</label>
 <textarea
 value={profile.bio}
 onChange={e => setProfile({...profile, bio: e.target.value})}
 rows={3}
 className={cn('w-full p-3 rounded-lg border text-secondary outline-none transition-colors resize-none', inputBg)}
 placeholder="Tell us a bit about yourself..."
 />
 </div>
 </div>
 </div>

 {/* Additional Details */}
 <div className={cn('p-6 rounded-2xl border', cardBg)}>
 <h3 className={cn('text-secondary font-semibold mb-4', headingColor)}>Additional Details</h3>
 <div className="space-y-4">
 <div className="space-y-1.5">
 <label className={cn('text-label ', labelColor)}>Phone Number</label>
 <div className="relative">
 <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="tel"
 value={profile.phone}
 onChange={e => setProfile({...profile, phone: e.target.value})}
 className={cn('w-full pl-9 pr-3 py-2 rounded-lg border text-secondary outline-none transition-colors', inputBg)}
 placeholder="+1 (555) 000-0000"
 />
 </div>
 </div>
 <div className="space-y-1.5">
 <label className={cn('text-label ', labelColor)}>Website</label>
 <div className="relative">
 <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="url"
 value={profile.website}
 onChange={e => setProfile({...profile, website: e.target.value})}
 className={cn('w-full pl-9 pr-3 py-2 rounded-lg border text-secondary outline-none transition-colors', inputBg)}
 placeholder="https://example.com"
 />
 </div>
 </div>
 <div className="space-y-1.5">
 <label className={cn('text-label ', labelColor)}>Occupation</label>
 <div className="relative">
 <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
 <input
 type="text"
 value={profile.occupation}
 onChange={e => setProfile({...profile, occupation: e.target.value})}
 className={cn('w-full pl-9 pr-3 py-2 rounded-lg border text-secondary outline-none transition-colors', inputBg)}
 placeholder="Software Engineer"
 />
 </div>
 </div>
 </div>
 </div>
 </div>

 <div className="flex items-center justify-end pt-4 pb-12">
 <button
 onClick={handleSave}
 disabled={saving}
 className="px-6 py-2.5 rounded-lg bg-indigo-500 text-white font-medium text-button hover:bg-indigo-600 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
 >
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
 {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
 </button>
 </div>

 </div>
 </div>
 </div>
 );
};
