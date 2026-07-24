import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
 Mic, MicOff, PhoneOff, Volume2, Video, VideoOff, 
 SwitchCamera, Grid3X3, MoreHorizontal, WifiOff, ZoomIn, ZoomOut, Delete, ShieldCheck, Maximize2
} from 'lucide-react';
import { SimpleWebRTCCall, hasActiveCall, getExistingCall } from '@/utils/simpleWebRTC';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallKeepAlive } from '@/hooks/useCallKeepAlive';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { EventBus, CommunicationEvent } from '@/packages/communication-engine/core/EventBus';
import { Capacitor } from '@capacitor/core';
import { setNativeAudioRoute, syncCallStateToNative } from '@/utils/androidBridge';
import CallMoreMenu from './CallMoreMenu';
import { startAggressiveVideoPlayback, attachVideoTrackRecoveryHandlers } from '@/utils/androidVideoPlayback';
import NetworkStatusBanner, { SignalStrengthIndicator, VideoDisabledNotice } from '@/components/calls/NetworkStatusBanner';
import useUltraLowBandwidth from '@/hooks/useUltraLowBandwidth';
import { MediaQuality } from '@/utils/gracefulDegradation';
import { stopAllRingtones } from '@/hooks/useNativeRingtone';
import { useVideoZoom } from '@/hooks/useVideoZoom';
import { CallStateTransition } from '@/components/calling/CallStateTransition';
import { AudioWaveform } from '@/components/calling/AudioWaveform';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { haptics } from '@/utils/haptics';
import { CallLossBridge } from '@/utils/callLossBridge';
import { calculateMOS, mosLabel, mosColor, logCallEvent } from '@/utils/callQuality';
import { getLastResolvedRegion } from '@/utils/turnResolver';
import { batteryThermalMonitor, shouldDisableVideo, getRecommendedFpsCap } from '@/utils/batteryThermalMonitor';
import { useBandwidthEstimation } from '@/hooks/useBandwidthEstimation';
import { useAudioInterceptor } from '@/hooks/useAudioInterceptor';
import {
 BUSY_TONE_AUTO_END_MS,
 FAILED_TONE_AUTO_END_MS,
 callProgressToneStateManager,
 setCallProgressToneMuted,
} from '@/utils/callProgressTones';
import { getGlobalAudioContext } from '@/utils/audioContext';
import LiveCallOverlay from '@/components/chatr-shield/LiveCallOverlay';

type AudioRoute = 'earpiece' | 'speaker' | 'bluetooth';

export interface UnifiedCallScreenProps {
 callId: string;
 contactName: string;
 contactAvatar?: string;
 contactPhone?: string;
 isInitiator: boolean;
 partnerId: string;
 callType: 'voice' | 'video';
 preAcquiredStream?: MediaStream | null;
 onEnd: () => void;
 onSwitchToVideo?: () => void;
 videoEnabled?: boolean;
 startedAt?: string | null;
}

export default function UnifiedCallScreen({
 callId,
 contactName,
 contactAvatar,
 contactPhone,
 isInitiator,
 partnerId,
 callType,
 preAcquiredStream = null,
 onEnd,
 onSwitchToVideo,
 videoEnabled = false,
 startedAt = null,
}: UnifiedCallScreenProps) {
 const [callState, setCallState] = useState<'connecting' | 'connected' | 'reconnecting' | 'failed' | 'busy' | 'ended'>('connecting');
 const [isMuted, setIsMuted] = useState(false);
 const [isVideoOn, setIsVideoOn] = useState(callType === 'video' || videoEnabled);
 const [audioRoute, setAudioRoute] = useState<AudioRoute>('speaker');
 const [duration, setDuration] = useState(0);
 
 // FaceTime-style: springy corner snapping layout state
 const [pipCorner, setPipCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');

 const playConnectChime = () => {
 callProgressToneStateManager.transition('CONNECTED', { callId });
 };

 const playDisconnectChime = () => {
 callProgressToneStateManager.transition('ENDED', { callId });
 };
 const [showKeypad, setShowKeypad] = useState(false);
 const [dtmfInput, setDtmfInput] = useState('');
 const [showMoreMenu, setShowMoreMenu] = useState(false);
 const [remoteVideoActive, setRemoteVideoActive] = useState(false);
 const [localVideoActive, setLocalVideoActive] = useState(false);
 const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
 const [controlsVisible, setControlsVisible] = useState(true);
 const [localStream, setLocalStream] = useState<MediaStream | null>(null);
 // AI Translation State
 const [isTranslating, setIsTranslating] = useState(false);
 const { processedStream, isConnected, isReady, error: aiError } = useAudioInterceptor(isTranslating, localStream, 'Kashmiri', 'Hindi');
 
 // Video upgrade states (simplified - no request/accept flow, FaceTime-style auto)

 const webrtcRef = useRef<any | null>(null); // any to avoid SimpleWebRTCCall typing issues since import was dropped or not visible here
 const remoteVideoRef = useRef<HTMLVideoElement>(null);
 const localVideoRef = useRef<HTMLVideoElement>(null);
 const remoteAudioRef = useRef<HTMLAudioElement>(null); // Must be a DOM element for mobile autoplay
 const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
 const durationAnchorRef = useRef<number | null>(null);
 const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
 const userIdRef = useRef<string | null>(null);
 const videoPlaybackCleanupRef = useRef<(() => void) | null>(null);
 const trackRecoveryCleanupRef = useRef<(() => void) | null>(null);
 const explicitEndRef = useRef(false);
 const hasConnectedRef = useRef(false);
 const toneEndTimerRef = useRef<NodeJS.Timeout | null>(null);
 const preserveTerminalToneRef = useRef(false);
 const lastCallStatusSnapshotRef = useRef<string>('');
 const audioRouteTouchedRef = useRef(false);
 const audioRouteRef = useRef<AudioRoute>('speaker');

 // Phase 8 – E2EE, MOS, battery
 const [mosScore, setMosScore] = useState<number | null>(null);
 const [batteryDisabledVideo, setBatteryDisabledVideo] = useState(false);
 const [lossBridgeMsg, setLossBridgeMsg] = useState<string | null>(null);
 const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
 const lossBridgeRef = useRef<CallLossBridge | null>(null);
 const { bandwidth, measuredSpeed } = useBandwidthEstimation();

 const isVideo = callType === 'video' || isVideoOn || videoEnabled;
 const isMobile = Capacitor.isNativePlatform() || /iPhone|iPad|iPod/i.test(navigator.userAgent);

 const isRemoteVideoRenderable = !!(remoteVideoActive || (remoteStream && remoteStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')));
 const isLocalVideoRenderable = !!(localVideoActive || (localStream && localStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')));
 const contactInitial = /^[+\d\s()-]+$/.test(contactName.trim())
 ? '?'
 : (contactName.trim().match(/[A-Za-z0-9]/)?.[0] || '?').toUpperCase();

 useEffect(() => {
 if (localVideoRef.current && localStream) {
 const videoTracks = localStream.getVideoTracks();
 if (videoTracks.length > 0 && localVideoRef.current.srcObject !== localStream) {
 localVideoRef.current.srcObject = localStream;
 localVideoRef.current.muted = true;
 localVideoRef.current.play().catch(e => console.log('Local video play:', e));
 
 const facing = videoTracks[0].getSettings().facingMode || webrtcRef.current?.getCurrentFacingMode?.() || 'user';
 localVideoRef.current.style.transform = facing === 'environment'
 ? 'none'
 : 'scaleX(-1)';
 }
 }
 }, [localStream, isLocalVideoRenderable]);

 useEffect(() => {
 if (remoteVideoRef.current && remoteStream) {
 const videoTracks = remoteStream.getVideoTracks();
 if (videoTracks.length > 0 && remoteVideoRef.current.srcObject !== remoteStream) {
 remoteVideoRef.current.srcObject = remoteStream;
 remoteVideoRef.current.play().catch(e => console.log('Remote video play:', e));
 }
 }
 }, [remoteStream, isRemoteVideoRenderable]);

 // Pinch-to-zoom for video (max 2x) — sends zoomed video to partner
 // Zoom for remote video
 const { containerRef: zoomContainerRef, style: zoomStyle, scale: zoomScale, isZoomed, resetZoom, zoomIn, zoomOut } = useVideoZoom({
 minScale: 1,
 maxScale: 2,
 enabled: callState === 'connected' && isRemoteVideoRenderable
 });

 // Zoom for local PIP video
 const { containerRef: localZoomRef, style: localZoomStyle, scale: localZoomScale, isZoomed: isLocalZoomed, resetZoom: resetLocalZoom, zoomIn: localZoomIn, zoomOut: localZoomOut } = useVideoZoom({
 minScale: 1,
 maxScale: 2,
 enabled: callState === 'connected' && isLocalVideoRenderable
 });
 const callStateRef = useRef(callState);

 useCallKeepAlive(callId, callState === 'connected');

 const playRemoteAudio = useCallback(async (reason: string): Promise<boolean> => {
 const audioEl = remoteAudioRef.current;
 if (!audioEl || !audioEl.srcObject) return false;

 if (Capacitor.isNativePlatform()) {
 setNativeAudioRoute(audioRouteRef.current);
 }

 audioEl.muted = false;
 audioEl.volume = 1.0;

 try {
 await audioEl.play();
 console.log(`🔊 [UnifiedCall] Remote audio playing (${reason})`);
 return true;
 } catch (error) {
 console.warn(`🔊 [UnifiedCall] Remote audio play blocked (${reason})`, error);
 return false;
 }
 }, []);

 useEffect(() => {
 stopAllRingtones();
 }, []);

 useEffect(() => {
 if (!isVideoOn || audioRouteTouchedRef.current || audioRoute !== 'earpiece') return;

 setAudioRoute('speaker');
 if (Capacitor.isNativePlatform()) {
 setNativeAudioRoute('speaker');
 }
 }, [audioRoute, isVideoOn]);

 // Keep a stable reference for realtime callbacks (prevents stale closures)
 useEffect(() => {
 callStateRef.current = callState;
 if (callState === 'connected') {
 hasConnectedRef.current = true;
 }
 }, [callState]);

 useEffect(() => {
 audioRouteRef.current = audioRoute;
 }, [audioRoute]);

 // Inject AI translated audio stream into the peer connection
 useEffect(() => {
 if (!webrtcRef.current) return;
 const simpleWebRTC = webrtcRef.current as any;
 
 if (simpleWebRTC.setAIAudioTrack) {
 if (isTranslating && processedStream) {
 const aiAudioTrack = processedStream.getAudioTracks()[0] || null;
 simpleWebRTC.setAIAudioTrack(aiAudioTrack);
 } else {
 simpleWebRTC.setAIAudioTrack(null);
 }
 }
 }, [isTranslating, processedStream]);

 const [micLevel, setMicLevel] = useState<number>(0);
 const [chunksSent, setChunksSent] = useState<number>(0);

 // --- AI AUDIO DEBUG EVENT LISTENER ---
 useEffect(() => {
 const handleAIAudio = (e: Event) => {
 const customEvent = e as CustomEvent;
 console.log(`[DEBUG] Received ${customEvent.detail} samples of local AI audio.`);
 // Only show the toast once per session to avoid spam
 if (!(window as any)._hasShownAIToast) {
 toast.success('Local AI audio ready. Sending to phone...');
 (window as any)._hasShownAIToast = true;
 }
 };
 
 const handleAIMic = (e: Event) => {
 const { rms, chunkCount } = (e as CustomEvent).detail;
 setMicLevel(rms);
 setChunksSent(chunkCount);
 };

 window.addEventListener('ai-audio-debug', handleAIAudio);
 window.addEventListener('ai-mic-debug', handleAIMic);
 return () => {
 window.removeEventListener('ai-audio-debug', handleAIAudio);
 window.removeEventListener('ai-mic-debug', handleAIMic);
 };
 }, []);
 // -------------------------------------

 useEffect(() => {
 if (startedAt && callState === 'connected') {
 startDurationTimer(startedAt, 'active call prop');
 } else if (startedAt) {
 syncDurationAnchor(startedAt, 'active call prop');
 }
 }, [startedAt, callState]);

 useEffect(() => {
 if (callState !== 'connected' || !remoteStream?.getAudioTracks().length) return;

 let attempts = 0;
 const maxAttempts = 20;
 const runAttempt = () => {
 attempts += 1;
 if (Capacitor.isNativePlatform()) {
 setNativeAudioRoute(audioRouteRef.current);
 }
 void playRemoteAudio(`audio playback watchdog ${attempts}`);
 };

 runAttempt();
 const interval = setInterval(() => {
 if (attempts >= maxAttempts) {
 clearInterval(interval);
 return;
 }
 runAttempt();
 }, 500);

 return () => clearInterval(interval);
 }, [callState, remoteStream, playRemoteAudio]);

 useEffect(() => {
 if (toneEndTimerRef.current) {
 clearTimeout(toneEndTimerRef.current);
 toneEndTimerRef.current = null;
 }

 if (callState === 'connected') {
 callProgressToneStateManager.transition('CONNECTED', { callId });
 return;
 }

 if (callState === 'connecting' && isInitiator) {
 callProgressToneStateManager.transition('CALLING', { callId });
 return () => callProgressToneStateManager.stop(callId);
 }

 if (callState === 'reconnecting' && hasConnectedRef.current) {
 callProgressToneStateManager.transition('RECONNECTING', { callId });
 return () => callProgressToneStateManager.stop(callId);
 }

 if (callState === 'busy') {
 callProgressToneStateManager.transition('BUSY', { callId });
 toneEndTimerRef.current = setTimeout(() => {
 void handleEndCall({ playEndTone: false, finalWebrtcState: 'failed' });
 }, BUSY_TONE_AUTO_END_MS);
 return () => {
 if (toneEndTimerRef.current) {
 clearTimeout(toneEndTimerRef.current);
 toneEndTimerRef.current = null;
 }
 };
 }

 if (callState === 'failed') {
 callProgressToneStateManager.transition('FAILED', { callId });
 toneEndTimerRef.current = setTimeout(() => {
 void handleEndCall({ playEndTone: false, finalWebrtcState: 'failed' });
 }, FAILED_TONE_AUTO_END_MS);
 return () => {
 if (toneEndTimerRef.current) {
 clearTimeout(toneEndTimerRef.current);
 toneEndTimerRef.current = null;
 }
 };
 }
 }, [callId, callState, isInitiator]);

 // Phase 3 – Battery & Thermal Monitor
 useEffect(() => {
 batteryThermalMonitor.start();
 const unsub = batteryThermalMonitor.onChange(state => {
 if (shouldDisableVideo(state)) {
 setBatteryDisabledVideo(true);
 toast.warning(`🔋 Low battery (${Math.round(state.batteryLevel * 100)}%) – video disabled to save power`);
 webrtcRef.current?.getPeerConnection()?.getSenders()
 .filter(s => s.track?.kind === 'video')
 .forEach(s => { if (s.track) s.track.enabled = false; });
 } else {
 setBatteryDisabledVideo(false);
 }
 });
 return () => {
 unsub();
 batteryThermalMonitor.stop();
 };
 }, []);

 // Phase 10 – Haptics on call state transitions
 useEffect(() => {
 if (callState === 'connected') haptics.trigger('connect');
 if (callState === 'ended') haptics.trigger('disconnect');
 }, [callState]);

 // Phase 9 – Loss Bridge (friendly network drop notifications)
 useEffect(() => {
 const bridge = new CallLossBridge(contactName);
 lossBridgeRef.current = bridge;
 bridge.start();
 const unsub = bridge.onChange(event => {
 setLossBridgeMsg(event.message);
 if (event.type === 'SIGNAL_RESTORED') {
 setTimeout(() => setLossBridgeMsg(null), 4000);
 }
 });
 return () => {
 unsub();
 bridge.stop();
 };
 }, [contactName]);

 // Phase 6 – Live MOS score update from ABR engine telemetry
 useEffect(() => {
 if (callState !== 'connected') return;
 const interval = setInterval(async () => {
 const pc = webrtcRef.current?.getPeerConnection?.();
 if (!pc) return;
 try {
 const stats = await pc.getStats();
 let rtt = 0, loss = 0, jitter = 0;
 stats.forEach(r => {
 if (r.type === 'candidate-pair' && r.state === 'succeeded') {
 rtt = (r.currentRoundTripTime || 0) * 1000;
 }
 if (r.type === 'remote-inbound-rtp') {
 jitter = (r.jitter || 0) * 1000;
 const sent = r.packetsSent || 1;
 loss = ((r.packetsLost || 0) / sent) * 100;
 }
 });
 const mos = calculateMOS(rtt, loss, jitter);
 setMosScore(mos);
 } catch {}
 }, 3000);
 return () => clearInterval(interval);
 }, [callState]);

 // Ultra-low bandwidth optimizations
 // Note: peerConnection is accessed lazily since webrtcRef.current may not be set yet
 const getPeerConnection = useCallback(() => {
 return webrtcRef.current?.getPeerConnection?.() || null;
 }, []);
 
 const {
 networkMode,
 modeName,
 videoAllowed,
 videoRequiresTap,
 currentQuality,
 qualityDescription,
 uiState,
 signalStrength,
 showWarning,
 isOffline,
 applyOptimization,
 triggerRecovery,
 canEnableVideo
 } = useUltraLowBandwidth({
 // Don't pass peerConnection directly - it's not available on first render
 callId,
 onQualityChange: (quality, reason) => {
 console.log(`📶 [UnifiedCall] Quality changed: ${MediaQuality[quality]} - ${reason}`);
 if (quality <= MediaQuality.AUDIO_LOW) {
 setNetworkQuality('poor');
 } else if (quality <= MediaQuality.AUDIO_HD) {
 setNetworkQuality('fair');
 } else {
 setNetworkQuality('good');
 }
 },
 onFallbackToText: () => {
 toast.warning('Network too weak for voice - switching to text');
 }
 });

 // Auto-hide controls for video calls
 const resetControlsTimer = useCallback(() => {
 setControlsVisible(true);
 if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
 if (isVideo && callState === 'connected') {
 controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 4000);
 }
 }, [isVideo, callState]);

 useEffect(() => {
 resetControlsTimer();
 return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
 }, [resetControlsTimer]);

 // Listen for call ended in database (when partner ends call from app)
 useEffect(() => {
 const channel = supabase
 .channel(`call-status-${callId}`)
 .on(
 'postgres_changes',
 {
 event: 'UPDATE',
 schema: 'public',
 table: 'calls',
 filter: `id=eq.${callId}`,
 },
 (payload) => {
 const updatedCall = payload.new as any;
 const statusSnapshot = [
 updatedCall.status || '',
 updatedCall.webrtc_state || '',
 updatedCall.call_type || '',
 updatedCall.started_at || '',
 ].join('|');
 if (statusSnapshot === lastCallStatusSnapshotRef.current) {
 return;
 }
 lastCallStatusSnapshotRef.current = statusSnapshot;
 console.log('📡 [UnifiedCall] Call status update:', updatedCall.status);

 if (updatedCall.started_at) {
 if (callStateRef.current === 'connected') {
 startDurationTimer(updatedCall.started_at, 'call status update');
 } else {
 syncDurationAnchor(updatedCall.started_at, 'call status update');
 }
 }

 // If backend marks WebRTC as connected, force UI into connected state.
 // This fixes cases where we re-attach to an existing WebRTC instance and miss the 'connected' event.
 if (
 (updatedCall.webrtc_state === 'connected' || updatedCall.status === 'active') &&
 callStateRef.current !== 'connected'
 ) {
 console.log('✅ [UnifiedCall] Sync: backend says connected');
 setCallState('connected');
 startDurationTimer(updatedCall.started_at, 'backend connected');
 syncCallStateToNative(callId, 'connected');
 }

 if (updatedCall.status === 'busy') {
 console.log('[UnifiedCall] Receiver is busy');
 setCallState('busy');
 syncCallStateToNative(callId, 'failed');
 return;
 }

 if (updatedCall.status === 'failed' || updatedCall.webrtc_state === 'failed') {
 console.log('[UnifiedCall] Call failed');
 setCallState('failed');
 syncCallStateToNative(callId, 'failed');
 return;
 }

 if (updatedCall.status === 'ended' || updatedCall.status === 'missed') {
 console.log('📵 [UnifiedCall] Call ended by partner');
 explicitEndRef.current = true;
 cleanup();
 preserveTerminalToneRef.current = true;
 callProgressToneStateManager.transition('ENDED', { callId });
 setTimeout(() => {
 preserveTerminalToneRef.current = false;
 }, 1_000);
 onEnd();
 }
 }
 )
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [callId, onEnd]);

 useEffect(() => {
 let cancelled = false;

 const hydrateCallStart = async () => {
 try {
 const { data, error } = await supabase
 .from('calls')
 .select('status,webrtc_state,started_at')
 .eq('id', callId)
 .maybeSingle();

 if (cancelled || error || !data) return;

 if (data.started_at) {
 syncDurationAnchor(data.started_at, 'initial call row');
 }

 if (
 (data.status === 'active' || data.webrtc_state === 'connected') &&
 callStateRef.current !== 'connected'
 ) {
 console.log('[UnifiedCall] Initial row says connected');
 setCallState('connected');
 startDurationTimer(data.started_at, 'initial call row');
 syncCallStateToNative(callId, 'connected');
 }
 } catch (error) {
 console.warn('[UnifiedCall] Failed to hydrate call start time:', error);
 }
 };

 void hydrateCallStart();

 return () => {
 cancelled = true;
 };
 }, [callId]);

 // Initialize WebRTC - STRICT SINGLETON
 useEffect(() => {
 let isMounted = true;
 
 const initCall = async () => {
 try {
 // CRITICAL: Prevent duplicate initialization
 if (webrtcRef.current) {
 console.log('⚠️ [UnifiedCall] Already initialized, skipping');
 return;
 }
 
 // CRITICAL: Check if another instance is already handling this call
 if (hasActiveCall(callId)) {
 const existing = getExistingCall(callId);
 if (existing) {
 console.log('⚠️ [UnifiedCall] Reusing existing WebRTC instance');
 webrtcRef.current = existing;

 // Re-attach event handlers
 attachEventHandlers(existing);

 // Ensure the underlying WebRTC is actually started (safe: start() is idempotent)
 await existing.start();

 // Inject local tracks if we have a preAcquiredStream
 if (preAcquiredStream) {
 console.log('🔥 [UnifiedCall] Injecting preAcquiredStream into existing WebRTC call instance');
 await existing.addLocalStream(preAcquiredStream);
 }

 // If we missed the 'connected' event, sync from peer connection state
 const pc = existing.getPeerConnection?.();
 if (pc && (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed')) {
 console.log('✅ [UnifiedCall] Sync: existing peer connection already connected');
 setCallState('connected');
 startDurationTimer(startedAt, 'existing peer connection');
 
 // Play connection chime and sync route
 playConnectChime();
 const defaultRoute: AudioRoute = 'speaker';
 setAudioRoute(defaultRoute);
 if (Capacitor.isNativePlatform()) {
 setNativeAudioRoute(defaultRoute);
 }
 }

 return;
 }
 }
 
 const { data: { user } } = await supabase.auth.getUser();
 if (!user || !isMounted) {
 if (!user) toast.error('Not authenticated');
 if (isMounted) onEnd();
 return;
 }
 userIdRef.current = user.id;

 console.log('🎬 [UnifiedCall] Starting', isInitiator ? 'outgoing' : 'incoming', callType, 'call');
 
 const call = SimpleWebRTCCall.create(callId, partnerId, isVideo, isInitiator, user.id, preAcquiredStream);
 if (!isMounted) {
 call.end();
 return;
 }
 webrtcRef.current = call;

 attachEventHandlers(call);

 await call.start();
 if (isInitiator && isMounted) await updateCallStatus('ringing');

 } catch (error) {
 console.error('❌ [UnifiedCall] Init error:', error);
 if (isMounted) onEnd();
 }
 };

 const attachEventHandlers = (call: SimpleWebRTCCall) => {
 call.on('localStream', (stream: MediaStream) => {
 console.log('📹 [UnifiedCall] Local stream received/updated');
 setLocalStream(stream);
 EventBus.getInstance().emit(CommunicationEvent.LOCAL_STREAM_READY, { stream });
 if (localVideoRef.current) {
 const videoTracks = stream.getVideoTracks();
 if (videoTracks.length > 0) {
 // Always rebind srcObject so camera switch gets the fresh stream
 localVideoRef.current.srcObject = stream;
 localVideoRef.current.muted = true;
 localVideoRef.current.play().catch(e => console.log('Local video play:', e));
 setLocalVideoActive(true);
 // Mirror front camera, don't mirror rear
 const facing = (videoTracks[0].getSettings().facingMode) || call.getCurrentFacingMode?.() || 'user';
 localVideoRef.current.style.transform = facing === 'environment'
 ? 'translateZ(0)'
 : 'scaleX(-1) translateZ(0)';
 }
 }
 });

 // Listen for explicit facing mode changes (for browsers that don't report facingMode in settings)
 call.on('facingModeChanged', (facing: string) => {
 if (localVideoRef.current) {
 localVideoRef.current.style.transform = facing === 'environment'
 ? 'translateZ(0)'
 : 'scaleX(-1) translateZ(0)';
 }
 });

 call.on('remoteStream', (stream: MediaStream) => {
 setRemoteStream(stream);
 console.log('📺 [UnifiedCall] Remote stream received');
 const audioTracks = stream.getAudioTracks();
 const videoTracks = stream.getVideoTracks();
 console.log(` → Audio tracks: ${audioTracks.length}, Video tracks: ${videoTracks.length}`);
 audioTracks.forEach(t => console.log(` 🔊 Audio: ${t.label}, enabled: ${t.enabled}, muted: ${t.muted}`));
 videoTracks.forEach(t => console.log(` 📹 Video: ${t.label}, enabled: ${t.enabled}, muted: ${t.muted}`));
 
 // CRITICAL: Always setup audio via the DOM <audio> element (must be in DOM for mobile autoplay)
 // On Android WebView, audio MUST go through a DOM element, not just the PeerConnection
 if (remoteAudioRef.current) {
 if (Capacitor.isNativePlatform()) {
 setNativeAudioRoute(audioRouteRef.current);
 }
 remoteAudioRef.current.srcObject = stream;
 remoteAudioRef.current.muted = false;
 remoteAudioRef.current.volume = 1.0;
 audioTracks.forEach(track => {
 track.onunmute = () => void playRemoteAudio('audio track unmuted');
 track.onmute = () => console.log('🔊 [UnifiedCall] Remote audio track muted');
 });
 
 // CRITICAL FIX: Use muted-then-unmuted strategy for Android WebView autoplay
 const tryAudioPlay = async () => {
 const audioEl = remoteAudioRef.current;
 if (!audioEl) return;
 
 const directPlayed = await playRemoteAudio('direct remote stream');
 if (!directPlayed) {
 console.log('🔊 [UnifiedCall] Direct audio play blocked, trying muted...');
 try {
 // Strategy 2: Muted play then unmute
 audioEl.muted = true;
 await audioEl.play();
 // Small delay then unmute
 setTimeout(() => {
 if (audioEl) {
 audioEl.muted = false;
 audioEl.volume = 1.0;
 console.log('🔊 [UnifiedCall] Audio unmuted after muted play');
 void playRemoteAudio('post-muted autoplay');
 }
 }, 100);
 } catch (e2) {
 console.warn('🔊 [UnifiedCall] Audio play failed, will retry on interaction:', e2);
 // Strategy 3: Wait for user interaction
 const playOnInteraction = () => {
 void playRemoteAudio('user interaction');
 document.removeEventListener('touchstart', playOnInteraction);
 document.removeEventListener('click', playOnInteraction);
 document.removeEventListener('pointerdown', playOnInteraction);
 };
 document.addEventListener('touchstart', playOnInteraction, { once: true });
 document.addEventListener('click', playOnInteraction, { once: true });
 document.addEventListener('pointerdown', playOnInteraction, { once: true });
 }
 }
 };
 
 tryAudioPlay();
 }
 
 // VIDEO PLAYBACK: Works for both desktop and mobile/WebView.
 // Visibility only flips on after a decoded frame is observed.
 if (remoteVideoRef.current && videoTracks.length > 0) {
 console.log('📺 [UnifiedCall] Starting aggressive video playback');
 
 if (remoteVideoRef.current.srcObject !== stream) {
 remoteVideoRef.current.srcObject = stream;
 }
 remoteVideoRef.current.muted = true;
 setRemoteVideoActive(false);
 
 // Cleanup previous playback attempt
 if (videoPlaybackCleanupRef.current) {
 videoPlaybackCleanupRef.current();
 }
 
 // Try muted play first. Keeping the remote video muted avoids WebView/browser
 // autoplay blocks while the separate audio element owns audible playback.
 remoteVideoRef.current.play().then(() => {
 console.log('📺 [UnifiedCall] Remote video element play() accepted');
 }).catch(() => {
 console.log('📺 [UnifiedCall] Initial muted play attempt failed, relying on retry loop...');
 });
 
 // Start playback recovery; success means an actual frame rendered.
 videoPlaybackCleanupRef.current = startAggressiveVideoPlayback(
 remoteVideoRef.current,
 stream,
 {
 maxRetries: 15,
 retryIntervalMs: 400,
 onPlaybackStarted: () => {
 console.log('✅ [UnifiedCall] Remote video PLAYING (aggressive)');
 setRemoteVideoActive(true);
 },
 onPlaybackFailed: () => {
 console.warn('⚠️ [UnifiedCall] Video playback failed after all retries');
 setRemoteVideoActive(false);
 }
 }
 );
 } else if (remoteVideoRef.current) {
 // No video tracks yet, but assign stream for later
 console.log('📺 [UnifiedCall] Assigning stream (no video tracks yet)');
 remoteVideoRef.current.srcObject = stream;
 }
 
 // ANDROID WEBVIEW FIX: Attach comprehensive track recovery handlers
 // This handles onunmute, onended, onmute, and track additions
 if (trackRecoveryCleanupRef.current) {
 trackRecoveryCleanupRef.current();
 }
 
 trackRecoveryCleanupRef.current = attachVideoTrackRecoveryHandlers(
 stream,
 remoteVideoRef.current!,
 (active) => {
 console.log(`📺 [UnifiedCall] Video active state: ${active}`);
 setRemoteVideoActive(active);
 
 // If video became active, ensure we're playing
 if (active && remoteVideoRef.current) {
 remoteVideoRef.current.play().catch(() => {});
 }
 }
 );
 
 // BIDIRECTIONAL: Listen for tracks added AFTER initial stream
 // This handles FaceTime-style video upgrade AND delayed video from receiver
 stream.onaddtrack = (event) => {
 console.log('➕ [UnifiedCall] Track added:', event.track.kind, event.track.label);
 if (event.track.kind === 'audio' && remoteAudioRef.current) {
 remoteAudioRef.current.srcObject = stream;
 remoteAudioRef.current.muted = false;
 remoteAudioRef.current.volume = 1.0;
 if (Capacitor.isNativePlatform()) {
 setNativeAudioRoute(audioRouteRef.current);
 }
 void playRemoteAudio('remote audio track added');
 }
 if (event.track.kind === 'video' && remoteVideoRef.current) {
 console.log('📺 [UnifiedCall] Video track added - starting aggressive playback');
 
 // Cleanup and restart aggressive playback
 if (videoPlaybackCleanupRef.current) {
 videoPlaybackCleanupRef.current();
 }
 
 videoPlaybackCleanupRef.current = startAggressiveVideoPlayback(
 remoteVideoRef.current,
 stream,
 {
 maxRetries: 15,
 retryIntervalMs: 400,
 onPlaybackStarted: () => setRemoteVideoActive(true),
 onPlaybackFailed: () => {
 console.warn('Dynamic video playback failed');
 setRemoteVideoActive(false);
 }
 }
 );
 }
 };
 });

 call.on('connected', () => {
 console.log('🎉 [UnifiedCall] Connected!');
 setCallState('connected');
 startDurationTimer(startedAt, 'webrtc connected');
 
 // Play connected chime
 playConnectChime();
 
 // Keep Chatr media audible by default; users can still switch to earpiece manually.
 const defaultRoute: AudioRoute = 'speaker';
 setAudioRoute(defaultRoute);
 if (Capacitor.isNativePlatform()) {
 setNativeAudioRoute(defaultRoute);
 }
 setTimeout(() => void playRemoteAudio('call connected'), 0);
 setTimeout(() => void playRemoteAudio('call connected retry'), 500);
 
 // NOTE: Call status is now updated to 'active' inside SimpleWebRTCCall.handleConnected()
 // No need for duplicate updateCallStatus('active') here
 
 // CRITICAL: Notify native shell about connection
 syncCallStateToNative(callId, 'connected');
 });

 call.on('failed', (error: Error) => {
 console.error('⚠️ [UnifiedCall] Failed:', error);
 const name = error?.name;
 if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
 setCallState('failed');
 } else if (name === 'NotReadableError') {
 toast.error('Camera/Mic is busy. Close other apps.');
 setCallState('failed');
 } else {
 setCallState('failed');
 }
 });

 call.on('recoveryStatus', (status: any) => {
 if (status?.message) {
 setCallState('reconnecting');
 } else if (hasConnectedRef.current) {
 setCallState('connected');
 }
 });

 call.on('networkQuality', (quality: string) => {
 if (['excellent', 'good', 'fair', 'poor'].includes(quality)) {
 setNetworkQuality(quality as any);
 }
 });

 call.on('mediaHealth', (health: {
 kind?: string;
 framesDelta?: number;
 packetsDelta?: number;
 staleMs?: number;
 width?: number;
 height?: number;
 fps?: number;
 }) => {
 if (health.kind !== 'video') return;

 setRemoteVideoActive(current => {
 if ((health.framesDelta ?? 0) > 0) {
 return true;
 }
 if ((health.staleMs ?? 0) > 5000) {
 console.warn('[UnifiedCall] Remote video frames stalled', health);
 return false;
 }
 return current;
 });
 });

 call.on('trackState', ({ kind, state, muted }: { kind: string; state: string; muted?: boolean }) => {
 if (kind !== 'video') return;
 console.log('[UnifiedCall] Remote video track state', { state, muted });
 if (state === 'ended' || muted === true) {
 setRemoteVideoActive(false);
 }
 });

 call.on('ended', () => {
 console.log('👋 [UnifiedCall] Ended by remote');
 handleEndCall();
 });

 // FaceTime-style: When partner's renegotiation with video arrives, auto-enable our camera
 call.on('renegotiationComplete', () => {
 console.log('📹 [UnifiedCall] Renegotiation complete - checking for video upgrade');
 });

 // ABR tier change tracking
 call.on('tierChange', ({ tier, reason }: { tier: string; reason: string }) => {
 console.log(`📊 [UnifiedCall] Tier: ${tier} (${reason})`);
 });

 // Auto video enable: partner clicked video, we auto-enable too
 call.on('videoEnableRequested', async (fromUserId: string) => {
 console.log('📹 [UnifiedCall] Partner requested video enable - auto-enabling...');
 try {
 const videoStream = await webrtcRef.current?.addVideoToCall();
 if (videoStream && localVideoRef.current) {
 localVideoRef.current.srcObject = videoStream;
 localVideoRef.current.muted = true;
 await localVideoRef.current.play().catch(e => console.log('Local video play:', e));
 setLocalVideoActive(true);
 setIsVideoOn(true);
 toast.success('Video enabled');
 }
 } catch (e) {
 console.warn('📹 [UnifiedCall] Could not auto-enable video:', e);
 }
 });

 // CRITICAL: Handle remote video track arrival (for mid-call upgrades)
 // This ensures video plays even when stream reference doesn't change
 call.on('remoteVideoTrack', ({ track, stream }: { track: MediaStreamTrack; stream: MediaStream }) => {
 console.log('📺 [UnifiedCall] Remote VIDEO track received - binding renderer');
 
 if (!remoteVideoRef.current) return;
 
 setIsVideoOn(true);
 setRemoteVideoActive(false);
 
 if (remoteVideoRef.current.srcObject !== stream) {
 remoteVideoRef.current.srcObject = stream;
 }
 remoteVideoRef.current.muted = true;
 
 // Try immediate play
 remoteVideoRef.current.play().catch(() => {
 console.log('📺 [UnifiedCall] Initial remoteVideoTrack play failed, retrying...');
 });
 
 // Start aggressive playback for the new video track (backup)
 if (videoPlaybackCleanupRef.current) {
 videoPlaybackCleanupRef.current();
 }
 
 videoPlaybackCleanupRef.current = startAggressiveVideoPlayback(
 remoteVideoRef.current,
 stream,
 {
 maxRetries: 15,
 retryIntervalMs: 400,
 onPlaybackStarted: () => {
 console.log('✅ [UnifiedCall] Remote video PLAYING after upgrade');
 setRemoteVideoActive(true);
 },
 onPlaybackFailed: () => {
 console.warn('⚠️ [UnifiedCall] Video upgrade playback failed');
 setRemoteVideoActive(false);
 }
 }
 );
 });
 };

 initCall();
 return () => {
 isMounted = false;
 cleanup();
 };
 }, [callId]); // Only depend on callId - prevents re-init on prop changes

 // Enable video mid-call
 useEffect(() => {
 if (!videoEnabled || !webrtcRef.current || localVideoActive) return;
 
 const addVideo = async () => {
 console.log('📹 [UnifiedCall] Adding video to call...');
 const videoStream = await webrtcRef.current?.addVideoToCall();
 if (videoStream && localVideoRef.current) {
 localVideoRef.current.srcObject = videoStream;
 localVideoRef.current.muted = true;
 localVideoRef.current.play().catch(e => console.log('Local video play:', e));
 setLocalVideoActive(true);
 setIsVideoOn(true);
 }
 };
 addVideo();
 }, [videoEnabled, localVideoActive]);

 const parseCallStartedAt = (value?: string | number | Date | null): number | null => {
 if (!value) return null;
 const parsed =
 typeof value === 'number' ? value :
 value instanceof Date ? value.getTime() :
 new Date(value).getTime();
 return Number.isFinite(parsed) ? parsed : null;
 };

 const getCurrentDurationSeconds = () => {
 const anchor = durationAnchorRef.current;
 if (!anchor) return duration;
 return Math.max(0, Math.floor((Date.now() - anchor) / 1000));
 };

 const syncDurationAnchor = (
 value?: string | number | Date | null,
 source = 'local'
 ) => {
 const parsed = parseCallStartedAt(value);
 const nextAnchor = parsed ?? durationAnchorRef.current ?? Date.now();
 const previousAnchor = durationAnchorRef.current;

 if (!previousAnchor || Math.abs(previousAnchor - nextAnchor) > 1500) {
 durationAnchorRef.current = nextAnchor;
 const nextDuration = Math.max(0, Math.floor((Date.now() - nextAnchor) / 1000));
 setDuration(nextDuration);
 console.log(`[UnifiedCall] Duration synced from ${source}: ${nextDuration}s`);
 }

 return durationAnchorRef.current;
 };

 const startDurationTimer = (
 canonicalStartedAt?: string | number | Date | null,
 source = 'local connected'
 ) => {
 const anchor = syncDurationAnchor(canonicalStartedAt, source);
 if (!anchor) return;

 if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
 const tick = () => {
 setDuration(Math.max(0, Math.floor((Date.now() - anchor) / 1000)));
 };
 tick();
 durationIntervalRef.current = setInterval(tick, 1000);
 };

 const updateCallStatus = async (status: string) => {
 try {
 const startedAtForActive = status === 'active'
 ? (await supabase.from('calls').select('started_at').eq('id', callId).maybeSingle()).data?.started_at
 : null;

 await supabase.from('calls').update({ 
 status,
 webrtc_state: status === 'active' ? 'connected' : 'signaling',
 ...(status === 'active' && !startedAtForActive ? { started_at: new Date().toISOString() } : {})
 }).eq('id', callId);
 } catch (e) { console.error('Status update failed:', e); }
 };

 const handleEndCall = async ({
 playEndTone = true,
 finalWebrtcState = 'ended',
 }: {
 playEndTone?: boolean;
 finalWebrtcState?: 'ended' | 'failed';
 } = {}) => {
 explicitEndRef.current = true;
 cleanup();

 if (playEndTone) {
 preserveTerminalToneRef.current = true;
 playDisconnectChime();
 setTimeout(() => {
 preserveTerminalToneRef.current = false;
 }, 1_000);
 }
 
 // Notify native shell
 syncCallStateToNative(callId, finalWebrtcState === 'failed' ? 'failed' : 'ended');
 
 try {
 const isRingingCancel = isInitiator && !hasConnectedRef.current;
 const finalStatus = isRingingCancel ? 'missed' : 'ended';
 const finalDuration = getCurrentDurationSeconds();

 await supabase.from('calls').update({ 
 status: finalStatus, 
 webrtc_state: finalWebrtcState, 
 ended_at: new Date().toISOString(), 
 duration: finalDuration,
 missed: isRingingCancel
 }).eq('id', callId);

 // Notify the receiver instantly via FCM so they can dismiss any native overlay / heads-up notification
 await supabase.functions.invoke('fcm-notify', {
 body: {
 type: 'call_ended',
 receiverId: partnerId,
 callerId: userIdRef.current || '',
 callId: callId
 }
 }).catch(err => console.warn('⚠️ [UnifiedCall] Failed to send call_ended FCM:', err));

 } catch (e) { console.error('End call update failed:', e); }
 onEnd();
 };

 const cleanup = () => {
 if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
 if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
 if (toneEndTimerRef.current) {
 clearTimeout(toneEndTimerRef.current);
 toneEndTimerRef.current = null;
 }
 if (!preserveTerminalToneRef.current) {
 callProgressToneStateManager.stop(callId);
 }
 
 // ANDROID WEBVIEW FIX: Cleanup video playback helpers
 if (videoPlaybackCleanupRef.current) {
 videoPlaybackCleanupRef.current();
 videoPlaybackCleanupRef.current = null;
 }
 if (trackRecoveryCleanupRef.current) {
 trackRecoveryCleanupRef.current();
 trackRecoveryCleanupRef.current = null;
 }
 
 if (remoteAudioRef.current) {
 remoteAudioRef.current.pause();
 // Don't set srcObject=null here - React manages the DOM element lifecycle
 }
 if (webrtcRef.current) {
 if (explicitEndRef.current) {
 webrtcRef.current.end();
 } else {
 webrtcRef.current.detachPresentationHandlers();
 }
 webrtcRef.current = null;
 }
 };

 const toggleMute = () => {
 const newState = !isMuted;
 setIsMuted(newState);
 webrtcRef.current?.toggleAudio(!newState);
 setCallProgressToneMuted(newState);
 void playRemoteAudio('mute button interaction');
 };

 // FaceTime-style instant video toggle - no request/accept flow
 const toggleVideo = async () => {
 const call = webrtcRef.current;
 if (!call) return;

 if (!isVideoOn) {
 void playRemoteAudio('video button');

 // Check network policy first
 if (!canEnableVideo()) {
 toast.warning(uiState.message || 'Video not available on current network');
 return;
 }

 console.log('📹 [UnifiedCall] Enabling video (FaceTime-style)...');

 // Ensure the local PIP mounts so localVideoRef is available
 setIsVideoOn(true);
 setLocalVideoActive(true);

 // Wait a frame so the <video ref={localVideoRef}> is mounted
 await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

 try {
 let videoStream: MediaStream | null = null;

 // Whichever side taps video owns a real renegotiation offer. Relying on
 // a separate "video-enable" hint left one side with local preview only.
 videoStream = await call.addVideoToCall();

 if (videoStream && localVideoRef.current) {
 localVideoRef.current.srcObject = videoStream;
 localVideoRef.current.muted = true;
 await localVideoRef.current.play().catch((e) => console.log('Local video play:', e));
 toast.success('Video enabled');
 return;
 }

 // If we got here, we failed to attach preview
 setIsVideoOn(false);
 setLocalVideoActive(false);
 toast.error('Could not enable video');
 } catch (e) {
 console.error('📹 [UnifiedCall] Video enable failed:', e);
 setIsVideoOn(false);
 setLocalVideoActive(false);
 toast.error('Camera access failed');
 }
 } else {
 // Turn off video
 console.log('📹 [UnifiedCall] Disabling video...');
 setIsVideoOn(false);
 call.toggleVideo(false);
 setLocalVideoActive(false);
 if (localVideoRef.current) {
 localVideoRef.current.srcObject = null;
 }
 console.log('📹 [UnifiedCall] Video disabled');
 }
 };

 const switchCamera = async () => {
 if (!localVideoActive || !webrtcRef.current) {
 toast.error('Enable video first');
 return;
 }
 try {
 // switchCamera() in simpleWebRTC re-emits 'localStream' with the fresh stream.
 // The 'localStream' event handler above handles srcObject rebind + mirror transform.
 // No manual DOM manipulation needed here — avoids stale stream race condition.
 const newFacing = await webrtcRef.current.switchCamera();
 console.log(`📷 [UnifiedCall] Camera switched to: ${newFacing}`);
 toast.success(newFacing === 'environment' ? '🔭 Rear camera' : '🤳 Front camera');
 } catch (e) { 
 console.error('Switch camera error:', e);
 toast.error('Could not switch camera'); 
 }
 };

 const cycleAudioRoute = () => {
 audioRouteTouchedRef.current = true;
 const routes: AudioRoute[] = ['speaker', 'earpiece'];
 const idx = routes.indexOf(audioRoute);
 const newRoute = routes[(idx + 1) % routes.length];
 setAudioRoute(newRoute);
 
 if (Capacitor.isNativePlatform()) {
 const applied = setNativeAudioRoute(newRoute);
 if (!applied) {
 toast.error('Could not switch audio route');
 setAudioRoute(audioRoute);
 return;
 }
 }
 
 console.log(`📱 [UnifiedCall] Audio route: ${newRoute === 'speaker' ? 'Speaker' : 'Earpiece'}`);
 };

 const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

 const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
 const dtmfFrequencies: Record<string, [number, number]> = {
 '1': [697, 1209],
 '2': [697, 1336],
 '3': [697, 1477],
 '4': [770, 1209],
 '5': [770, 1336],
 '6': [770, 1477],
 '7': [852, 1209],
 '8': [852, 1336],
 '9': [852, 1477],
 '*': [941, 1209],
 '0': [941, 1336],
 '#': [941, 1477],
 };
 
 const handleDTMF = (digit: string) => {
 setDtmfInput(prev => `${prev}${digit}`.slice(-24));
 webrtcRef.current?.sendDTMF(digit);

 try {
 const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
 const ctx = new AudioCtor();
 const [low, high] = dtmfFrequencies[digit] || [440, 880];
 const oscLow = ctx.createOscillator();
 const oscHigh = ctx.createOscillator();
 const gain = ctx.createGain();

 oscLow.frequency.value = low;
 oscHigh.frequency.value = high;
 gain.gain.value = 0.08;

 oscLow.connect(gain);
 oscHigh.connect(gain);
 gain.connect(ctx.destination);

 oscLow.start();
 oscHigh.start();

 window.setTimeout(() => {
 oscLow.stop();
 oscHigh.stop();
 ctx.close().catch(() => {});
 }, 120);
 } catch (error) {
 console.debug('[UnifiedCall] DTMF tone playback unavailable:', error);
 }
 };

 const handleDtmfBackspace = () => {
 setDtmfInput(prev => prev.slice(0, -1));
 };

 const clearDtmfInput = () => {
 setDtmfInput('');
 };

 const hasLiveControls = callState !== 'failed' && callState !== 'busy' && callState !== 'ended';
 const audioRouteLabel = audioRoute === 'speaker' ? 'Speaker' : audioRoute === 'bluetooth' ? 'Bluetooth' : 'Earpiece';
 const callModeLabel = isVideo ? 'Video call' : 'Voice call';
 const connectionStatusLabel =
 callState === 'connected' ? formatDuration(duration)
 : callState === 'reconnecting' ? (uiState.message || 'Reconnecting...')
 : callState === 'failed' ? 'Connection failed'
 : callState === 'busy' ? 'User busy'
 : isInitiator ? 'Ringing...'
 : 'Connecting...';
 const speedValue = typeof measuredSpeed === 'number' && measuredSpeed > 0
 ? measuredSpeed
 : bandwidth.downlink;
 const speedLabel = speedValue >= 10 ? `${speedValue.toFixed(0)} Mbps` : `${speedValue.toFixed(1)} Mbps`;
 const latencyLabel = bandwidth.rtt > 0 ? `${Math.round(bandwidth.rtt)}ms` : null;
 const networkLineLabel = [
 uiState.message || (networkQuality === 'poor' ? 'Weak network' : 'Excellent network'),
 speedLabel,
 latencyLabel,
 ].filter(Boolean).join(' · ');
 const qualityBadgeLabel =
 callState === 'failed' ? 'Failed'
 : callState === 'busy' ? 'Busy'
 : isVideo && isRemoteVideoRenderable ? (
 networkQuality === 'fair' ? 'SD Video'
 : networkQuality === 'poor' ? 'Low Video'
 : 'HD Video'
 )
 : isVideo ? (
 isLocalVideoRenderable ? 'Video waiting'
 : isVideoOn ? 'Starting video'
 : 'Video off'
 )
 : 'Voice';
 const videoControlLabel =
 !videoAllowed ? 'No video'
 : isVideoOn && isLocalVideoRenderable ? 'Camera on'
 : isVideoOn ? 'Starting'
 : callType === 'video' ? 'Camera'
 : 'Video';

 const callUI = (
 <div 
 className="fixed inset-0 z-[99999] bg-black flex flex-col overflow-hidden select-none"
 style={{ 
 height: '100dvh', 
 width: '100vw', 
 top: 0,
 left: 0,
 right: 0,
 bottom: 0,
 isolation: 'isolate',
 WebkitTapHighlightColor: 'transparent',
 touchAction: 'manipulation',
 WebkitUserSelect: 'none',
 userSelect: 'none',
 willChange: 'transform, opacity',
 contain: 'layout style paint',
 transform: 'translateZ(0)', // Force GPU layer for smooth touch
 backfaceVisibility: 'hidden',
 perspective: 1000,
 }}
 onClick={() => {
 resetControlsTimer();
 void playRemoteAudio('screen tap');
 }}
 onPointerDownCapture={() => {
 if (callStateRef.current === 'connected') {
 void playRemoteAudio('pointer down');
 }
 }}
 >
 {/* CRITICAL: Hidden audio element in DOM for remote audio - needed for mobile/WebView autoplay policy */}
 {/* Audio elements NOT in DOM are blocked by browsers on mobile. This must stay rendered. */}
 <audio
 ref={remoteAudioRef}
 autoPlay
 playsInline
 preload="auto"
 style={{
 position: 'absolute',
 width: 1,
 height: 1,
 opacity: 0,
 pointerEvents: 'none',
 }}
 />

 {/* Premium Glassmorphic Dialer/Ringing Overlays */}
 {callState !== 'connected' && (
 <CallStateTransition 
 callState={
 callState === 'busy' ? 'busy'
 : callState === 'failed' ? 'failed'
 : callState === 'reconnecting' ? 'connecting'
 : isInitiator ? (duration > 0 ? 'ringing' : 'dialing')
 : 'connecting'
 }
 contactName={contactName}
 contactAvatar={contactAvatar}
 callType={callType === 'video' ? 'video' : 'voice'}
 />
 )}

 {/* Voice Call UI (LiveCallOverlay) */}
 {!isVideo && callState === 'connected' && (
 <LiveCallOverlay
 phoneNumber={contactPhone || partnerId}
 callerName={contactName}
 onEnd={handleEndCall}
 isMuted={isMuted}
 onToggleMute={() => {
 if (webrtcRef.current) webrtcRef.current.toggleAudio();
 }}
 isSpeaker={audioRoute === 'speaker'}
 onToggleSpeaker={() => {
 setAudioRoute(audioRoute === 'speaker' ? 'earpiece' : 'speaker');
 }}
 onToggleVideo={toggleVideo}
 />
 )}

 {/* Phase 9 Loss Bridge Toast Notification */}
 <AnimatePresence>
 {lossBridgeMsg && (
 <motion.div 
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="absolute top-20 inset-x-4 mx-auto max-w-sm z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-500/90 text-white font-semibold text-secondary shadow-xl backdrop-blur-xl border border-amber-400/40"
 >
 <WifiOff className="w-4 h-4 animate-pulse" />
 <span>{lossBridgeMsg}</span>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Background - Full-screen HD Remote Video with pinch-to-zoom */}
 {isVideo && (
 <div
 ref={zoomContainerRef}
 className="absolute inset-0 overflow-hidden"
 style={{ zIndex: 0, ...zoomStyle }}
 >
 <video
 ref={remoteVideoRef}
 autoPlay
 playsInline
 className="w-full h-full bg-black"
 style={{
 width: '100vw',
 height: '100dvh',
 minHeight: '-webkit-fill-available',
 objectFit: 'cover',
 transform: 'translateZ(0)',
 backfaceVisibility: 'hidden',
 perspective: 1000,
 opacity: 1,
 }}
 />
 </div>
 )}
 
 {/* Show avatar when no remote video - with smooth transitions */}
 {isVideo && (
 <div 
 className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center pointer-events-none"
 style={{ 
 transform: 'translateZ(0)',
 opacity: isRemoteVideoRenderable ? 0 : 1,
 transition: 'opacity 0.3s ease',
 zIndex: 10,
 }}
 >
 <div className="relative flex items-center justify-center -mt-10">
 <AudioWaveform 
 stream={remoteStream} 
 color="#10b981" 
 size={240} 
 className="absolute z-0 scale-95 sm:scale-100" 
 />
 
 {contactAvatar ? (
 <img 
 src={contactAvatar} 
 alt={contactName} 
 className="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover ring-[6px] ring-white/10 shadow-[0_0_80px_rgba(16,185,129,0.3)] transition-transform duration-200 active:scale-95 relative z-10" 
 />
 ) : (
 <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ring-[6px] ring-white/10 shadow-[0_0_80px_rgba(16,185,129,0.3)] transition-transform duration-200 active:scale-95 relative z-10">
 <span className="text-7xl font-light text-white">{contactInitial}</span>
 </div>
 )}
 </div>
 </div>
 )}

 <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 pointer-events-none z-[1]" />

 {/* Live Shield Analytics & E2EE Panel / MOS Score Badges */}
 {isVideo && callState === 'connected' && (
 <div className={`absolute flex flex-col gap-3 z-30 ${
 isRemoteVideoRenderable ? 'top-24 right-4 items-end' : 'top-[63%] left-1/2 -translate-x-1/2 items-center'
 }`}>
 <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/35 border border-white/10 backdrop-blur-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
 <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
 <span className="whitespace-nowrap text-[10px] font-bold tracking-[0.08em] text-emerald-300 uppercase">
 Secure {mosScore && `| MOS ${mosScore.toFixed(1)}`}
 </span>
 {mosScore && (
 <span
 className="w-2 h-2 rounded-full animate-pulse"
 style={{ backgroundColor: mosColor(mosScore) }}
 />
 )}
 </div>

 </div>
 )}

 <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/70 via-black/30 to-transparent z-10 pointer-events-none" />
 <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-10 pointer-events-none" />

 {/* Local Video PIP - keep mounted so ref exists; hide when inactive */}
 <motion.div
 layout
 drag
 dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
 dragElastic={1.0}
 onDragEnd={(event, info) => {
 const midX = window.innerWidth / 2;
 const midY = window.innerHeight / 2;
 const pointX = info.point.x;
 const pointY = info.point.y;
 
 let nextCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right';
 if (pointX < midX) {
 nextCorner = pointY < midY ? 'top-left' : 'bottom-left';
 } else {
 nextCorner = pointY < midY ? 'top-right' : 'bottom-right';
 }
 setPipCorner(nextCorner);
 }}
 initial={false}
 animate={isLocalVideoRenderable ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
 transition={{ type: 'spring', stiffness: 300, damping: 25 }}
 className={`absolute w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl z-20 cursor-grab active:cursor-grabbing ${
 isLocalVideoRenderable ? 'pointer-events-auto' : 'pointer-events-none'
 } ${
 pipCorner === 'top-left' ? 'top-16 left-4' :
 pipCorner === 'top-right' ? 'top-16 right-4' :
 pipCorner === 'bottom-left' ? 'bottom-48 left-4' :
 'bottom-48 right-4'
 }`}
 style={{
 transform: 'translateZ(0)',
 backfaceVisibility: 'hidden',
 touchAction: 'none',
 }}
 >
 <div ref={localZoomRef} className="w-full h-full" style={localZoomStyle}>
 <video
 ref={localVideoRef}
 autoPlay
 playsInline
 muted
 className="w-full h-full object-cover"
 style={{
 transform: 'scaleX(-1)',
 }}
 />
 </div>
 {/* Switch camera overlay inside PIP */}
 {isLocalVideoRenderable && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 switchCamera();
 }}
 className="absolute bottom-2 right-2 z-30 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
 title="Switch camera"
 >
 <SwitchCamera className="w-3.5 h-3.5 text-white" />
 </button>
 )}
 {/* Local zoom indicator */}
 {isLocalZoomed && (
 <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded-full">
 <span className="text-white text-[9px] font-medium">{localZoomScale.toFixed(1)}x</span>
 </div>
 )}
 </motion.div>

 {/* Video Disabled Notice */}
 {isVideo && !videoAllowed && callState === 'connected' && (
 <div className="absolute top-16 inset-x-4 z-40 flex justify-center">
 <VideoDisabledNotice />
 </div>
 )}

 {/* Remote zoom indicator */}
 <AnimatePresence>
 {isZoomed && (
 <motion.div
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.9 }}
 className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full flex items-center gap-2"
 >
 <ZoomIn className="w-3.5 h-3.5 text-white/70" />
 <span className="text-white text-secondary font-medium">{zoomScale.toFixed(1)}x</span>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Zoom controls - remote + local */}
 <AnimatePresence>
 {controlsVisible && (isRemoteVideoRenderable || isLocalVideoRenderable) && (
 <motion.div
 initial={{ opacity: 0, scale: 0.8 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.8 }}
 className="absolute bottom-52 right-4 z-40 flex flex-col gap-2"
 >
 {/* Remote zoom in */}
 {isRemoteVideoRenderable && zoomScale < 2 && (
 <button
 onClick={() => {
 zoomIn();
 const newZoom = Math.min(2, zoomScale + 0.5);
 webrtcRef.current?.applyZoom(newZoom);
 }}
 className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
 title="Zoom remote video"
 >
 <ZoomIn className="w-5 h-5 text-white" />
 </button>
 )}
 {/* Remote zoom out */}
 {isZoomed && (
 <button
 onClick={() => {
 resetZoom();
 webrtcRef.current?.applyZoom(1);
 }}
 className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
 title="Reset remote zoom"
 >
 <ZoomOut className="w-5 h-5 text-white" />
 </button>
 )}
 </motion.div>
 )}
 </AnimatePresence>

 <AnimatePresence>
 {controlsVisible && (
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="absolute top-0 inset-x-0 z-30 pt-safe"
 style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}
 >
 <div className="flex flex-col items-center py-4">
 {/* Signal Strength + Quality indicator */}
 <div className="flex items-center gap-2 mb-2">
 <SignalStrengthIndicator size="sm" />
 <div
 className={`px-3 py-1 rounded-full text-label ${
 callState === 'connected'
 ? networkQuality === 'excellent' || networkQuality === 'good'
 ? 'bg-emerald-500/20 text-emerald-300'
 : networkQuality === 'fair'
 ? 'bg-amber-500/20 text-amber-300'
 : 'bg-red-500/20 text-red-300'
 : callState === 'failed' || callState === 'busy'
 ? 'bg-red-500/20 text-red-300'
 : 'bg-white/10 text-white/75'
 }`}>
 {qualityBadgeLabel}
 </div>
 </div>
 
 <h1 className="text-white text-workspace drop-shadow-lg">{contactName}</h1>
 {contactPhone && <p className="text-white/60 text-secondary">{contactPhone}</p>}
 <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/40">{callModeLabel}</p>
 <p className="mt-1 text-[11px] text-white/45">{networkLineLabel}</p>
 
 <p className={`text-secondary mt-1 ${
	 callState === 'connected' ? 'text-emerald-400 font-mono' 
	 : callState === 'reconnecting' ? 'text-amber-400 animate-pulse'
	 : callState === 'failed' || callState === 'busy' ? 'text-red-400'
	 : 'text-white/70 animate-pulse'
	 }`}>
	 {connectionStatusLabel}
	 </p>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Keypad Overlay */}
 <AnimatePresence>
 {showKeypad && (
 <motion.div
 initial={{ opacity: 0, y: 50 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 50 }}
 className="absolute inset-x-4 bottom-44 bg-black/85 backdrop-blur-2xl rounded-[28px] border border-white/10 p-5 z-40 shadow-2xl"
 >
 <div className="mb-4 rounded-2xl bg-white/6 border border-white/8 px-4 py-3">
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Dial tones</p>
 <p className="mt-1 min-h-[28px] text-workspace font-medium tracking-[0.24em] text-white font-mono break-all">
 {dtmfInput || '—'}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={handleDtmfBackspace}
 className="w-10 h-10 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-white/80 active:scale-90 transition-transform"
 aria-label="Delete last digit"
 >
 <Delete className="w-4 h-4" />
 </button>
 <button
 onClick={clearDtmfInput}
 className="px-3 py-2 rounded-full bg-white/8 border border-white/10 text-[11px] font-medium text-white/80 active:scale-95 transition-transform"
 >
 Clear
 </button>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
 {keypadDigits.map(d => (
 <button
 key={d}
 onClick={() => handleDTMF(d)}
 className="w-16 h-16 rounded-full bg-white/10 border border-white/10 text-white text-page active:bg-white/20 active:scale-95 transition-all mx-auto flex items-center justify-center"
 >
 {d}
 </button>
 ))}
 </div>
 <button
 onClick={() => setShowKeypad(false)}
 className="w-full mt-4 rounded-full bg-white/8 py-3 text-secondary font-medium text-emerald-300 active:scale-[0.99] transition-transform"
 >
 Hide Keypad
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 {/* AI Translation Status */}
 {isTranslating && (
 <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
 <div className={`px-4 py-2 rounded-full text-white text-secondary font-medium shadow-lg backdrop-blur-sm flex items-center gap-2 ${aiError ? 'bg-red-500/90' : !isConnected || !isReady ? 'bg-amber-500/90 animate-pulse' : 'bg-purple-600/90'}`}>
 {aiError ? (
 <>
 <div className="w-2 h-2 rounded-full bg-red-200" />
 {aiError}
 </>
 ) : !isConnected ? (
 <>
 <div className="w-2 h-2 rounded-full bg-white animate-ping" />
 Local AI translation unavailable...
 </>
 ) : !isReady ? (
 <>
 <div className="w-2 h-2 rounded-full bg-white animate-spin" />
 AI Setting Up...
 </>
 ) : (
 <>
 <div className="w-2 h-2 rounded-full bg-purple-200" />
 🎙️ AI Listening & Translating (Kashmiri → Hindi)
 </>
 )}
 </div>
 </div>
 )}

 {/* Bottom Controls */}
 <AnimatePresence>
 {isVideo && controlsVisible && (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 20 }}
 className="absolute bottom-0 left-0 right-0 z-[100] pb-[env(safe-area-inset-bottom,20px)] pointer-events-none"
 style={{ 
 background: isRemoteVideoRenderable ? 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)' : 'none'
 }}
 >
 {callState === 'connected' ? (
 <div className="mx-auto flex w-full max-w-sm flex-col px-4 pb-4">
 {/* Status indicator row */}
 <div className="mb-4 flex items-center justify-center space-x-2 pointer-events-auto">
 <div className="flex items-center space-x-1.5 rounded-full bg-black/35 border border-white/10 px-3 py-1 backdrop-blur-md shadow-lg">
 <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
 <span className="text-[11px] font-semibold tracking-wide text-white/95">
 {String(Math.floor(duration / 60)).padStart(2, '0')}:{String(duration % 60).padStart(2, '0')}
 </span>
 </div>
 </div>

 <div className="mx-4 mb-4 rounded-[28px] border border-white/10 bg-black/35 px-6 pt-5 pb-3 backdrop-blur-[34px] shadow-[0_18px_44px_rgba(0,0,0,0.45)] relative overflow-hidden pointer-events-auto">
 <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
 <div className="relative z-10">
 <div className="mx-auto mb-5 h-1.5 w-14 rounded-full bg-white/15" />

 <div className="flex justify-evenly items-end mb-2 px-0 gap-1 sm:gap-3 w-full">
 <button
 onClick={() => setShowMoreMenu(true)}
 className="flex flex-col items-center gap-1 touch-manipulation"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/15 flex items-center justify-center transition-all duration-150 active:scale-90 active:bg-white/25">
 <MoreHorizontal className="w-5 h-5 text-white" />
 </div>
 <span className="text-[10px] text-white/65">More</span>
 </button>

 <button
 onClick={toggleVideo}
 className="flex flex-col items-center gap-1 touch-manipulation"
 disabled={!videoAllowed && !isVideoOn}
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
 <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 relative ${
 isVideoOn && isLocalVideoRenderable ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:bg-emerald-600'
 : isVideoOn && !isLocalVideoRenderable ? 'bg-amber-500/70 text-white animate-pulse'
 : !videoAllowed ? 'bg-white/5 text-white/30'
 : 'bg-white/15 text-white active:bg-white/25'
 }`}>
 {!videoAllowed ? (
 <WifiOff className="w-5 h-5" />
 ) : isVideoOn ? (
 <Video className="w-5 h-5" />
 ) : (
 <Video className="w-5 h-5" />
 )}
 </div>
 <span className={`text-[10px] ${!videoAllowed ? 'text-white/30' : 'text-white/65'}`}>
 {videoControlLabel}
 </span>
 </button>

 <button
 onClick={() => handleEndCall()}
 className="flex flex-col items-center gap-1 touch-manipulation"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
 <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/35 transition-all duration-150 active:scale-90 active:bg-red-600">
 <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
 </div>
 <span className="text-[10px] text-red-300">End</span>
 </button>

 <button
 onClick={toggleMute}
 className="flex flex-col items-center gap-1 touch-manipulation"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
 <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
 isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 active:bg-red-600' : 'bg-white/15 text-white active:bg-white/25'
 }`}>
 {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
 </div>
 <span className="text-[10px] text-white/65">{isMuted ? 'Muted' : 'Mute'}</span>
 </button>

 <button
 onClick={cycleAudioRoute}
 className="flex flex-col items-center gap-1 touch-manipulation"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
 <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
 audioRoute === 'speaker' ? 'bg-white text-black shadow-lg shadow-white/15' : 'bg-white/15 text-white active:bg-white/25'
 }`}>
 <Volume2 className="w-5 h-5" />
 </div>
 <span className="text-[10px] text-white/65">{audioRouteLabel}</span>
 </button>
 </div>

 {/* Flip & PIP buttons removed as per Image 2 specification */}
 </div>
 </div>
 </div>
 ) : (
 <div className="mx-auto mb-5 flex w-full max-w-xs flex-col items-center gap-3 px-6 pointer-events-auto">
 <button
 onClick={() => handleEndCall()}
 className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-red-500 p-5 shadow-lg shadow-red-500/35 transition-all duration-150 active:scale-90 active:bg-red-600"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 aria-label="Cancel call"
 >
 <PhoneOff className="h-8 w-8 text-white" />
 </button>
 <div className="text-center">
 <p className="text-secondary font-medium text-white/85">
 {callState === 'failed' ? 'Close' : callState === 'busy' ? 'End call' : 'Cancel'}
 </p>
 <p className="mt-1 text-label text-white/45">
 {callState === 'connecting' ? 'Waiting for the secure connection' : connectionStatusLabel}
 </p>
 </div>
 </div>
 )}
 </motion.div>
 )}
 </AnimatePresence>
 
 {/* VoIP Features Menu */}
 <CallMoreMenu
 isOpen={showMoreMenu}
 onClose={() => setShowMoreMenu(false)}
 callId={callId}
 localStream={localStream}
 contactName={contactName}
 callType={callType}
 isVideoOn={isVideoOn}
 isMuted={isMuted}
 duration={duration}
 partnerId={partnerId}
 onHoldChange={(held) => {
 if (webrtcRef.current) {
 webrtcRef.current.toggleAudio(!held);
 }
 }}
 />
 </div>
 );

 return createPortal(callUI, document.body);
}
