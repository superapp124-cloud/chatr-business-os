import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNativeHaptics } from "@/hooks/useNativeHaptics";
import { useCallContext } from "@/contexts/CallContext";
import { THEMES, ThemeOption } from "@/components/dialer/chatr-calls/theme";

// Dialer Screens
import BottomTabBar from "@/components/dialer/chatr-calls/BottomTabBar";
import FavoritesScreen from "@/components/dialer/chatr-calls/screens/FavoritesScreen";
import RecentsScreen from "@/components/dialer/chatr-calls/screens/RecentsScreen";
import ContactsScreen from "@/components/dialer/chatr-calls/screens/ContactsScreen";
import KeypadScreen from "@/components/dialer/chatr-calls/screens/KeypadScreen";

// Chatr Shield Components
import ShieldTab from "@/components/chatr-shield/ShieldTab";
import IncomingCallOverlay from "@/components/chatr-shield/IncomingCallOverlay";
import PostCallReport from "@/components/chatr-shield/PostCallReport";

import { CallerIntelligence } from "@/lib/chatr-shield/types";
import { ScoreOutput } from "@/lib/chatr-shield/shield-pipeline";
import "@/components/dialer/chatr-calls/calls.css";

import UnifiedTimeline from "@/pages/UnifiedTimeline";

type CallState = 'idle' | 'incoming' | 'live' | 'post-call';

export default function Calls() {
 const navigate = useNavigate();
 const haptics = useNativeHaptics();
 const [authReady, setAuthReady] = useState(false);
 const [activeTab, setActiveTab] = useState("recents");
 const [currentTheme, setCurrentTheme] = useState<ThemeOption>('midnight');

 // Call State Machine
 const [callState, setCallState] = useState<CallState>('idle');
 const [activeCallNumber, setActiveCallNumber] = useState<string>('');
 const [activeCallScore, setActiveCallScore] = useState<ScoreOutput | null>(null);
 const [callDuration, setCallDuration] = useState(0);

 useEffect(() => {
 let isMounted = true;
 checkAuth(() => isMounted);

 const theme = THEMES[currentTheme];
 const root = document.documentElement;
 root.style.setProperty('--dialer-primary', theme.colors.primary);
 root.style.setProperty('--dialer-bg', theme.colors.background);
 root.style.setProperty('--dialer-surface', theme.colors.surface);
 root.style.setProperty('--dialer-surface-light', theme.colors.surfaceLight);
 root.style.setProperty('--dialer-text', theme.colors.text);
 root.style.setProperty('--dialer-text-secondary', theme.colors.textSecondary);
 root.style.setProperty('--dialer-glass', theme.colors.glass);
 root.style.setProperty('--dialer-border', theme.colors.border);

 return () => { isMounted = false; };
 }, [currentTheme]);

 // Call duration is tracked via the CallContext's active call duration.
 // No fake demo timers — all state comes from real call events.

 const checkAuth = async (isMounted: () => boolean) => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!isMounted()) return;
 if (!user && !Capacitor.isNativePlatform()) { navigate('/auth'); return; }
 setAuthReady(true);
 } catch {
 setAuthReady(true);
 }
 };
 const { initiateCall } = useCallContext?.() || {};

 const handleCall = async (phoneNumber: string) => {
 if (!phoneNumber) { toast.error("Please enter a phone number"); return; }
 haptics.medium();

 // ⚡ PRO LOOKUP: Resolve phone to Chatr User ID
 const { data: profile } = await supabase
 .from('profiles')
 .select('id, full_name, avatar_url')
 .eq('phone_number', phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`)
 .maybeSingle();

 if (profile && initiateCall) {
 await initiateCall({
 partnerId: profile.id,
 partnerName: profile.full_name || 'Chatr User',
 partnerAvatar: profile.avatar_url || undefined,
 partnerPhone: phoneNumber,
 callType: 'voice'
 });
 } else {
 // Fallback for non-Chatr users (could trigger native dialer)
 if (Capacitor.isNativePlatform()) {
 toast.info("Number not on Chatr. Dialing via carrier...");
 window.location.href = `tel:${phoneNumber}`;
 } else {
 toast.error("This user is not on Chatr yet. Invite them to join!");
 }
 }
 };

 const handleEndCall = () => {
 setCallState('post-call');
 // Real duration comes from callDuration state (tracked via setInterval when live)
 };

 if (!authReady) {
 return (
 <div className="flex h-full min-h-full flex-col items-center justify-center bg-black">
 <div className="w-12 h-12 rounded-full bg-zinc-800 animate-pulse" />
 </div>
 );
 }

 const renderScreen = () => {
 switch (activeTab) {
 case "favorites": return <FavoritesScreen />;
 case "recents": return <RecentsScreen onInfoClick={() => {}} />;
 case "contacts": return <ContactsScreen />;
 case "keypad": return <KeypadScreen onCall={handleCall} />;
 case "shield": return <ShieldTab onThemeChange={setCurrentTheme} currentTheme={currentTheme} />;
 case "timeline": return <UnifiedTimeline />;
 default: return <RecentsScreen onInfoClick={() => {}} />;
 }
 };

 return (
 <div className="dialer-container">
 {renderScreen()}
 <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

 {/* Incoming Call Overlay */}
 {callState === 'incoming' && (
 <IncomingCallOverlay
 phoneNumber={activeCallNumber}
 onDecline={() => setCallState('idle')}
 onScreen={() => toast.info("Screening call...")}
 onFullView={(score) => {
 setActiveCallScore(score);
 setCallState('live');
 }}
 onAddNote={() => toast.info("Note feature coming soon")}
 />
 )}

 {/* Live Call Overlay removed: handled globally by UnifiedCallScreen */}

 {/* Post-Call Report */}
 {callState === 'post-call' && activeCallScore && (
 <PostCallReport
 phoneNumber={activeCallNumber}
 score={activeCallScore}
 callDurationSeconds={callDuration}
 onBack={() => setCallState('idle')}
 />
 )}
 </div>
 );
}
