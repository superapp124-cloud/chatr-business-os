import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { StandaloneCallsDashboard } from './StandaloneCallsDashboard';
import KeypadScreen from './chatr-calls/screens/KeypadScreen';
import RecentsScreen from './chatr-calls/screens/RecentsScreen';
import FavoritesScreen from './chatr-calls/screens/FavoritesScreen';
import ContactsScreen from './chatr-calls/screens/ContactsScreen';
import { StandaloneCallsNav } from './StandaloneCallsNav';
import { PageLoader } from '../PageLoader';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneNumber } from '@/utils/phoneHashUtil';
import { resolveCallAvatar, resolveCallDisplayName } from '@/utils/callIdentity';
import { setPreCallMediaStream, clearPreCallMediaStream } from '@/utils/preCallMedia';
import { toast } from 'sonner';

export const StandaloneCallsApp = () => {
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 const [themeColor, setThemeColor] = useState(() => localStorage.getItem('chatr-theme-color') || '#8B5CF6');
 const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'glass'>(() => (localStorage.getItem('chatr-theme-mode') as 'dark' | 'light' | 'glass') || 'dark');

 useEffect(() => {
 localStorage.setItem('chatr-theme-color', themeColor);
 }, [themeColor]);

 useEffect(() => {
 localStorage.setItem('chatr-theme-mode', themeMode);
 }, [themeMode]);

 useEffect(() => {
 supabase.auth.getUser().then(({ data: { user } }) => {
 if (user) setCurrentUserId(user.id);
 });
 }, []);
 
 // ... handleNonChatrNumber and handleCall remain same ...
 const handleNonChatrNumber = async (target: string) => {
 toast.error('ChatrCalls supports VoIP calls to Chatr users only');
 };

 const handleCall = async (target: string, callType: 'voice' | 'video' = 'voice') => {
 if (!currentUserId || !target) return;
 const callId = crypto.randomUUID();

 try {
 const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
 setPreCallMediaStream(callId, stream);

 const normalized = normalizePhoneNumber(target);
 const { data: receiverProfile } = await supabase.from('profiles').select('*').eq('phone_number', normalized).maybeSingle();
 
 if (!receiverProfile) {
 await handleNonChatrNumber(target);
 clearPreCallMediaStream(callId);
 return;
 }

 const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
 const callerPhone = normalizePhoneNumber(myProfile?.phone_number || '');
 const receiverPhone = normalizePhoneNumber(receiverProfile.phone_number || target);
 
 const finalCallerName = resolveCallDisplayName(myProfile, myProfile?.username, callerPhone);
 const finalReceiverName = resolveCallDisplayName(receiverProfile, receiverProfile.full_name, receiverPhone);
 
 const callerAvatar = resolveCallAvatar(myProfile);
 const receiverAvatar = resolveCallAvatar(receiverProfile);

 const { data: convId } = await supabase.rpc('create_direct_conversation', { other_user_id: receiverProfile.id });

 await supabase.from('calls').insert({
 id: callId,
 conversation_id: convId,
 caller_id: currentUserId,
 caller_name: finalCallerName,
 caller_avatar: callerAvatar,
 caller_phone: callerPhone,
 receiver_id: receiverProfile.id,
 receiver_name: finalReceiverName,
 receiver_avatar: receiverAvatar,
 receiver_phone: receiverPhone,
 call_type: callType,
 status: 'ringing'
 });

 supabase.functions.invoke('fcm-notify', {
 body: { type: 'call', receiverId: receiverProfile.id, callerId: currentUserId, callerName: finalCallerName, callerAvatar, callerPhone, callId, callType }
 });

 const outgoingCallDetail = {
 callId,
 receiverId: receiverProfile.id,
 displayName: finalReceiverName,
 avatar: receiverAvatar,
 phone: receiverPhone,
 callType
 };

 sessionStorage.setItem('chatr:pending-outgoing-call', JSON.stringify(outgoingCallDetail));
 window.dispatchEvent(new CustomEvent('initiate-call', { detail: outgoingCallDetail }));
 toast.success(`Calling ${finalReceiverName}...`);

 } catch (error) {
 console.error('Call failed:', error);
 clearPreCallMediaStream(callId);
 toast.error('Failed to start call');
 }
 };

 return (
 <div className="flex flex-col min-h-screen bg-[#09090B] text-white w-full sm:max-w-[430px] mx-auto sm:border-x sm:border-white/5 shadow-2xl relative overflow-hidden font-sans">
 <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
 <Suspense fallback={<PageLoader />}>
 <Routes>
 <Route index element={<StandaloneCallsDashboard themeColor={themeColor} setThemeColor={setThemeColor} themeMode={themeMode} setThemeMode={setThemeMode} />} />
 <Route path="favorites" element={<FavoritesScreen themeColor={themeColor} themeMode={themeMode} />} />
 <Route path="recents" element={<RecentsScreen themeColor={themeColor} themeMode={themeMode} onCall={(num) => handleCall(num, 'voice')} />} />
 <Route path="contacts" element={<ContactsScreen themeColor={themeColor} themeMode={themeMode} />} />
 <Route path="keypad" element={<KeypadScreen themeColor={themeColor} themeMode={themeMode} onCall={(num) => handleCall(num, 'voice')} />} />
 <Route path="*" element={<Navigate to="/calls" replace />} />
 </Routes>
 </Suspense>
 <StandaloneCallsNav themeColor={themeColor} themeMode={themeMode} />
 </div>
 );
};
