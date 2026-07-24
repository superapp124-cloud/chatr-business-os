import React, { useState } from 'react';
import { Bell, Smartphone, Monitor, Mail, Slack, Clock, ShieldAlert } from 'lucide-react';
import { NotificationChannel } from '@/core/capabilities/types';

interface PreferenceRow {
 channel: NotificationChannel;
 icon: React.ReactNode;
 label: string;
 enabled: boolean;
 quietHoursStart?: string;
 quietHoursEnd?: string;
 urgentOverride: boolean;
}

export const NotificationPreferences: React.FC = () => {
 const [prefs, setPrefs] = useState<PreferenceRow[]>([
 { channel: 'desktop', icon: <Monitor className="w-4 h-4" />, label: 'Desktop App', enabled: true, urgentOverride: true },
 { channel: 'push', icon: <Smartphone className="w-4 h-4" />, label: 'Mobile Push', enabled: true, urgentOverride: true },
 { channel: 'slack', icon: <Slack className="w-4 h-4" />, label: 'Slack Integration', enabled: true, quietHoursStart: '18:00', quietHoursEnd: '09:00', urgentOverride: true },
 { channel: 'email', icon: <Mail className="w-4 h-4" />, label: 'Email Alerts', enabled: false, urgentOverride: false },
 ]);

 const toggleEnabled = (channel: NotificationChannel) => {
 setPrefs(prefs.map(p => p.channel === channel ? { ...p, enabled: !p.enabled } : p));
 };

 const toggleUrgent = (channel: NotificationChannel) => {
 setPrefs(prefs.map(p => p.channel === channel ? { ...p, urgentOverride: !p.urgentOverride } : p));
 };

 return (
 <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 text-white max-w-2xl">
 <div className="flex items-center gap-3 mb-6">
 <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
 <Bell className="w-5 h-5 text-violet-400" />
 </div>
 <div>
 <h2 className="text-section font-bold">Universal Notification Engine</h2>
 <p className="text-secondary text-white/50">Manage routing rules, channels, and quiet hours.</p>
 </div>
 </div>

 <div className="space-y-4">
 {prefs.map(pref => (
 <div key={pref.channel} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
 <div className="flex items-center gap-4">
 <div className="p-2 bg-white/5 rounded-lg text-white/70">
 {pref.icon}
 </div>
 <div>
 <h3 className="font-semibold text-secondary">{pref.label}</h3>
 <div className="flex items-center gap-2 mt-1">
 {pref.quietHoursStart && (
 <span className="flex items-center gap-1 text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
 <Clock className="w-3 h-3" />
 Muted {pref.quietHoursStart} - {pref.quietHoursEnd}
 </span>
 )}
 {pref.urgentOverride && (
 <span className="flex items-center gap-1 text-[10px] text-rose-400/80 bg-rose-500/10 px-2 py-0.5 rounded-full">
 <ShieldAlert className="w-3 h-3" />
 Urgent Override
 </span>
 )}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-4">
 <label className="flex items-center gap-2 text-label text-white/50 cursor-pointer">
 <input 
 type="checkbox" 
 checked={pref.urgentOverride} 
 onChange={() => toggleUrgent(pref.channel)}
 className="rounded border-white/20 bg-transparent text-violet-500 focus:ring-violet-500/20"
 />
 Urgent Only
 </label>
 
 <button 
 onClick={() => toggleEnabled(pref.channel)}
 className={`w-11 h-6 rounded-full transition-colors relative ${pref.enabled ? 'bg-violet-600' : 'bg-white/10'}`}
 >
 <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${pref.enabled ? 'left-6' : 'left-1'}`} />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
};
