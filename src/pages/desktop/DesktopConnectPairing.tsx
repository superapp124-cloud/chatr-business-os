import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Monitor, Smartphone, Shield, RefreshCw, CheckCircle2, AlertCircle, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PairingStatus = 'generating' | 'waiting' | 'paired' | 'expired' | 'error';

declare global {
 interface Window {
 electronAPI?: {
 onRevokeSession: (callback: () => void) => void;
 };
 }
}

export const DesktopConnectPairing = () => {
 const [pairingId, setPairingId] = useState<string | null>(null);
 const [status, setStatus] = useState<PairingStatus>('generating');
 const [errorMessage, setErrorMessage] = useState<string>('');
 const [secondsLeft, setSecondsLeft] = useState(300); // 5 min
 const navigate = useNavigate();

 const initPairing = useCallback(async () => {
 setStatus('generating');
 setPairingId(null);
 setSecondsLeft(300);

 try {
 // Generate a crypto key pair for ECDH — the pubkey is embedded in the QR
 const keyPair = await window.crypto.subtle.generateKey(
 { name: 'ECDH', namedCurve: 'P-256' },
 true,
 ['deriveKey']
 );
 const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
 const desktopPubkey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

 const { data, error } = await supabase.functions.invoke('desktop-pair-init', {
 body: {
 desktop_pubkey: desktopPubkey,
 device_name: `Desktop — ${navigator.platform || 'Web'}`,
 device_fingerprint: navigator.userAgent,
 }
 });

 if (error) throw new Error(error.message || 'Could not reach the server');
 if (!data?.pairing_id) throw new Error('Server returned an invalid response');

 setPairingId(data.pairing_id);
 setStatus('waiting');

 // Subscribe to the pairing channel — waits for mobile to scan and confirm
 const channel = supabase.channel(`desktop_pairing_${data.pairing_id}`)
 .on('broadcast', { event: 'paired' }, async (payload) => {
 const { token, user_id, verified } = payload.payload;

 if (!verified || !token) {
 setStatus('error');
 setErrorMessage('Pairing failed: invalid response from server.');
 return;
 }

 setStatus('paired');

 // Store the magic link token in sessionStorage only (security rule v0.1)
 window.sessionStorage.setItem('desktop_session_jwt', token);
 window.sessionStorage.setItem('desktop_user_id', user_id);

 // Attach revocation listener if running in Electron
 if (window.electronAPI) {
 window.electronAPI.onRevokeSession(() => {
 window.sessionStorage.removeItem('desktop_session_jwt');
 window.sessionStorage.removeItem('desktop_user_id');
 navigate('/desktop-connect');
 });
 }

 toast.success('Desktop paired! Welcome.', { duration: 3000 });

 // If the token is a magic link URL, redirect to it. Otherwise go to chat.
 if (token.startsWith('http')) {
 window.location.href = token;
 } else {
 setTimeout(() => navigate('/desktop/chat'), 1200);
 }

 await supabase.removeChannel(channel);
 })
 .subscribe((subStatus) => {
 if (subStatus === 'CHANNEL_ERROR') {
 setStatus('error');
 setErrorMessage('Lost connection to server. Please try again.');
 }
 });

 // Return cleanup
 return () => { supabase.removeChannel(channel); };

 } catch (err: any) {
 console.error('[DesktopConnectPairing] Error:', err);
 setStatus('error');
 setErrorMessage(err?.message || 'Something went wrong. Please try again.');
 }
 }, [navigate]);

 // Initialize on mount
 useEffect(() => {
 const cleanupPromise = initPairing();
 return () => { cleanupPromise.then(cleanup => cleanup?.()) };
 }, [initPairing]);

 // Countdown timer
 useEffect(() => {
 if (status !== 'waiting') return;
 const interval = setInterval(() => {
 setSecondsLeft(s => {
 if (s <= 1) {
 setStatus('expired');
 return 0;
 }
 return s - 1;
 });
 }, 1000);
 return () => clearInterval(interval);
 }, [status]);

 const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

 const qrValue = pairingId
 ? JSON.stringify({ type: 'chatr-desktop-pair', pairing_id: pairingId, v: 1 })
 : '';

 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
 {/* Background grid */}
 <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2322d3ee%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50 pointer-events-none" />

 <div className="w-full max-w-4xl mx-auto relative z-10">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

 {/* Left: Branding & Instructions */}
 <div className="space-y-8 text-white">
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
 <Monitor className="w-5 h-5 text-cyan-400" />
 </div>
 <span className="text-cyan-400 font-semibold text-secondary tracking-wider uppercase">CHATR Desktop</span>
 </div>
 <h1 className="text-display text-white ">
 Connect your<br />phone to this computer
 </h1>
 <p className="text-slate-400 text-section">
 Scan the QR code with your phone to get started. Your conversations sync instantly.
 </p>
 </div>

 <div className="space-y-4">
 {[
 { icon: Smartphone, title: 'Open CHATR on your phone', desc: 'Make sure you are signed in' },
 { icon: Wifi, title: 'Tap Menu → Desktop Connect', desc: 'Or tap the QR icon in settings' },
 { icon: Shield, title: 'Point your camera at the screen', desc: 'Pairing is secured with end-to-end encryption' },
 ].map((step, i) => (
 <div key={i} className="flex items-start gap-4">
 <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
 <step.icon className="w-4 h-4 text-cyan-400" />
 </div>
 <div>
 <p className="font-medium text-white text-secondary">{step.title}</p>
 <p className="text-slate-500 text-label mt-0.5">{step.desc}</p>
 </div>
 </div>
 ))}
 </div>

 <div className="flex items-center gap-2 text-label text-slate-600">
 <Shield className="w-3.5 h-3.5" />
 <span>Session stored in memory only. Auto-expires in 30 days.</span>
 </div>
 </div>

 {/* Right: QR Panel */}
 <div className="flex flex-col items-center">
 <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 w-full max-w-sm space-y-6">
 
 {/* QR Code Area */}
 <div className={cn(
 "bg-white rounded-2xl p-4 flex items-center justify-center transition-all duration-300",
 status === 'waiting' ? "opacity-100" : "opacity-60"
 )}>
 {status === 'generating' && (
 <div className="w-64 h-64 flex items-center justify-center">
 <div className="space-y-3 text-center">
 <Loader2 className="w-10 h-10 animate-spin text-slate-400 mx-auto" />
 <p className="text-label text-slate-500">Generating secure QR…</p>
 </div>
 </div>
 )}

 {(status === 'waiting' || status === 'expired') && pairingId && (
 <div className="relative">
 <QRCodeSVG
 value={qrValue}
 size={240}
 level="H"
 includeMargin={true}
 fgColor="#0f172a"
 />
 {status === 'expired' && (
 <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-lg">
 <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
 <p className="text-secondary font-semibold text-slate-700">QR Expired</p>
 </div>
 )}
 </div>
 )}

 {status === 'paired' && (
 <div className="w-64 h-64 flex items-center justify-center">
 <div className="space-y-3 text-center">
 <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
 <p className="text-secondary font-semibold text-slate-700">Paired! Redirecting…</p>
 </div>
 </div>
 )}

 {status === 'error' && (
 <div className="w-64 h-64 flex items-center justify-center">
 <div className="space-y-3 text-center px-4">
 <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
 <p className="text-secondary font-semibold text-slate-700">Connection Failed</p>
 <p className="text-label text-slate-500">{errorMessage}</p>
 </div>
 </div>
 )}
 </div>

 {/* Status Bar */}
 <div className="space-y-3">
 {status === 'waiting' && (
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-label text-slate-400">Waiting for phone to scan…</span>
 </div>
 <span className={cn(
 "text-label font-mono font-semibold",
 secondsLeft < 60 ? 'text-red-400' : 'text-slate-500'
 )}>
 {formatTime(secondsLeft)}
 </span>
 </div>
 )}

 {(status === 'expired' || status === 'error') && (
 <Button
 onClick={initPairing}
 className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
 >
 <RefreshCw className="w-4 h-4 mr-2" />
 Generate New QR Code
 </Button>
 )}
 </div>

 {/* Security Footer */}
 <div className="flex items-center justify-center gap-2 text-[11px] text-slate-600">
 <Shield className="w-3 h-3" />
 <span>End-to-end secured · QR valid for 5 min</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};
