import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Mic, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, UserPlus, AlertCircle, MessageSquare, Shield, Smartphone } from 'lucide-react';
import { useDialerData } from '@/hooks/useDialerData';
import { CallerIntelligence } from '@/lib/chatr-shield/types';
import { supabase } from '@/integrations/supabase/client';
import {
 avatarColorForIdentity,
 callerInitials,
 chooseCallerDisplayName,
 createFallbackCallerIdentity,
 formatPhoneForDisplay,
 getPhoneLookupKey,
 getCountryIsoCodeForPhone,
} from '@/utils/callerIdentityResolver';
import { AISummaryCard, CallSummaryData } from '../AISummaryCard';
import { cn } from '@/lib/utils';

interface RecentsScreenProps {
 onCall?: (number: string) => void;
 onInfoClick?: () => void;
 themeColor?: string;
 themeMode?: 'dark' | 'light' | 'glass';
}

interface GroupedCall {
 key: string;
 caller: CallerIntelligence;
 count: number;
 status: 'incoming' | 'outgoing' | 'missed';
 lastTimestamp: string;
}

function getDayGroup(dateStr: string) {
 const date = new Date(dateStr);
 const today = new Date();
 const yesterday = new Date(today);
 yesterday.setDate(yesterday.getDate() - 1);
 
 if (date.toDateString() === today.toDateString()) return 'Today';
 if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
 return 'Older';
}

function formatCallTime(dateStr: string, group: string) {
 const date = new Date(dateStr);
 // Prevent "Invalid Date"
 if (isNaN(date.getTime())) return dateStr;
 
 const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
 
 if (group === 'Today') return timeString;
 
 const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
 return `${days[date.getDay()]}, ${timeString}`;
}

const RecentsScreen: React.FC<RecentsScreenProps> = ({ onCall, themeColor = 'var(--dialer-primary)', themeMode = 'dark' }) => {
 const [searchQuery, setSearchQuery] = useState('');
 const [filterMode, setFilterMode] = useState<'All' | 'Incoming' | 'Outgoing' | 'Missed'>('All');
 const [selectedCallTarget, setSelectedCallTarget] = useState<{name: string, phone: string} | null>(null);
 const [contactMatches, setContactMatches] = useState<CallerIntelligence[]>([]);
 const [callSummaries, setCallSummaries] = useState<Record<string, CallSummaryData>>({});
 const { recents, loading } = useDialerData();

 // Load AI call summaries stored by the native Android CallSummaryEngine
 useEffect(() => {
 const loadSummaries = async () => {
 try {
 const raw = (window as any)?.ChatrNativeRuntime?.getCallSummaries?.();
 if (raw) {
 const parsed: CallSummaryData[] = typeof raw === 'string' ? JSON.parse(raw) : raw;
 const map: Record<string, CallSummaryData> = {};
 parsed.forEach(s => { map[s.phoneNumber] = s; });
 setCallSummaries(map);
 }
 } catch (e) {
 console.warn('[Recents] Failed to load AI summaries:', e);
 }
 };
 loadSummaries();
 }, [recents]);

 useEffect(() => {
 const query = searchQuery.trim();
 if (query.length < 2) {
 setContactMatches([]);
 return;
 }

 let cancelled = false;
 const timer = window.setTimeout(async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const digits = query.replace(/\D/g, '');
 const filters = [`contact_name.ilike.%${query}%`];
 if (digits.length >= 3) filters.push(`contact_phone.ilike.%${digits}%`);

 const { data, error } = await supabase
 .from('contacts')
 .select('id, contact_name, contact_phone, contact_user_id, is_registered')
 .eq('user_id', user.id)
 .or(filters.join(','))
 .order('contact_name')
 .limit(20);

 if (cancelled) return;
 if (error) {
 console.warn('[Recents] Contact search failed:', error);
 setContactMatches([]);
 return;
 }

 setContactMatches((data || []).map((contact: any) => ({
 ...createFallbackCallerIdentity(getPhoneLookupKey(contact.contact_phone)),
 displayName: contact.contact_name || contact.contact_phone,
 phoneNumber: getPhoneLookupKey(contact.contact_phone),
 isContact: true,
 isVerified: !!contact.is_registered,
 trustScore: contact.is_registered ? 95 : 85,
 trustBand: 'safe',
 confidenceLevel: 'high',
 aiSummary: contact.is_registered ? 'Saved contact on Chatr.' : 'Saved phonebook contact.',
 aiFlags: ['Phonebook'],
 lastActive: new Date().toISOString(),
 } as any)));
 }, 180);

 return () => {
 cancelled = true;
 window.clearTimeout(timer);
 };
 }, [searchQuery]);

 const filteredRecents = useMemo(() => {
 let list = recents.map((call) => ({
 ...call,
 status: (['missed', 'rejected', 'blocked'].includes((call as any).callStatus) || call.trustBand === 'block')
 ? 'missed'
 : (call as any).direction === 'outgoing'
 ? 'outgoing'
 : 'incoming'
 }));

 if (filterMode !== 'All') {
 list = list.filter(c => c.status === filterMode.toLowerCase());
 }

 if (searchQuery.trim()) {
 const q = searchQuery.toLowerCase();
 list = list.filter(
 c => c.displayName?.toLowerCase().includes(q) || c.phoneNumber?.includes(q)
 );
 }
 return list;
 }, [recents, searchQuery, filterMode]);

 // Group by date categories and search real synced contacts.
 const groupedByDate = useMemo(() => {
 const groups: Record<string, GroupedCall[]> = { 'Today': [], 'Yesterday': [], 'Older': [] };
 
 // Process recent calls
 filteredRecents.forEach((call, index) => {
 const groupName = getDayGroup(call.lastActive);
 groups[groupName].push({
 key: `recent-${call.phoneNumber}-${index}`,
 caller: call,
 count: (call as any).attemptCount || 1,
 status: call.status,
 lastTimestamp: call.lastActive
 });
 });

 if (searchQuery.trim() && contactMatches.length > 0) {
 const seenRecentPhones = new Set(filteredRecents.map(call => getPhoneLookupKey(call.phoneNumber)));
 groups['Contacts'] = [];
 contactMatches.forEach((contact, index) => {
 if (seenRecentPhones.has(getPhoneLookupKey(contact.phoneNumber))) return;
 groups['Contacts'].push({
 key: `contact-${contact.phoneNumber}-${index}`,
 caller: contact,
 count: 0,
 status: 'outgoing',
 lastTimestamp: new Date().toISOString()
 });
 });
 }
 
 return groups;
 }, [filteredRecents, searchQuery, contactMatches]);

 const getStatusIcon = (status: GroupedCall['status'], isSpam: boolean, isGlobal: boolean = false) => {
 if (isGlobal) return <Phone size={14} className="text-white/40" />;
 if (isSpam) return <PhoneMissed size={14} className="text-[#F43F5E]" />;
 switch (status) {
 case 'missed': return <PhoneMissed size={14} className="text-[#F43F5E]" />;
 case 'outgoing': return <PhoneOutgoing size={14} style={{ color: themeColor }} />;
 default: return <PhoneIncoming size={14} className="text-[#10B981]" />;
 }
 };

 const handleNativeRoute = (routeType: string, targetPhone?: string) => {
 const phone = targetPhone || selectedCallTarget?.phone;
 if (!phone) return;
 
 if (routeType === 'chatr') {
 onCall?.(phone);
 } else {
 // For SIM1, SIM2, Whatsapp, we trigger the native OS Intent via the bridge
 if (window.ChatrNativeRuntime?.routeCall) {
 window.ChatrNativeRuntime.routeCall(phone, routeType);
 } else {
 // Fallback for Web/PWA
 if (routeType === 'whatsapp') {
 window.location.href = `https://wa.me/${phone.replace(/\D/g, '')}`;
 } else {
 window.location.href = `tel:${phone}`;
 }
 }
 }
 
 setSelectedCallTarget(null);
 };

 const isLight = themeMode === 'light';
 const isGlass = themeMode === 'glass';
 const bgClass = isGlass ? 'bg-transparent text-white' : isLight ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#09090B] text-white';
 const cardBgClass = isLight ? 'bg-white' : 'bg-[#09090B]/80';
 const borderLight = isLight ? 'border-slate-200' : 'border-white/10';

 return (
 <div className={cn("min-h-screen font-sans pb-32 relative overflow-x-hidden", bgClass)}>
 
 {/* Search Bar (Premium Glass) */}
 <div className={cn("px-5 pt-6 pb-2 sticky top-0 z-50 backdrop-blur-md", cardBgClass)}>
 <div className="flex items-center bg-white/[0.05] rounded-2xl px-4 py-3.5 border border-white/10 transition-all duration-500 group focus-within:ring-2" style={{ borderColor: searchQuery ? themeColor + '66' : 'rgba(255,255,255,0.1)', boxShadow: searchQuery ? `0 0 20px ${themeColor}1A` : 'none' }}>
 <Search size={20} className="mr-3 transition-colors duration-500" style={{ color: searchQuery ? themeColor : 'rgba(255,255,255,0.4)' }} />
 <input
 type="text"
 placeholder="Search contacts"
 className="flex-1 bg-transparent border-none outline-none text-white text-[17px] placeholder:text-white/30"
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 />
 <Mic size={20} className="text-white/40 ml-2 hover:text-white transition-colors" />
 </div>
 </div>

 {/* Filter Chips */}
 <div className="px-5 pb-4 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar">
 {['All', 'Incoming', 'Outgoing', 'Missed'].map(mode => (
 <button
 key={mode}
 onClick={() => setFilterMode(mode as any)}
 className="px-5 py-2 rounded-xl text-[14px] font-bold whitespace-nowrap border transition-all duration-500"
 style={{ 
 backgroundColor: filterMode === mode ? themeColor + '33' : 'transparent', 
 borderColor: filterMode === mode ? themeColor : 'rgba(255,255,255,0.1)',
 color: filterMode === mode ? 'white' : 'rgba(255,255,255,0.6)',
 boxShadow: filterMode === mode ? `0 4px 15px ${themeColor}26` : 'none'
 }}
 >
 {mode}
 </button>
 ))}
 </div>

 {/* Call List */}
 <div className="flex flex-col">
 {loading && recents.length === 0 ? (
 <div className="px-5 py-4 space-y-3">
 {[0, 1, 2, 3, 4].map((item) => (
 <div key={item} className="h-[68px] rounded-2xl bg-white/[0.04] animate-pulse" />
 ))}
 </div>
 ) : ['Today', 'Yesterday', 'Older', 'Contacts'].map((groupName) => {
 const calls = groupedByDate[groupName];
 if (!calls || calls.length === 0) return null;

 return (
 <div key={groupName}>
 <h2 className="px-5 py-3 text-[14px] font-bold text-white/40 tracking-[0.1em] uppercase" style={{ color: themeColor + 'CC' }}>
 {groupName}
 </h2>
 
 {calls.map((item) => {
 const { caller, status, lastTimestamp } = item;
 const resolvedName = chooseCallerDisplayName([caller.displayName], caller.phoneNumber);
 const displayPhone = formatPhoneForDisplay(caller.phoneNumber);
 const isUnknown = !resolvedName;
 const name = resolvedName || displayPhone;
 const isSpam = caller.trustBand === 'block' || caller.isSpam;
 const initials = callerInitials(resolvedName, caller.phoneNumber);
 const timeStr = formatCallTime(lastTimestamp, groupName);
 const avatarColor = avatarColorForIdentity(resolvedName, caller.phoneNumber);
 const callKind = status === 'missed' ? 'Missed' : status === 'outgoing' ? 'Outgoing' : 'Incoming';
 const isoCode = getCountryIsoCodeForPhone(caller.phoneNumber);

 const aiSummary = callSummaries[caller.phoneNumber];

 return (
 <div key={item.key} className={cn("flex flex-col border-b transition-colors", isLight ? "border-slate-200" : "border-white/[0.03]")}>
 <div 
 className={cn("flex items-center px-4 py-3 gap-4 transition-colors cursor-pointer", isLight ? "active:bg-slate-100" : "active:bg-white/[0.03]")}
 onClick={() => handleNativeRoute('chatr', caller.phoneNumber)}
 >
 
 {/* Avatar */}
 <div className="shrink-0 relative">
 {caller.avatarUrl && !isSpam ? (
 <img src={caller.avatarUrl} alt={name} className="w-[44px] h-[44px] rounded-full object-cover" />
 ) : (
 <div
 className="w-[44px] h-[44px] rounded-full flex items-center justify-center text-white text-[17px] font-bold"
 style={{ backgroundColor: isSpam ? '#d93025' : avatarColor }}
 >
 {isSpam ? <AlertCircle size={24} className="fill-white text-[#d93025]" /> : initials}
 </div>
 )}
 </div>
 
 {/* Call Details */}
 <div className="flex-1 min-w-0 flex flex-col justify-center">
 <p className={cn("text-[17px] font-semibold truncate", isSpam ? "text-[#F43F5E]" : (isLight ? "text-slate-900" : "text-white"))}>
 {isSpam ? `Spam Risk (${caller.communityReportCount || caller.spamReports || 1})` : name}
 </p>
 
 <div className="flex items-center gap-1.5 mt-0.5">
 {getStatusIcon(status, isSpam, groupName === 'Contacts')}
 <span className={cn("text-[14px] font-medium truncate flex items-center gap-1.5", isSpam ? 'text-[#F43F5E]' : (isLight ? "text-slate-500" : "text-white/45"))}>
 {isSpam ? `Junk - ${timeStr}` :
 groupName === 'Contacts' ? 'Phonebook contact' :
 isUnknown ? `${caller.carrierData?.state || 'India'} - ${timeStr}` :
 (
 <>
 {callKind} - 
 {isoCode !== 'un' && (
 <img src={`https://flagcdn.com/w20/${isoCode}.png`} alt={isoCode} className="h-3 rounded-sm object-cover ml-0.5 shadow-sm" />
 )}
 {displayPhone} - {timeStr}
 </>
 )}
 </span>
 {item.count > 1 && (
 <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/70">
 {item.count} attempts
 </span>
 )}
 </div>
 </div>

 {/* Phone Icon (Action Sheet) */}
 <button 
 className="p-3 shrink-0 rounded-full active:bg-black/5"
 onClick={(e) => {
 e.stopPropagation();
 setSelectedCallTarget({ name: isSpam ? 'Spam Number' : name, phone: caller.phoneNumber });
 }}
 >
 <Phone size={22} className="text-white/20 group-hover:text-white transition-colors" strokeWidth={1.5} />
 </button>
 </div>

 {/* Chatr AI Post-Call Summary Card */}
 {aiSummary && groupName === 'Today' && (
 <AISummaryCard summary={aiSummary} themeColor={themeColor} />
 )}

 {/* Inline Actions for Unknown/Spam */}
 {(isUnknown || isSpam) && (
 <div className="flex items-center gap-3 pl-[76px] pr-4 pb-4">
 <button className="flex items-center gap-2 px-5 py-2 rounded-xl border border-white/10 bg-white/5 active:bg-white/10 transition-colors">
 <UserPlus size={16} style={{ color: themeColor }} />
 <span className="text-[14px] font-bold text-white/80">Add contact</span>
 </button>
 <button className="flex items-center gap-2 px-5 py-2 rounded-xl border border-white/10 bg-white/5 active:bg-white/10 transition-colors">
 <AlertCircle size={16} className="text-[#F43F5E]" />
 <span className="text-[14px] font-bold text-white/80">Report spam</span>
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>
 );
 })}
 </div>

 {/* OS-Level Routing Action Sheet Overlay */}
 {selectedCallTarget && (
 <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="bg-[#121214] w-full sm:max-w-[430px] rounded-t-[32px] pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-500 border-t border-white/10">
 <div className="p-6 border-b border-white/5 flex justify-between items-center">
 <div>
 <h3 className="text-workspace font-bold text-white tracking-tight">Call via...</h3>
 <p className="text-secondary text-white/40 mt-1">{selectedCallTarget.name} - {selectedCallTarget.phone}</p>
 </div>
 <button 
 onClick={() => setSelectedCallTarget(null)}
 className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold"
 >
 x
 </button>
 </div>
 
 <div className="p-2 flex flex-col gap-1">
 <button onClick={() => handleNativeRoute('chatr')} className="flex items-center gap-4 p-5 rounded-2xl active:bg-white/5 transition-colors text-left w-full group">
 <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500" style={{ backgroundColor: themeColor + '1A', color: themeColor }}>
 <Shield size={20} />
 </div>
 <div>
 <div className="font-bold text-[16px] text-white">Chatr VoIP</div>
 <div className="text-label font-semibold tracking-wide transition-colors duration-500" style={{ color: themeColor }}>SECURE & ENCRYPTED</div>
 </div>
 </button>

 <button onClick={() => handleNativeRoute('sim1')} className="flex items-center gap-4 p-5 rounded-2xl active:bg-white/5 transition-colors text-left w-full group">
 <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/40 group-active:scale-95 transition-transform">
 <Smartphone size={22} />
 </div>
 <div>
 <div className="font-bold text-[16px] text-white">SIM 1</div>
 <div className="text-secondary text-white/30">Jio 4G</div>
 </div>
 </button>

 <button onClick={() => handleNativeRoute('sim2')} className="flex items-center gap-4 p-5 rounded-2xl active:bg-white/5 transition-colors text-left w-full group">
 <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/40 group-active:scale-95 transition-transform">
 <Smartphone size={22} />
 </div>
 <div>
 <div className="font-bold text-[16px] text-white">SIM 2</div>
 <div className="text-secondary text-white/30">Airtel</div>
 </div>
 </button>

 <button onClick={() => handleNativeRoute('whatsapp')} className="flex items-center gap-4 p-5 rounded-2xl active:bg-white/5 transition-colors text-left w-full group">
 <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
 <MessageSquare size={20} />
 </div>
 <div>
 <div className="font-bold text-[16px] text-white">WhatsApp</div>
 <div className="text-secondary text-white/30">Voice Call</div>
 </div>
 </button>
 </div>
 <div className="h-4" />
 </div>
 </div>
 )}
 </div>
 );
};

export default RecentsScreen;
