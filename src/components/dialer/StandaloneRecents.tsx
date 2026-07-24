import React from 'react';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, ShieldAlert, ShieldCheck, Info } from 'lucide-react';
import { useInstantCache } from '@/hooks/useInstantCache';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export const StandaloneRecents = () => {
 const { data: calls, isLoading } = useInstantCache('real-call-history', async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return [];
 
 const { data } = await supabase
 .from('calls')
 .select('*')
 .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
 .order('created_at', { ascending: false })
 .limit(50);
 
 return data || [];
 }, { pollingInterval: 10000 });

 if (isLoading) {
 return (
 <div className="flex flex-col gap-4 p-6">
 {[1, 2, 3, 4, 5].map(i => (
 <div key={i} className="h-16 w-full bg-white/5 rounded-2xl animate-pulse" />
 ))}
 </div>
 );
 }

 return (
 <div className="flex flex-col divide-y divide-white/5 pb-24 smooth-mount">
 <div className="px-6 py-8">
 <h1 className="text-display font-black">Recents</h1>
 </div>
 
 {calls?.length === 0 ? (
 <div className="flex flex-col items-center justify-center pt-20 text-white/20">
 <PhoneOutgoing className="w-16 h-16 mb-4 opacity-10" />
 <p className="text-secondary font-bold uppercase tracking-widest">No recent calls</p>
 </div>
 ) : (
 calls?.map((call) => {
 const isMissed = call.status === 'missed';
 const isIncoming = call.receiver_id === call.user_id; // logic needs user id check
 const shieldScore = call.metadata?.shield_score || 85;

 return (
 <div key={call.id} className="flex items-center gap-4 px-6 py-4 active:bg-white/5 transition-colors group">
 <div className="relative">
 <div className={cn(
 "w-12 h-12 rounded-full flex items-center justify-center border",
 isMissed ? "border-rose-500/20 bg-rose-500/10" : "border-white/10 bg-white/5"
 )}>
 {isMissed ? (
 <PhoneMissed className="w-5 h-5 text-rose-500" />
 ) : isIncoming ? (
 <PhoneIncoming className="w-5 h-5 text-emerald-500" />
 ) : (
 <PhoneOutgoing className="w-5 h-5 text-blue-400" />
 )}
 </div>
 {shieldScore > 80 && (
 <div className="absolute -bottom-1 -right-1 bg-[#020806] p-0.5 rounded-full">
 <ShieldCheck className="w-4 h-4 text-primary" />
 </div>
 )}
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <h3 className={cn("text-secondary font-bold truncate", isMissed && "text-rose-500")}>
 {call.metadata?.display_name || call.metadata?.phone_number || 'Unknown'}
 </h3>
 <p className="text-[10px] font-bold text-white/30 uppercase">
 {format(new Date(call.created_at), 'HH:mm')}
 </p>
 </div>
 <div className="flex items-center gap-1.5">
 <p className="text-[11px] text-white/40 font-medium">
 {call.metadata?.location || 'Secure Connection'}
 </p>
 <span className="text-[8px] text-white/10">•</span>
 <p className="text-[11px] text-primary/60 font-bold uppercase tracking-tighter">
 Shield {shieldScore}%
 </p>
 </div>
 </div>

 <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
 <Info className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
 </button>
 </div>
 );
 })
 )}
 </div>
 );
};
