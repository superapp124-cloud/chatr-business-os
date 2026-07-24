import React, { useState, useEffect } from 'react';
import { 
 Shield, 
 Lock, 
 MessageCircle, 
 Phone, 
 Contact, 
 Wallet, 
 ChevronRight,
 CheckCircle2,
 AlertOctagon,
 EyeOff,
 Bot,
 Radar,
 Activity,
 PhoneIncoming,
 PhoneOutgoing,
 PhoneMissed,
 UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInstantCache } from '@/hooks/useInstantCache';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import chatrLogo from '@/assets/chatr-logo.png';
import { useDialerData } from '@/hooks/useDialerData';
import {
 avatarColorForIdentity,
 callerInitials,
 chooseCallerDisplayName,
 formatPhoneForDisplay,
} from '@/utils/callerIdentityResolver';

type TopContactBubble = {
 id: string;
 name: string;
 phone: string;
 avatar?: string | null;
 initials: string;
 color: string;
};

type DefenseFeatures = {
 aiScreen: boolean;
 scamEngine: boolean;
 darkWeb: boolean;
 antiTracker: boolean;
};

type NativeDefenseState = {
 features?: Partial<DefenseFeatures>;
 lastResult?: {
 decision?: string;
 riskLevel?: string;
 displayName?: string | null;
 summary?: string;
 } | null;
};

type NativeProtectionState = {
 readPhoneState?: boolean;
 readCallLog?: boolean;
 overlay?: boolean;
 callScreeningRole?: boolean;
 callRedirectionRole?: boolean;
 defaultDialer?: boolean;
 nativeCaptureReady?: boolean;
 callerIdReady?: boolean;
 gsmDefenseReady?: boolean;
 incomingGsmReady?: boolean;
 outgoingGsmReady?: boolean;
 fullGsmCoverageReady?: boolean;
 gsmDefenses?: NativeDefenseState;
 stats?: {
 capturedCalls?: number;
 pendingSync?: number;
 knownCallerProfiles?: number;
 };
};

const defaultDefenseFeatures: DefenseFeatures = {
 aiScreen: true,
 scamEngine: true,
 darkWeb: true,
 antiTracker: true,
};

const parseNativeJson = <T,>(raw?: string | null): T | null => {
 if (!raw) return null;
 try {
 return JSON.parse(raw) as T;
 } catch (error) {
 console.warn('[Shield] Failed to parse native state:', error);
 return null;
 }
};

const readNativeProtectionState = (): NativeProtectionState | null => {
 if (typeof window === 'undefined') return null;
 return parseNativeJson<NativeProtectionState>(window.ChatrNativeRuntime?.getCallerProtectionState?.());
};

const mergeDefenseFeatures = (state?: NativeDefenseState | null): DefenseFeatures => ({
 ...defaultDefenseFeatures,
 ...(state?.features || {}),
});

export const StandaloneCallsDashboard = ({ 
 themeColor, 
 setThemeColor,
 themeMode = 'dark',
 setThemeMode
}: { 
 themeColor: string, 
 setThemeColor: (c: string) => void,
 themeMode?: 'dark' | 'light' | 'glass',
 setThemeMode?: (m: 'dark' | 'light' | 'glass') => void
}) => {
 const navigate = useNavigate();
 
 const [threatsBlocked, setThreatsBlocked] = useState(2408);
 const { recents: dialerRecents, loading: recentsLoading } = useDialerData();

 const [nativeProtection, setNativeProtection] = useState<NativeProtectionState | null>(() => readNativeProtectionState());
 const [features, setFeatures] = useState<DefenseFeatures>(() =>
 mergeDefenseFeatures(readNativeProtectionState()?.gsmDefenses),
 );

 useEffect(() => {
 const refresh = () => {
 const nextProtection = readNativeProtectionState();
 if (!nextProtection) return;
 setNativeProtection(nextProtection);
 setFeatures(mergeDefenseFeatures(nextProtection.gsmDefenses));

 const blocked = Number(nextProtection.stats?.capturedCalls || 0);
 if (blocked > 0) {
 setThreatsBlocked(prev => Math.max(prev, blocked));
 }
 };

 refresh();
 window.addEventListener('nativeContactPermissionsChanged', refresh as EventListener);
 return () => window.removeEventListener('nativeContactPermissionsChanged', refresh as EventListener);
 }, []);

 const toggleFeature = (key: keyof typeof features) => {
 const readyByKey = {
 aiScreen: Boolean(nativeProtection?.nativeCaptureReady || nativeProtection?.callerIdReady),
 scamEngine: Boolean(nativeProtection?.callScreeningRole || nativeProtection?.nativeCaptureReady),
 darkWeb: Boolean(nativeProtection?.nativeCaptureReady),
 antiTracker: Boolean(nativeProtection?.nativeCaptureReady),
 } satisfies Record<keyof DefenseFeatures, boolean>;

 if (!readyByKey[key]) {
 window.ChatrNativeRuntime?.requestCallerProtectionSetup?.();
 return;
 }

 const enabled = !features[key];
 if (window.ChatrNativeRuntime?.setGsmDefenseFeature) {
 const nextState = parseNativeJson<NativeDefenseState>(
 window.ChatrNativeRuntime.setGsmDefenseFeature(key, enabled),
 );
 setFeatures(mergeDefenseFeatures(nextState));
 setNativeProtection(readNativeProtectionState());
 return;
 }

 setFeatures(prev => ({ ...prev, [key]: enabled }));
 };
 
 const { data: profile } = useInstantCache('user-profile', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return null;
 return (await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()).data;
 });

 const { data: topContacts } = useInstantCache<TopContactBubble[]>('dashboard-top-contact-bubbles', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 const bubbles: TopContactBubble[] = [];

 if (user) {
 const { data } = await supabase
 .from('contacts')
 .select('id, contact_name, contact_phone, profiles:contact_user_id(avatar_url)')
 .eq('user_id', user.id)
 .order('contact_name')
 .limit(8);

 (data || []).forEach((contact: any) => {
 const name = chooseCallerDisplayName([contact.contact_name], contact.contact_phone);
 if (!name) return;

 bubbles.push({
 id: contact.id,
 name,
 phone: contact.contact_phone || '',
 avatar: contact.profiles?.avatar_url || null,
 initials: callerInitials(name, contact.contact_phone),
 color: avatarColorForIdentity(name, contact.contact_phone),
 });
 });
 }

 if (bubbles.length === 0 && window.ChatrNativeRuntime?.getDeviceContacts) {
 try {
 const parsed = JSON.parse(window.ChatrNativeRuntime.getDeviceContacts(8) || '[]');
 if (Array.isArray(parsed)) {
 parsed.forEach((contact: any) => {
 const name = chooseCallerDisplayName(
 [contact.contact_name || contact.displayName],
 contact.normalized_number || contact.phone_number,
 );
 if (!name) return;

 bubbles.push({
 id: contact.id || contact.normalized_number,
 name,
 phone: contact.normalized_number || contact.contact_phone || contact.phone_number || '',
 avatar: contact.photo_uri || null,
 initials: contact.initials || callerInitials(name, contact.normalized_number),
 color: contact.avatar_color || avatarColorForIdentity(name, contact.normalized_number),
 });
 });
 }
 } catch (error) {
 console.warn('[Shield] Native contact bubbles unavailable:', error);
 }
 }

 return bubbles;
 }, { ttl: 3000 });

 useEffect(() => {
 if (!features.scamEngine) return;
 const interval = setInterval(() => {
 const nextProtection = readNativeProtectionState();
 if (nextProtection) {
 setNativeProtection(nextProtection);
 setThreatsBlocked(prev => Math.max(prev, Number(nextProtection.stats?.capturedCalls || 0), prev));
 }
 }, 2000);
 return () => clearInterval(interval);
 }, [features.scamEngine]);

 const incomingGsmReady = Boolean(nativeProtection?.incomingGsmReady || nativeProtection?.callerIdReady);
 const outgoingGsmReady = Boolean(
 nativeProtection?.outgoingGsmReady ||
 nativeProtection?.callRedirectionRole ||
 nativeProtection?.defaultDialer
 );
 const fullGsmCoverageReady = Boolean(nativeProtection?.fullGsmCoverageReady);
 const aiReady = Boolean(nativeProtection?.nativeCaptureReady || nativeProtection?.callerIdReady);
 const scamReady = Boolean(nativeProtection?.callScreeningRole || nativeProtection?.nativeCaptureReady);
 const scamBlocksLive = Boolean(nativeProtection?.callScreeningRole);
 const darkWebReady = Boolean(nativeProtection?.nativeCaptureReady);
 const antiTrackerReady = Boolean(nativeProtection?.nativeCaptureReady);
 const aiActive = features.aiScreen && aiReady;
 const scamActive = features.scamEngine && scamReady;
 const darkWebActive = features.darkWeb && darkWebReady;
 const antiTrackerActive = features.antiTracker && antiTrackerReady;
 const activeFeaturesCount = [
 aiActive,
 scamActive,
 darkWebActive,
 antiTrackerActive,
 ].filter(Boolean).length;
 const isFullySecure = activeFeaturesCount >= 3 && incomingGsmReady;
 const coverageLabel = fullGsmCoverageReady
 ? 'All GSM Protected'
 : incomingGsmReady
 ? 'Incoming Protected'
 : outgoingGsmReady
 ? 'Outgoing Protected'
 : 'Action Required';
 const coverageDetail = fullGsmCoverageReady
 ? 'Inbound + outbound'
 : outgoingGsmReady
 ? 'Outgoing shield active'
 : 'Enable outgoing shield';

 const isLight = themeMode === 'light';
 const isGlass = themeMode === 'glass';

 const rootClass = isGlass ? 'bg-transparent text-white' : isLight ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#0B0410] text-white';
 const cardClass = isGlass ? 'bg-white/5 border-white/10 backdrop-blur-xl' : isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-gradient-to-b from-white/[0.06] to-white/[0.02] border-white/10 backdrop-blur-xl';
 const subtextClass = isLight ? 'text-slate-500' : 'text-white/50';
 const subtextMutedClass = isLight ? 'text-slate-400' : 'text-white/40';
 const titleClass = isLight ? 'text-slate-800' : 'text-white/80';
 const headingClass = isLight ? 'text-slate-900' : 'text-white';
 const borderLightClass = isLight ? 'border-slate-200' : 'border-white/10';
 const bgSubtleClass = isLight ? 'bg-slate-100' : 'bg-white/5';

 return (
 <div className={cn("h-screen flex flex-col relative overflow-hidden font-sans w-full sm:max-w-[430px] mx-auto sm:border-x sm:border-white/5 shadow-2xl transition-colors duration-700", rootClass)}>
 {isGlass && (
 <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl -z-10" />
 )}
 
 {/* Dynamic Background Ambient Glows */}
 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full blur-[120px] pointer-events-none transition-colors duration-700" style={{ backgroundColor: themeColor + '26' }} />
 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none transition-colors duration-700" style={{ backgroundColor: themeColor + '1A' }} />

 {/* Main Scrollable Content */}
 <main className="flex-1 overflow-y-auto px-5 pt-12 pb-32 relative z-10 custom-scrollbar">
 
 {/* Header & Contact Bubbles */}
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shadow-lg shrink-0 transition-colors duration-500" style={{ boxShadow: `0 4px 20px ${themeColor}33`, backgroundColor: themeColor + '1A', border: `1px solid ${themeColor}4D` }}>
 <img src={chatrLogo} alt="Chatr Shield" className="w-6 h-6 object-contain drop-shadow-md" />
 </div>
 
 <div className={cn("flex max-w-[260px] gap-2 overflow-x-auto rounded-full border p-1.5 backdrop-blur-md no-scrollbar", isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/5 border-white/5")}>
 {topContacts && topContacts.length > 0 ? topContacts.slice(0, 8).map(contact => (
 <button
 key={contact.id}
 onClick={() => navigate('/calls/contacts')}
 className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 text-[11px] font-black text-white shadow-lg active:scale-95"
 style={{ backgroundColor: themeColor }}
 aria-label={`Open ${contact.name}`}
 >
 {contact.avatar ? (
 <img src={contact.avatar} alt={contact.name} className="h-full w-full object-cover" />
 ) : (
 contact.initials
 )}
 </button>
 )) : (
 <button
 onClick={() => {
 window.ChatrNativeRuntime?.requestContactsPermission?.();
 navigate('/calls/contacts');
 }}
 className="flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-[11px] font-bold text-white/80 active:scale-95"
 >
 <UserPlus className="h-4 w-4" style={{ color: themeColor }} />
 Sync
 </button>
 )}
 </div>
 </div>
 
 <div className="relative shrink-0">
 <Avatar className={cn("h-10 w-10 border ring-2 ring-offset-2 transition-all duration-500", isLight ? "border-slate-200 ring-offset-[#F8FAFC]" : "border-white/10 ring-offset-[#0B0410]")} style={{ '--tw-ring-color': themeColor + '4D' } as React.CSSProperties}>
 <AvatarImage src={profile?.avatar_url} />
 <AvatarFallback className={headingClass} style={{ backgroundColor: themeColor + '33' }}>A</AvatarFallback>
 </Avatar>
 <div className={cn("absolute bottom-0 right-0 w-3 h-3 bg-[#25D366] border-[2px] rounded-full", isLight ? "border-[#F8FAFC]" : "border-[#0B0410]")} />
 </div>
 </div>

 {/* Compact Horizontal Security Status Banner */}
 <div
 className={cn("relative w-full rounded-[24px] border p-4 flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.05)] mb-6 transition-all duration-500 cursor-pointer active:scale-[0.98]", cardClass)}
 onClick={() => {
 if (!fullGsmCoverageReady) {
 window.ChatrNativeRuntime?.requestOutgoingGsmSetup?.();
 }
 }}
 >
 
 <div className="flex items-center gap-4">
 {/* Mini Glowing Shield */}
 <div className="relative w-12 h-12 flex items-center justify-center shrink-0 transition-all duration-500">
 <div className="absolute inset-0 rounded-full border animate-[ping_3s_ease-out_infinite]" style={{ borderColor: themeColor + '4D' }} />
 <div className="absolute inset-1 rounded-full border border-dashed animate-[spin_10s_linear_infinite]" style={{ borderColor: themeColor + '80' }} />
 <div className="absolute inset-2 blur-md rounded-full" style={{ backgroundColor: themeColor + '66' }} />
 
 <Shield className={cn("w-5 h-5 relative z-10 transition-colors duration-500", headingClass)} style={{ fill: isFullySecure ? themeColor : '#4b5563', filter: `drop-shadow(0 0 10px ${isFullySecure ? themeColor : '#4b5563'})` }} />
 </div>

 {/* Status & Stats */}
 <div className="flex flex-col justify-center">
 <div className="flex items-center gap-1.5 mb-1">
 <CheckCircle2 className="w-4 h-4" style={{ color: isFullySecure ? themeColor : '#ef4444' }} />
 <h2 className={cn("text-[14px] font-bold tracking-wide", headingClass)}>
 {coverageLabel}
 </h2>
 </div>
 <div className="flex items-center gap-2">
 <span className={cn("text-[11px] font-medium", subtextClass)}>
 <span className={cn("font-bold tabular-nums", headingClass)}>{threatsBlocked.toLocaleString()}</span> Blocked
 </span>
 <span className="w-1 h-1 rounded-full bg-white/20" />
 <span className="text-[11px] font-bold transition-colors duration-500" style={{ color: fullGsmCoverageReady ? themeColor : '#f59e0b' }}>
 {coverageDetail}
 </span>
 </div>
 </div>
 </div>
 
 <ChevronRight className="w-5 h-5 text-white/20" />
 </div>

 {/* Premium Features Grid (Interactive) */}
 <h3 className={cn("text-[13px] font-semibold tracking-wide mb-3 px-1", titleClass)}>Active Defenses</h3>
 <div className="grid grid-cols-2 gap-3 mb-6">
 
 {/* AI Voice Screening */}
 <div 
 onClick={() => toggleFeature('aiScreen')}
 className={cn("rounded-[24px] border p-4 relative overflow-hidden group cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-xl active:scale-95", cardClass, !aiActive && "opacity-70 grayscale")}
 style={{ borderColor: aiActive ? themeColor + '4D' : undefined, boxShadow: aiActive ? `0 10px 30px -10px ${themeColor}4D` : 'none' }}
 >
 <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full transition-colors duration-500" style={{ backgroundColor: aiActive ? themeColor + '1A' : 'transparent' }} />
 <Bot className="w-6 h-6 mb-3 transition-colors duration-500" style={{ color: aiActive ? themeColor : '#6b7280' }} />
 <h4 className={cn("text-[13px] font-bold mb-1", headingClass)}>AI Call Screen</h4>
 <p className={cn("text-[10px] leading-tight", subtextClass)}>
 {aiReady ? 'Identifies unknown GSM callers on ring.' : 'Needs phone and overlay setup.'}
 </p>
 {!aiReady && <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-bold", borderLightClass, titleClass)}>Set up</span>}
 <div className="absolute top-4 right-4 w-2 h-2 rounded-full transition-all duration-500" style={{ backgroundColor: aiActive ? themeColor : (isLight ? '#cbd5e1' : '#374151'), boxShadow: aiActive ? `0 0 8px ${themeColor}CC` : 'none' }} />
 </div>

 {/* Real-time Spam Blocking */}
 <div 
 onClick={() => toggleFeature('scamEngine')}
 className={cn("rounded-[24px] border p-4 relative overflow-hidden group cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-xl active:scale-95", cardClass, !scamActive && "opacity-70 grayscale")}
 style={{ borderColor: scamActive ? themeColor + '4D' : undefined, boxShadow: scamActive ? `0 10px 30px -10px ${themeColor}4D` : 'none' }}
 >
 <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full transition-colors duration-500" style={{ backgroundColor: scamActive ? themeColor + '1A' : 'transparent' }} />
 <AlertOctagon className="w-6 h-6 mb-3 transition-colors duration-500" style={{ color: scamActive ? themeColor : '#6b7280' }} />
 <h4 className={cn("text-[13px] font-bold mb-1", headingClass)}>Scam Engine</h4>
 <p className={cn("text-[10px] leading-tight", subtextClass)}>
 {scamBlocksLive ? 'Blocks risky incoming GSM calls live.' : scamReady ? 'Scores GSM calls; live block needs role.' : 'Needs Call Screening role.'}
 </p>
 {!scamReady && <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-bold", borderLightClass, titleClass)}>Set up</span>}
 <div className="absolute top-4 right-4 w-2 h-2 rounded-full transition-all duration-500" style={{ backgroundColor: scamActive ? themeColor : (isLight ? '#cbd5e1' : '#374151'), boxShadow: scamActive ? `0 0 8px ${themeColor}CC` : 'none' }} />
 </div>

 {/* Deep Web Monitor */}
 <div 
 onClick={() => toggleFeature('darkWeb')}
 className={cn("rounded-[24px] border p-4 relative overflow-hidden group cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-xl active:scale-95", cardClass, !darkWebActive && "opacity-70 grayscale")}
 style={{ borderColor: darkWebActive ? themeColor + '4D' : undefined, boxShadow: darkWebActive ? `0 10px 30px -10px ${themeColor}4D` : 'none' }}
 >
 <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full transition-colors duration-500" style={{ backgroundColor: darkWebActive ? themeColor + '1A' : 'transparent' }} />
 <Radar className="w-6 h-6 mb-3 transition-colors duration-500" style={{ color: darkWebActive ? themeColor : '#6b7280' }} />
 <h4 className={cn("text-[13px] font-bold mb-1", headingClass)}>Dark Web Scan</h4>
 <p className={cn("text-[10px] leading-tight", subtextClass)}>
 {darkWebReady ? 'Checks leaked identity signals during caller lookup.' : 'Needs GSM capture setup.'}
 </p>
 {!darkWebActive && (
 <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-bold", borderLightClass, titleClass)}>
 Set up
 </span>
 )}
 <div className="absolute top-4 right-4 w-2 h-2 rounded-full transition-all duration-500" style={{ backgroundColor: darkWebActive ? themeColor : (isLight ? '#cbd5e1' : '#374151'), boxShadow: darkWebActive ? `0 0 8px ${themeColor}CC` : 'none' }} />
 </div>

 {/* Anti-Tracking */}
 <div 
 onClick={() => toggleFeature('antiTracker')}
 className={cn("rounded-[24px] border p-4 relative overflow-hidden group cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-xl active:scale-95", cardClass, !antiTrackerActive && "opacity-70 grayscale")}
 style={{ borderColor: antiTrackerActive ? themeColor + '4D' : undefined, boxShadow: antiTrackerActive ? `0 10px 30px -10px ${themeColor}4D` : 'none' }}
 >
 <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full transition-colors duration-500" style={{ backgroundColor: antiTrackerActive ? themeColor + '1A' : 'transparent' }} />
 <EyeOff className="w-6 h-6 mb-3 transition-colors duration-500" style={{ color: antiTrackerActive ? themeColor : '#6b7280' }} />
 <h4 className={cn("text-[13px] font-bold mb-1", headingClass)}>Anti-Tracker</h4>
 <p className={cn("text-[10px] leading-tight", subtextClass)}>
 {antiTrackerReady ? 'Hash-only lookup for GSM caller identity.' : 'Needs call capture permission.'}
 </p>
 {!antiTrackerReady && <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-bold", borderLightClass, titleClass)}>Set up</span>}
 <div className="absolute top-4 right-4 w-2 h-2 rounded-full transition-all duration-500" style={{ backgroundColor: antiTrackerActive ? themeColor : (isLight ? '#cbd5e1' : '#374151'), boxShadow: antiTrackerActive ? `0 0 8px ${themeColor}CC` : 'none' }} />
 </div>
 </div>

 {/* Split Cards: Recent Activity & Quick Actions */}
 <div className="grid grid-cols-2 gap-4">
 
 {/* Recent Activity */}
 <div className={cn("rounded-[28px] border p-5 flex flex-col transition-all duration-500 hover:-translate-y-1 hover:shadow-xl cursor-pointer", cardClass)} onClick={() => navigate('/calls/recents')} style={{ boxShadow: `0 10px 30px -15px ${themeColor}33` }}>
 <div className="flex justify-between items-center mb-5">
 <span className={cn("text-[13px] font-medium", titleClass)}>Recent Activity</span>
 <ChevronRight className={cn("w-4 h-4", subtextMutedClass)} />
 </div>

 <div className="space-y-4">
 {recentsLoading && dialerRecents.length === 0 ? (
 [0, 1, 2].map(item => (
 <div key={item} className="flex items-center gap-3">
 <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/10" />
 <div className="flex-1 space-y-2">
 <div className="h-3 w-20 animate-pulse rounded-full bg-white/10" />
 <div className="h-2 w-16 animate-pulse rounded-full bg-white/5" />
 </div>
 </div>
 ))
 ) : dialerRecents.length > 0 ? dialerRecents.slice(0, 3).map((call, i) => {
 const resolvedName = chooseCallerDisplayName([call.displayName], call.phoneNumber);
 const displayName = resolvedName || formatPhoneForDisplay(call.phoneNumber, true);
 const avatar = (call as any).avatarUrl;
 const time = new Date(call.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 const status = (['missed', 'rejected', 'blocked'].includes((call as any).callStatus) || call.trustBand === 'block')
 ? 'missed'
 : (call as any).direction === 'outgoing'
 ? 'outgoing'
 : 'incoming';
 const StatusIcon = status === 'missed' ? PhoneMissed : status === 'outgoing' ? PhoneOutgoing : PhoneIncoming;
 const statusColor = status === 'missed' ? '#F43F5E' : status === 'outgoing' ? '#3B82F6' : '#10B981';
 const statusText = status === 'missed' ? 'Missed' : status === 'outgoing' ? 'Outgoing' : 'Incoming';
 const attempts = (call as any).attemptCount || 1;
 
 return (
 <div key={(call as any).id || `${call.phoneNumber}-${i}`} className="flex items-center gap-3">
 <div className="relative shrink-0">
 <Avatar className="h-9 w-9 border border-white/5">
 <AvatarImage src={avatar || undefined} />
 <AvatarFallback className="text-[11px] font-black text-white" style={{ backgroundColor: avatarColorForIdentity(resolvedName, call.phoneNumber) }}>
 {callerInitials(resolvedName, call.phoneNumber)}
 </AvatarFallback>
 </Avatar>
 <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#091a13] rounded-full transition-colors duration-500" style={{ backgroundColor: themeColor }} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex justify-between items-center mb-0.5">
 <span className={cn("text-[12px] font-bold truncate", headingClass)}>{displayName || "Unknown"}</span>
 <span className={cn("text-[9px]", subtextMutedClass)}>{time}</span>
 </div>
 <div className="flex items-center gap-1">
 <StatusIcon className="w-2.5 h-2.5" style={{ color: statusColor }} />
 <Lock className="w-2.5 h-2.5 transition-colors duration-500" style={{ color: themeColor }} />
 <span className={cn("text-[9px] truncate", subtextClass)}>
 {statusText}{attempts > 1 ? ` (${attempts})` : ''} secured
 </span>
 </div>
 </div>
 </div>
 );
 }) : (
 <div className="text-[11px] text-white/40 text-center py-4 flex flex-col items-center">
 <Activity className="w-5 h-5 text-white/20 mb-2" />
 No recent activity
 </div>
 )}
 </div>
 </div>

 {/* Quick Actions */}
 <div className={cn("rounded-[28px] border p-5 flex flex-col transition-all duration-500 hover:-translate-y-1 hover:shadow-xl", cardClass)} style={{ boxShadow: `0 10px 30px -15px ${themeColor}33` }}>
 <span className={cn("text-[13px] font-medium mb-5", titleClass)}>Quick Actions</span>
 
 <div className="grid grid-cols-2 gap-y-6 gap-x-2 flex-1 place-content-center">
 <div className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/chat')}>
 <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center", bgSubtleClass, borderLightClass)}>
 <MessageCircle className={cn("w-5 h-5", titleClass)} />
 </div>
 <span className={cn("text-[9px] text-center font-medium leading-tight", subtextClass)}>Secure<br/>Chat</span>
 </div>
 
 <div className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/calls/keypad')}>
 <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center", bgSubtleClass, borderLightClass)}>
 <Phone className={cn("w-5 h-5", titleClass)} />
 </div>
 <span className={cn("text-[9px] text-center font-medium leading-tight", subtextClass)}>Dial<br/>Secure</span>
 </div>
 
 <div className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/calls/contacts')}>
 <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center", bgSubtleClass, borderLightClass)}>
 <Contact className={cn("w-5 h-5", titleClass)} />
 </div>
 <span className={cn("text-[9px] text-center font-medium leading-tight", subtextClass)}>Shield<br/>Contacts</span>
 </div>
 
 <div className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/chatr-wallet')}>
 <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center", bgSubtleClass, borderLightClass)}>
 <Wallet className={cn("w-5 h-5", titleClass)} />
 </div>
 <span className={cn("text-[9px] text-center font-medium leading-tight", subtextClass)}>Crypto<br/>Vault</span>
 </div>
 </div>
 </div>
 </div>

 {/* Theme Customization */}
 <div className={cn("mt-6 rounded-[28px] border p-5 mb-8 transition-all duration-500", cardClass)}>
 <div className="flex items-center justify-between mb-4">
 <h3 className={cn("text-[13px] font-semibold tracking-wide", titleClass)}>Personalize App Theme</h3>
 
 {setThemeMode && (
 <div className={cn("flex items-center rounded-full p-1 border", isLight ? "bg-slate-100 border-slate-200" : "bg-black/20 border-white/10")}>
 {['dark', 'glass', 'light'].map((mode) => (
 <button
 key={mode}
 onClick={() => setThemeMode(mode as any)}
 className={cn(
 "px-3 py-1 rounded-full text-[10px] font-bold capitalize transition-all",
 themeMode === mode ? (isLight ? "bg-white shadow-sm text-slate-900" : "bg-white/20 text-white") : (isLight ? "text-slate-500" : "text-white/50")
 )}
 >
 {mode}
 </button>
 ))}
 </div>
 )}
 </div>
 <p className={cn("text-[10px] leading-tight mb-4", subtextClass)}>
 Customise the aesthetic of your incoming and outgoing calls, dashboard, and dialer.
 </p>
 <div className="flex flex-wrap gap-4 justify-between">
 {[
 { id: 'purple', color: '#8B5CF6', name: 'Cosmic' },
 { id: 'blue', color: '#3B82F6', name: 'Ocean' },
 { id: 'emerald', color: '#10B981', name: 'Aurora' },
 { id: 'rose', color: '#F43F5E', name: 'Sunset' },
 { id: 'amber', color: '#F59E0B', name: 'Amber' },
 { id: 'pearl', color: '#F8FAFC', name: 'Pearl' },
 { id: 'mint', color: '#A7F3D0', name: 'Mint' },
 { id: 'pink', color: '#F9A8D4', name: 'Blush' },
 { id: 'cyan', color: '#67E8F9', name: 'Sky' },
 ].map(t => (
 <button
 key={t.id}
 onClick={() => setThemeColor(t.color)}
 className={cn(
 "w-10 h-10 rounded-full border-2 transition-all duration-500 active:scale-95 hover:scale-110",
 themeColor === t.color ? (isLight ? "border-slate-400 scale-110 shadow-md" : "border-white scale-110 shadow-lg") : "border-transparent opacity-70 hover:opacity-100"
 )}
 style={{ 
 backgroundColor: t.color, 
 boxShadow: themeColor === t.color ? `0 0 20px ${t.color}` : 'none' 
 }}
 aria-label={`Select ${t.name} theme`}
 />
 ))}
 </div>
 </div>

 </main>
 </div>
 );
};
