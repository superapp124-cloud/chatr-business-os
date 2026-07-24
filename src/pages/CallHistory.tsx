import { useState, useEffect, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Trash2, Search, UserPlus, Grid3X3, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CallHistoryEmptyState, CallListSkeleton } from "@/components/ui/PremiumEmptyStates";
import { PhoneDialer } from "@/components/calling/PhoneDialer";
import { clearPreCallMediaStream, setPreCallMediaStream } from "@/utils/preCallMedia";
import { AppleHeader } from "@/components/ui/AppleHeader";
import { AppleSegmentedControl } from '@/components/ui/AppleSegmentedControl';
import { AppleSearchBar } from '@/components/ui/AppleInput';
import { AppleCard } from '@/components/ui/AppleCard';
import { AppleIconButton, AppleButton } from '@/components/ui/AppleButton';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { cn } from '@/lib/utils';
import { resolveCallAvatar, resolveCallDisplayName } from '@/utils/callIdentity';
import { normalizePhoneNumber } from '@/utils/phoneHashUtil';
import { CallInsightsPanel } from '@/components/calling/CallInsightsPanel';
import { SpamReportModal } from '@/components/calling/SpamReportModal';
import { subscribeToNativeNavigate } from '@/hooks/useNativeNavigate';
import { Brain, ShieldAlert, Shield, ShieldX } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import '../types/plugins';

interface Call {
 id: string;
 conversation_id: string;
 call_type: string;
 status: string;
 started_at: string;
 ended_at: string | null;
 duration: number | null;
 caller_id: string;
 receiver_id: string;
 caller_phone?: string | null;
 receiver_phone?: string | null;
 caller?: { username: string; avatar_url: string } | null;
 receiver?: { username: string; avatar_url: string } | null;
 missed?: boolean;
 created_at?: string;
 riskLevel?: string;
 decision?: string;
 intent?: string;
}

export default function CallHistory() {
 const navigate = useNavigate();
 const haptics = useNativeHaptics();
 const [calls, setCalls] = useState<Call[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeFilter, setActiveFilter] = useState<string>('all');
 const [currentUserId, setCurrentUserId] = useState<string | undefined>();
 const [contacts, setContacts] = useState<any[]>([]);
 const [searchQuery, setSearchQuery] = useState('');
 const [showNewCall, setShowNewCall] = useState(false);
 const [showDialer, setShowDialer] = useState(false);
 const [insightPhone, setInsightPhone] = useState<string | null>(null);
 const [insightDuration, setInsightDuration] = useState(0);
 const [spamPhone, setSpamPhone] = useState<string | null>(null);

 // Listen for nativeNavigate events from Android (post-call AI + spam report)
 useEffect(() => {
 const unsub = subscribeToNativeNavigate(detail => {
 if (detail.showInsights && detail.phoneNumber) {
 setInsightPhone(detail.phoneNumber);
 }
 if (detail.showSpamReport && detail.phoneNumber) {
 setSpamPhone(detail.phoneNumber);
 }
 });
 return unsub;
 }, []);

 useEffect(() => {
 loadCalls();
 loadContacts();

 const channel = supabase
 .channel('call-history')
 .on('postgres_changes', {
 event: '*',
 schema: 'public',
 table: 'calls',
 }, () => {
 loadCalls();
 })
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, []);

 const loadCalls = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 
 setCurrentUserId(user.id);

 // 1. Fetch Cloud Calls
 const { data, error } = await supabase
 .from('calls')
 .select('id, conversation_id, call_type, status, started_at, ended_at, duration, caller_id, receiver_id, caller_name, caller_avatar, caller_phone, receiver_name, receiver_avatar, receiver_phone, missed, created_at')
 .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
 .order('created_at', { ascending: false })
 .limit(50);

 if (error) throw error;
 
 let callsWithProfiles = (data || []).map(call => ({
 ...call,
 caller: { username: call.caller_name || 'Unknown', avatar_url: call.caller_avatar },
 receiver: { username: call.receiver_name || 'Unknown', avatar_url: call.receiver_avatar }
 })) as Call[];

 // 2. Enhance with Native Caller Intelligence if available
 if (Capacitor.isNativePlatform() && Capacitor.Plugins.ChatrIntelligence) {
 try {
 const { calls: nativeCalls } = await Capacitor.Plugins.ChatrIntelligence.getRecentCalls({ limit: 50 });
 const nativeCallMap = new Map();
 if (Array.isArray(nativeCalls)) {
 nativeCalls.forEach((nc: any) => {
 nativeCallMap.set(nc.deviceEventId, nc);
 nativeCallMap.set(nc.normalizedNumber, nc);
 });
 }

 callsWithProfiles = callsWithProfiles.map(call => {
 const isOutgoing = call.caller_id === user.id;
 const phone = isOutgoing ? call.receiver_phone : call.caller_phone;
 const nativeInfo = nativeCallMap.get(call.id) || (phone ? nativeCallMap.get(phone) : null);
 
 if (nativeInfo) {
 return {
 ...call,
 riskLevel: nativeInfo.defenseResult?.riskLevel,
 decision: nativeInfo.defenseResult?.decision,
 intent: nativeInfo.intentPrediction?.label
 };
 }
 return call;
 });
 } catch (err) {
 console.warn('Failed to load native Caller Intelligence', err);
 }
 }
 
 setCalls(callsWithProfiles);
 } catch (error) {
 console.error('Error loading calls:', error);
 toast.error('Failed to load call history');
 } finally {
 setLoading(false);
 }
 };

 const loadContacts = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { data, error } = await supabase
 .from('profiles')
 .select('*')
 .neq('id', user.id)
 .order('username');

 if (error) throw error;
 setContacts(data || []);
 } catch (error) {
 console.error('Error loading contacts:', error);
 }
 };

 const deleteCall = async (callId: string) => {
 haptics.light();
 try {
 const { error } = await supabase
 .from('calls')
 .delete()
 .eq('id', callId);

 if (error) throw error;

 setCalls(calls.filter(call => call.id !== callId));
 toast.success('Call deleted');
 } catch (error) {
 console.error('Error deleting call:', error);
 toast.error('Failed to delete call');
 }
 };

 const generateCallId = (): string => {
 if (typeof crypto !== 'undefined' && crypto.randomUUID) {
 return crypto.randomUUID();
 }
 const bytes = new Uint8Array(16);
 crypto.getRandomValues(bytes);
 bytes[6] = (bytes[6] & 0x0f) | 0x40;
 bytes[8] = (bytes[8] & 0x3f) | 0x80;
 const toHex = (n: number) => n.toString(16).padStart(2, '0');
 const b = Array.from(bytes, toHex).join('');
 return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`;
 };

 const startCall = async (contactId: string, callType: 'voice' | 'video') => {
 haptics.medium();
 const callId = generateCallId();
 
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 toast.error('Please sign in to make calls');
 return;
 }

 const stream = await navigator.mediaDevices.getUserMedia({
 audio: true,
 video: callType === 'video',
 });
 setPreCallMediaStream(callId, stream);

 const { data: receiverProfile, error: receiverError } = await supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url, phone_number')
 .eq('id', contactId)
 .single();

 if (receiverError || !receiverProfile) {
 clearPreCallMediaStream(callId);
 toast.error('Contact not found');
 return;
 }

 const { data: profile } = await supabase
 .from('profiles')
 .select('full_name, username, avatar_url, phone_number')
 .eq('id', user.id)
 .single();

 const callerPhone = normalizePhoneNumber(profile?.phone_number || '');
 const receiverPhone = normalizePhoneNumber(receiverProfile?.phone_number || '');
 const callerDisplayName = resolveCallDisplayName(profile, profile?.username, callerPhone);
 const receiverDisplayName = resolveCallDisplayName(receiverProfile, receiverPhone);
 const callerAvatar = resolveCallAvatar(profile);
 const receiverAvatar = resolveCallAvatar(receiverProfile);

 if (!callerPhone || !receiverPhone) {
 clearPreCallMediaStream(callId);
 toast.error('This call needs a real phone number on both Chatr profiles');
 return;
 }

 const { data: conversationId, error: conversationError } = await supabase.rpc(
 'create_direct_conversation',
 { other_user_id: contactId }
 );

 if (conversationError || !conversationId) {
 clearPreCallMediaStream(callId);
 toast.error('Could not create conversation');
 return;
 }

 const { data: callData, error: callError } = await supabase
 .from('calls')
 .insert({
 id: callId,
 conversation_id: conversationId,
 caller_id: user.id,
 caller_name: callerDisplayName,
 caller_avatar: callerAvatar || null,
 caller_phone: callerPhone,
 receiver_id: contactId,
 receiver_name: receiverDisplayName,
 receiver_avatar: receiverAvatar || null,
 receiver_phone: receiverPhone,
 call_type: callType,
 status: 'ringing'
 })
 .select()
 .single();

 if (callError) {
 clearPreCallMediaStream(callId);
 toast.error('Could not start call');
 return;
 }

 try {
 await supabase.functions.invoke('fcm-notify', {
 body: {
 type: 'call',
 receiverId: contactId,
 callerId: user.id,
 callerName: callerDisplayName,
 callerAvatar: callerAvatar || '',
 callerPhone,
 callId: callData.id,
 callType: callType
 }
 });
 } catch (fcmError) {
 console.warn('FCM notification failed:', fcmError);
 }

 setShowNewCall(false);
 setShowDialer(false);
 loadCalls();
 } catch (error: any) {
 console.error('Error starting call:', error);
 clearPreCallMediaStream(callId);
 
 if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
 toast.error(callType === 'video'
 ? 'Please allow camera and microphone to make video calls'
 : 'Please allow microphone to make voice calls'
 );
 } else {
 toast.error('Failed to start call');
 }
 }
 };

 const handleDialerCall = (contactId: string, contactName: string, callType: 'voice' | 'video') => {
 startCall(contactId, callType);
 };

 const formatDuration = (seconds: number | null) => {
 if (!seconds) return '0:00';
 const mins = Math.floor(seconds / 60);
 const secs = seconds % 60;
 return `${mins}:${secs.toString().padStart(2, '0')}`;
 };

 const getCallIcon = (call: Call) => {
 if (call.call_type === 'video') return <Video className="h-4 w-4" />;
 
 if (call.status === 'rejected' || call.status === 'missed' || call.missed) {
 return <PhoneMissed className="h-4 w-4 text-destructive" />;
 }
 
 return call.caller_id === currentUserId ? 
 <PhoneOutgoing className="h-4 w-4 text-green-500" /> :
 <PhoneIncoming className="h-4 w-4 text-blue-500" />;
 };

 const getContactInfo = (call: Call) => {
 const isOutgoing = call.caller_id === currentUserId;
 return {
 name: isOutgoing ? call.receiver?.username : call.caller?.username,
 avatar: isOutgoing ? call.receiver?.avatar_url : call.caller?.avatar_url,
 };
 };

 const filteredCalls = activeFilter === 'all' 
 ? calls 
 : calls.filter(call => call.status === 'missed' || call.missed);

 const filteredContacts = contacts.filter(contact =>
 contact.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
 contact.phone_number?.includes(searchQuery)
 );

 const openConversation = (conversationId?: string | null) => {
 if (!conversationId) {
 toast.info('Conversation is still syncing for this call');
 return;
 }

 haptics.light();
 navigate(`/chat/${conversationId}`);
 };

 const segmentOptions = [
 { value: 'all', label: 'All' },
 { value: 'missed', label: 'Missed' }
 ];

 return (
 <div className="flex flex-col h-screen bg-background safe-area-pb">
 {/* Apple-style Header */}
 <AppleHeader
 title="Calls"
 largeTitle
 glass
 rightAction={
 <div className="flex items-center gap-1">
 <AppleIconButton 
 variant="ghost" 
 icon={<Grid3X3 className="h-5 w-5" />}
 onClick={() => {
 haptics.light();
 setShowDialer(true);
 }}
 />
 <Dialog open={showNewCall} onOpenChange={setShowNewCall}>
 <DialogTrigger asChild>
 <AppleIconButton 
 variant="ghost" 
 icon={<UserPlus className="h-5 w-5" />}
 onClick={() => haptics.light()}
 />
 </DialogTrigger>
 <DialogContent className="max-w-md rounded-2xl">
 <DialogHeader>
 <DialogTitle>New Call</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <AppleSearchBar
 placeholder="Search contacts..."
 value={searchQuery}
 onChange={setSearchQuery}
 />
 <ScrollArea className="h-[400px]">
 <div className="space-y-2">
 {filteredContacts.map((contact) => (
 <div
 key={contact.id}
 className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors"
 >
 <Avatar className="w-12 h-12">
 <AvatarImage src={contact.avatar_url} />
 <AvatarFallback className="bg-primary/10 text-primary font-semibold">
 {contact.username?.[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1">
 <p className="font-semibold">{contact.username}</p>
 {contact.phone_number && (
 <p className="text-secondary text-muted-foreground">{contact.phone_number}</p>
 )}
 </div>
 <div className="flex gap-1">
 <AppleIconButton
 variant="ghost"
 icon={<Phone className="h-4 w-4" />}
 onClick={() => startCall(contact.id, 'voice')}
 />
 <AppleIconButton
 variant="ghost"
 icon={<Video className="h-4 w-4" />}
 onClick={() => startCall(contact.id, 'video')}
 />
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 }
 />

 {/* Segmented Control */}
 <div className="px-4 py-2 bg-background/80 backdrop-blur-xl border-b border-border/50">
 <AppleSegmentedControl
 options={segmentOptions}
 value={activeFilter}
 onChange={(value) => {
 haptics.light();
 setActiveFilter(value);
 }}
 fullWidth
 />
 </div>

 <ScrollArea className="flex-1">
 <div className="p-4 space-y-2">
 {loading ? (
 <CallListSkeleton count={6} />
 ) : filteredCalls.length === 0 ? (
 <CallHistoryEmptyState onStartCall={() => {
 haptics.light();
 setShowNewCall(true);
 }} />
 ) : (
 filteredCalls.map((call) => {
 const contact = getContactInfo(call);
 const isOutgoing = call.caller_id === currentUserId;

 return (
 <AppleCard
 key={call.id}
 pressable
 onPress={() => openConversation(call.conversation_id)}
 className="flex items-center gap-4 p-4"
 >
 <Avatar className="w-12 h-12">
 <AvatarImage src={contact.avatar} />
 <AvatarFallback className="bg-primary/10 text-primary font-semibold">
 {contact.name?.[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="font-semibold truncate">{contact.name}</p>
 {getCallIcon(call)}
 </div>
 {call.intent && call.intent !== 'unknown' && (
 <p className="text-label text-primary capitalize">{call.intent}</p>
 )}
 <div className="flex items-center gap-2 text-secondary text-muted-foreground">
 <span>{isOutgoing ? 'Outgoing' : 'Incoming'}</span>
 {call.duration && call.status === 'ended' && (
 <>
 <span>•</span>
 <span>{formatDuration(call.duration)}</span>
 </>
 )}
 {call.riskLevel && (
 <>
 <span>•</span>
 <span className={cn("flex items-center gap-1 text-label", 
 call.riskLevel === 'scam' ? "text-destructive font-bold" :
 call.riskLevel === 'suspicious' ? "text-yellow-600 font-medium" :
 "text-green-600"
 )}>
 {call.riskLevel === 'scam' ? <ShieldX className="h-3 w-3" /> :
 call.riskLevel === 'suspicious' ? <ShieldAlert className="h-3 w-3" /> :
 <Shield className="h-3 w-3" />}
 {call.riskLevel}
 </span>
 </>
 )}
 </div>
 <p className="text-label text-muted-foreground">
 {formatDistanceToNow(new Date(call.started_at || call.created_at || new Date().toISOString()), { addSuffix: true })}
 </p>
 </div>

 <div className="flex items-center gap-1">
 <AppleIconButton
 variant="ghost"
 icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
 onClick={(event: MouseEvent<HTMLButtonElement>) => {
 event.stopPropagation();
 openConversation(call.conversation_id);
 }}
 />
 <AppleIconButton
 variant="ghost"
 icon={<Brain className="h-4 w-4 text-primary" />}
 onClick={(event: MouseEvent<HTMLButtonElement>) => {
 event.stopPropagation();
 const phone = isOutgoing ? call.receiver_phone : call.caller_phone;
 setInsightDuration(call.duration ?? 0);
 setInsightPhone(phone ?? '');
 }}
 />
 <AppleIconButton
 variant="ghost"
 icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
 onClick={(event: MouseEvent<HTMLButtonElement>) => {
 event.stopPropagation();
 const phone = isOutgoing ? call.receiver_phone : call.caller_phone;
 setSpamPhone(phone ?? '');
 }}
 />
 <AppleIconButton
 variant="ghost"
 icon={<Trash2 className="h-4 w-4 text-muted-foreground" />}
 onClick={(event: MouseEvent<HTMLButtonElement>) => {
 event.stopPropagation();
 deleteCall(call.id);
 }}
 />
 </div>
 </AppleCard>
 );
 })
 )}
 </div>
 </ScrollArea>
 
 {/* Phone Dialer */}
 <PhoneDialer
 open={showDialer}
 onClose={() => setShowDialer(false)}
 onCall={handleDialerCall}
 />
 </div>
 );
}
