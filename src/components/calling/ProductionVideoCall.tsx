import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, SwitchCamera, Repeat, ZoomIn, ZoomOut, MonitorUp, MonitorOff, ShieldCheck, Wifi } from 'lucide-react';
import { SimpleWebRTCCall } from '@/utils/simpleWebRTC';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallUI } from '@/hooks/useCallUI';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { useCallKeepAlive } from '@/hooks/useCallKeepAlive';
import { useVideoZoom } from '@/hooks/useVideoZoom';

// Browser detection utilities
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isFirefox = () => /firefox/i.test(navigator.userAgent);
const isChrome = () => /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);
const isMobile = () => Capacitor.isNativePlatform() || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

interface ProductionVideoCallProps {
 callId: string;
 contactName: string;
 isInitiator: boolean;
 partnerId: string;
 onEnd: () => void;
}

export default function ProductionVideoCall({
 callId,
 contactName,
 isInitiator,
 partnerId,
 onEnd,
}: ProductionVideoCallProps) {
 const [callState, setCallState] = useState<'connecting' | 'connected' | 'failed'>('connecting');
 const [audioEnabled, setAudioEnabled] = useState(true);
 const [videoEnabled, setVideoEnabled] = useState(true);
 const [speakerEnabled, setSpeakerEnabled] = useState(false);
 const [isScreenSharing, setIsScreenSharing] = useState(false);
 const [duration, setDuration] = useState(0);
 const [videoLayout, setVideoLayout] = useState<'remote-main' | 'local-main'>('remote-main');
 const [isFullScreen, setIsFullScreen] = useState(false);
 const [userInteracted, setUserInteracted] = useState(false);
 const isMobileDevice = isMobile();

 const webrtcRef = useRef<SimpleWebRTCCall | null>(null);
 const localVideoRef = useRef<HTMLVideoElement>(null);
 const remoteVideoRef = useRef<HTMLVideoElement>(null);
 const screenContainerRef = useRef<HTMLDivElement>(null);
 const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
 const userIdRef = useRef<string | null>(null);
 
 // CRITICAL: Keep call alive with heartbeat mechanism
 useCallKeepAlive(callId, callState === 'connected');

 const { controlsVisible, showControls } = useCallUI({
 autoHideDelay: 8000, 
 enabled: true 
 });

 useEffect(() => {
 // Flagship Immersive Mode: Hide status bar natively on start
 if (Capacitor.isNativePlatform()) {
 try {
 StatusBar.hide().catch(e => console.log('StatusBar.hide error:', e));
 } catch (e) {
 console.log('StatusBar error:', e);
 }
 }

 const initCall = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) {
 toast.error('Not authenticated');
 onEnd();
 return;
 }
 userIdRef.current = user.id;

 console.log('🎬 [ProductionVideoCall] Initializing video call...');
 
 const call = SimpleWebRTCCall.create(callId, partnerId, true, isInitiator, user.id);
 webrtcRef.current = call;

 call.on('localStream', (stream: MediaStream) => {
 console.log('📹 [ProductionVideoCall] Local stream received');
 if (localVideoRef.current) {
 localVideoRef.current.srcObject = stream;
 localVideoRef.current.muted = true;
 localVideoRef.current.play().catch(e => console.log('Local video play:', e));
 // Apply mirror based on facing mode
 const facing = stream.getVideoTracks()[0]?.getSettings()?.facingMode || call.getCurrentFacingMode?.() || 'user';
 localVideoRef.current.style.transform = facing === 'environment' ? 'translateZ(0)' : 'scaleX(-1) translateZ(0)';
 }
 
 setTimeout(() => {
 if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
 remoteVideoRef.current.muted = false;
 remoteVideoRef.current.volume = 1.0;
 console.log('🔊 Double-checking remote audio is unmuted');
 }
 }, 500);
 });

 // Listen for camera facing mode changes to update mirror
 call.on('facingModeChanged', (facing: string) => {
 if (localVideoRef.current) {
 localVideoRef.current.style.transform = facing === 'environment' ? 'translateZ(0)' : 'scaleX(-1) translateZ(0)';
 }
 if (pipVideoRef.current && videoLayout === 'remote-main') {
 pipVideoRef.current.style.transform = facing === 'environment' ? 'none' : 'scaleX(-1)';
 }
 });

 call.on('remoteStream', (stream: MediaStream) => {
 console.log('📺 [ProductionVideoCall] Remote stream received');
 
 if (remoteVideoRef.current) {
 remoteVideoRef.current.srcObject = stream;
 remoteVideoRef.current.playsInline = true;
 remoteVideoRef.current.autoplay = true;
 
 // CRITICAL: Start muted to allow autoplay, then unmute after playback starts
 remoteVideoRef.current.muted = true;
 remoteVideoRef.current.volume = 1.0;
 
 remoteVideoRef.current.setAttribute('webkit-playsinline', 'true');
 remoteVideoRef.current.setAttribute('playsinline', 'true');
 
 const forcePlay = async (attempt: number = 1) => {
 try {
 if (remoteVideoRef.current) {
 if (attempt === 1) {
 remoteVideoRef.current.muted = true;
 }
 
 await remoteVideoRef.current.play();
 console.log(`✅ Remote video playing (attempt ${attempt})`);
 
 setTimeout(() => {
 if (remoteVideoRef.current) {
 remoteVideoRef.current.muted = false;
 remoteVideoRef.current.volume = 1.0;
 setUserInteracted(true);
 }
 }, 100);
 }
 } catch (err) {
 console.warn(`⚠️ Play failed (attempt ${attempt}):`, err);
 
 if (attempt <= 2 && (err.name === 'NotAllowedError' || err.name === 'NotSupportedError')) {
 const playOnInteraction = async () => {
 try {
 if (remoteVideoRef.current) {
 remoteVideoRef.current.muted = true;
 await remoteVideoRef.current.play();
 setTimeout(() => {
 if (remoteVideoRef.current) {
 remoteVideoRef.current.muted = false;
 remoteVideoRef.current.volume = 1.0;
 setUserInteracted(true);
 }
 }, 100);
 }
 } catch (e) {
 console.error('Failed to play after interaction:', e);
 }
 };
 
 const events = ['touchstart', 'touchend', 'click', 'mousedown', 'keydown'];
 events.forEach(eventType => {
 document.addEventListener(eventType, playOnInteraction, { once: true, capture: true });
 });
 }
 }
 };
 
 forcePlay(1);
 setTimeout(() => forcePlay(2), 100);
 setTimeout(() => forcePlay(3), 500);
 setTimeout(() => forcePlay(4), 1500);
 }
 });

 call.on('connected', () => {
 console.log('🎉 [ProductionVideoCall] Call connected!');
 setCallState('connected');
 startDurationTimer();
 updateCallStatus('active');
 });

 call.on('failed', (error: Error) => {
 console.error('⚠️ [ProductionVideoCall] Connection issue:', error);
 const name = (error as any)?.name as string | undefined;

 if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
 setCallState('failed');
 return;
 }

 if (name === 'NotFoundError') {
 toast.error('No camera or microphone found on this device', { duration: 8000 });
 setCallState('failed');
 return;
 }

 if (name === 'NotReadableError') {
 toast.error('Camera/microphone is busy. Close other apps and try again.', { duration: 8000 });
 return;
 }
 });
 
 call.on('ended', () => {
 handleEndCall();
 });

 await call.start();
 if (isInitiator) {
 await updateCallStatus('ringing');
 }

 } catch (error) {
 console.error('❌ [ProductionVideoCall] Init error:', error);
 toast.error('Failed to initialize call');
 onEnd();
 }
 };

 initCall();

 return () => {
 cleanup();
 };
 }, []);

 // CRITICAL: Monitor call status changes to stop ringback
 useEffect(() => {
 if (!isInitiator) return;
 
 const channel = supabase
 .channel(`video-call-status-${callId}`)
 .on('postgres_changes', {
 event: 'UPDATE',
 schema: 'public',
 table: 'calls',
 filter: `id=eq.${callId}`
 }, (payload: any) => {
 const newStatus = payload.new?.status;
 if (newStatus === 'active' || newStatus === 'connected') {
 if (callState === 'connecting') {
 setCallState('connected');
 startDurationTimer();
 }
 }
 })
 .subscribe();
 
 return () => {
 supabase.removeChannel(channel);
 };
 }, [callId, isInitiator, callState]);

 const startDurationTimer = () => {
 durationIntervalRef.current = setInterval(() => {
 setDuration(d => d + 1);
 }, 1000);
 };

 const updateCallStatus = async (status: string) => {
 try {
 await supabase
 .from('calls')
 .update({ 
 status,
 webrtc_state: status === 'active' ? 'connected' : 'signaling',
 ...(status === 'active' ? { started_at: new Date().toISOString() } : {})
 })
 .eq('id', callId);
 } catch (error) {
 console.error('Failed to update call status:', error);
 }
 };

 const handleEndCall = async () => {
 cleanup();
 
 try {
 await supabase
 .from('calls')
 .update({ 
 status: 'ended',
 webrtc_state: 'ended',
 ended_at: new Date().toISOString(),
 duration
 })
 .eq('id', callId);
 } catch (error) {
 console.error('Failed to update call end:', error);
 }

 onEnd();
 };

 const cleanup = () => {
 if (Capacitor.isNativePlatform()) {
 try {
 StatusBar.show().catch(e => console.log('StatusBar.show error:', e));
 } catch (e) {
 console.log('StatusBar error:', e);
 }
 }
 
 if (durationIntervalRef.current) {
 clearInterval(durationIntervalRef.current);
 }
 if (webrtcRef.current) {
 webrtcRef.current.end();
 webrtcRef.current = null;
 }
 };

 const toggleAudio = () => {
 const newState = !audioEnabled;
 setAudioEnabled(newState);
 webrtcRef.current?.toggleAudio(newState);
 };

 const toggleVideo = () => {
 const newState = !videoEnabled;
 setVideoEnabled(newState);
 webrtcRef.current?.toggleVideo(newState);
 };

 const toggleSpeaker = async () => {
 const newState = !speakerEnabled;
 setSpeakerEnabled(newState);
 
 if (remoteVideoRef.current) {
 try {
 const devices = await navigator.mediaDevices.enumerateDevices();
 const audioDevices = devices.filter(device => device.kind === 'audiooutput');
 
 if (audioDevices.length > 0) {
 const targetDevice = newState 
 ? audioDevices.find(d => d.label.toLowerCase().includes('speaker'))?.deviceId 
 : audioDevices.find(d => d.label.toLowerCase().includes('earpiece') || d.label.toLowerCase().includes('phone'))?.deviceId;
 
 if (targetDevice && 'setSinkId' in remoteVideoRef.current) {
 await (remoteVideoRef.current as any).setSinkId(targetDevice);
 toast.success(newState ? 'Speaker enabled' : 'Earpiece enabled');
 }
 }
 } catch (error) {
 console.error('Failed to switch audio output:', error);
 }
 }
 };

 const formatDuration = (seconds: number): string => {
 const mins = Math.floor(seconds / 60);
 const secs = seconds % 60;
 return `${mins}:${secs.toString().padStart(2, '0')}`;
 };

 const handleSwapVideos = () => {
 setVideoLayout(prev => prev === 'remote-main' ? 'local-main' : 'remote-main');
 };

 const handleToggleFullScreen = async () => {
 if (!isFullScreen) {
 await document.documentElement.requestFullscreen();
 setIsFullScreen(true);
 } else {
 await document.exitFullscreen();
 setIsFullScreen(false);
 }
 };

 const handleSwitchCamera = async () => {
 try {
 const newMode = await webrtcRef.current?.switchCamera();
 toast.success(`Switched to ${newMode === 'user' ? 'front' : 'back'} camera`);
 } catch (error) {
 console.error('Camera switch error:', error);
 }
 };

 const toggleScreenShare = async () => {
 if (!isScreenSharing) {
 try {
 const screenStream = await navigator.mediaDevices.getDisplayMedia({
 video: true,
 audio: false,
 } as DisplayMediaStreamOptions);
 
 const videoTrack = screenStream.getVideoTracks()[0];
 
 if (webrtcRef.current) {
 await webrtcRef.current.replaceTrack(videoTrack);
 }
 
 if (localVideoRef.current) {
 localVideoRef.current.srcObject = screenStream;
 }
 
 setIsScreenSharing(true);
 toast.success('Screen sharing started');
 
 videoTrack.onended = () => {
 stopScreenShare();
 };
 } catch (error) {
 console.error('Screen share error:', error);
 }
 } else {
 stopScreenShare();
 }
 };

 const stopScreenShare = async () => {
 try {
 const cameraStream = await navigator.mediaDevices.getUserMedia({ 
 video: { facingMode: 'user' },
 audio: false 
 });
 
 const videoTrack = cameraStream.getVideoTracks()[0];
 
 if (webrtcRef.current) {
 await webrtcRef.current.replaceTrack(videoTrack);
 }
 
 if (localVideoRef.current) {
 localVideoRef.current.srcObject = cameraStream;
 }
 
 setIsScreenSharing(false);
 } catch (error) {
 console.error('Error stopping screen share:', error);
 }
 };

 const mainVideoRef = videoLayout === 'remote-main' ? remoteVideoRef : localVideoRef;
 const pipVideoRef = videoLayout === 'remote-main' ? localVideoRef : remoteVideoRef;

 const { containerRef: zoomContainerRef, style: zoomStyle, scale: zoomScale, isZoomed, resetZoom, zoomIn } = useVideoZoom({
 minScale: 1,
 maxScale: 2,
 enabled: callState === 'connected'
 });

 return (
 <div 
 ref={screenContainerRef}
 className="fixed inset-0 z-[99999] bg-black select-none overflow-hidden flex flex-col justify-between"
 style={{ 
 width: '100vw', 
 height: '100dvh',
 minHeight: '-webkit-fill-available',
 top: 0,
 left: 0,
 right: 0,
 bottom: 0,
 isolation: 'isolate',
 }}
 onClick={(e) => { e.stopPropagation(); showControls(); }}
 >
 {/* 1. Dynamic speaker glowing styles */}
 <style dangerouslySetInnerHTML={{__html: `
 @keyframes speakerPulse {
 0%, 100% { border-color: rgba(29, 158, 117, 0.25); box-shadow: 0 0 15px rgba(29, 158, 117, 0.15); }
 50% { border-color: rgba(29, 158, 117, 0.7); box-shadow: 0 0 25px rgba(29, 158, 117, 0.45); }
 }
 .speaker-active-border {
 animation: speakerPulse 3s infinite ease-in-out;
 }
 `}} />

 {/* 2. Top cinematic overlay gradient */}
 <div 
 className="absolute inset-x-0 top-0 h-48 pointer-events-none z-10"
 style={{
 background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0) 100%)'
 }}
 />

 {/* 3. Bottom cinematic overlay gradient */}
 <div 
 className="absolute inset-x-0 bottom-0 h-80 pointer-events-none z-10"
 style={{
 background: 'linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0) 100%)'
 }}
 />

 {/* Main video window (FaceTime-Style Fullscreen Cover) */}
 <div 
 ref={zoomContainerRef}
 className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center bg-black z-0"
 style={zoomStyle}
 >
 <video
 ref={mainVideoRef}
 autoPlay
 playsInline
 muted={videoLayout === 'local-main'}
 // Immersive Object Fit Cover & GPU-Accelerated Cinematic enhancement filters
 className="w-full h-full object-cover"
 style={{ 
 WebkitPlaysinline: 'true',
 filter: 'contrast(1.05) brightness(0.96) saturate(1.03)',
 willChange: 'transform, filter',
 transform: 'translateZ(0)',
 } as any}
 onDoubleClick={() => {
 if (isZoomed) {
 resetZoom();
 } else {
 handleToggleFullScreen();
 }
 }}
 onLoadedMetadata={(e) => {
 const video = e.currentTarget;
 if (videoLayout === 'remote-main') {
 video.muted = true;
 video.play().then(() => {
 setTimeout(() => {
 video.muted = false;
 video.volume = 1.0;
 console.log('🔊 Remote video metadata loaded and unmuted');
 }, 100);
 }).catch(err => console.log('Auto-play on metadata:', err));
 }
 }}
 onClick={() => {
 if (mainVideoRef.current && videoLayout === 'remote-main') {
 mainVideoRef.current.muted = false;
 mainVideoRef.current.volume = 1.0;
 mainVideoRef.current.play().catch(err => console.log('Play on click:', err));
 setUserInteracted(true);
 }
 }}
 />
 </div>

 {/* Zoom indicator for main video */}
 {isZoomed && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="absolute top-28 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full flex items-center gap-2 z-20 border border-white/10"
 >
 <ZoomIn className="w-3.5 h-3.5 text-white/70" />
 <span className="text-white text-label font-semibold">{zoomScale.toFixed(1)}x</span>
 </motion.div>
 )}

 {/* Picture-in-Picture Local Preview (FaceTime Style, Draggable & Rounded 32px) */}
 <motion.div
 drag
 dragConstraints={screenContainerRef}
 dragElastic={0.08}
 dragMomentum={false}
 initial={{ opacity: 0, scale: 0.8, y: 120 }}
 animate={{ opacity: 1, scale: 1, y: 100 }}
 className="absolute top-20 right-4 w-32 h-44 rounded-[32px] overflow-hidden border border-white/20 shadow-2xl z-20 cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-shadow speaker-active-border"
 style={{
 boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)',
 touchAction: 'none'
 }}
 >
 <video
 ref={pipVideoRef}
 autoPlay
 playsInline
 muted={videoLayout === 'remote-main'}
 className="w-full h-full object-cover"
 style={{ 
 WebkitPlaysinline: 'true',
 filter: 'contrast(1.05) brightness(0.96) saturate(1.03)',
 willChange: 'transform, filter',
 transform: 'translateZ(0)',
 } as any}
 />
 {/* Swap overlay trigger */}
 <div
 onClick={(e) => {
 e.stopPropagation();
 handleSwapVideos();
 if (pipVideoRef.current && videoLayout === 'local-main') {
 pipVideoRef.current.muted = false;
 pipVideoRef.current.volume = 1.0;
 pipVideoRef.current.play().catch(err => console.log('PIP play:', err));
 }
 }}
 className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
 >
 <Repeat className="w-6 h-6 text-white" />
 </div>
 </motion.div>

 {/* Flagship Top Glassmorphic Information Panel */}
 {!isFullScreen && (
 <motion.div 
 initial={{ y: -30, opacity: 0 }}
 animate={{ y: 0, opacity: 1 }}
 className="absolute top-10 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-sm"
 >
 <div 
 className="text-white px-6 py-4 rounded-[28px] border border-white/10 shadow-2xl flex flex-col items-center justify-center"
 style={{
 background: 'rgba(18, 22, 28, 0.45)',
 backdropFilter: 'blur(20px)',
 WebkitBackdropFilter: 'blur(20px)',
 }}
 >
 <h2 className="text-body font-bold text-center tracking-tight">{contactName}</h2>
 <p className="text-label text-white/60 text-center mt-0.5">
 {callState === 'connecting' && 'Establishing secure channel...'}
 {callState === 'connected' && formatDuration(duration)}
 {callState === 'failed' && 'Access blocked'}
 </p>

 {/* Dynamic Status Badges (HD, E2EE, Signal Quality) */}
 <div className="flex items-center justify-center gap-1.5 mt-2.5">
 <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-400/20 uppercase tracking-widest animate-pulse">
 HD
 </span>
 <span className="text-[9px] font-extrabold bg-white/10 text-white/80 px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest flex items-center gap-1">
 <Wifi className="w-2.5 h-2.5 text-emerald-400" />
 Secure
 </span>
 </div>
 </div>
 </motion.div>
 )}

 {/* Translucent Glassmorphic Secure Line Pill overlay (Positioned at bottom 18%) */}
 <AnimatePresence>
 {!isFullScreen && (
 <motion.div
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 15 }}
 className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-5 py-2.5"
 style={{
 bottom: '18%',
 background: 'rgba(18, 22, 28, 0.48)',
 backdropFilter: 'blur(18px)',
 WebkitBackdropFilter: 'blur(18px)',
 border: '1px solid rgba(29, 158, 117, 0.25)',
 borderRadius: '9999px',
 boxShadow: '0 0 15px rgba(29, 158, 117, 0.15)',
 }}
 >
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
 <span className="text-[10px] tracking-wider text-emerald-400 font-extrabold uppercase select-none flex items-center gap-1">
 🔒 SECURE LINE • TRANSPORT ENCRYPTED
 </span>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Flagship Redesigned Center Bottom Floating Controls Dock */}
 <AnimatePresence>
 {controlsVisible && !isFullScreen && (
 <motion.div
 initial={{ opacity: 0, y: 40 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 40 }}
 className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3.5 px-6 py-4"
 style={{
 background: 'rgba(18, 22, 28, 0.55)',
 backdropFilter: 'blur(24px)',
 WebkitBackdropFilter: 'blur(24px)',
 border: '1px solid rgba(255, 255, 255, 0.08)',
 borderRadius: '36px',
 boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
 }}
 >
 {/* Camera Swap Button */}
 <Button
 size="lg"
 variant="secondary"
 className="rounded-full w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/5 shadow-md flex items-center justify-center p-0 transition-transform active:scale-90"
 onClick={handleSwitchCamera}
 >
 <SwitchCamera className="h-5 w-5 text-white" />
 </Button>

 {/* Audio Toggle (Mute/Unmute) */}
 <Button
 size="lg"
 variant={audioEnabled ? "secondary" : "destructive"}
 className={`rounded-full w-12 h-12 border border-white/5 shadow-md flex items-center justify-center p-0 transition-transform active:scale-90 ${audioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'}`}
 onClick={toggleAudio}
 >
 {audioEnabled ? <Mic className="h-5 w-5 text-white" /> : <MicOff className="h-5 w-5 text-white" />}
 </Button>

 {/* Video Camera Toggle */}
 <Button
 size="lg"
 variant={videoEnabled ? "secondary" : "destructive"}
 className={`rounded-full w-12 h-12 border border-white/5 shadow-md flex items-center justify-center p-0 transition-transform active:scale-90 ${videoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'}`}
 onClick={toggleVideo}
 >
 {videoEnabled ? <Video className="h-5 w-5 text-white" /> : <VideoOff className="h-5 w-5 text-white" />}
 </Button>

 {/* Speaker/Earpiece Toggle */}
 <Button
 size="lg"
 className={`rounded-full w-12 h-12 border border-white/5 shadow-md flex items-center justify-center p-0 transition-transform active:scale-90 ${speakerEnabled ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
 onClick={toggleSpeaker}
 >
 <Repeat className="h-5 w-5" />
 </Button>

 {/* Desktop Screen Share Toggle */}
 {!isMobileDevice && (
 <Button
 size="lg"
 className={`rounded-full w-12 h-12 border border-white/5 shadow-md flex items-center justify-center p-0 transition-transform active:scale-90 ${isScreenSharing ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
 onClick={toggleScreenShare}
 >
 {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
 </Button>
 )}

 {/* Symmetrical divider line */}
 <div className="w-[1px] h-8 bg-white/10 mx-1" />

 {/* Prominent Symmetrical Red End Call Button inside controls dock */}
 <Button
 size="lg"
 variant="destructive"
 className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 shadow-lg flex items-center justify-center p-0 transition-all hover:scale-105 active:scale-90 relative overflow-hidden animate-pulse"
 style={{
 boxShadow: '0 0 20px rgba(220, 38, 38, 0.45)'
 }}
 onClick={handleEndCall}
 >
 <PhoneOff className="h-6 w-6 text-white" />
 </Button>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}
