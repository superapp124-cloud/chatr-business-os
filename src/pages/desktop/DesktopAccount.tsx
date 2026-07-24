import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lock, Mail, Smartphone, Key, Trash2, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { cn } from '@/lib/utils';

export const DesktopAccount: React.FC = () => {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const [changingPassword, setChangingPassword] = useState(false);
 const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
 const [saving, setSaving] = useState(false);
 const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
 const [loading2FA, setLoading2FA] = useState(true);

 React.useEffect(() => {
 const fetchMfa = async () => {
 const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
 if (!error && data) {
 setTwoFactorEnabled(data.currentLevel === 'aal2' || data.nextLevel === 'aal2');
 }
 setLoading2FA(false);
 };
 fetchMfa();
 }, []);

 const bg = isDark ? 'bg-[#0d0f1a]' : 'bg-slate-50';
 const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-slate-200';
 const inputBg = isDark ? 'bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30' : 'bg-white border-slate-200 text-slate-900';
 const labelColor = isDark ? 'text-white/60' : 'text-slate-500';
 const headingColor = isDark ? 'text-white' : 'text-slate-900';
 const textColor = isDark ? 'text-white/80' : 'text-slate-700';

 const handlePasswordChange = async () => {
 if (passwordForm.new !== passwordForm.confirm) {
 toast.error('New passwords do not match');
 return;
 }
 if (passwordForm.new.length < 8) {
 toast.error('Password must be at least 8 characters');
 return;
 }
 setSaving(true);
 try {
 const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
 if (error) throw error;
 toast.success('Password updated successfully');
 setChangingPassword(false);
 setPasswordForm({ current: '', new: '', confirm: '' });
 } catch (err: any) {
 toast.error(err.message || 'Failed to update password');
 } finally {
 setSaving(false);
 }
 };

 const handleDeleteAccount = async () => {
 const confirmed = window.confirm(
 'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'
 );
 if (!confirmed) return;
 toast.error('Account deletion requires contacting support for data protection compliance.');
 };

 return (
 <div className={cn('flex-1 overflow-y-auto p-8', bg)}>
 <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="mb-8">
 <h1 className={cn('text-display font-black tracking-tight', headingColor)}>Account</h1>
 <p className={labelColor}>Manage your account security and authentication</p>
 </div>

 {/* Password */}
 <div className={cn('rounded-2xl border p-6', cardBg)}>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <Lock className="w-5 h-5 text-indigo-400" />
 <h2 className={cn('font-bold', headingColor)}>Password</h2>
 </div>
 {!changingPassword && (
 <button onClick={() => setChangingPassword(true)}
 className="text-label font-semibold text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-500/10">
 Change Password
 </button>
 )}
 </div>

 {changingPassword ? (
 <div className="space-y-3">
 {[
 { label: 'Current Password', key: 'current' },
 { label: 'New Password', key: 'new' },
 { label: 'Confirm New Password', key: 'confirm' },
 ].map(f => (
 <div key={f.key}>
 <label className={cn('text-label font-semibold mb-1 block', labelColor)}>{f.label}</label>
 <input
 type="password"
 value={(passwordForm as any)[f.key]}
 onChange={e => setPasswordForm(p => ({ ...p, [f.key]: e.target.value }))}
 className={cn('w-full px-4 py-2.5 rounded-xl border text-secondary outline-none focus:border-indigo-500 transition-colors', inputBg)}
 placeholder="••••••••"
 />
 </div>
 ))}
 <div className="flex gap-2 mt-4">
 <button onClick={handlePasswordChange} disabled={saving}
 className="flex items-center gap-2 px-4 py-2 rounded-xl text-button font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors disabled:opacity-50">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
 {saving ? 'Saving…' : 'Update Password'}
 </button>
 <button onClick={() => { setChangingPassword(false); setPasswordForm({ current: '', new: '', confirm: '' }); }}
 className={cn('px-4 py-2 rounded-xl text-secondary font-semibold transition-colors', isDark ? 'text-white/60 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100')}>
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <p className={cn('text-secondary', labelColor)}>Last changed: Never • Use a strong, unique password</p>
 )}
 </div>

 {/* Two-Factor Auth */}
 <div className={cn('rounded-2xl border p-6', cardBg)}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Smartphone className="w-5 h-5 text-emerald-400" />
 <div>
 <h2 className={cn('font-bold', headingColor)}>Two-Step Verification</h2>
 <p className={cn('text-label mt-0.5', labelColor)}>Add an extra layer of security</p>
 </div>
 </div>
 {loading2FA ? (
 <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
 ) : (
 <button
 onClick={async () => { 
 if (!twoFactorEnabled) {
 toast.info('Starting 2FA enrollment...');
 try {
 const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
 if (error) throw error;
 toast.success('2FA enrollment started. Please scan the QR code (UI not fully implemented here yet).');
 } catch (e: any) {
 toast.error('Failed to enroll: ' + e.message);
 }
 } else {
 toast.info('2FA disable flow not fully implemented in demo.');
 }
 }}
 className={cn('relative w-11 h-6 rounded-full transition-colors', twoFactorEnabled ? 'bg-emerald-500' : isDark ? 'bg-white/10' : 'bg-slate-200')}
 >
 <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', twoFactorEnabled ? 'left-5' : 'left-0.5')} />
 </button>
 )}
 </div>
 </div>

 {/* Active Sessions */}
 <div className={cn('rounded-2xl border p-6', cardBg)}>
 <div className="flex items-center gap-3 mb-4">
 <Key className="w-5 h-5 text-amber-400" />
 <h2 className={cn('font-bold', headingColor)}>Active Sessions</h2>
 </div>
 <div className={cn('p-3 rounded-xl flex items-center justify-between', isDark ? 'bg-white/[0.04]' : 'bg-slate-50')}>
 <div>
 <p className={cn('text-secondary font-medium', textColor)}>This device</p>
 <p className={cn('text-label', labelColor)}>Browser • Current session</p>
 </div>
 <span className="text-label text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-1 rounded-full">Active</span>
 </div>
 </div>

 {/* Danger Zone */}
 <div className="rounded-2xl border border-red-500/20 p-6 bg-red-500/5">
 <div className="flex items-center gap-3 mb-4">
 <AlertTriangle className="w-5 h-5 text-red-400" />
 <h2 className="font-bold text-red-400">Danger Zone</h2>
 </div>
 <p className={cn('text-secondary mb-4', labelColor)}>Permanently delete your account and all associated data. This cannot be undone.</p>
 <button onClick={handleDeleteAccount}
 className="flex items-center gap-2 px-4 py-2 rounded-xl text-button font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors">
 <Trash2 className="w-4 h-4" /> Delete Account
 </button>
 </div>
 </div>
 </div>
 );
};

export default DesktopAccount;
