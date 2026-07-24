import { AdvancedPhoneDialer } from "@/components/dialer/AdvancedPhoneDialer";
import { useNativeHaptics } from "@/hooks/useNativeHaptics";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhoneNumber } from "@/utils/phoneHashUtil";
import { resolveCallAvatar, resolveCallDisplayName } from "@/utils/callIdentity";
import { setPreCallMediaStream, clearPreCallMediaStream } from "@/utils/preCallMedia";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PENDING_OUTGOING_CALL_KEY = 'chatr:pending-outgoing-call';

export default function StandaloneDialer() {
 const navigate = useNavigate();
 const haptics = useNativeHaptics();
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);

 useEffect(() => {
 supabase.auth.getUser().then(({ data: { user } }) => {
 if (!user) {
 navigate('/auth');
 } else {
 setCurrentUserId(user.id);
 }
 });
 }, [navigate]);

 const generateCallId = () => {
 return crypto.randomUUID();
 };

 const resolveChatrReceiver = async (target: string) => {
 if (looksLikeUuid(target)) {
 const { data } = await supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url, phone_number')
 .eq('id', target)
 .maybeSingle();

 return data;
 }

 const normalized = normalizePhoneNumber(target);
 const digits = target.replace(/\D/g, '');
 const lastTen = digits.slice(-10);

 if (normalized) {
 const { data } = await supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url, phone_number')
 .eq('phone_number', normalized)
 .maybeSingle();

 if (data) return data;
 }

 if (lastTen) {
 const { data } = await supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url, phone_number')
 .ilike('phone_search', `%${lastTen}%`)
 .limit(1)
 .maybeSingle();

 if (data) return data;
 }

 return null;
 };

 const handleNonChatrNumber = async (target: string) => {
 const phone = normalizePhoneNumber(target) || target;
 if (!phone) {
 toast.error('Enter a valid phone number');
 return;
 }

 haptics.error();
 toast.error('ChatrCalls supports VoIP calls to Chatr users only');

 try {
 await (supabase as any).from('call_insights').upsert({
 user_id: currentUserId,
 number: phone,
 tags: ['Invite', 'Non-Chatr'],
 notes: 'Tried to call from ChatrCalls. Number is not a Chatr VoIP user yet.',
 suggested_action: 'Invite this number to Chatr before calling',
 last_activity: new Date().toISOString(),
 }, {
 onConflict: 'user_id,number',
 });
 } catch (error) {
 console.warn('Could not save non-Chatr call insight', error);
 }
 };

 const requestPermissionsAndCall = async (target: string, name: string, callType: 'voice' | 'video') => {
 const receiverProfile = await resolveChatrReceiver(target);

 if (!receiverProfile) {
 await handleNonChatrNumber(target);
 return;
 }

 const callId = generateCallId();
 haptics.medium();

 try {
 const stream = await navigator.mediaDevices.getUserMedia({
 audio: true,
 video: callType === 'video',
 });

 setPreCallMediaStream(callId, stream);
 await handleCall(receiverProfile.id, name, callType, callId);
 } catch (error: any) {
 clearPreCallMediaStream(callId);
 haptics.error();
 toast.error('Could not access device. Please try again.');
 }
 };

 const handleCall = async (target: string, displayName: string, callType: 'voice' | 'video', callId: string) => {
 if (!currentUserId) return;

 try {
 // 1. Try to find profile by ID or Phone
 let receiverId = target;
 let receiverProfile = null;

 if (looksLikeUuid(target)) {
 const { data } = await supabase.from('profiles').select('*').eq('id', target).single();
 receiverProfile = data;
 } else {
 const normalized = normalizePhoneNumber(target);
 const { data } = await supabase.from('profiles').select('*').eq('phone_number', normalized).maybeSingle();
 receiverProfile = data;
 if (receiverProfile) receiverId = receiverProfile.id;
 }

 if (!receiverProfile) {
 await handleNonChatrNumber(target);
 clearPreCallMediaStream(callId);
 return;
 }

 // 2. Resolve final display names and numbers
 const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
 
 const callerPhone = normalizePhoneNumber(myProfile?.phone_number || '');
 const receiverPhone = normalizePhoneNumber(receiverProfile?.phone_number || target);
 
 const finalCallerName = resolveCallDisplayName(myProfile, myProfile?.username, callerPhone);
 const finalReceiverName = receiverProfile ? resolveCallDisplayName(receiverProfile, displayName, receiverPhone) : displayName;
 
 const callerAvatar = resolveCallAvatar(myProfile);
 const receiverAvatar = receiverProfile ? resolveCallAvatar(receiverProfile) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${finalReceiverName}`;

 if (!callerPhone || !receiverPhone) {
 clearPreCallMediaStream(callId);
 toast.error('Phone numbers missing');
 return;
 }

 // 3. Create conversation if receiver is a known user
 let conversationId = null;
 if (receiverProfile) {
 const { data: convId } = await supabase.rpc('create_direct_conversation', { other_user_id: receiverProfile.id });
 conversationId = convId;
 }

 // 4. Record the call
 await supabase.from('calls').insert({
 id: callId,
 conversation_id: conversationId,
 caller_id: currentUserId,
 caller_name: finalCallerName,
 caller_avatar: callerAvatar || null,
 caller_phone: callerPhone,
 receiver_id: receiverProfile.id,
 receiver_name: finalReceiverName,
 receiver_avatar: receiverAvatar || null,
 receiver_phone: receiverPhone,
 call_type: callType,
 status: 'ringing'
 });

 haptics.success();
 
 // 5. Trigger notification if receiver is a user
 if (receiverProfile) {
 supabase.functions.invoke('fcm-notify', {
 body: {
 type: 'call',
 receiverId: receiverProfile.id,
 callerId: currentUserId,
 callerName: finalCallerName,
 callerAvatar: callerAvatar || '',
 callerPhone,
 callId,
 callType
 }
 });
 }

 toast.success(`Calling ${finalReceiverName}...`);

 // 6. Local signaling for UI. Persist the event briefly so the full
 // call screen still opens if the native shell is finishing startup.
 const outgoingCallDetail = {
 callId,
 receiverId: receiverProfile.id,
 displayName: finalReceiverName,
 avatar: receiverAvatar,
 phone: receiverPhone,
 callType
 };

 try {
 sessionStorage.setItem(PENDING_OUTGOING_CALL_KEY, JSON.stringify(outgoingCallDetail));
 } catch (storageError) {
 console.warn('Could not persist outgoing call handoff', storageError);
 }

 const dispatchOutgoingCall = () => {
 window.dispatchEvent(new CustomEvent('initiate-call', { detail: outgoingCallDetail }));
 };

 dispatchOutgoingCall();
 window.setTimeout(dispatchOutgoingCall, 400);

 } catch (error) {
 console.error('Call failed:', error);
 clearPreCallMediaStream(callId);
 haptics.error();
 toast.error('Failed to start call');
 }
 };

 const looksLikeUuid = (str: string) => {
 const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 return regex.test(str);
 };

 const handleChat = async (phone: string) => {
 haptics.medium();
 const normalized = normalizePhoneNumber(phone);
 
 try {
 // Find if user exists
 const { data: profile } = await supabase.from('profiles').select('id').eq('phone_number', normalized).maybeSingle();
 
 if (profile) {
 const { data: conversationId } = await supabase.rpc('create_direct_conversation', { 
 other_user_id: profile.id 
 });
 
 if (conversationId) {
 navigate(`/chat/${conversationId}`);
 } else {
 toast.error('Could not start chat');
 }
 } else {
 toast.info('User not on Chatr network yet. Sending invite link...');
 // In a real app, this would trigger an SMS invite
 }
 } catch (err) {
 toast.error('Network error. Try again later.');
 }
 };

 if (!currentUserId) return null;

 return (
 <div className="flex h-screen flex-col bg-background safe-area-pt">
 <AdvancedPhoneDialer 
 onCall={requestPermissionsAndCall} 
 onChat={handleChat}
 />
 </div>
 );
}
