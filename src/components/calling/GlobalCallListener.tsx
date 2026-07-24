import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { IncomingCallScreen } from "./IncomingCallScreen";
import UnifiedCallScreen from "./UnifiedCallScreen";
import CallHandoffBanner from "./CallHandoffBanner";
import { useCallHandoff } from "@/hooks/useCallHandoff";
import IncomingCallOverlay from "@/components/chatr-shield/IncomingCallOverlay";

import { sendSignal, prefetchTurnConfig } from "@/utils/webrtcSignaling";
import { SimpleWebRTCCall, getExistingCall } from "@/utils/simpleWebRTC";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { clearPreCallMediaStream, setPreCallMediaStream, takePreCallMediaStream } from "@/utils/preCallMedia";
import { looksLikePhoneIdentity, looksLikeUuid, resolveCallAvatar, resolveCallDisplayName } from "@/utils/callIdentity";
import { resolveCallerIdentity } from "@/utils/callerIdentityResolver";
import { normalizePhoneNumber } from "@/utils/phoneHashUtil";
import {
 describePhoneRoute,
 parsePhoneRouteDecision,
 type PhoneCoreRouteDecision,
} from "@/core/phone/phoneRoute";
import {
 dismissIncomingCallNotification,
 showIncomingCallNotification,
 syncSystemCallIdentityToNative,
} from "@/utils/androidBridge";
import {
 BUSY_TONE_AUTO_END_MS,
 FAILED_TONE_AUTO_END_MS,
 callProgressToneStateManager,
} from "@/utils/callProgressTones";
import { socketService, type CallProgressEvent } from "@/services/socketService";

const PENDING_OUTGOING_CALL_KEY = 'chatr:pending-outgoing-call';

// Native call state helpers - inlined to avoid module resolution issues
const isCallAcceptedByNative = (callId?: string): boolean => {
 const state = (window as any).__CALL_STATE__;
 if (!state?.accepted) return false;
 if (callId && state.callId !== callId) return false;
 console.log(`[NativeCall] Call ${callId?.slice(0, 8) || 'any'} already accepted by native`);
 return true;
};

const clearNativeCallState = (): void => {
 (window as any).__CALL_STATE__ = undefined;
 console.log('[NativeCall] Native call state cleared');
};

// ARCHITECTURE: Only skip web call UI if native TelecomManager/CallKit is ACTUALLY available
// Plain Capacitor wrappers (without CallKit plugin) should use web UI
const isNativeShell = () => Capacitor.isNativePlatform();
const hasNativeCallUI = () =>
 (typeof window !== "undefined" && !!(window as any).ChatrCall) ||
 (isNativeShell() && (Capacitor.getPlatform() === "android" || !!(window as any).CallKit));

export function GlobalCallListener() {
 const navigate = useNavigate();
 const location = useLocation();
 const hasNativeUI = hasNativeCallUI();

 // ── Desktop Calls route guard ──────────────────────────────────────────────
 // ALL /desktop/* routes manage their own WebRTC via GroupCallManager.
 // GlobalCallListener must NOT render full-screen UI on ANY desktop route —
 // doing so creates a SECOND competing WebRTC call (from the legacy
 // SimpleWebRTCCall stack) that blocks media flow from GroupCallManager.
 // Subscriptions still run so mobile-side call notifications work correctly.
 const isDesktopCallsRoute = location.pathname.startsWith('/desktop');
 // ──────────────────────────────────────────────────────────────────────────

 const MAX_RINGING_RECOVERY_AGE_MS = 45_000; // Increased to 45s to prevent premature expiry during cold boots/user reaction times
 const [incomingCall, setIncomingCall] = useState<any>(null);
 const [activeCall, setActiveCall] = useState<any>(null);

 // Device fingerprint for handoff
 const deviceFingerprint = useRef(
 btoa(`${navigator.userAgent}-${screen.width}x${screen.height}-${Intl.DateTimeFormat().resolvedOptions().timeZone}`).slice(0, 32)
 ).current;

 const {
 incomingHandoff,
 acceptHandoff,
 rejectHandoff,
 } = useCallHandoff(deviceFingerprint);
 const [outgoingCall, setOutgoingCall] = useState<any>(null); // NEW: Track outgoing calls (caller side)
 const [userId, setUserId] = useState<string | null>(null);

 const incomingCallRef = useRef<any>(null);
 const outgoingCallRef = useRef<any>(null);
 const activeCallRef = useRef<any>(null);
 const nativeActionInFlightRef = useRef<Set<string>>(new Set());
 const incomingRecoveryInFlightRef = useRef<Promise<void> | null>(null);
 const lastReceiverStatusRef = useRef<Map<string, string>>(new Map());
 const dismissedIncomingCallIdsRef = useRef<Set<string>>(new Set());
 const nativeIncomingPresentedIdsRef = useRef<Set<string>>(new Set());
 const locallyEndingCallIdsRef = useRef<Set<string>>(new Set());
 const locallyAnsweredCallIdsRef = useRef<Set<string>>(new Set());
 const terminalToneTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
 const terminatedCallIdsRef = useRef<Set<string>>(new Set());

 const markCallAsTerminated = (callId: string): boolean => {
 if (terminatedCallIdsRef.current.has(callId)) {
 return false; // Already terminated, silent drop
 }
 terminatedCallIdsRef.current.add(callId);
 nativeIncomingPresentedIdsRef.current.delete(callId);
 console.log(`[GlobalCallListener] Call ${callId.slice(0, 8)} marked as terminated, ignoring future end events`);
 
 // Auto-clear from set after 60 seconds to prevent leaks
 setTimeout(() => {
 terminatedCallIdsRef.current.delete(callId);
 console.log(`[GlobalCallListener] Removed call ${callId.slice(0, 8)} from terminated set`);
 }, 60000);
 
 return true; // First execution allowed
 };
 const isAppVisible = () => {
 if (typeof document === "undefined") return true;
 return document.visibilityState === "visible";
 };

 const isRingingCallStale = (call: any) => {
 if (!call?.created_at) return false;
 const createdAt = new Date(call.created_at).getTime();
 if (Number.isNaN(createdAt)) return false;
 return Date.now() - createdAt > MAX_RINGING_RECOVERY_AGE_MS;
 };

 const expireStaleRingingCall = async (call: any, reason: string) => {
 if (!call?.id) return;

 console.log(
 `[GlobalCallListener] ${reason}: expiring stale ringing call ${call.id.slice(0, 8)}`
 );

 if (incomingCallRef.current?.id === call.id) {
 incomingCallRef.current = null;
 setIncomingCall(null);
 }

 if (hasNativeUI && !dismissedIncomingCallIdsRef.current.has(call.id)) {
 dismissIncomingCallNotification(call.id);
 dismissedIncomingCallIdsRef.current.add(call.id);
 }

 lastReceiverStatusRef.current.delete(call.id);

 const { error } = await supabase
 .from("calls")
 .update({
 status: "missed",
 ended_at: new Date().toISOString(),
 missed: true,
 })
 .eq("id", call.id)
 .eq("status", "ringing");

 if (error) {
 console.warn(`[GlobalCallListener] ${reason}: failed to expire stale ringing call`, error);
 }
 };

 const isDndBlockingCall = (settings: any, callerId?: string): boolean => {
 if (!settings?.dndEnabled) return false;
 if (callerId && Array.isArray(settings.allowedDuringDND) && settings.allowedDuringDND.includes(callerId)) {
 return false;
 }

 const schedule = settings.dndSchedule;
 if (!schedule?.enabled) return true;

 const now = new Date();
 const currentDay = now.getDay();
 const currentTime = now.toTimeString().slice(0, 5);

 if (Array.isArray(schedule.days) && !schedule.days.includes(currentDay)) {
 return false;
 }

 const startTime = schedule.startTime || "22:00";
 const endTime = schedule.endTime || "07:00";

 if (startTime > endTime) {
 return currentTime >= startTime || currentTime < endTime;
 }

 return currentTime >= startTime && currentTime < endTime;
 };

 const resolveIncomingUnavailableReason = async (call: any): Promise<"busy" | "dnd" | null> => {
 if (!call?.id || call.status !== "ringing") return null;

 const hasDifferentActiveCall =
 (activeCallRef.current && activeCallRef.current.id !== call.id) ||
 (incomingCallRef.current && incomingCallRef.current.id !== call.id) ||
 (outgoingCallRef.current && outgoingCallRef.current.id !== call.id);

 if (hasDifferentActiveCall) return "busy";

 try {
 const { data: profile } = await supabase
 .from("profiles")
 .select("call_blocking_settings")
 .eq("id", userId)
 .maybeSingle();

 if (isDndBlockingCall(profile?.call_blocking_settings, call.caller_id)) {
 return "dnd";
 }
 } catch (error) {
 console.warn("[GlobalCallListener] DND lookup failed; allowing call", error);
 }

 return null;
 };

 const markIncomingUnavailable = async (
 call: any,
 reason: "busy" | "dnd",
 source: string,
 ) => {
 if (!call?.id) return;

 console.log(`[GlobalCallListener] ${source}: marking call ${call.id.slice(0, 8)} as ${reason}`);

 if (hasNativeUI && !dismissedIncomingCallIdsRef.current.has(call.id)) {
 dismissIncomingCallNotification(call.id);
 dismissedIncomingCallIdsRef.current.add(call.id);
 }

 lastReceiverStatusRef.current.delete(call.id);

 const unavailableUpdate = {
 status: "busy",
 webrtc_state: "failed",
 ended_at: new Date().toISOString(),
 missed: false,
 };

 const { error } = await supabase
 .from("calls")
 .update(unavailableUpdate)
 .eq("id", call.id)
 .eq("status", "ringing");

 if (!error) return;

 console.warn("[GlobalCallListener] Busy status update failed, falling back to ended", error);
 await supabase
 .from("calls")
 .update({
 status: "ended",
 webrtc_state: "failed",
 ended_at: new Date().toISOString(),
 missed: false,
 })
 .eq("id", call.id)
 .eq("status", "ringing");
 };

 const clearTerminalToneTimer = (callId: string) => {
 const timer = terminalToneTimersRef.current.get(callId);
 if (timer) {
 clearTimeout(timer);
 terminalToneTimersRef.current.delete(callId);
 }
 };

 const finishOutgoingAfterTerminalTone = (
 callId: string,
 delayMs: number,
 finalWebrtcState: "ended" | "failed" = "failed",
 ) => {
 clearTerminalToneTimer(callId);

 const timer = setTimeout(async () => {
 terminalToneTimersRef.current.delete(callId);
 callProgressToneStateManager.stop(callId);

 if (outgoingCallRef.current?.id === callId) {
 setOutgoingCall(null);
 }

 if (activeCallRef.current?.id === callId) {
 setActiveCall(null);
 }

 if (incomingCallRef.current?.id === callId) {
 setIncomingCall(null);
 }

 await supabase
 .from("calls")
 .update({
 status: "ended",
 webrtc_state: finalWebrtcState,
 ended_at: new Date().toISOString(),
 missed: false,
 })
 .eq("id", callId)
 .in("status", ["ringing", "busy", "active", "ongoing"]);
 }, delayMs);

 terminalToneTimersRef.current.set(callId, timer);
 };

 const hydrateNativeIncomingCall = async (
 callId: string,
 payload: {
 callerId?: string;
 callerName?: string;
 callerAvatar?: string;
 callerPhone?: string;
 callType?: string;
 conversationId?: string;
 }
 ) => {
 let callRow: any = null;
 const { data: fetchedCall } = await supabase
 .from("calls")
 .select("caller_id, caller_name, caller_avatar, caller_phone, call_type, conversation_id")
 .eq("id", callId)
 .maybeSingle();
 callRow = fetchedCall;

 const resolvedCallerId = payload.callerId || callRow?.caller_id || "";
 let callerProfile: any = null;

 if (resolvedCallerId) {
 const { data: fetchedProfile } = await supabase
 .from("profiles")
 .select("full_name, username, avatar_url, phone_number")
 .eq("id", resolvedCallerId)
 .maybeSingle();
 callerProfile = fetchedProfile;
 }

 const phoneFromName =
 looksLikePhoneIdentity(payload.callerName) ? payload.callerName
 : looksLikePhoneIdentity(callRow?.caller_name) ? callRow?.caller_name
 : "";
 const resolvedCallerPhone = normalizePhoneNumber(
 payload.callerPhone || callerProfile?.phone_number || callRow?.caller_phone || phoneFromName || ""
 );

 // Fallback: If caller profile lookup by ID failed, look up profile by normalized phone number
 if (!callerProfile && resolvedCallerPhone) {
 const { data: fallbackProfile } = await supabase
 .from("profiles")
 .select("full_name, username, avatar_url, phone_number")
 .eq("phone_number", resolvedCallerPhone)
 .maybeSingle();
 if (fallbackProfile) {
 console.log(`[GlobalCallListener] Hydrated caller profile via fallback phone lookup: ${resolvedCallerPhone}`);
 callerProfile = fallbackProfile;
 }
 }

 let trustedCallerIdentity: any = null;
 if (resolvedCallerPhone) {
 try {
 const identity = await resolveCallerIdentity(resolvedCallerPhone, userId);
 if (identity && !["unknown", "global_web"].includes(identity.source)) {
 trustedCallerIdentity = identity;
 }
 } catch (identityError) {
 console.warn(`[GlobalCallListener] Caller identity lookup failed for ${resolvedCallerPhone}`, identityError);
 }
 }

 const resolvedCallerName = resolveCallDisplayName(
 callerProfile,
 trustedCallerIdentity?.displayName,
 payload.callerName,
 callRow?.caller_name,
 resolvedCallerPhone
 );
 const resolvedCallerAvatar = resolveCallAvatar(
 callerProfile,
 trustedCallerIdentity?.avatarUrl,
 payload.callerAvatar,
 callRow?.caller_avatar
 );

 syncSystemCallIdentityToNative({
 callId,
 phoneNumber: resolvedCallerPhone,
 displayName: resolvedCallerName,
 avatarUrl: resolvedCallerAvatar,
 remoteId: resolvedCallerId,
 });

 return {
 callerId: resolvedCallerId,
 callerName: resolvedCallerName,
 callerAvatar: resolvedCallerAvatar,
 callerPhone: resolvedCallerPhone,
 callType: payload.callType || callRow?.call_type || "audio",
 conversationId: payload.conversationId || callRow?.conversation_id || "",
 };
 };

 const startOutgoingFromSystemDialer = async (
 phoneNumber?: string,
 nativeCallId?: string,
 phoneRoute?: PhoneCoreRouteDecision,
 ) => {
 if (!phoneNumber) return;

 if (phoneRoute) {
 console.log(`[GlobalCallListener] Phone route: ${describePhoneRoute(phoneRoute)}`);

 if (phoneRoute.shieldDisposition === "high_risk") {
 console.warn("[GlobalCallListener] High-risk phone route allowed through existing UX contract", phoneRoute);
 }
 }

 let callerUserId = userId;
 if (!callerUserId) {
 const { data } = await supabase.auth.getUser();
 callerUserId = data.user?.id ?? null;
 }

 if (!callerUserId) {
 toast.error("Please sign in before placing Chatr calls");
 return;
 }

 const normalizedPhone = phoneRoute?.normalizedNumber || normalizePhoneNumber(phoneNumber);
 const searchDigits = (phoneRoute?.normalizedNumber || phoneNumber).replace(/\D/g, "");

 let targetProfile: any = null;
 const { data: exactProfile } = await supabase
 .from("profiles")
 .select("id, full_name, username, avatar_url, phone_number, phone_search")
 .eq("phone_number", normalizedPhone)
 .maybeSingle();
 targetProfile = exactProfile;

 if (!targetProfile && searchDigits) {
 const { data: fuzzyProfile } = await supabase
 .from("profiles")
 .select("id, full_name, username, avatar_url, phone_number, phone_search")
 .ilike("phone_search", `%${searchDigits}%`)
 .limit(1)
 .maybeSingle();
 targetProfile = fuzzyProfile;
 }

 if (!targetProfile?.id) {
 toast.info(`No Chatr account found for ${phoneNumber}`);
 return;
 }

 if (targetProfile.id === callerUserId) {
 toast.info("That number belongs to this account");
 return;
 }

 const { data: callerProfile } = await supabase
 .from("profiles")
 .select("full_name, username, avatar_url, phone_number")
 .eq("id", callerUserId)
 .single();

 const callerPhone = normalizePhoneNumber(callerProfile?.phone_number || "");
 const receiverPhone = normalizePhoneNumber(targetProfile.phone_number || normalizedPhone || phoneNumber);
 const callerDisplayName = resolveCallDisplayName(callerProfile, callerPhone);
 const callerAvatar = resolveCallAvatar(callerProfile);
 const receiverDisplayName = resolveCallDisplayName(targetProfile, normalizedPhone, phoneNumber, receiverPhone);
 const receiverAvatar = resolveCallAvatar(targetProfile);
 const callId = nativeCallId || crypto.randomUUID();

 if (!callerPhone || !receiverPhone) {
 toast.error("Both Chatr profiles need a real phone number before system calling can work properly");
 return;
 }

 syncSystemCallIdentityToNative({
 callId,
 phoneNumber: receiverPhone,
 displayName: receiverDisplayName,
 avatarUrl: receiverAvatar || "",
 remoteId: targetProfile.id,
 });

 try {
 try {
 const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
 setPreCallMediaStream(callId, stream);
 } catch (mediaError) {
 console.warn("📱 [GlobalCallListener] System-dialer pre-acquire failed:", mediaError);
 }

 const { data: conversationId, error: conversationError } = await supabase.rpc(
 "create_direct_conversation",
 { other_user_id: targetProfile.id }
 );

 if (conversationError) {
 throw conversationError;
 }

 const { data: callData, error: callError } = await supabase
 .from("calls")
 .insert({
 id: callId,
 conversation_id: conversationId,
 caller_id: callerUserId,
 caller_name: callerDisplayName,
 caller_avatar: callerAvatar || null,
 caller_phone: callerPhone,
 receiver_id: targetProfile.id,
 receiver_name: receiverDisplayName,
 receiver_avatar: receiverAvatar || null,
 receiver_phone: receiverPhone,
 call_type: "voice",
 status: "ringing",
 })
 .select("id")
 .single();

 if (callError || !callData?.id) {
 throw callError || new Error("Could not create outgoing call");
 }

 const nextActiveCall = {
 id: callData.id,
 conversation_id: conversationId,
 caller_id: callerUserId,
 caller_name: callerDisplayName,
 caller_avatar: callerAvatar || null,
 caller_phone: callerPhone,
 receiver_id: targetProfile.id,
 receiver_name: receiverDisplayName,
 receiver_avatar: receiverAvatar || null,
 receiver_phone: receiverPhone,
 call_type: "voice",
 status: "ringing",
 isInitiator: true,
 partnerId: targetProfile.id,
 callerName: receiverDisplayName,
 callerAvatar: receiverAvatar,
 contactPhone: receiverPhone,
 preAcquiredStream: takePreCallMediaStream(callData.id),
 };
 activeCallRef.current = nextActiveCall;
 setActiveCall(nextActiveCall);
 setOutgoingCall(null);
 if (!userId && callerUserId) {
 setUserId(callerUserId);
 }
 /*
 id: callData.id,
 receiverName: receiverDisplayName,
 receiverAvatar: receiverAvatar,
 receiver_phone: receiverPhone,
 call_type: "voice",
 */

 await supabase.functions.invoke("fcm-notify", {
 body: {
 type: "call",
 receiverId: targetProfile.id,
 callerId: callerUserId,
 callerName: callerDisplayName,
 callerAvatar: callerAvatar,
 callerPhone,
 callId: callData.id,
 callType: "voice",
 conversationId,
 },
 });
 } catch (error) {
 clearPreCallMediaStream(callId);
 console.error("📱 [GlobalCallListener] System dialer outgoing failed:", error);
 toast.error("Could not start Chatr call from system dialer");
 }
 };
 
 useEffect(() => {
 incomingCallRef.current = incomingCall;
 }, [incomingCall]);
 
 useEffect(() => {
 outgoingCallRef.current = outgoingCall;
 }, [outgoingCall]);
 
 useEffect(() => {
 activeCallRef.current = activeCall;
 if (!activeCall) {
 locallyAnsweredCallIdsRef.current.clear();
 }
 }, [activeCall]);

 useEffect(() => {
 if (!outgoingCall || activeCall) return;

 callProgressToneStateManager.transition('CALLING', { callId: outgoingCall.id });

 return () => {
 callProgressToneStateManager.stop(outgoingCall.id);
 };
 }, [activeCall?.id, outgoingCall?.id]);

 useEffect(() => {
 if (!userId || !socketService.isEnabled) return;

 const isRelevantCall = (event: CallProgressEvent) => {
 if (!event.callId) return false;
 return (
 outgoingCallRef.current?.id === event.callId ||
 activeCallRef.current?.id === event.callId ||
 incomingCallRef.current?.id === event.callId
 );
 };

 const handleRinging = (event: CallProgressEvent) => {
 if (outgoingCallRef.current?.id !== event.callId || activeCallRef.current?.id === event.callId) return;
 callProgressToneStateManager.transition('CALLING', { callId: event.callId });
 };

 const handleBusy = (event: CallProgressEvent) => {
 if (outgoingCallRef.current?.id !== event.callId) return;
 callProgressToneStateManager.transition('BUSY', { callId: event.callId });
 finishOutgoingAfterTerminalTone(event.callId, BUSY_TONE_AUTO_END_MS, "failed");
 };

 const handleRejected = (event: CallProgressEvent) => {
 if (!isRelevantCall(event)) return;
 clearTerminalToneTimer(event.callId);
 if (!locallyEndingCallIdsRef.current.has(event.callId)) {
 callProgressToneStateManager.transition('ENDED', { callId: event.callId });
 }
 locallyEndingCallIdsRef.current.delete(event.callId);
 if (outgoingCallRef.current?.id === event.callId) setOutgoingCall(null);
 if (activeCallRef.current?.id === event.callId) setActiveCall(null);
 };

 const handleFailed = (event: CallProgressEvent) => {
 if (!isRelevantCall(event)) return;
 callProgressToneStateManager.transition('FAILED', { callId: event.callId });
 finishOutgoingAfterTerminalTone(event.callId, FAILED_TONE_AUTO_END_MS, "failed");
 };

 const handleConnected = (event: CallProgressEvent) => {
 if (!isRelevantCall(event)) return;
 clearTerminalToneTimer(event.callId);
 callProgressToneStateManager.transition('CONNECTED', { callId: event.callId });
 };

 const handleReconnecting = (event: CallProgressEvent) => {
 if (activeCallRef.current?.id !== event.callId) return;
 callProgressToneStateManager.transition('RECONNECTING', { callId: event.callId });
 };

 const handleEnded = (event: CallProgressEvent) => {
 if (!isRelevantCall(event)) return;
 if (!markCallAsTerminated(event.callId)) {
 console.log(`[GlobalCallListener] handleEnded: duplicate event ignored for ${event.callId.slice(0, 8)}`);
 return;
 }
 clearTerminalToneTimer(event.callId);
 if (!locallyEndingCallIdsRef.current.has(event.callId)) {
 callProgressToneStateManager.transition('ENDED', { callId: event.callId });
 } else {
 callProgressToneStateManager.stop(event.callId);
 }
 locallyEndingCallIdsRef.current.delete(event.callId);
 if (outgoingCallRef.current?.id === event.callId) setOutgoingCall(null);
 if (activeCallRef.current?.id === event.callId) setActiveCall(null);
 if (incomingCallRef.current?.id === event.callId) setIncomingCall(null);
 };

 const unsubscribers = [
 socketService.on('CALL_RINGING', handleRinging),
 socketService.on('CALL_BUSY', handleBusy),
 socketService.on('CALL_REJECTED', handleRejected),
 socketService.on('CALL_TIMEOUT', handleFailed),
 socketService.on('CALL_FAILED', handleFailed),
 socketService.on('CALL_CONNECTED', handleConnected),
 socketService.on('CALL_RECONNECTING', handleReconnecting),
 socketService.on('CALL_ENDED', handleEnded),
 ];

 return () => {
 unsubscribers.forEach(unsubscribe => unsubscribe());
 };
 }, [userId]);

 // Track auth state (so this works on ALL screens and after refresh)
 useEffect(() => {
 let mounted = true;

 const init = async () => {
 const { data } = await supabase.auth.getUser();
 if (!mounted) return;
 const uid = data.user?.id ?? null;
 setUserId(uid);
 if (uid) {
 prefetchTurnConfig().catch((err) =>
 console.log("[WebRTC] Auth init prefetch failed:", err)
 );
 }
 };

 init();

 const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
 const uid = session?.user?.id ?? null;
 setUserId(uid);
 if (uid) {
 prefetchTurnConfig().catch((err) =>
 console.log("[WebRTC] Auth change prefetch failed:", err)
 );
 }
 });

 return () => {
 mounted = false;
 subscription.unsubscribe();
 };
 }, []);

 const buildIncomingCallSnapshot = (
 call: any,
 overrides: {
 callerId?: string;
 callerName?: string;
 callerAvatar?: string;
 callerPhone?: string;
 callType?: string;
 conversationId?: string;
 } = {}
 ) => {
 const phoneFromName =
 looksLikePhoneIdentity(overrides.callerName) ? overrides.callerName
 : looksLikePhoneIdentity(call.caller_name) ? call.caller_name
 : "";
 const normalizedCallerPhone = normalizePhoneNumber(
 overrides.callerPhone || call.caller_phone || phoneFromName || ""
 );
 const resolvedCallerName = resolveCallDisplayName(
 undefined,
 overrides.callerName,
 call.caller_name,
 normalizedCallerPhone,
 call.caller_phone,
 call.caller_id
 );

 return {
 ...call,
 caller_id: overrides.callerId ?? call.caller_id ?? "",
 callerName: resolvedCallerName || "Unknown",
 callerAvatar: overrides.callerAvatar ?? call.caller_avatar ?? "",
 caller_phone: normalizedCallerPhone || call.caller_phone || "",
 call_type: overrides.callType ?? call.call_type ?? "audio",
 conversation_id: overrides.conversationId ?? call.conversation_id ?? "",
 };
 };

 const presentIncomingCall = async (call: any, source: string) => {
 if (!call?.id || call.status !== "ringing") return;

 if (
 locallyAnsweredCallIdsRef.current.has(call.id) ||
 locallyEndingCallIdsRef.current.has(call.id) ||
 isCallAcceptedByNative(call.id)
 ) {
 console.log(`[GlobalCallListener] ${source}: call ${call.id.slice(0, 8)} already answered or ended locally/natively, skipping presentIncomingCall`);
 return;
 }

 if (isRingingCallStale(call)) {
 await expireStaleRingingCall(call, `${source} stale ringing guard`);
 return;
 }

 if (activeCallRef.current?.id === call.id) {
 console.log(`[GlobalCallListener] ${source}: call already active, skipping incoming UI`);
 return;
 }

 if (incomingCallRef.current?.id === call.id) {
 console.log(`[GlobalCallListener] ${source}: incoming UI already showing for ${call.id.slice(0, 8)}`);
 return;
 }

 const unavailableReason = await resolveIncomingUnavailableReason(call);
 if (unavailableReason) {
 await markIncomingUnavailable(call, unavailableReason, source);
 return;
 }

 // In native shell, we ALWAYS let native TelecomManager/ConnectionService handle incoming calls
 // (both background and foreground) to avoid duplicate ringtones and double call screens.
 // We only use the Web Incoming Screen on pure web (browsers) where hasNativeUI is false.
 const shouldUseWebIncomingFallback = !hasNativeUI;
 if (!shouldUseWebIncomingFallback) {
 if (nativeIncomingPresentedIdsRef.current.has(call.id)) {
 console.log(`[GlobalCallListener] ${source}: native incoming UI already requested for ${call.id.slice(0, 8)}`);
 return;
 }
 nativeIncomingPresentedIdsRef.current.add(call.id);
 window.setTimeout(() => nativeIncomingPresentedIdsRef.current.delete(call.id), 60_000);

 let nativeIncomingCall = buildIncomingCallSnapshot(call);
 try {
 const hydrated = await Promise.race([
 hydrateNativeIncomingCall(call.id, {
 callerId: call.caller_id,
 callerName: call.caller_name,
 callerAvatar: call.caller_avatar,
 callerPhone: call.caller_phone,
 callType: call.call_type,
 conversationId: call.conversation_id,
 }),
 new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1400)),
 ]);

 if (hydrated) {
 nativeIncomingCall = buildIncomingCallSnapshot(call, {
 callerId: hydrated.callerId,
 callerName: hydrated.callerName,
 callerAvatar: hydrated.callerAvatar,
 callerPhone: hydrated.callerPhone,
 callType: hydrated.callType,
 conversationId: hydrated.conversationId,
 });
 }
 } catch (error) {
 console.warn(`[GlobalCallListener] ${source}: native identity hydration failed, using immediate call payload`, error);
 }
 const nativeRequested = showIncomingCallNotification({
 callId: call.id,
 callerId: nativeIncomingCall.caller_id,
 callerName: nativeIncomingCall.callerName,
 callerAvatar: nativeIncomingCall.callerAvatar,
 callerPhone: nativeIncomingCall.caller_phone,
 callType: nativeIncomingCall.call_type,
 conversationId: nativeIncomingCall.conversation_id,
 });
 console.log(
 `[GlobalCallListener] ${source}: app backgrounded, ${
 nativeRequested ? "requested native incoming UI" : "native bridge unavailable"
 }`
 );
 if (!nativeRequested) {
 nativeIncomingPresentedIdsRef.current.delete(call.id);
 }
 return;
 }

 const immediateIncomingCall = buildIncomingCallSnapshot(call);
 incomingCallRef.current = immediateIncomingCall;
 setIncomingCall(immediateIncomingCall);
 console.log(`[GlobalCallListener] ${source}: showing immediate incoming UI for ${call.id.slice(0, 8)}`);

 try {
 console.log(`[GlobalCallListener] ${source}: hydrating incoming call details for ${call.id.slice(0, 8)}`);
 const hydrated = await hydrateNativeIncomingCall(call.id, {
 callerId: call.caller_id,
 callerName: call.caller_name,
 callerAvatar: call.caller_avatar,
 callerPhone: call.caller_phone,
 callType: call.call_type,
 conversationId: call.conversation_id,
 });

 if (incomingCallRef.current?.id !== call.id) {
 console.log(`[GlobalCallListener] ${source}: incoming UI changed before hydration completed`);
 return;
 }

 const hydratedIncomingCall = buildIncomingCallSnapshot(call, {
 callerId: hydrated.callerId,
 callerName: hydrated.callerName,
 callerAvatar: hydrated.callerAvatar,
 callerPhone: hydrated.callerPhone,
 callType: hydrated.callType,
 conversationId: hydrated.conversationId,
 });

 incomingCallRef.current = hydratedIncomingCall;
 setIncomingCall((current: any) => current?.id === call.id ? hydratedIncomingCall : current);
 console.log(`[GlobalCallListener] ${source}: incoming UI hydrated for ${call.id.slice(0, 8)}`);
 } catch (error) {
 console.warn(`[GlobalCallListener] ${source}: failed to hydrate incoming call, keeping fallback UI`, error);
 }
 };

 const recoverPendingIncomingCall = async (reason: string) => {
 if (!userId) return;

 if (activeCallRef.current || incomingCallRef.current || outgoingCallRef.current || locallyAnsweredCallIdsRef.current.size > 0) {
 console.log(`[GlobalCallListener] ${reason}: skipping recovery while another call UI or active answer is in progress`);
 return;
 }

 if (incomingRecoveryInFlightRef.current) {
 console.log(`[GlobalCallListener] ${reason}: incoming recovery already running`);
 return incomingRecoveryInFlightRef.current;
 }

 const recovery = (async () => {
 try {
 const { data: ringingCalls, error } = await supabase
 .from("calls")
 .select("id, status, caller_id, caller_name, caller_avatar, caller_phone, call_type, conversation_id, created_at")
 .eq("receiver_id", userId)
 .neq("caller_id", userId)
 .eq("status", "ringing")
 .order("created_at", { ascending: false })
 .limit(5);

 if (error) {
 console.warn(`[GlobalCallListener] ${reason}: failed to recover pending incoming call`, error);
 return;
 }

 if (!ringingCalls?.length) {
 console.log(`[GlobalCallListener] ${reason}: no pending ringing call found`);
 return;
 }

 const staleRingingCalls = ringingCalls.filter(isRingingCallStale);
 if (staleRingingCalls.length) {
 await Promise.allSettled(
 staleRingingCalls.map((call) =>
 expireStaleRingingCall(call, `${reason} stale ringing cleanup`)
 )
 );
 }

 const freshRingingCall = ringingCalls.find(
 (call) =>
 !isRingingCallStale(call) &&
 !locallyAnsweredCallIdsRef.current.has(call.id) &&
 !locallyEndingCallIdsRef.current.has(call.id)
 );
 if (!freshRingingCall) {
 console.log(`[GlobalCallListener] ${reason}: only stale ringing calls found`);
 return;
 }

 console.log(
 `[GlobalCallListener] ${reason}: recovered ringing call ${freshRingingCall.id.slice(0, 8)}`
 );
 await presentIncomingCall(freshRingingCall, reason);
 } catch (error) {
 console.warn(`[GlobalCallListener] ${reason}: unexpected incoming recovery error`, error);
 } finally {
 incomingRecoveryInFlightRef.current = null;
 }
 })();

 incomingRecoveryInFlightRef.current = recovery;
 return recovery;
 };

 useEffect(() => {
 if (!userId) return;

 void recoverPendingIncomingCall("user bootstrap");

 const handleVisibilityChange = () => {
 if (!isAppVisible()) return;
 void recoverPendingIncomingCall("document visible");
 };

 const handleWindowFocus = () => {
 void recoverPendingIncomingCall("window focus");
 };

 document.addEventListener("visibilitychange", handleVisibilityChange);
 window.addEventListener("focus", handleWindowFocus);

 return () => {
 document.removeEventListener("visibilitychange", handleVisibilityChange);
 window.removeEventListener("focus", handleWindowFocus);
 };
 }, [userId]);
 
 // CRITICAL: Listen for native call acceptance event
 // This is dispatched by MainActivity when user answers via native UI
 useEffect(() => {
 // Listen for nativeCallAction events from MainActivity.handleAnswerCall()
 const handleNativeCallAction = async (event: CustomEvent) => {
 const { action, callId, callerId, navigateTo } = event.detail;

 // Track if app was launched purely for this call (happens quickly after boot)
 if (performance.now() < 5000) {
 (window as any).__WAS_LAUNCHED_FOR_CALL__ = true;
 }

 if (!callId) {
 console.warn("[GlobalCallListener] Received nativeCallAction without callId:", action);
 return;
 }
 
 const {
 callerName,
 callerAvatar,
 callerPhone,
 callType,
 conversationId,
 phoneNumber,
 phoneRoute: rawPhoneRoute,
 } = event.detail;
 
 console.log(`📱 [GlobalCallListener] nativeCallAction: ${action} for call ${callId?.slice(0, 8)}`);
 
 if (action === 'start_outgoing') {
 const phoneRoute = parsePhoneRouteDecision(rawPhoneRoute, {
 callId,
 phoneNumber,
 primaryRoute: event.detail.primaryRoute,
 });

 if (callId && nativeActionInFlightRef.current.has(callId)) {
 console.log('[GlobalCallListener] Outgoing native action already in flight, skipping duplicate');
 return;
 }

 if (callId) {
 nativeActionInFlightRef.current.add(callId);
 }

 try {
 await startOutgoingFromSystemDialer(
 phoneRoute.normalizedNumber || phoneNumber,
 callId,
 phoneRoute,
 );
 } finally {
 if (callId) {
 nativeActionInFlightRef.current.delete(callId);
 }
 }
 return;
 }

 if (action === 'end' && callId) {
 if (!markCallAsTerminated(callId)) {
 console.log(`[GlobalCallListener] nativeCallAction end: duplicate event ignored for ${callId.slice(0, 8)}`);
 return;
 }
 console.log('[GlobalCallListener] Native requested call end');
 locallyEndingCallIdsRef.current.add(callId);
 callProgressToneStateManager.stop(callId);

 await supabase
 .from('calls')
 .update({ status: 'ended', ended_at: new Date().toISOString() })
 .eq('id', callId);

 if (activeCallRef.current?.id === callId) {
 activeCallRef.current = null;
 setActiveCall(null);
 }

 if (outgoingCallRef.current?.id === callId) {
 outgoingCallRef.current = null;
 setOutgoingCall(null);
 }

 if (incomingCallRef.current?.id === callId) {
 incomingCallRef.current = null;
 setIncomingCall(null);
 }

 return;
 }

 if (action === 'answer' && callId) {
 const acceptedAtIso = new Date().toISOString();
 locallyAnsweredCallIdsRef.current.add(callId);
 (window as any).__CALL_STATE__ = {
 callId,
 accepted: true,
 acceptedAt: Date.now(),
 acceptedAtIso
 };
 console.log(`[GlobalCallListener] Set __CALL_STATE__ for native answer call: ${callId.slice(0, 8)}`);

 if (nativeActionInFlightRef.current.has(callId)) {
 console.log('[GlobalCallListener] Native answer already in flight, skipping duplicate');
 return;
 }

 nativeActionInFlightRef.current.add(callId);

 // Update database status to active immediately to minimize signaling latency
 supabase
 .from('calls')
 .update({
 status: 'active',
 started_at: acceptedAtIso,
 })
 .eq('id', callId)
 .then(({ error }) => {
 if (error) {
 console.warn('[GlobalCallListener] Failed to update call status to active:', error);
 } else {
 console.log('[GlobalCallListener] Successfully updated call status to active in DB');
 }
 });

 try {
 const hydrated = await hydrateNativeIncomingCall(callId, {
 callerId,
 callerName,
 callerAvatar,
 callerPhone,
 callType,
 conversationId,
 });

 if (!hydrated.callerId) {
 console.error('[GlobalCallListener] Missing callerId for native answer, aborting WebRTC start');
 toast.error('Could not connect the call');
 return;
 }

 console.log('[GlobalCallListener] Native answered call - starting WebRTC as receiver');

 setIncomingCall(null);

 // Check if there is an existing pre-warmed WebRTC session to avoid redundant getUserMedia calls
 const existingCall = getExistingCall(callId);
 let prewarmedStream: MediaStream | null = null;
 if (existingCall) {
 prewarmedStream = existingCall.getLocalStream();
 if (prewarmedStream) {
 console.log('🔥 [GlobalCallListener] Reusing pre-warmed media stream from existing session - skipping getUserMedia!');
 }
 }

 if (activeCallRef.current?.id === callId) {
 console.log('[GlobalCallListener] Already have active call, skipping');
 return;
 }

 if (!prewarmedStream) {
 try {
 const isVideo = hydrated.callType === 'video';
 const stream = await navigator.mediaDevices.getUserMedia({
 audio: true,
 video: isVideo,
 });
 setPreCallMediaStream(callId, stream);
 } catch (mediaErr) {
 console.warn('[GlobalCallListener] Could not pre-acquire media:', mediaErr);
 }
 }

 const nextActiveCall = {
 id: callId,
 caller_id: hydrated.callerId,
 caller_phone: hydrated.callerPhone,
 conversation_id: hydrated.conversationId,
 call_type: hydrated.callType || 'audio',
 isInitiator: false,
 partnerId: hydrated.callerId,
 callerName: hydrated.callerName || hydrated.callerPhone || 'Unknown',
 callerAvatar: hydrated.callerAvatar,
 started_at: acceptedAtIso,
 preAcquiredStream: prewarmedStream || takePreCallMediaStream(callId),
 };

 activeCallRef.current = nextActiveCall;
 setActiveCall(nextActiveCall);
 } finally {
 nativeActionInFlightRef.current.delete(callId);
 }
 } else if ((action === 'reject' || action === 'missed') && callId) {
 if (!markCallAsTerminated(callId)) {
 console.log(`[GlobalCallListener] nativeCallAction reject/missed: duplicate event ignored for ${callId.slice(0, 8)}`);
 return;
 }
 console.log(`[GlobalCallListener] Native marked call ${action}`);
 locallyEndingCallIdsRef.current.add(callId);
 callProgressToneStateManager.stop(callId);

 await supabase
 .from('calls')
 .update({
 status: action === 'missed' ? 'missed' : 'ended',
 ended_at: new Date().toISOString(),
 missed: action === 'missed',
 })
 .eq('id', callId);

 setIncomingCall(null);

 if (navigateTo) {
 console.log(`[GlobalCallListener] Navigating via nativeCallAction detail: ${navigateTo}`);
 navigate(navigateTo);
 }
 }
 };
 
 // Also handle legacy chatr:native_call_accepted event
 const handleNativeCallAccepted = (event: CustomEvent<{ callId: string }>) => {
 const { callId } = event.detail;
 console.log(`📱 [GlobalCallListener] Native accepted call event: ${callId?.slice(0, 8)}`);
 if (callId) {
 locallyAnsweredCallIdsRef.current.add(callId);
 }
 
 const current = incomingCallRef.current;
 if (current && current.id === callId) {
 console.log('📱 [GlobalCallListener] Dismissing web incoming UI - native accepted');
 setIncomingCall(null);
 }
 };
 
 const handleInitiateCall = (event: CustomEvent) => {
 const detail = event.detail || {};
 const { callId, receiverId, displayName, avatar, phone, callType } = detail;

 if (!callId || !receiverId) return;

 try {
 const pendingRaw = sessionStorage.getItem(PENDING_OUTGOING_CALL_KEY);
 if (pendingRaw) {
 const pending = JSON.parse(pendingRaw);
 if (pending?.callId === callId) {
 sessionStorage.removeItem(PENDING_OUTGOING_CALL_KEY);
 }
 }
 } catch (storageError) {
 console.warn('[GlobalCallListener] Could not clear pending outgoing call handoff', storageError);
 }

 if (activeCallRef.current?.id === callId) {
 console.log('[GlobalCallListener] Local outgoing call already active, skipping duplicate');
 return;
 }

 console.log('[GlobalCallListener] Starting local outgoing call immediately:', callId.slice(0, 8));

 syncSystemCallIdentityToNative({
 callId,
 phoneNumber: phone || '',
 displayName: displayName || phone || 'Unknown',
 avatarUrl: avatar || '',
 remoteId: receiverId,
 });

 const nextActiveCall = {
 id: callId,
 receiver_id: receiverId,
 receiver_phone: phone,
 call_type: callType === 'video' ? 'video' : 'voice',
 isInitiator: true,
 partnerId: receiverId,
 callerName: displayName || phone || 'Unknown',
 callerAvatar: avatar,
 preAcquiredStream: takePreCallMediaStream(callId),
 };

 activeCallRef.current = nextActiveCall;
 outgoingCallRef.current = null;
 setActiveCall(nextActiveCall);
 setOutgoingCall(null);
 };

 const resolvePrewarmPartnerId = async (
 callId: string,
 partnerId?: string | null,
 callerId?: string | null,
 ): Promise<string> => {
 const directPartner = [partnerId, callerId].find((candidate) => looksLikeUuid(candidate));
 if (directPartner) return directPartner;

 try {
 const { data, error } = await supabase
 .from("calls")
 .select("caller_id")
 .eq("id", callId)
 .maybeSingle();

 if (error) {
 console.warn(`[GlobalCallListener] Prewarm caller lookup failed for ${callId.slice(0, 8)}:`, error);
 return "";
 }

 if (looksLikeUuid(data?.caller_id)) {
 return data.caller_id;
 }
 } catch (error) {
 console.warn(`[GlobalCallListener] Prewarm caller lookup crashed for ${callId.slice(0, 8)}:`, error);
 }

 return "";
 };

 const handleNativeCallPrewarm = async (event: CustomEvent) => {
 const detail = event.detail || {};
 const { callId, callerName, callType, partnerId, callerId } = detail;
 if (!callId) return;

 if (Capacitor.isNativePlatform()) {
 console.log(`📱 [GlobalCallListener] nativeCallPrewarm skipped to prevent background network socket death`);
 return;
 }

 console.log(`🔥 [GlobalCallListener] Received nativeCallPrewarm for call ${callId.slice(0, 8)}`);

 // 1. Pre-warm media stream (audio/video)
 const isVideo = callType === 'video';
 try {
 const stream = await navigator.mediaDevices.getUserMedia({
 audio: true,
 video: isVideo,
 });
 console.log(`🔥 [GlobalCallListener] Pre-warmed media stream for call ${callId.slice(0, 8)}`);
 setPreCallMediaStream(callId, stream);
 } catch (mediaError) {
 console.warn(`[GlobalCallListener] Background media pre-warm failed/denied:`, mediaError);
 }

 // 2. Pre-create the WebRTC instance
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 const resolvedPartner = await resolvePrewarmPartnerId(callId, partnerId, callerId);
 if (!resolvedPartner) {
 console.log(`[GlobalCallListener] Prewarm has no UUID caller id yet for ${callId.slice(0, 8)}; media is warm, WebRTC will start on answer`);
 return;
 }
 console.log(`🔥 [GlobalCallListener] Pre-creating SimpleWebRTCCall singleton for ${callId.slice(0, 8)}`);
 
 // Pre-warm the singleton WebRTC instance
 const call = SimpleWebRTCCall.create(
 callId,
 resolvedPartner,
 isVideo,
 false, // Receivers are always non-initiators
 user.id,
 takePreCallMediaStream(callId) // Pass our pre-warmed stream
 );
 
 // Trigger ICE gathering and signaling channel subscription early
 await call.start();
 console.log(`🔥 [GlobalCallListener] WebRTC pre-warm started for call ${callId.slice(0, 8)}`);
 }
 } catch (webrtcError) {
 console.warn(`[GlobalCallListener] Background WebRTC pre-warm failed:`, webrtcError);
 }
 };

 window.addEventListener('nativeCallPrewarm', handleNativeCallPrewarm as EventListener);
 window.addEventListener('nativeCallAction', handleNativeCallAction as EventListener);
 window.addEventListener('chatr:native_call_accepted', handleNativeCallAccepted as EventListener);
 window.addEventListener('initiate-call', handleInitiateCall as EventListener);

 try {
 const pendingRaw = sessionStorage.getItem(PENDING_OUTGOING_CALL_KEY);
 if (pendingRaw) {
 const pending = JSON.parse(pendingRaw);
 // CRITICAL: Only restore if call was initiated in the last 15 seconds
 const age = Date.now() - (pending.timestamp || 0);
 if (age < 15000) {
 window.setTimeout(() => {
 handleInitiateCall(new CustomEvent('initiate-call', { detail: pending }));
 }, 0);
 } else {
 sessionStorage.removeItem(PENDING_OUTGOING_CALL_KEY);
 }
 }
 } catch (storageError) {
 console.warn('[GlobalCallListener] Could not restore pending outgoing call handoff', storageError);
 }
 
 return () => {
 window.removeEventListener('nativeCallPrewarm', handleNativeCallPrewarm as EventListener);
 window.removeEventListener('nativeCallAction', handleNativeCallAction as EventListener);
 window.removeEventListener('chatr:native_call_accepted', handleNativeCallAccepted as EventListener);
 window.removeEventListener('initiate-call', handleInitiateCall as EventListener);
 };
 }, []);
 
  // Subscribe once per logged-in user
  // CRITICAL: In native shell, skip INCOMING call notifications (handled by TelecomManager/CallKit)
  // But STILL subscribe to call STATUS updates for WebRTC signaling to work!
  useEffect(() => {
    if (!userId) return;

    const subId = Math.random().toString(36).substring(2, 9);
    console.log(`🔔 GlobalCallListener active for user: ${userId} (hasNativeUI: ${hasNativeUI}) [subId: ${subId}]`);

    // Only skip web incoming UI if native CallKit/TelecomManager is available
    // Plain Capacitor wrappers should use web UI for incoming calls

    // Incoming calls (receiver side) - SKIP UI only if native TelecomManager/CallKit shows it
    const incomingChannel = supabase
      .channel(`incoming-calls:${userId}:${subId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `receiver_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new as any;
          console.log("📞 New call INSERT (receiver match):", call);
          await presentIncomingCall(call, "receiver insert");
        }
      )
      .subscribe((status) => {
        console.log("📡 incoming-calls channel status:", status);
        if (status === "SUBSCRIBED") {
          void recoverPendingIncomingCall("incoming channel subscribed");
        }
      });

    // Call updates relevant to this receiver (ended/answered elsewhere)
    // NOTE: For native shell, WebRTC is started via nativeCallAction event instead
    const updatesChannel = supabase
      .channel(`call-updates:${userId}:${subId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `receiver_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new as any;
          console.log("📱 [GlobalCallListener] Receiver call UPDATE:", call.id, "status:", call.status);
          const previousStatus = lastReceiverStatusRef.current.get(call.id);
          const statusChanged = previousStatus !== call.status;
          lastReceiverStatusRef.current.set(call.id, call.status);

          if (call.status === "ringing") {
            dismissedIncomingCallIdsRef.current.delete(call.id);
          }

          if (!statusChanged && call.status !== "ringing") {
            return;
          }

          if (call.status === "ringing") {
            await presentIncomingCall(call, "receiver update");
          }

          if (
            (call.status === "active" || call.status === "ended" || call.status === "missed" || call.status === "busy" || call.status === "failed") &&
            hasNativeUI &&
            !dismissedIncomingCallIdsRef.current.has(call.id)
          ) {
            dismissIncomingCallNotification(call.id);
            dismissedIncomingCallIdsRef.current.add(call.id);
          }

          // CRITICAL: Skip if we already have an active call - prevents duplicate WebRTC instances
          if (activeCallRef.current?.id === call.id) {
            console.log("📱 [GlobalCallListener] Already have active call for this ID, skipping");
            // But check if it was ended
            if (call.status === "ended" || call.status === "missed" || call.status === "failed") {
              if (!markCallAsTerminated(call.id)) return;
              console.log("📵 [GlobalCallListener] Active call ended by partner (receiver side)");
              activeCallRef.current = null;
              setActiveCall(null);
              lastReceiverStatusRef.current.delete(call.id);
              dismissedIncomingCallIdsRef.current.delete(call.id);
              // Silent - no toast for call ended
            }
            return;
          }

          // Handle call ended for any call we might be tracking
          const currentActive = activeCallRef.current;
          if (currentActive && call.id === currentActive.id) {
            if (call.status === "ended" || call.status === "missed" || call.status === "failed") {
              if (!markCallAsTerminated(call.id)) return;
              console.log("📵 [GlobalCallListener] Active call ended by partner (receiver side)");
              activeCallRef.current = null;
              setActiveCall(null);
              lastReceiverStatusRef.current.delete(call.id);
              dismissedIncomingCallIdsRef.current.delete(call.id);
              // Silent - no toast for call ended
              return;
            }
          }

          // Web mode: handle incoming call updates
          const currentIncoming = incomingCallRef.current;
          if (!currentIncoming) return;
          if (call.id !== currentIncoming.id) return;

          if (call.status === "ended" || call.status === "missed" || call.status === "busy" || call.status === "failed") {
            if (!markCallAsTerminated(call.id)) return;
            console.log("📵 Incoming call cancelled by caller");
            incomingCallRef.current = null;
            setIncomingCall(null);
            lastReceiverStatusRef.current.delete(call.id);
            dismissedIncomingCallIdsRef.current.delete(call.id);
            if (!hasNativeUI) {
              toast.info(`Missed call from ${currentIncoming.callerName || currentIncoming.caller_phone || "Unknown"}`);
            }
          }

          if (call.status === "active") {
            console.log("📱 Incoming call answered on another device");
            incomingCallRef.current = null;
            setIncomingCall(null);
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 call-updates channel status:", status);
        if (status === "SUBSCRIBED") {
          void recoverPendingIncomingCall("call-updates channel subscribed");
        }
      });

    // NEW: Outgoing calls (caller side) - listen for when receiver accepts
    const outgoingChannel = supabase
      .channel(`outgoing-calls:${userId}:${subId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `caller_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new as any;
          console.log("📤 [GlobalCallListener] Outgoing call created:", call.id, "status:", call.status);

          // Start WebRTC immediately when caller initiates
          if (call.status === "ringing" && !activeCallRef.current) {
            const { data: receiverProfile } = await supabase
              .from("profiles")
              .select("full_name, username, avatar_url, phone_number")
              .eq("id", call.receiver_id)
              .maybeSingle();

            console.log("🚀 [GlobalCallListener] Starting WebRTC as INITIATOR");

            const receiverPhone = normalizePhoneNumber(
              receiverProfile?.phone_number || call.receiver_phone || ""
            );
            const receiverName = resolveCallDisplayName(
              receiverProfile,
              call.receiver_name,
              call.receiver_phone,
              receiverPhone
            );
            const receiverAvatar = resolveCallAvatar(receiverProfile, call.receiver_avatar);

            syncSystemCallIdentityToNative({
              callId: call.id,
              phoneNumber: receiverPhone,
              displayName: receiverName,
              avatarUrl: receiverAvatar,
              remoteId: call.receiver_id,
            });

            const preAcquiredStream = takePreCallMediaStream(call.id);
            callProgressToneStateManager.transition('CONNECTED', { callId: call.id });

            setActiveCall({
              ...call,
              isInitiator: true,
              partnerId: call.receiver_id,
              callerName: receiverName,
              callerAvatar: receiverAvatar,
              contactPhone: receiverPhone || call.receiver_phone,
              preAcquiredStream,
            });

            setOutgoingCall(null);
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 outgoing-calls channel status:", status);
      });

    // NEW: Listen for outgoing call status changes (accepted/rejected/ended)
    const outgoingUpdatesChannel = supabase
      .channel(`outgoing-updates:${userId}:${subId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `caller_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new as any;
          const currentOutgoing = outgoingCallRef.current;
          const currentActive = activeCallRef.current;

          console.log("📤 [GlobalCallListener] Outgoing call UPDATE:", call.id, "status:", call.status);

          // If we already have an activeCall for this call, no need to reinitialize
          if (currentActive && call.id === currentActive.id) {
            console.log("📤 [GlobalCallListener] Call already active, ignoring update");
            return;
          }

          if (call.status === "busy") {
            console.log("[GlobalCallListener] Outgoing call hit busy state");
            callProgressToneStateManager.transition('BUSY', { callId: call.id });

            const existingTimer = terminalToneTimersRef.current.get(call.id);
            if (existingTimer) clearTimeout(existingTimer);

            const timer = setTimeout(async () => {
              terminalToneTimersRef.current.delete(call.id);
              callProgressToneStateManager.stop(call.id);
              setOutgoingCall(null);

              await supabase
                .from("calls")
                .update({
                  status: "ended",
                  webrtc_state: "failed",
                  ended_at: new Date().toISOString(),
                  missed: false,
                })
                .eq("id", call.id)
                .eq("status", "busy");
            }, BUSY_TONE_AUTO_END_MS);

            terminalToneTimersRef.current.set(call.id, timer);
            return;
          }

          // Receiver rejected, missed, or call ended
          if (call.status === "ended" || call.status === "rejected" || call.status === "missed") {
            if (!markCallAsTerminated(call.id)) return;
            console.log("📵 [GlobalCallListener] Outgoing call ended/rejected/missed");
            if (!locallyEndingCallIdsRef.current.has(call.id) && currentOutgoing?.id === call.id) {
              callProgressToneStateManager.transition(call.status === "missed" ? 'FAILED' : 'ENDED', { callId: call.id });
            }
            locallyEndingCallIdsRef.current.delete(call.id);
            setOutgoingCall(null);

            // Also clear activeCall if it matches
            if (currentActive && call.id === currentActive.id) {
              setActiveCall(null);
            }
            
            // Silent cleanup - no toast notification needed for call outcomes
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 outgoing-updates channel status:", status);
      });

    // NEW: Listen for video upgrade signals via webrtc_signals table
    const videoUpgradeChannel = supabase
      .channel(`video-upgrade:${userId}:${subId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "webrtc_signals",
          filter: `to_user=eq.${userId}`,
        },
        (payload) => {
          const signal = payload.new as any;
          const signalData = signal.signal_data;
          
          console.log("📡 [GlobalCallListener] Received signal:", signalData);
          
          // FaceTime-style: Video signals no longer require acceptance dialog
          // WebRTC renegotiation handles video track exchange automatically
          // Legacy: Keep backward compatibility for old signals but don't show toasts
          if (signalData?.videoUpgradeRequest || signalData?.videoUpgradeAccepted) {
            console.log("📹 [GlobalCallListener] Partner enabled video via renegotiation");
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 video-upgrade channel status:", status);
      });

    return () => {
      terminalToneTimersRef.current.forEach(timer => clearTimeout(timer));
      terminalToneTimersRef.current.clear();
      callProgressToneStateManager.stop(null, false);
      if (incomingChannel) supabase.removeChannel(incomingChannel);
      if (updatesChannel) supabase.removeChannel(updatesChannel);
      if (outgoingChannel) supabase.removeChannel(outgoingChannel);
      if (outgoingUpdatesChannel) supabase.removeChannel(outgoingUpdatesChannel);
      if (videoUpgradeChannel) supabase.removeChannel(videoUpgradeChannel);
    };
  }, [userId, hasNativeUI]);

 // GUARD: Block web accept if native already accepted
 const handleAnswer = async () => {
 if (!incomingCall) return;

 // CRITICAL: If native already accepted, skip - auto-join will handle it
 if (isCallAcceptedByNative(incomingCall.id)) {
 console.log('🚫 [GlobalCallListener] Web accept blocked - native already accepted');
 return;
 }

 try {
 // Acquire media under the user's gesture and hand it to the call UI.
 const stream = await navigator.mediaDevices.getUserMedia({
 audio: true,
 video: incomingCall.call_type === 'video',
 });

 setPreCallMediaStream(incomingCall.id, stream);

 await handleAnswerDirect();
 } catch (error: any) {
 console.error('Permission request failed:', error);
 if (incomingCall?.id) clearPreCallMediaStream(incomingCall.id);

 // Device busy: let user retry (do NOT auto-reject)
 if (error?.name === 'NotReadableError') {
 console.warn('📱 [GlobalCallListener] Device busy:', error);
 return;
 }

 // Simple, friendly messages for non-technical users
 if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
 console.warn('📱 [GlobalCallListener] Permission denied:', error);
 } else if (error?.name === 'NotFoundError') {
 console.warn('📱 [GlobalCallListener] Device not found:', error);
 } else {
 console.warn('📱 [GlobalCallListener] Media error:', error);
 }

 // CRITICAL: Do NOT auto-reject for permission errors
 // The user should be able to retry or manually end the call
 // Only reject if it's a hard "not found" error
 if (error?.name === 'NotFoundError') {
 await handleReject();
 }
 }
 };

 // Direct answer (used after media acquired or for auto-join)
 const handleAnswerDirect = async () => {
 if (!incomingCall) return;
 const answeredAtIso = new Date().toISOString();

 // CRITICAL: If native already accepted, skip DB update - native already did it
 const nativeAccepted = isCallAcceptedByNative(incomingCall.id);
 if (nativeAccepted) {
 console.log('✅ [GlobalCallListener] Auto-joining call (native accepted)');
 } else {
 console.log('✅ [GlobalCallListener] Answering call (web accept):', incomingCall.id);
 }

 const preAcquiredStream = takePreCallMediaStream(incomingCall.id);

 setActiveCall({
 ...incomingCall,
 isInitiator: false,
 partnerId: incomingCall.caller_id || incomingCall.partnerId,
 started_at: incomingCall.started_at || answeredAtIso,
 preAcquiredStream,
 });
 setIncomingCall(null);

 // Only update DB if this is a web accept (not native auto-join)
 if (!nativeAccepted) {
 const { error } = await supabase
 .from("calls")
 .update({ status: "active", started_at: answeredAtIso })
 .eq("id", incomingCall.id);

 if (error) console.error("Failed to update call status:", error);
 }
 };

 const handleReject = async () => {
 if (!incomingCall) return;
 if (!markCallAsTerminated(incomingCall.id)) return;

 locallyEndingCallIdsRef.current.add(incomingCall.id);
 callProgressToneStateManager.stop(incomingCall.id);

 console.log("❌ Rejecting call:", incomingCall.id);

 await supabase
 .from("calls")
 .update({ status: "ended", ended_at: new Date().toISOString(), missed: false })
 .eq("id", incomingCall.id);

 try {
 await sendSignal({
 type: "answer" as any,
 callId: incomingCall.id,
 data: { rejected: true },
 to: incomingCall.caller_id,
 });
 } catch (error) {
 console.error("Failed to send reject signal:", error);
 }

 setIncomingCall(null);

 toast.info(`Call from ${incomingCall.callerName} declined`);
 };

 // NEW: Cancel outgoing call
 const handleCancelOutgoing = async () => {
 if (!outgoingCall) return;
 if (!markCallAsTerminated(outgoingCall.id)) return;

 locallyEndingCallIdsRef.current.add(outgoingCall.id);
 callProgressToneStateManager.stop(outgoingCall.id);

 console.log("❌ Cancelling outgoing call:", outgoingCall.id);

 await supabase
 .from("calls")
 .update({ status: "ended", ended_at: new Date().toISOString() })
 .eq("id", outgoingCall.id);

 setOutgoingCall(null);

 toast.info("Call was cancelled");
 };

 // NEW: Dispatch visibility event to hide main App UI if launched for a call
 useEffect(() => {
 const isVisible = !!activeCall || !!incomingCall || !!outgoingCall || !!incomingHandoff;
 window.dispatchEvent(new CustomEvent('chatr:call_screen_visibility', { 
 detail: { visible: isVisible } 
 }));
 }, [activeCall, incomingCall, outgoingCall, incomingHandoff]);

 const handleEndCall = async () => {
 if (!activeCall) return;
 if (!markCallAsTerminated(activeCall.id)) return;

 locallyEndingCallIdsRef.current.add(activeCall.id);
 callProgressToneStateManager.stop(activeCall.id);

 console.log("📵 Ending active call:", activeCall.id);

 // Clear native call state when call ends
 clearNativeCallState();

 // Update DB status to ended - partner detects this via Realtime subscription in UnifiedCallScreen
 // NOTE: UnifiedCallScreen.handleEndCall also does this, so this is a safety fallback only
 await supabase
 .from("calls")
 .update({ status: "ended", ended_at: new Date().toISOString() })
 .eq("id", activeCall.id);

 // DO NOT send a bogus "answer" signal - it corrupts WebRTC signaling state on the receiver
 // The DB status change (above) is sufficient for partner to detect call ended

 setActiveCall(null);
 
 // Auto-close illusion: if app was launched to answer/prewarm a call, exit immediately
 if ((window as any).__WAS_LAUNCHED_FOR_CALL__) {
 console.log("👋 [GlobalCallListener] Call ended, auto-closing standalone call screen app");
 Capacitor.Plugins.App.exitApp();
 }
 };

 // Show incoming call screen (receiver side)
 // CRITICAL: Only render when incoming AND no active call to ensure clean ringtone stop
 // SKIP on /desktop/calls — DesktopCalls handles it via incomingRoom state.
 if (incomingCall && !activeCall && !isDesktopCallsRoute) {
 // callerPhone is populated when the caller used a phone number identity.
 // For Chatr-to-Chatr UUID calls with no phone, skip the overlay silently.
 const callerPhone = incomingCall.callerPhone || incomingCall.caller_phone || '';
 const showShieldOverlay = callerPhone.length >= 7;

 return (
 <>
 {/* Chatr Shield overlay: runs pipeline fire-and-forget, never blocks answer/reject.
 Timeout-guarded inside IncomingCallOverlay (4s max) so a slow/failed Supabase
 lookup on Indian LTE/CGNAT cannot delay the call controls. */}
 {showShieldOverlay && (
 <IncomingCallOverlay
 phoneNumber={callerPhone}
 onDecline={handleReject}
 />
 )}
 <IncomingCallScreen
 callerName={incomingCall.callerName}
 callerAvatar={incomingCall.callerAvatar}
 callType={incomingCall.call_type}
 onAnswer={handleAnswer}
 onReject={handleReject}
 ringtoneUrl="/ringtone.mp3"
 />
 </>
 );
 }

 // NEW: Show outgoing call screen (caller side - waiting for receiver to accept)
 // SKIP on /desktop/calls — DesktopCalls shows its own "Room is open" waiting UI.
 if (outgoingCall && !activeCall && !isDesktopCallsRoute) {
 return (
 <div 
 className="fixed inset-0 z-[99999] bg-gradient-to-b from-primary/20 to-background flex items-center justify-center select-none touch-none"
 style={{ 
 height: '100dvh', 
 width: '100vw',
 minHeight: '-webkit-fill-available',
 isolation: 'isolate',
 }}
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex flex-col items-center gap-6 p-8 animate-pulse">
 <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center shadow-2xl">
 {outgoingCall.receiverAvatar ? (
 <img 
 src={outgoingCall.receiverAvatar} 
 alt={outgoingCall.receiverName}
 className="w-full h-full rounded-full object-cover"
 />
 ) : (
 <span className="text-display">{outgoingCall.receiverName?.[0]?.toUpperCase() || '?'}</span>
 )}
 </div>
 <div className="text-center">
 <h2 className="text-page mb-2">{outgoingCall.receiverName}</h2>
 <p className="text-muted-foreground">
 {outgoingCall.call_type === 'video' ? '📹 Video calling...' : '📞 Calling...'}
 </p>
 </div>
 <button
 onClick={handleCancelOutgoing}
 className="mt-4 px-8 py-3 bg-destructive text-destructive-foreground rounded-full font-medium shadow-lg hover:bg-destructive/90 transition-colors"
 >
 Cancel
 </button>
 </div>
 </div>
 );
 }

 // Handle voice to video upgrade - FaceTime style (no acceptance needed)
 // The WebRTC renegotiation handles video automatically on both sides
 const handleUpgradeToVideo = async () => {
 if (!activeCall) {
 console.warn("⚠️ No active call to upgrade");
 return;
 }
 
 console.log("📹 FaceTime-style video upgrade for call:", activeCall.id);
 
 // Simply enable video flag - UnifiedCallScreen handles the rest via WebRTC renegotiation
 setActiveCall({ ...activeCall, videoEnabled: true });
 
 // Update database for record-keeping
 try {
 await supabase.from("calls").update({ call_type: 'video' }).eq("id", activeCall.id);
 } catch (e) {
 console.error("Failed to update call type:", e);
 }
 };

 // Show active call (both caller and receiver) - UNIFIED for voice and video
 // Also render handoff banner on top of active calls
 // SKIP on /desktop/calls — GroupCallManager + DesktopCalls handles the active call UI.
 if (activeCall && !isDesktopCallsRoute) {
 const contactName = activeCall.isInitiator 
 ? activeCall.receiverName || activeCall.partnerName || activeCall.displayName || activeCall.callerName 
 : activeCall.callerName;

 const contactAvatar = activeCall.isInitiator
 ? activeCall.receiverAvatar || activeCall.partnerAvatar || activeCall.avatar || activeCall.callerAvatar
 : activeCall.callerAvatar;

 return (
 <>
 {/* Call handoff banner overlay */}
 <AnimatePresence>
 {incomingHandoff && (
 <CallHandoffBanner
 callState={incomingHandoff.call_state}
 fromDevice={incomingHandoff.from_device_id}
 onAccept={async () => {
 const state = await acceptHandoff(incomingHandoff.id);
 if (state) {
 // End current call and switch to transferred one
 handleEndCall();
 setActiveCall({
 id: incomingHandoff.call_id,
 isInitiator: false,
 partnerId: state.partnerId,
 callerName: state.partnerName,
 call_type: state.callType,
 videoEnabled: state.isVideoOn,
 });
 }
 }}
 onReject={() => rejectHandoff(incomingHandoff.id)}
 />
 )}
 </AnimatePresence>
 <UnifiedCallScreen
 callId={activeCall.id}
 contactName={contactName}
 contactAvatar={contactAvatar}
 contactPhone={activeCall.caller_phone || activeCall.receiver_phone}
 isInitiator={activeCall.isInitiator}
 partnerId={activeCall.partnerId}
 callType={activeCall.call_type === 'video' ? 'video' : 'voice'}
 preAcquiredStream={activeCall.preAcquiredStream}
 onEnd={handleEndCall}
 onSwitchToVideo={handleUpgradeToVideo}
 videoEnabled={activeCall.videoEnabled}
 startedAt={activeCall.started_at || activeCall.startedAt || null}
 />
 </>
 );
 }

 // No active call - still show handoff banner if available
 if (incomingHandoff) {
 return (
 <AnimatePresence>
 <CallHandoffBanner
 callState={incomingHandoff.call_state}
 fromDevice={incomingHandoff.from_device_id}
 onAccept={async () => {
 const state = await acceptHandoff(incomingHandoff.id);
 if (state) {
 setActiveCall({
 id: incomingHandoff.call_id,
 isInitiator: false,
 partnerId: state.partnerId,
 callerName: state.partnerName,
 call_type: state.callType,
 videoEnabled: state.isVideoOn,
 });
 }
 }}
 onReject={() => rejectHandoff(incomingHandoff.id)}
 />
 </AnimatePresence>
 );
 }

 return null;
}
