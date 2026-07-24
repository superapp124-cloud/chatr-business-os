import React, { useState, useEffect, useRef } from 'react';
import {
 Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
 Users, PhoneMissed, Shield, Zap, Lock,
 Briefcase, Presentation, GraduationCap,
 Stethoscope, Sparkles, ChevronRight, MonitorOff, Plus,
 Calendar, Clock, TrendingUp, VideoIcon, CalendarClock,
 BarChart3, UserPlus, Hash, ArrowRight
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { SessionWorkspace } from '@/components/calling/SessionWorkspace';
import { WorldClockWidget } from '@/components/desktop/WorldClockWidget';
import { useCallContext } from '@/contexts/CallContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useRealParticipants } from '@/hooks/useRealParticipants';
import { format } from 'date-fns';
import { useCallSummary } from '@/hooks/useCallSummary';
import { useCallRecording } from '@/hooks/useCallRecording';

// Meeting sub-components
import { MeetingHeader } from '@/components/calling/meeting/MeetingHeader';
import { MeetingStatusRibbon } from '@/components/calling/meeting/MeetingStatusRibbon';
import { ParticipantsPanel, Participant } from '@/components/calling/meeting/ParticipantsPanel';
import { InviteModal } from '@/components/calling/meeting/InviteModal';
import { AddParticipantsPanel } from '@/components/calling/meeting/AddParticipantsPanel';
import { MeetingLogsDrawer } from '@/components/calling/meeting/MeetingLogsDrawer';
import { MeetingControls } from '@/components/calling/meeting/MeetingControls';
import { ReactionsBar } from '@/components/calling/meeting/ReactionsBar';
import { LayoutSwitcher, LayoutMode } from '@/components/calling/meeting/LayoutSwitcher';
import { HostControls } from '@/components/calling/meeting/HostControls';
import { MeetingCopilotPanel } from '@/components/calling/MeetingCopilotPanel';

/* ─── Real unique meeting ID ─────────────────────────────────────── */
function generateMeetingId(): string {
 const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
 return `CHATR-${seg()}-${seg()}`;
}

/* ─── Session types/goals ─────────────────────────────────────────── */

export const IconMap: Record<string, React.FC<any>> = {
 Users, CalendarClock, Presentation, GraduationCap, Stethoscope, Shield, Phone, Sparkles, Briefcase
};

const DEFAULT_GOALS = [
 { id: 'sales', label: 'Meet Customer', desc: 'Connect with customers, discuss needs and close deals.', iconName: 'Users', bg: 'bg-gradient-to-br from-[#7C2BBE] to-[#450C85]', border: 'border-white/10', tag: 'Sales & CRM', accent: 'text-white bg-white/20' },
 { id: 'recruitment', label: 'Hire Someone', desc: 'Conduct interviews and evaluate potential candidates.', iconName: 'CalendarClock', bg: 'bg-gradient-to-br from-[#129B55] to-[#046132]', border: 'border-white/10', tag: 'HR & Recruitment', accent: 'text-white bg-white/20' },
 { id: 'presentation', label: 'Present Proposal', desc: 'Present ideas, proposals and get feedback.', iconName: 'Presentation', bg: 'bg-gradient-to-br from-[#D97904] to-[#995100]', border: 'border-white/10', tag: 'Business', accent: 'text-white bg-white/20' },
 { id: 'education', label: 'Teach Class', desc: 'Deliver engaging classes and share knowledge.', iconName: 'GraduationCap', bg: 'bg-gradient-to-br from-[#0B71C6] to-[#033F76]', border: 'border-white/10', tag: 'Education', accent: 'text-white bg-white/20' },
 { id: 'clinic', label: 'Consult Patient', desc: 'Provide consultations and patient care online.', iconName: 'Stethoscope', bg: 'bg-gradient-to-br from-[#E22748] to-[#910A22]', border: 'border-white/10', tag: 'Healthcare', accent: 'text-white bg-white/20' },
 { id: 'internal', label: 'Internal Meeting', desc: 'Collaborate with your team and align on goals.', iconName: 'Users', bg: 'bg-gradient-to-br from-[#0B969E] to-[#04595E]', border: 'border-white/10', tag: 'Teamwork', accent: 'text-white bg-white/20' },
 { id: 'audit', label: 'Internal Audit', desc: 'Review processes, check compliance and manage risks.', iconName: 'Shield', bg: 'bg-gradient-to-br from-[#681EBF] to-[#390A72]', border: 'border-white/10', tag: 'Compliance', accent: 'text-white bg-white/20' },
 { id: 'quick', label: 'Quick Call', desc: 'Start an instant voice or video conversation.', iconName: 'Phone', bg: 'bg-gradient-to-br from-[#402BBE] to-[#1F1070]', border: 'border-white/10', tag: 'Personal', accent: 'text-white bg-white/20' },
];


interface CallLog {
 id: string;
 caller_id: string;
 conversation_id: string;
 status: string;
 call_type: string;
 started_at: string;
 duration: number | null;
 other_user?: { id: string; username: string; full_name: string; avatar_url: string; phone_number?: string };
}

/* ─────────────────────── Sub-components ─────────────────────── */

const RemoteTile = ({ stream, label, avatarChar, flag, isSpeaking }: { stream: MediaStream | null; label: string; avatarChar: string; flag?: string; isSpeaking?: boolean }) => {
 const videoRef = useRef<HTMLVideoElement>(null);
 const audioRef = useRef<HTMLAudioElement>(null);
 const [hasVideo, setHasVideo] = useState(false);
 const [playFailed, setPlayFailed] = useState(false);

 useEffect(() => {
 if (!stream) return;
 const checkTracks = () => setHasVideo(stream.getVideoTracks().length > 0);
 checkTracks();
 stream.addEventListener('addtrack', checkTracks);
 stream.addEventListener('removetrack', checkTracks);
 return () => {
 stream.removeEventListener('addtrack', checkTracks);
 stream.removeEventListener('removetrack', checkTracks);
 };
 }, [stream]);

 useEffect(() => {
 if (!stream) return;
 if (videoRef.current && videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
 if (audioRef.current && audioRef.current.srcObject !== stream) audioRef.current.srcObject = stream;
 if (videoRef.current) videoRef.current.play().catch(e => console.warn('Video autoplay prevented:', e));
 if (audioRef.current) {
 audioRef.current.play().then(() => setPlayFailed(false)).catch(e => {
 console.warn('Audio autoplay prevented:', e);
 setPlayFailed(true);
 });
 }
 }, [stream, hasVideo]);

 const handlePlayClick = () => {
 if (audioRef.current) audioRef.current.play().then(() => setPlayFailed(false)).catch(console.error);
 if (videoRef.current) videoRef.current.play().catch(console.error);
 };

 return (
 <div className={cn(
 'relative w-full h-full bg-zinc-900 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300',
 isSpeaking ? 'border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]' : 'border border-white/[0.06]'
 )}>
 <audio ref={audioRef} autoPlay playsInline />
 <video ref={videoRef} autoPlay playsInline muted className={cn('w-full h-full object-cover', !hasVideo && 'opacity-0 absolute inset-0 z-0')} />
 {!hasVideo && (
 <div className="flex flex-col items-center gap-3 relative z-10">
 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/40 to-blue-600/40 border-2 border-white/10 flex items-center justify-center text-display text-white/80">
 {avatarChar}
 </div>
 <p className="text-secondary text-white/40">{label}</p>
 </div>
 )}
 <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-medium text-white/90 flex items-center gap-1.5 z-20">
 <div className={cn('w-1.5 h-1.5 rounded-full', isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-white/30')} />
 {flag} {label}
 </div>
 {isSpeaking && (
 <div className="absolute top-3 right-3 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[9px] text-emerald-400 font-bold z-20">Speaking</div>
 )}
 {playFailed && (
 <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
 <button onClick={handlePlayClick} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium shadow-xl flex items-center gap-2 animate-bounce">
 <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
 Click to connect audio/video
 </button>
 </div>
 )}
 </div>
 );
};

const LocalTile = ({ stream, videoOff, name, size = 'pip' }: { stream: MediaStream | null; videoOff: boolean; name: string; size?: 'pip' | 'full' }) => {
 const ref = useRef<HTMLVideoElement>(null);
 useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);

 if (size === 'full') {
 return (
 <div className="relative w-full h-full bg-zinc-950 rounded-2xl overflow-hidden border border-white/[0.06] flex items-center justify-center">
 {!videoOff && <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />}
 {videoOff && (
 <div className="flex flex-col items-center gap-3">
 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/40 to-blue-600/40 border-2 border-white/10 flex items-center justify-center text-display text-white/60">
 {name[0]?.toUpperCase() || 'Y'}
 </div>
 <p className="text-secondary text-white/40">Camera off</p>
 </div>
 )}
 <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] text-white/90">You</div>
 </div>
 );
 }

 return (
 <div className="relative rounded-xl overflow-hidden border border-white/20 bg-zinc-900 shadow-2xl shadow-black/60">
 {!videoOff && <video ref={ref} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />}
 {videoOff && (
 <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
 <MonitorOff className="w-6 h-6 text-zinc-500" />
 </div>
 )}
 <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] text-white/80">You</div>
 </div>
 );
};

/* ─────────────────────── Main Component ─────────────────────── */

const DesktopCalls: React.FC = () => {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const [callLogs, setCallLogs] = useState<CallLog[]>([]);
 const [logPage, setLogPage] = useState(1);
 const LOGS_PER_PAGE = 8;
 const totalLogPages = Math.ceil(callLogs.length / LOGS_PER_PAGE);
 const paginatedLogs = callLogs.slice((logPage - 1) * LOGS_PER_PAGE, logPage * LOGS_PER_PAGE);

 const [customGoals, setCustomGoals] = useState(() => {
 try {
 const saved = localStorage.getItem('chatr_custom_goals');
 if (saved) return JSON.parse(saved);
 } catch {}
 return DEFAULT_GOALS;
 });
 const [showAddGoalModal, setShowAddGoalModal] = useState(false);
 const [newGoal, setNewGoal] = useState({ label: '', desc: '', tag: '', bg: 'bg-gradient-to-br from-[#402BBE] to-[#1F1070]', iconName: 'Sparkles' });

 const handleSaveGoal = () => {
 if (!newGoal.label || !newGoal.desc) {
 toast.error('Please fill in all fields');
 return;
 }
 const goal = {
 id: 'custom-' + Date.now(),
 label: newGoal.label,
 desc: newGoal.desc,
 iconName: newGoal.iconName,
 bg: newGoal.bg,
 border: 'border-white/10',
 tag: newGoal.tag || 'Custom',
 accent: 'text-white bg-white/20'
 };
 const updated = [...customGoals, goal];
 setCustomGoals(updated);
 localStorage.setItem('chatr_custom_goals', JSON.stringify(updated));
 setShowAddGoalModal(false);
 setNewGoal({ label: '', desc: '', tag: '', bg: 'bg-gradient-to-br from-[#402BBE] to-[#1F1070]', iconName: 'Sparkles' });
 toast.success('Custom goal added!');
 };

 const {
 callState, activeRoomId, activeCallId, localStream, remoteStreams, currentUserName, currentUserId,
 isMuted, isVideoOff, callDuration, remoteUserName, remoteUserAvatar,
 sessionGoal, transcriptRef, setSessionGoal,
 startCall, endCall, toggleMute, toggleVideo, addParticipant
 } = useCallContext();

 const [dialInput, setDialInput] = useState('');

 // Meeting UI state (all purely local/UI)
 const [showParticipants, setShowParticipants] = useState(false);
 const [showInviteModal, setShowInviteModal] = useState(false);
 const [showAddParticipant, setShowAddParticipant] = useState(false);
 const [showDrawer, setShowDrawer] = useState(false);
 const [showReactions, setShowReactions] = useState(false);
 const [showLayoutSwitcher, setShowLayoutSwitcher] = useState(false);
 const [showHostControls, setShowHostControls] = useState(false);
 const [isHandRaised, setIsHandRaised] = useState(false);
 const [isScreenSharing, setIsScreenSharing] = useState(false);
 const [layoutMode, setLayoutMode] = useState<LayoutMode>('gallery');
 const [waitingRoom, setWaitingRoom] = useState<{ id: string; name: string; avatarColor: string }[]>([]);
 const [instantMeetingId] = useState(generateMeetingId);
 const [showInstantMeeting, setShowInstantMeeting] = useState(false);
 const [showJoinMeeting, setShowJoinMeeting] = useState(false);
 const [joinId, setJoinId] = useState('');
 const [upcomingMeetings, setUpcomingMeetings] = useState<{ title: string; time: string; participants: number; color: string }[]>([]);
 const [showSummaryModal, setShowSummaryModal] = useState(false);
 const { isRecording, startRecording, stopRecording } = useCallRecording();

 const { summary, loading: summaryLoading, generateSummary } = useCallSummary({
 meetingTitle: sessionGoal || 'Meeting',
 transcript: transcriptRef.current,
 });

 const getLocalCallId = () => activeCallId || activeRoomId || instantMeetingId;

 const saveTranscriptToDocuments = async (transcriptOverride?: string) => {
 const transcript = (transcriptOverride ?? transcriptRef.current).trim();
 if (!transcript) return null;

 if (!window.electronAPI?.localFiles) {
 toast.error('Local transcript saving is available in the CHATR desktop app.');
 return null;
 }

 const result = await window.electronAPI.localFiles.saveTranscript({
 callId: getLocalCallId(),
 meetingTitle: sessionGoal || 'CHATR Call',
 participantName: remoteUserName || 'Unknown',
 durationSeconds: callDuration,
 transcript,
 createdAt: new Date().toISOString(),
 });

 if (result.ok) {
 toast.success('Transcript saved to Documents\\CHATR Workspace\\Transcripts');
 return result.path || null;
 }

 toast.error(result.error || 'Failed to save transcript locally');
 return null;
 };

 const saveSummaryToDocuments = async (
 summaryText: string,
 transcriptOverride?: string,
 metadata?: {
 callId?: string | null;
 meetingTitle?: string;
 participantName?: string;
 durationSeconds?: number;
 }
 ) => {
 const summaryValue = summaryText.trim();
 if (!summaryValue) return null;

 if (!window.electronAPI?.localFiles?.saveSummary) {
 toast.error('Local summary saving is available in the CHATR desktop app.');
 return null;
 }

 const result = await window.electronAPI.localFiles.saveSummary({
 callId: metadata?.callId ?? getLocalCallId(),
 meetingTitle: metadata?.meetingTitle || sessionGoal || 'CHATR Call',
 participantName: metadata?.participantName || remoteUserName || 'Unknown',
 durationSeconds: metadata?.durationSeconds ?? callDuration,
 summary: summaryValue,
 transcript: (transcriptOverride ?? transcriptRef.current).trim(),
 createdAt: new Date().toISOString(),
 });

 if (result.ok) {
 toast.success('Summary saved to Documents\\CHATR Workspace\\ChatrAI Summaries');
 return result.path || null;
 }

 toast.error(result.error || 'Failed to save summary locally');
 return null;
 };

 const handleToggleRecording = async () => {
 const callId = getLocalCallId();

 if (isRecording) {
 await stopRecording(callId);
 if (transcriptRef.current.trim()) {
 await saveTranscriptToDocuments();
 }
 return;
 }

 if (!localStream) {
 toast.error('No local audio stream available to record.');
 return;
 }

 await window.electronAPI?.localFiles?.ensureFolders();
 await startRecording(callId, localStream, { participantName: remoteUserName || currentUserName || 'CHATR Call' });
 };

 const handleEndCall = async () => {
 const finalTranscript = transcriptRef.current;
 const finalCallId = getLocalCallId();
 const finalMetadata = {
 callId: finalCallId,
 meetingTitle: sessionGoal || 'CHATR Call',
 participantName: remoteUserName || 'Unknown',
 durationSeconds: callDuration,
 };

 if (isRecording) {
 await stopRecording(finalCallId);
 }

 if (finalTranscript.trim()) {
 await saveTranscriptToDocuments(finalTranscript);
 }

 endCall();

 if (finalTranscript.trim()) {
 setShowSummaryModal(true);
 const generatedSummary = await generateSummary(finalTranscript);
 if (generatedSummary) {
 await saveSummaryToDocuments(generatedSummary, finalTranscript, finalMetadata);
 }
 }
 };

 // Real computed stats from actual call history
 const [realStats, setRealStats] = useState({ todayMeetings: 0, upcoming: 0, hoursToday: '0', participants: 0 });

 // User presence — syncs to Supabase profiles
 const [presence, setPresence] = useState<'online' | 'away' | 'busy' | 'oncall' | 'inmeeting'>('online');

 const presenceOptions: { key: typeof presence; label: string; color: string }[] = [
 { key: 'online', label: 'Online', color: 'bg-emerald-500' },
 { key: 'away', label: 'Away', color: 'bg-amber-400' },
 { key: 'busy', label: 'Busy / DND', color: 'bg-red-500' },
 { key: 'oncall', label: 'On Call', color: 'bg-blue-500' },
 { key: 'inmeeting', label: 'In Meeting', color: 'bg-purple-500' },
 ];
 const [showPresenceMenu, setShowPresenceMenu] = useState(false);

 const updatePresence = async (p: typeof presence) => {
 setPresence(p);
 setShowPresenceMenu(false);
 if (!currentUserId) return;
 await supabase.from('profiles').update({ presence_status: p }).eq('id', currentUserId);
 };

 // Real participants from Supabase
 const participants = useRealParticipants(activeRoomId, currentUserId, currentUserName);
 const [callLogs2, setCallLogs2] = useState<CallLog[]>([]);

 const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
 const greeting = () => {
 const h = new Date().getHours();
 return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
 };

 const displayName = currentUserName?.replace(/\?/g, '') || 'there';

 useEffect(() => {
 if (currentUserId) loadCallLogs(currentUserId);
 }, [currentUserId, callState]);

 // Load presence from DB on mount
 useEffect(() => {
 if (!currentUserId) return;
 supabase.from('profiles').select('status').eq('id', currentUserId).single()
 .then(({ data }) => { if (data?.status) setPresence(data.status as any); });
 }, [currentUserId]);

 // Compute real stats from actual call logs
 useEffect(() => {
 if (!callLogs.length) return;
 const today = new Date().toDateString();
 const todayCalls = callLogs.filter(c => new Date(c.started_at).toDateString() === today);
 const totalSecs = todayCalls.reduce((acc, c) => acc + (c.duration || 0), 0);
 const allParticipantIds = new Set(callLogs.map(c => c.caller_id));
 setRealStats({
 todayMeetings: todayCalls.length,
 upcoming: upcomingMeetings.length,
 hoursToday: (totalSecs / 3600).toFixed(1),
 participants: allParticipantIds.size,
 });
 }, [callLogs, upcomingMeetings]);

 // Fetch real upcoming meetings from calendar_events table
 useEffect(() => {
   async function fetchRealCalendarEvents() {
     if (!currentUserId) return;
     try {
       const { supabase } = await import('@/integrations/supabase/client');
       const { data: events } = await supabase
         .from('calendar_events')
         .select('*')
         .gte('start_time', new Date().toISOString())
         .order('start_time', { ascending: true })
         .limit(5);

       if (events && events.length > 0) {
         setUpcomingMeetings(
           events.map((e: any) => ({
             title: e.title || 'Scheduled Sync',
             time: new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
             participants: Array.isArray(e.attendees) ? e.attendees.length : 2,
             color: 'bg-[#6D5DF6]',
           }))
         );
       }
     } catch (err) {
       console.warn('Failed to fetch calendar events:', err);
     }
   }
   void fetchRealCalendarEvents();
 }, [currentUserId]);

 const loadCallLogs = async (uid: string) => {
 import('@/integrations/supabase/client').then(async ({ supabase }) => {
 const { data: calls } = await supabase.from('calls').select('*').order('started_at', { ascending: false }).limit(40);
 if (!calls?.length) return;
 const convIds = [...new Set(calls.map(c => c.conversation_id).filter(Boolean))];
 if (!convIds.length) return;
 const { data: participants } = await supabase
 .from('conversation_participants')
 .select('conversation_id, user_id, profiles!inner(id, username, full_name, avatar_url, phone_number)')
 .in('conversation_id', convIds)
 .neq('user_id', uid);
 const profileMap = (participants || []).reduce((acc: any, p: any) => {
 if (!acc[p.conversation_id]) acc[p.conversation_id] = p.profiles;
 return acc;
 }, {});
 setCallLogs(calls.map(c => ({ ...c, other_user: profileMap[c.conversation_id] })));
 });
 };

 const remoteCount = Object.keys(remoteStreams).length;

 const handleAdmit = (id: string) => {
 const person = waitingRoom.find(p => p.id === id);
 if (person) {
 toast.success(`${person.name} admitted!`);
 setWaitingRoom(prev => prev.filter(p => p.id !== id));
 }
 };

 const handleReject = (id: string) => {
 const person = waitingRoom.find(p => p.id === id);
 if (person) {
 toast.error(`${person.name} rejected.`);
 setWaitingRoom(prev => prev.filter(p => p.id !== id));
 }
 };

 const closeAllPopups = () => {
 setShowAddParticipant(false);
 setShowReactions(false);
 setShowLayoutSwitcher(false);
 setShowHostControls(false);
 };

 return (
 <div className={cn('flex w-full h-full overflow-hidden', isDark ? 'bg-[#0B0F19] text-white' : 'bg-zinc-50 text-zinc-950')}>

 {/* ── Idle: Left sidebar ─────────────────────────────────── */}
 {callState === 'idle' && (
 <div className={cn('w-[240px] shrink-0 flex flex-col border-r overflow-hidden', isDark ? 'bg-[#0B0E14] border-white/5' : 'bg-white border-zinc-200/50')}>
 <div className={cn('p-4 border-b', isDark ? 'border-white/5' : 'border-zinc-100')}>
 <div className="flex items-center gap-2 mb-6 mt-1">
 <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40 transform -rotate-[10deg]">
 <div className="w-3.5 h-3.5 bg-white rounded-sm rotate-[10deg] flex items-center justify-center">
 <div className="w-1.5 h-1.5 bg-indigo-600 rounded-sm" />
 </div>
 </div>
 <span className={cn("text-[15px] font-bold tracking-tight", isDark ? 'text-white' : 'text-zinc-900')}>SmartSession</span>
 </div>
 <h2 className={cn('text-[9px] uppercase tracking-widest font-bold mb-3 flex items-center gap-1.5', isDark ? 'text-white/50' : 'text-zinc-500')}>
 <Zap className="w-3.5 h-3.5 text-yellow-500" /> Quick Actions
 </h2>
 <div className="grid grid-cols-2 gap-1.5 mt-2">
 {customGoals.map((g: any) => {
 const Icon = IconMap[g.iconName] || Sparkles;
 return (
 <button
 key={g.id}
 onClick={() => setSessionGoal(prev => prev === g.id ? null : g.id)}
 className={cn(
 'flex items-center py-1.5 px-2 rounded-md border text-left gap-1.5 transition-all duration-200',
 sessionGoal === g.id
 ? 'ring-1 ring-white/30 scale-[1.02]' : 'hover:scale-[1.02] border-transparent',
 isDark ? g.bg : 'bg-zinc-100'
 )}
 >
 <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0 bg-white/20")}>
 <Icon className={cn("w-2.5 h-2.5", isDark ? 'text-white' : 'text-zinc-700')} />
 </div>
 <span className={cn('text-[8px] font-medium leading-tight line-clamp-1', isDark ? 'text-white' : 'text-zinc-800')}>{g.label}</span>
 </button>
 );
 })}
 <button
 onClick={() => setShowAddGoalModal(true)}
 className={cn('flex items-center py-1.5 px-2 rounded-md border border-dashed text-left gap-1.5 transition-all duration-200 hover:scale-[1.02]', isDark ? 'border-white/20 hover:bg-white/5 text-white/60' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-500')}
 >
 <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0 bg-transparent")}>
 <Plus className="w-3 h-3" />
 </div>
 <span className="text-[8px] font-medium leading-tight line-clamp-1">Add Goal</span>
 </button>
 </div>
 </div>

 {/* Dial input */}
 {sessionGoal && (
 <div className={cn('p-3 border-b animate-in slide-in-from-top-2 duration-200', isDark ? 'bg-white/[0.02] border-white/5' : 'bg-zinc-50 border-zinc-200')}>
 <div className="flex gap-1.5">
 <input
 autoFocus
 type="text"
 placeholder="Username or phone..."
 value={dialInput}
 onChange={e => setDialInput(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && startCall(dialInput, true)}
 className={cn('flex-1 border rounded-lg px-2 py-1.5 text-label focus:outline-none focus:border-purple-500/50', isDark ? 'bg-[#0B0F19] border-white/10 text-white placeholder:text-white/30' : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400')}
 />
 </div>
 <div className="flex gap-1.5 mt-1.5">
 <button onClick={() => startCall(dialInput, true)} disabled={!dialInput} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-bold text-white transition-all">
 <Video className="w-3 h-3" /> Video
 </button>
 <button onClick={() => startCall(dialInput, false)} disabled={!dialInput} className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-bold transition-all', isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800')}>
 <Phone className="w-3 h-3" /> Voice
 </button>
 </div>
 </div>
 )}

 {/* Upcoming */}
 <div className="px-4 pt-3 pb-1 shrink-0">
 <h3 className={cn('text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5', isDark ? 'text-white/50' : 'text-zinc-500')}>
 <CalendarClock className="w-3 h-3" /> Upcoming
 </h3>
 </div>
 <div className="px-2 pb-1 space-y-1 shrink-0">
 {upcomingMeetings.length === 0 ? (
 <div className={cn('px-4 py-3 text-[10px]', isDark ? 'text-white/30' : 'text-zinc-400')}>
 No meetings scheduled for today
 </div>
 ) : upcomingMeetings.map((m, i) => (
 <div key={i} className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-xl', isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-zinc-100')}>
 <div className={cn('w-1.5 h-8 rounded-full shrink-0', m.color)} />
 <div className="flex-1 min-w-0">
 <p className={cn('text-[11px] font-semibold truncate', isDark ? 'text-white/80' : 'text-zinc-900')}>{m.title}</p>
 <p className={cn('text-[9px]', isDark ? 'text-white/40' : 'text-zinc-500')}>{m.time} · {m.participants} participants</p>
 </div>
 </div>
 ))}
 </div>

 <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
 <h3 className={cn('text-[10px] uppercase tracking-widest font-bold', isDark ? 'text-white/50' : 'text-zinc-500')}>Recent Sessions</h3>
 </div>
 <div className="flex-1 flex flex-col min-h-0">
 <ScrollArea className="flex-1">
 <div className="px-2 pb-2 space-y-0.5">
 {paginatedLogs.length === 0 ? (
 <div className={cn('px-4 py-3 text-[9px] text-center', isDark ? 'text-white/30' : 'text-zinc-400')}>
 No recent sessions
 </div>
 ) : paginatedLogs.map(log => (
 <button
 key={log.id}
 onClick={() => { setSessionGoal(log.call_type || 'quick'); setDialInput(log.other_user?.username || ''); }}
 className={cn('w-full flex items-center gap-2 p-1.5 rounded-md transition-colors text-left', isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-zinc-100')}
 >
 <Avatar className={cn('w-6 h-6 border shrink-0', isDark ? 'border-white/5' : 'border-zinc-200')}>
 <AvatarImage src={log.other_user?.avatar_url} />
 <AvatarFallback className={cn('text-[9px]', isDark ? 'bg-zinc-800 text-white/90' : 'bg-zinc-200 text-zinc-700')}>{log.other_user?.full_name?.[0] || '?'}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <p className={cn('text-[10px] font-bold truncate leading-tight', isDark ? 'text-white/90' : 'text-zinc-900')}>{log.other_user?.full_name || log.other_user?.username || 'Unknown'}</p>
 <p className={cn('text-[8px] truncate', isDark ? 'text-white/40' : 'text-zinc-500')}>{log.call_type || 'Session'}</p>
 </div>
 <div className="flex flex-col items-end gap-1 shrink-0">
 <span className={cn('text-[7px]', isDark ? 'text-white/30' : 'text-zinc-400')}>{new Date(log.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
 {log.call_type === 'video' ? <Video className="w-2.5 h-2.5 text-purple-500" /> : <Phone className="w-2.5 h-2.5 text-blue-500" />}
 </div>
 </button>
 ))}
 </div>
 </ScrollArea>
 {totalLogPages > 1 && (
 <div className={cn("px-4 py-2 flex items-center justify-between border-t shrink-0", isDark ? 'border-white/5 bg-[#0B0E14]' : 'border-zinc-100 bg-white')}>
 <button
 onClick={() => setLogPage(p => Math.max(1, p - 1))}
 disabled={logPage === 1}
 className="px-2 py-1 text-[9px] font-bold rounded-md border disabled:opacity-30 transition-all flex items-center gap-1 hover:bg-white/5"
 >
 Prev
 </button>
 <span className="text-[9px] font-medium opacity-50">{logPage} / {totalLogPages}</span>
 <button
 onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
 disabled={logPage === totalLogPages}
 className="px-2 py-1 text-[9px] font-bold rounded-md border disabled:opacity-30 transition-all flex items-center gap-1 hover:bg-white/5"
 >
 Next
 </button>
 </div>
 )}
 </div>
 </div>
 )}

 {/* ── Main content area ─────────────────────────────── */}
 <div className="flex-1 flex flex-col overflow-hidden relative">

 {/* ══ IDLE SCREEN ══ */}
 {callState === 'idle' && (
 <ScrollArea className="flex-1">
 <div className="p-4 md:p-5 max-w-[1200px] mx-auto space-y-3.5">

 {/* Hero */}
 <div className={cn('relative overflow-hidden rounded-2xl flex flex-col md:flex-row items-center justify-between min-h-[115px] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)]', isDark ? 'bg-gradient-to-r from-[#2F1D8A] via-[#521996] to-[#8C1381] border-none' : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 border-none')}>
 <div className="relative z-10 max-w-lg mb-3 md:mb-0">
 <h1 className="text-lg font-bold mb-1 text-white flex items-center gap-2">
 {greeting()}, {displayName}! <span className="text-lg">👋</span>
 <WorldClockWidget />
 </h1>
 <p className="text-[11px] mb-3 text-white/90">Here's what's happening with your sessions today.</p>

 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => setShowInstantMeeting(!showInstantMeeting)}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-purple-800 text-[10px] font-bold shadow-md transition-all hover:scale-105"
 >
 <Calendar className="w-3.5 h-3.5" /> Dashboard
 </button>
 <button
 onClick={() => setShowJoinMeeting(!showJoinMeeting)}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-white/20 text-white hover:bg-white/10 transition-all bg-white/5 backdrop-blur-sm"
 >
 <BarChart3 className="w-3.5 h-3.5" /> Analytics
 </button>
 </div>
 
 {/* Instant Meeting ID card */}
 {showInstantMeeting && (
 <div className="mt-3 p-2.5 rounded-xl bg-black/30 border border-white/[0.08] max-w-sm animate-in slide-in-from-top-2 duration-200 relative z-10">
 <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1 font-bold">Your Instant Meeting</div>
 <div className="flex items-center gap-3 mb-2">
 <div className="font-mono text-secondary font-bold text-white/90">{instantMeetingId}</div>
 </div>
 <div className="flex gap-2">
 <button onClick={() => setSessionGoal('quick')} className="flex-1 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1">
 <VideoIcon className="w-3 h-3" /> Start Meeting
 </button>
 <button onClick={() => { navigator.clipboard.writeText(instantMeetingId); toast.success('Meeting ID copied!'); }} className="px-2.5 py-1 rounded-md bg-white/[0.07] hover:bg-white/[0.12] text-white/60 text-[10px] transition-all">
 Copy
 </button>
 </div>
 </div>
 )}

 {/* Join by ID */}
 {showJoinMeeting && (
 <div className="mt-3 p-2.5 rounded-xl bg-black/30 border border-white/[0.08] max-w-sm animate-in slide-in-from-top-2 duration-200 relative z-10">
 <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1 font-bold">Join a Meeting</div>
 <div className="flex gap-2">
 <input
 type="text"
 value={joinId}
 onChange={e => setJoinId(e.target.value)}
 placeholder="Meeting ID or link..."
 className="flex-1 bg-black/40 border border-white/[0.1] rounded-md px-2 py-1 text-label text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
 />
 <button
 onClick={() => { if (joinId.trim()) { setDialInput(joinId.trim()); startCall(joinId.trim(), true); } }}
 className="px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition-all"
 >
 Join
 </button>
 </div>
 </div>
 )}
 </div>

 <div className="relative z-10 hidden md:flex items-center justify-center mr-8">
 <div className="w-[90px] h-[85px] rounded-[20px] bg-white/20 backdrop-blur-md shadow-[0_15px_35px_rgba(0,0,0,0.3)] flex items-center justify-center border border-white/30 rotate-[10deg] hover:rotate-0 transition-all duration-500 relative">
 <Calendar className="w-10 h-10 text-white drop-shadow-lg" />
 <div className="absolute -bottom-2 -right-2 w-[32px] h-[32px] bg-[#9333EA] rounded-full border-[3px] border-[#6D1B9E] flex items-center justify-center shadow-lg">
 <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
 </div>
 </div>
 </div>

 <div className="absolute top-0 right-0 w-[600px] h-full overflow-hidden opacity-30 pointer-events-none">
 <svg viewBox="0 0 800 400" className="absolute right-0 w-full h-full text-white" preserveAspectRatio="none">
 <path d="M0 400 C 200 400 200 0 400 0 C 600 0 600 400 800 400 L 800 0 L 0 0 Z" fill="currentColor" />
 </svg>
 </div>
 </div>

 {/* Stats row — computed from real call history */}
 <div className="grid grid-cols-4 gap-2.5">
 {[
 { label: "Today's Meetings", val: String(realStats.todayMeetings), icon: VideoIcon, color: 'text-purple-400', bg: 'bg-[#5B21B6]/80' },
 { label: 'Upcoming', val: String(realStats.upcoming), icon: CalendarClock, color: 'text-blue-400', bg: 'bg-[#1E40AF]/80' },
 { label: 'Hours Today', val: realStats.hoursToday, icon: Clock, color: 'text-emerald-400', bg: 'bg-[#065F46]/80' },
 { label: 'Total Contacts', val: String(realStats.participants), icon: Users, color: 'text-amber-400', bg: 'bg-[#92400E]/80' },
 ].map((s, i) => (
 <div key={i} className={cn('rounded-xl border p-2.5 flex items-center gap-2.5 shadow-md', isDark ? 'bg-[#111623] border-white/5' : 'bg-white border-zinc-200')}>
 <div className={cn('w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0', s.bg)}>
 <s.icon className={cn('w-3.5 h-3.5', 'text-white')} />
 </div>
 <div>
 <div className={cn('text-[14px] font-bold leading-tight', isDark ? 'text-white' : 'text-zinc-900')}>{s.val}</div>
 <div className={cn('text-[8.5px]', isDark ? 'text-white/60' : 'text-zinc-500')}>{s.label}</div>
 </div>
 </div>
 ))}
 </div>

 {/* Goals grid */}
 <div>
 <h3 className={cn('text-xs font-bold mb-2', isDark ? 'text-white' : 'text-zinc-800')}>Popular Goals</h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
 {customGoals.map((g: any) => {
 const Icon = IconMap[g.iconName] || Sparkles;
 return (
 <button
 key={g.id}
 onClick={() => setSessionGoal(prev => prev === g.id ? null : g.id)}
 className={cn(
 'group relative text-left p-2.5 rounded-xl border transition-all duration-300 flex flex-col justify-between h-[82px] shadow-md',
 isDark ? g.bg : 'bg-white', isDark ? g.border : 'border-zinc-200',
 sessionGoal === g.id ? 'ring-2 ring-white/40 scale-[1.01]' : 'hover:scale-[1.01] hover:shadow-lg'
 )}
 >
 <div className="flex items-center justify-between">
 <div className={cn("w-5 h-5 rounded-md flex items-center justify-center bg-white/20", isDark ? '' : 'bg-zinc-100')}>
 <Icon className={cn("w-3 h-3", isDark ? 'text-white' : 'text-zinc-600')} />
 </div>
 <span className={cn("text-[7.5px] font-bold opacity-90 px-1.5 py-0.5 rounded text-white uppercase tracking-wider bg-white/20 backdrop-blur-sm")}>{g.tag}</span>
 </div>
 <div>
 <h4 className={cn("font-bold text-[10.5px]", isDark ? 'text-white' : 'text-zinc-900')}>{g.label}</h4>
 <p className={cn("text-[8.5px] line-clamp-1 mt-0.5 leading-snug", isDark ? 'text-white/80' : 'text-zinc-500')}>{g.desc}</p>
 </div>
 <ArrowRight className="w-3 h-3 text-white absolute bottom-2.5 right-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
 </button>
 );
 })}
 
 {/* Add New Goal Card */}
 <button 
 onClick={() => setShowAddGoalModal(true)} 
 className={cn(
 'group relative text-left p-2.5 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col justify-between h-[82px]',
 isDark ? 'border-white/20 hover:border-white/40 hover:bg-white/5' : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
 )}
 >
 <div className="flex items-center justify-between">
 <h4 className={cn("font-bold text-[11px]", isDark ? 'text-white/60' : 'text-zinc-500')}>Add New Goal</h4>
 <p className={cn("text-[9px] line-clamp-2 mt-0.5 leading-snug", isDark ? 'text-white/40' : 'text-zinc-400')}>Create custom action.</p>
 </div>
 </button>
 </div>
 </div>
 </div>
 </ScrollArea>
 )}

 {/* ══ CONNECTED SCREEN ══ */}
 {callState === 'connected' && (
 <div className="flex-1 flex flex-col overflow-hidden">

 {/* Meeting Header (persistent) */}
 <MeetingHeader
 title="Weekly Project Review"
 meetingId="CHATR-8F4K-219A"
 hostName={displayName}
 duration={fmt(callDuration)}
 participantCount={participants.length}
 isRecording={isRecording}
 isAiActive={true}
 isSpeakerView={layoutMode === 'speaker'}
 onInviteClick={() => setShowInviteModal(true)}
 onParticipantsClick={() => setShowParticipants(p => !p)}
 onLayoutClick={() => { closeAllPopups(); setShowLayoutSwitcher(p => !p); }}
 onMoreClick={() => { closeAllPopups(); setShowHostControls(p => !p); }}
 onRecordingToggle={handleToggleRecording}
 />

 {/* Status Ribbon */}
 <MeetingStatusRibbon
 isRecording={isRecording}
 isAiTranscribing={true}
 isScreenSharing={isScreenSharing}
 networkQuality="excellent"
 isEncrypted={true}
 />

 {/* Video + Panels row */}
 <div className="flex-1 flex overflow-hidden">

 {/* Video area */}
 <div className="flex-1 relative bg-zinc-950 overflow-hidden flex flex-col">
 <div className="flex-1 overflow-hidden relative">
 {remoteCount === 0 ? (
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
 <div className="relative w-80 aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-900">
 {localStream && !isVideoOff ? (
 <video ref={(el) => { if (el) el.srcObject = localStream; }} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600/40 to-blue-600/40 border border-white/10 flex items-center justify-center text-page font-bold text-white/60">
 {currentUserName[0]?.toUpperCase() || 'Y'}
 </div>
 </div>
 )}
 <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-full text-[10px] text-white/80">You</div>
 </div>
 <div className="text-center space-y-2">
 <div className="flex items-center justify-center gap-2">
 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
 <p className="text-white/70 font-medium">Room is open</p>
 </div>
 <p className="text-white/30 text-secondary">Waiting for {remoteUserName || 'participants'} to join...</p>
 <button onClick={() => setShowInviteModal(true)} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white text-label font-bold transition-all mx-auto">
 <UserPlus className="w-3.5 h-3.5" /> Invite Participants
 </button>
 </div>
 </div>
 ) : (
 <div className="absolute inset-0 flex">
 {layoutMode === 'gallery' && (
 <div className={cn('flex-1 p-3 gap-3', remoteCount === 1 ? 'flex items-center justify-center' : remoteCount <= 4 ? 'grid grid-cols-2' : 'grid grid-cols-3')}>
 {Object.entries(remoteStreams).map(([uid, { stream, name, flag }]: any, idx) => (
 <div key={uid} className={cn('relative', remoteCount === 1 ? 'w-full max-w-[1000px] aspect-video' : 'w-full h-full')}>
 <RemoteTile stream={stream} label={name} avatarChar={name[0]?.toUpperCase() || 'U'} flag={flag} isSpeaking={idx === 0} />
 </div>
 ))}
 </div>
 )}

 {layoutMode === 'speaker' && (
 <div className="flex-1 flex flex-col p-3 gap-3 relative">
 <div className="flex-1 w-full relative">
 {Object.entries(remoteStreams).length > 0 && (
 <RemoteTile 
 stream={Object.values(remoteStreams)[0].stream} 
 label={Object.values(remoteStreams)[0].name} 
 avatarChar={Object.values(remoteStreams)[0].name[0]?.toUpperCase() || 'U'} 
 flag={Object.values(remoteStreams)[0].flag} 
 isSpeaking={true} 
 />
 )}
 </div>
 {remoteCount > 1 && (
 <div className="h-40 w-full flex gap-3 overflow-x-auto">
 {Object.entries(remoteStreams).slice(1).map(([uid, { stream, name, flag }]: any) => (
 <div key={uid} className="h-full aspect-video relative shrink-0">
 <RemoteTile stream={stream} label={name} avatarChar={name[0]?.toUpperCase() || 'U'} flag={flag} isSpeaking={false} />
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {(layoutMode === 'sidebar' || layoutMode === 'presenter') && (
 <div className="flex-1 flex p-3 gap-3 relative">
 <div className="flex-1 h-full relative">
 {Object.entries(remoteStreams).length > 0 && (
 <RemoteTile 
 stream={Object.values(remoteStreams)[0].stream} 
 label={Object.values(remoteStreams)[0].name} 
 avatarChar={Object.values(remoteStreams)[0].name[0]?.toUpperCase() || 'U'} 
 flag={Object.values(remoteStreams)[0].flag} 
 isSpeaking={true} 
 />
 )}
 </div>
 {remoteCount > 1 && (
 <div className="w-64 h-full flex flex-col gap-3 overflow-y-auto">
 {Object.entries(remoteStreams).slice(1).map(([uid, { stream, name, flag }]: any) => (
 <div key={uid} className="w-full aspect-video relative shrink-0">
 <RemoteTile stream={stream} label={name} avatarChar={name[0]?.toUpperCase() || 'U'} flag={flag} isSpeaking={false} />
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {layoutMode === 'pip' && (
 <div className="flex-1 p-3 gap-3 relative flex items-center justify-center">
 {Object.entries(remoteStreams).length > 0 && (
 <div className="w-full max-w-[1000px] aspect-video relative">
 <RemoteTile 
 stream={Object.values(remoteStreams)[0].stream} 
 label={Object.values(remoteStreams)[0].name} 
 avatarChar={Object.values(remoteStreams)[0].name[0]?.toUpperCase() || 'U'} 
 flag={Object.values(remoteStreams)[0].flag} 
 isSpeaking={true} 
 />
 </div>
 )}
 {remoteCount > 1 && (
 <div className="absolute top-5 right-5 flex flex-col gap-3 z-10 pointer-events-none">
 {Object.entries(remoteStreams).slice(1).map(([uid, { stream, name, flag }]: any) => (
 <div key={uid} className="w-48 aspect-video relative shrink-0 shadow-2xl rounded-xl overflow-hidden pointer-events-auto border-2 border-white/10">
 <RemoteTile stream={stream} label={name} avatarChar={name[0]?.toUpperCase() || 'U'} flag={flag} isSpeaking={false} />
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {remoteCount > 0 && layoutMode !== 'pip' && (
 <div className="absolute bottom-5 right-5 w-48 aspect-[3/4] z-20 shadow-2xl">
 <LocalTile stream={localStream} videoOff={isVideoOff} name={currentUserName} />
 </div>
 )}
 {remoteCount > 0 && layoutMode === 'pip' && (
 <div className="absolute bottom-5 right-5 w-48 aspect-video z-20 shadow-2xl rounded-xl overflow-hidden pointer-events-auto border-2 border-white/10">
 <LocalTile stream={localStream} videoOff={isVideoOff} name={currentUserName} />
 </div>
 )}
 </div>
 )}
 </div>

 {/* Bottom Drawer — live chat wired to room channel */}
 <MeetingLogsDrawer
 isOpen={showDrawer}
 onToggle={() => setShowDrawer(p => !p)}
 logEvents={[]}
 waitingRoom={waitingRoom}
 onAdmit={handleAdmit}
 onReject={handleReject}
 roomId={activeRoomId}
 />

 {/* Controls */}
 <div className="relative">
 {showAddParticipant && (
 <AddParticipantsPanel
 onClose={() => setShowAddParticipant(false)}
 onAdd={(t) => addParticipant(t)}
 meetingLink={activeRoomId ? `${window.location.origin}/desktop/calls?room=${activeRoomId}` : undefined}
 />
 )}
 {showReactions && <ReactionsBar onClose={() => setShowReactions(false)} />}
 {showLayoutSwitcher && (
 <LayoutSwitcher
 current={layoutMode}
 onChange={setLayoutMode}
 onClose={() => setShowLayoutSwitcher(false)}
 />
 )}
 {showHostControls && (
 <HostControls
 onClose={() => setShowHostControls(false)}
 onMuteAll={async () => {
 if (!activeRoomId) return;
 try {
 await supabase.channel(`room-settings-${activeRoomId}`).send({
 type: 'broadcast',
 event: 'host_control',
 payload: { key: 'mute_all', value: true }
 });
 toast.success('Mute command sent to all participants.');
 } catch (e) {
 toast.error('Failed to send mute command.');
 }
 }}
 onEndMeeting={endCall}
 roomId={activeRoomId}
 />
 )}

 <MeetingControls
 isMuted={isMuted}
 isVideoOff={isVideoOff}
 isRecording={isRecording}
 isHandRaised={isHandRaised}
 isScreenSharing={isScreenSharing}
 showAddParticipant={showAddParticipant}
 onToggleMute={toggleMute}
 onToggleVideo={toggleVideo}
 onToggleRecord={handleToggleRecording}
 onToggleHand={() => { setIsHandRaised(p => !p); toast.info(isHandRaised ? 'Hand lowered' : 'Hand raised ✋'); }}
 onToggleScreen={() => setIsScreenSharing(p => !p)}
 onAddParticipant={() => { closeAllPopups(); setShowAddParticipant(p => !p); }}
 onReactions={() => { closeAllPopups(); setShowReactions(p => !p); }}
 onMoreOptions={() => { closeAllPopups(); setShowHostControls(p => !p); }}
 onEndCall={handleEndCall}
 callDuration={fmt(callDuration)}
 />
 </div>
 </div>

 {/* Participants Panel */}
 {showParticipants && (
 <ParticipantsPanel
 participants={participants}
 isHost={true}
 onClose={() => setShowParticipants(false)}
 onInvite={() => { setShowParticipants(false); setShowInviteModal(true); }}
 onMuteParticipant={(id) => { console.log('Mute', id); toast.info('Participant muted'); }}
 onRemoveParticipant={(id) => { console.log('Remove', id); toast.info('Participant removed'); }}
 />
 )}

 {/* AI Workspace */}
 <SessionWorkspace
 goal={sessionGoal || 'quick'}
 remoteUserName={remoteUserName}
 remoteUserAvatar={remoteUserAvatar}
 callId={getLocalCallId()}
 callDuration={callDuration}
 onSaveTranscript={saveTranscriptToDocuments}
 onSaveSummary={saveSummaryToDocuments}
 onTranscriptUpdate={(text) => {
 const cleanedText = text.trim();
 if (!cleanedText) return;
 transcriptRef.current = transcriptRef.current
 ? `${transcriptRef.current.trimEnd()}\n${cleanedText}`
 : cleanedText;
 }}
 />
 </div>
 </div>
 )}
 </div>

 {/* ── Global Modals ───────────────────────────────────── */}
 {showInviteModal && (
 <InviteModal
 meetingId={activeRoomId || instantMeetingId}
 meetingLink={activeRoomId ? `${window.location.origin}/desktop/calls?room=${activeRoomId}` : `${window.location.origin}/desktop/calls?room=${instantMeetingId}`}
 passcode=""
 onClose={() => setShowInviteModal(false)}
 />
 )}

 {/* Post-Call Summary Modal */}
 {showSummaryModal && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
 <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
 <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
 <h3 className="font-semibold text-white/90 flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-indigo-400" /> Call Summary
 </h3>
 {!summaryLoading && (
 <button onClick={() => setShowSummaryModal(false)} className="text-white/40 hover:text-white/80 p-1">
 ✕
 </button>
 )}
 </div>
 <div className="p-6">
 {summaryLoading ? (
 <div className="flex flex-col items-center justify-center py-10 space-y-4">
 <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
 <p className="text-secondary text-white/60">ChatrAI is analyzing the transcript...</p>
 </div>
 ) : (
 <div className="space-y-4">
 <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-secondary text-white/80 whitespace-pre-line ">
 {summary || "No summary could be generated."}
 </div>
 <div className="flex justify-end pt-2">
 <button onClick={() => setShowSummaryModal(false)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-secondary font-medium transition-colors">
 Close
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Add Custom Goal Modal */}
 {showAddGoalModal && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
 <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
 <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
 <h3 className="font-semibold text-white/90 flex items-center gap-2">
 <Plus className="w-4 h-4 text-purple-400" /> Add Custom Goal
 </h3>
 <button onClick={() => setShowAddGoalModal(false)} className="text-white/40 hover:text-white/80 p-1">
 ✕
 </button>
 </div>
 <div className="p-6 space-y-4">
 <div>
 <label className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1.5 block">Label</label>
 <input
 type="text"
 placeholder="e.g. Sales Pitch"
 value={newGoal.label}
 onChange={(e) => setNewGoal({ ...newGoal, label: e.target.value })}
 className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-secondary text-white focus:outline-none focus:border-purple-500"
 />
 </div>
 <div>
 <label className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1.5 block">Description</label>
 <textarea
 placeholder="What is this goal for?"
 value={newGoal.desc}
 onChange={(e) => setNewGoal({ ...newGoal, desc: e.target.value })}
 className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-secondary text-white focus:outline-none focus:border-purple-500 h-20 resize-none"
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1.5 block">Category / Tag</label>
 <input
 type="text"
 placeholder="e.g. Sales"
 value={newGoal.tag}
 onChange={(e) => setNewGoal({ ...newGoal, tag: e.target.value })}
 className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-secondary text-white focus:outline-none focus:border-purple-500"
 />
 </div>
 <div>
 <label className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1.5 block">Icon</label>
 <select
 value={newGoal.iconName}
 onChange={(e) => setNewGoal({ ...newGoal, iconName: e.target.value })}
 className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-secondary text-white focus:outline-none focus:border-purple-500"
 >
 {Object.keys(IconMap).map((k) => (
 <option key={k} value={k}>{k}</option>
 ))}
 </select>
 </div>
 </div>
 <div>
 <label className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1.5 block">Color Theme</label>
 <div className="flex gap-2">
 {[
 'bg-gradient-to-br from-[#7C2BBE] to-[#450C85]', // Purple
 'bg-gradient-to-br from-[#129B55] to-[#046132]', // Green
 'bg-gradient-to-br from-[#D97904] to-[#995100]', // Orange
 'bg-gradient-to-br from-[#0B71C6] to-[#033F76]', // Blue
 'bg-gradient-to-br from-[#E22748] to-[#910A22]', // Red
 ].map((c, i) => (
 <button
 key={i}
 onClick={() => setNewGoal({ ...newGoal, bg: c })}
 className={cn("w-8 h-8 rounded-full border-2", c, newGoal.bg === c ? "border-white" : "border-transparent")}
 />
 ))}
 </div>
 </div>
 </div>
 <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex justify-end gap-3">
 <button onClick={() => setShowAddGoalModal(false)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-secondary font-medium transition-colors">
 Cancel
 </button>
 <button onClick={handleSaveGoal} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-button transition-colors">
 Save Goal
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Meeting Copilot Panel (right side) ── */}
 <MeetingCopilotPanel
 callState={callState}
 callerName={Object.keys(remoteStreams)[0]}
 meetingGoal={sessionGoal || undefined}
 />
 </div>
 );
};

export default DesktopCalls;
