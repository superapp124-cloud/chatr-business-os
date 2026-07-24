import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AgentActionCard } from '@/components/ai-agents/AgentActions';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { useService, useOptionalService, usePlatformReady } from '@/platform/Infrastructure/PlatformContext';
import type { Room, Message } from '@/platform/Domain/Communication/MessagingService';
import { useNativeRingtone } from '@/hooks/useNativeRingtone';
import { BrainCircuit, CheckCheck, FileText, CornerUpRight, Plus, Search, Pin, Phone, Video, X, Calendar, Zap, Smile, Sparkles, Loader2, Users, MessageSquare, MoreVertical, Hash, Bell, BellOff, ChevronRight, Reply, Image as ImageIcon, Download, FileIcon, Globe, Lock, Shield, Settings2, ChevronDown, CheckCircle2, Send, UserPlus, Mic, Paperclip, Type, Camera, MapPin, User, Languages, ListChecks, Forward } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OutcomeCenter } from '@/components/desktop/OutcomeCenter';
import { DailyTimeline } from '@/components/desktop/DailyTimeline';
import { CalendarSettings } from '@/components/settings/CalendarSettings';
import { IntelligencePanel } from '@/components/desktop/IntelligencePanel';
import { useCHATROS } from '@/core/os/hooks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { AdaptiveHome } from '@/components/desktop/AdaptiveHome';
import { OutcomeCard } from '@/components/outcomes/OutcomeCard';
import { useIntentObserver } from '@/hooks/useIntentObserver';
import { eventBus } from '@/core/runtime/EventBus';
import { commitmentRuntime } from '@/core/capabilities/CommitmentRuntime';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCall } from '@/contexts/CallContext';
import { toast } from 'sonner';
import { generate } from '@/services/ai';
import { AICoworkerService } from '@/services/ai/AICoworkerService';
import { UniversalSearch } from '@/components/desktop/UniversalSearch';
import { format, isToday, isYesterday } from 'date-fns';
import { PresenceIndicator } from './chat/components/PresenceIndicator';
import { TypingIndicator } from './chat/components/TypingIndicator';
import { CreateNewModal } from './chat/components/CreateNewModal';
import { triggerCabBooking } from '@/core/capabilities/travel/CabBookingWorkflow';
import { triggerCalendarMeeting } from '@/core/capabilities/calendar/CalendarMeetingWorkflow';
import { triggerFoodOrdering } from '@/core/capabilities/commerce/FoodOrderingWorkflow';
import { triggerWeatherWorkflow } from '@/core/capabilities/weather/WeatherWorkflow';
import { triggerFlightBooking } from '@/core/capabilities/travel/FlightBookingWorkflow';

// ─── UTILS ──────────────────────────────────────────────────────────────────

const relativeTime = (dateStr: string): string => {
 if (!dateStr) return '';
 try {
 const date = new Date(dateStr);
 if (isToday(date)) return format(date, 'HH:mm');
 if (isYesterday(date)) return 'Yesterday';
 return format(date, 'dd MMM');
 } catch { return ''; }
};

// ─── DEMO DATA (fallback UI while no workspace rooms exist) ─────────────────
// These are only shown when the user has no rooms yet — they do NOT represent real data.

const EMPTY_CHANNELS: Room[] = [];
const EMPTY_MESSAGES: Message[] = [];



// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function DesktopChat() {
 const { themeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const isReady = usePlatformReady();
 const messagingService = useService<any>('MessagingService');
 
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { startCall } = useCall();

 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [showNewDmModal, setShowNewDmModal] = useState(false);
 const [dmSearchQuery, setDmSearchQuery] = useState('');
 const [dmSearchResults, setDmSearchResults] = useState<any[]>([]);
 const [dmSearchLoading, setDmSearchLoading] = useState(false);
 const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
 // Peer username for calling (resolved when DM room is selected)
 const [peerUsername, setPeerUsername] = useState<string | null>(null);
 // Copilot chat
 const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
 const [forwardSearchQuery, setForwardSearchQuery] = useState('');
 const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
 const [forwardSelectedRooms, setForwardSelectedRooms] = useState<Set<string>>(new Set());
 const [isForwarding, setIsForwarding] = useState(false);
 const [attachments, setAttachments] = useState<File[]>([]);

 const [copilotInput, setCopilotInput] = useState('');
 const [copilotMessages, setCopilotMessages] = useState<{ role: 'user' | 'assistant'; content: string; workflowId?: string }[]>([]);
 const [copilotLoading, setCopilotLoading] = useState(false);
 const copilotEndRef = useRef<HTMLDivElement | null>(null);

 // OS Panel State
 const [rightPaneTab, setRightPaneTab] = useState<'copilot' | 'outcomes' | 'timeline' | 'decisions' | 'notes'>('copilot');

 // Outcomes Runtime State
 const [outcomes, setOutcomes] = useState<any[]>(() => {
 try {
 const saved = localStorage.getItem('chatr_outcomes_v1');
 return saved ? JSON.parse(saved) : [];
 } catch {
 return [];
 }
 });

 useEffect(() => {
 localStorage.setItem('chatr_outcomes_v1', JSON.stringify(outcomes));
 }, [outcomes]);

 useEffect(() => {
 const handleOutcomesDetected = (e: any) => {
 const detectedOutcomes = e.detail;
 // We process them via the runtime
 detectedOutcomes.forEach((o: any) => commitmentRuntime.processCommitment(o));
 };

 const handleCommitmentSuggested = (e: any) => {
 // EventBus emits { payload: { commitment } }
 const commitment = e.payload.commitment;
 setOutcomes(prev => {
 // Clear any previous unconfirmed suggestions to prevent stacking while typing
 const filtered = prev.filter(o => o.status !== 'suggested' && o.status !== 'detected' && o.status !== 'validated');
 return [...filtered, commitment];
 });
 setRightPaneTab('outcomes');
 };

 const handleCommitmentStateChanged = (e: any) => {
 // EventBus emits { payload: commitment }
 const commitment = e.payload;
 setOutcomes(prev => prev.map(o => o.id === commitment.id ? commitment : o));
 };

 const handleRealityVerified = (e: any) => {
 const { commitment } = e.payload;
 setOutcomes(prev => prev.map(o => o.id === commitment.id ? commitment : o));

 // Append generic OS task representation so old code doesn't break, or just add a message
 if (selectedId && user) {
 let actionType = 'task';
 if (commitment.capability === 'core.flight_booking' || commitment.capability === 'core.hotel_booking') actionType = 'book';
 if (commitment.capability === 'core.candidate_interview' || commitment.capability === 'core.meeting' || commitment.capability === 'core.calendar_event') actionType = 'message';
 
 const sysMsg = {
 room_id: selectedId,
 content: `${commitment.title}`,
 sender_id: user.id, // we tie it to the user so it displays properly
 type: 'system',
 metadata: { 
 isAction: true,
 actionType: actionType,
 actionTitle: `${commitment.type || commitment.capability} Completed`,
 actionDescription: e.payload.reality?.message + (e.payload.reality?.evidence?.pnr ? ` (PNR: ${e.payload.reality.evidence.pnr})` : '') || commitment.title,
 actionData: { 
 ...commitment.entities, 
 ...commitment.selectedResult,
 ...e.payload.reality?.evidence 
 }
 }
 };
 
 supabase.from('messages').insert(sysMsg).then(({ error }) => {
 if (error) console.error('Failed to save action message:', error);
 });
 }
 };

 window.addEventListener('chatr:outcomes-detected', handleOutcomesDetected);
 
 // Use the new EventBus for the kernel events
 eventBus.subscribe('chatr:commitment-suggested', handleCommitmentSuggested);
 eventBus.subscribe('chatr:commitment-state-changed', handleCommitmentStateChanged);
 eventBus.subscribe('chatr:reality-verified', handleRealityVerified);
 
 return () => {
 window.removeEventListener('chatr:outcomes-detected', handleOutcomesDetected);
 eventBus.unsubscribe('chatr:commitment-suggested', handleCommitmentSuggested);
 eventBus.unsubscribe('chatr:commitment-state-changed', handleCommitmentStateChanged);
 eventBus.unsubscribe('chatr:reality-verified', handleRealityVerified);
 };
 }, [selectedId]);




 // ── Forwarding ─────────────────────────────────────────────────────────────
 const executeForward = async () => {
 if (!forwardMessage || forwardSelectedRooms.size === 0) return;
 
 setIsForwarding(true);
 let successCount = 0;
 
 try {
 for (const targetRoomId of Array.from(forwardSelectedRooms)) {
 const msg = await messagingService.sendMessage(
 targetRoomId, 
 forwardMessage.content, 
 forwardMessage.attachments || []
 );
 if (msg) successCount++;
 }
 
 if (successCount > 0) {
 toast.success(`Message forwarded to ${successCount} chat${successCount > 1 ? 's' : ''}`);
 setForwardMessage(null);
 setForwardSelectedRooms(new Set());
 } else {
 toast.error('Failed to forward message');
 }
 } catch (err: any) {
 toast.error('Error forwarding message: ' + err.message);
 } finally {
 setIsForwarding(false);
 }
 };

 // ── Call Handlers ───────────────────────────────────────────────────────────
 const [rooms, setRooms] = useState<Room[]>(EMPTY_CHANNELS);
 const [messages, setMessages] = useState<Message[]>(EMPTY_MESSAGES);
 const [messageInput, setMessageInput] = useState('');
 const [threadInput, setThreadInput] = useState('');
 const [isUploading, setIsUploading] = useState(false);
 const [isAiLoading, setIsAiLoading] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 
 const [isLoadingRooms, setIsLoadingRooms] = useState(false);
 const [isLoadingMessages, setIsLoadingMessages] = useState(false);
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);

 const intentObserver = useIntentObserver({
 conversationId: selectedId,
 userId: currentUserId || undefined,
 });

 // Global OS — knowledge extraction for Intelligence Panel
 const chatrOS = useCHATROS();

 // Watch typing for intents
 useEffect(() => {
 if (messageInput.trim().length > 0) {
 intentObserver.observe(messageInput);
 chatrOS.observeText(messageInput);
 }
 }, [messageInput]);

 const [onlineRoster, setOnlineRoster] = useState<Record<string, { status: string; lastSeen: number }>>({});
 const [typingUsers, setTypingUsers] = useState<Record<string, NodeJS.Timeout>>({});
 const [isRewriting, setIsRewriting] = useState(false);
 const unsubRef = useRef<(() => void) | null>(null);
 const typingChannelRef = useRef<any>(null);
 const messagesEndRef = useRef<HTMLDivElement | null>(null);

 // Get current user
 useEffect(() => {
 supabase.auth.getSession().then(({ data: { session } }) => {
 if (session?.user) setCurrentUserId(session.user.id);
 });
 const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
 setCurrentUserId(session?.user?.id || null);
 });
 return () => { subscription.unsubscribe(); };
 }, []);

 // Listen for executed outcomes — inject a rich completion receipt into the chat thread
 useEffect(() => {
 const handleOutcomeExecuted = (e: any) => {
 const { text, type, raw } = e.detail;

 // Show a premium toast notification
 toast.success(raw?.title || text, {
 description: `${type?.charAt(0) + type?.slice(1).toLowerCase()} completed · ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
 duration: 4000,
 });

 // Auto-switch the right pane to outcomes to show the result
 setRightPaneTab('outcomes');

 // If we're in a conversation, also inject a completion card into the chat
 if (selectedId) {
 const receiptMsg: any = {
 id: crypto.randomUUID(),
 roomId: selectedId,
 senderId: 'system',
 senderName: 'CHATR AI',
 content: JSON.stringify({
 title: raw?.title || text,
 type: type,
 capability: raw?.capability,
 transactionId: raw?.transactionId,
 verifiedAt: raw?.verifiedAt,
 entities: raw?.entities,
 }),
 createdAt: new Date().toISOString(),
 type: 'os_completion_receipt',
 };
 setMessages(prev => [...prev, receiptMsg]);
 setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 }
 };
 window.addEventListener('chatr:outcome-executed', handleOutcomeExecuted);
 return () => window.removeEventListener('chatr:outcome-executed', handleOutcomeExecuted);
 }, [selectedId]);

 // Presence Subscription
 useEffect(() => {
 if (!isReady) return;
 try {
 const presenceService = useService<any>('PresenceService');
 const unsub = presenceService.onRosterChange((roster: Record<string, any>) => {
 setOnlineRoster(roster);
 });
 return () => unsub?.();
 } catch { /* ignore if not available */ }
 }, [isReady]);

 // Load rooms when platform is ready; also honour ?conv= URL param
 useEffect(() => {
 if (!messagingService) return;
 setIsLoadingRooms(true);
 messagingService.getRooms().then((r: Room[]) => {
 setRooms(r);
 const convParam = searchParams.get('conv');
 if (convParam) {
 // If this conv is already loaded use it; otherwise add a placeholder entry
 const existing = r.find(room => room.id === convParam);
 if (existing) {
 setSelectedId(convParam);
 } else {
 // Reload conversation list to include newly created one
 setTimeout(() => {
 messagingService.getRooms().then((r2: Room[]) => {
 setRooms(r2);
 setSelectedId(convParam);
 });
 }, 500);
 }
 } else if (r.length > 0 && !selectedId) {
 setSelectedId(r[0].id);
 }
 }).finally(() => setIsLoadingRooms(false));
 }, [isReady, messagingService, searchParams]);

 // Global message listener to bump rooms to top
 useEffect(() => {
 if (!currentUserId || !messagingService) return;
 const channel = supabase.channel('global_messages')
 .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
 const msg = payload.new;
 setRooms(prev => {
 const roomIndex = prev.findIndex(r => r.id === msg.conversation_id);
 if (roomIndex === -1) {
 messagingService.getRooms().then(setRooms);
 return prev;
 }
 const newRooms = [...prev];
 const room = newRooms[roomIndex];
 room.lastMessageAt = msg.created_at;
 if (msg.sender_id !== currentUserId && msg.conversation_id !== selectedId) {
 room.unreadCount = (room.unreadCount || 0) + 1;
 }
 newRooms.splice(roomIndex, 1);
 newRooms.unshift(room);
 return newRooms;
 });
 })
 .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [currentUserId, messagingService, selectedId]);

 // Load messages when room is selected
 useEffect(() => {
 if (!selectedId || !messagingService) return;
 setIsLoadingMessages(true);
 setMessages([]);

 // Unsubscribe from previous room
 if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
 if (typingChannelRef.current) { supabase.removeChannel(typingChannelRef.current); typingChannelRef.current = null; }
 setTypingUsers({});

 messagingService.getMessages(selectedId).then((msgs: Message[]) => {
 setMessages(msgs);
 setIsLoadingMessages(false);
 setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 });

 // Subscribe to realtime typing
 const typingChannel = supabase.channel(`typing:${selectedId}`)
 .on('broadcast', { event: 'typing' }, (payload) => {
 if (payload.payload.userId !== currentUserId) {
 setTypingUsers(prev => {
 if (prev[payload.payload.userId]) clearTimeout(prev[payload.payload.userId]);
 const timeout = setTimeout(() => {
 setTypingUsers(curr => {
 const next = { ...curr };
 delete next[payload.payload.userId];
 return next;
 });
 }, 3000);
 return { ...prev, [payload.payload.userId]: timeout };
 });
 }
 })
 .subscribe();
 typingChannelRef.current = typingChannel;

 // Subscribe to realtime messages
 const unsub = messagingService.subscribeToRoom(selectedId, (msg: Message) => {
 setMessages(prev => {
 if (prev.some(m => m.id === msg.id)) return prev;
 return [...prev, msg];
 });
 setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 // Play notification sound for messages from others
 if (msg.senderId !== currentUserId) {
 try {
 const notif = new Audio('/notification.mp3');
 notif.volume = 0.5;
 notif.play().catch(() => {});
 } catch {}
 }
 });
 unsubRef.current = unsub;
 return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
 }, [selectedId, messagingService]);

 // Resolve the peer's username for calling when DM room selected
 useEffect(() => {
 const room = rooms.find(r => r.id === selectedId);
 if (!room || room.type !== 'dm' || !currentUserId) { setPeerUsername(null); return; }
 // Fetch the other participant's profile
 supabase
 .from('conversation_participants')
 .select('user_id, profiles:user_id(username, full_name, phone_number)')
 .eq('conversation_id', selectedId)
 .neq('user_id', currentUserId)
 .limit(1)
 .single()
 .then(({ data, error }) => {
 if (error || !data) {
 // Fallback to room name if query fails (room name might be the phone number)
 setPeerUsername(room.name !== 'Unnamed' ? room.name : null);
 return;
 }
 const profile = (data as any)?.profiles;
 setPeerUsername(profile?.username || profile?.phone_number || profile?.full_name || room.name);
 });
 }, [selectedId, rooms, currentUserId]);

 // Split rooms into channels vs DMs for display
 const channels = rooms.filter(r => r.type === 'channel');
 const dms = rooms.filter(r => r.type !== 'channel');
 const selectedRoom = rooms.find(r => r.id === selectedId);

 // Split messages by type for OS Panel
 const chatMessages = messages.filter(m => !m.type?.startsWith('os_'));
 
 const parseOSMetadata = (m: Message) => {
 try {
 return { id: m.id, createdAt: m.createdAt, ...JSON.parse(m.content) };
 } catch {
 return null;
 }
 };
 
 const osTasks = messages.filter(m => m.type === 'os_task').map(parseOSMetadata).filter(Boolean);
 const osDecisions = messages.filter(m => m.type === 'os_decision').map(parseOSMetadata).filter(Boolean);
 const osNotes = messages.filter(m => m.type === 'os_note').map(parseOSMetadata).filter(Boolean);
 const osEvents = messages.filter(m => m.type === 'os_event').map(parseOSMetadata).filter(Boolean);

 const [isExtracting, setIsExtracting] = useState(false);
 const handleExtract = async () => {
 if (!selectedId || !currentUserId || isExtracting) return;
 setIsExtracting(true);
 toast('Extracting tasks and decisions...');
 try {
 await AICoworkerService.extractOSEntities(selectedId, chatMessages, currentUserId);
 toast.success('Successfully extracted insights!');
 } catch (err: any) {
 toast.error('Extraction failed: ' + err.message);
 } finally {
 setIsExtracting(false);
 }
 };

 const handleSmartReply = async () => {
 setIsAiLoading(true);
 try {
 const historyPayload = messages.slice(-10).map(m => ({ sender: m.senderName || 'User', text: m.content }));
 const reply = await AICoworkerService.generateSmartReply(historyPayload);
 setMessageInput(reply);
 } catch (err) {
 toast.error('Failed to generate smart reply');
 } finally {
 setIsAiLoading(false);
 }
 };

 const handleExtractActions = async () => {
 setIsAiLoading(true);
 try {
 const historyPayload = messages.slice(-15).map(m => ({ sender: m.senderName || 'User', text: m.content }));
 const extracted = await AICoworkerService.extractActionSummary(historyPayload);
 
 if (selectedId && messagingService) {
 const aiMsg = await messagingService.sendAiMessage(selectedId, extracted);
 if (aiMsg) {
 setMessages(prev => [...prev, aiMsg]);
 setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 }
 }
 } catch (err) {
 toast.error('Failed to extract actions');
 } finally {
 setIsAiLoading(false);
 }
 };

 const triggerFilePicker = (acceptType: string) => {
 if (fileInputRef.current) {
 fileInputRef.current.accept = acceptType;
 fileInputRef.current.click();
 }
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files || files.length === 0) return;
 setAttachments(prev => [...prev, ...Array.from(files)]);
 if (fileInputRef.current) fileInputRef.current.value = '';
 };

 // ─── Intent Detection ────────────────────────────────────────────────────
 const CAB_BOOKING_PATTERNS = [
 /book.{0,10}cab/i,
 /book.{0,10}ride/i,
 /get.{0,10}cab/i,
 /need.{0,10}cab/i,
 /ola|uber|rapido/i,
 /book.{0,10}taxi/i,
 ];

 const detectCabBookingIntent = (text: string): boolean =>
 CAB_BOOKING_PATTERNS.some(p => p.test(text));

 const CALENDAR_MEETING_PATTERNS = [
 /schedule.{0,10}meeting/i,
 /book.{0,10}meeting/i,
 /set up.{0,10}meeting/i,
 ];

 const detectCalendarMeetingIntent = (text: string): boolean =>
 CALENDAR_MEETING_PATTERNS.some(p => p.test(text));

 const FOOD_ORDERING_PATTERNS = [
 /hungry/i,
 /order.{0,10}food/i,
 /order.{0,10}pizza/i,
 /get.{0,10}food/i,
 ];

 const detectFoodOrderingIntent = (text: string): boolean =>
 FOOD_ORDERING_PATTERNS.some(p => p.test(text));

 const FLIGHT_DEPARTURE_PATTERNS = [
 /flight.{0,10}tomorrow/i,
 /get me there on time/i,
 /catch my flight/i,
 ];

 const detectFlightDepartureIntent = (text: string): boolean =>
 FLIGHT_DEPARTURE_PATTERNS.some(p => p.test(text));

 const ENTERPRISE_APPROVAL_PATTERNS = [
 /access.{0,10}production/i,
 /request.{0,10}access/i,
 /need.{0,10}database/i,
 ];

 const detectEnterpriseApprovalIntent = (text: string): boolean =>
 ENTERPRISE_APPROVAL_PATTERNS.some(p => p.test(text));

 const WEATHER_PATTERNS = [
 /weather/i,
 /temperature/i,
 /how hot/i,
 /how cold/i,
 /forecast/i,
 ];

 const detectWeatherIntent = (text: string): boolean =>
 WEATHER_PATTERNS.some(p => p.test(text));

 const handleCopilotSend = useCallback(async (textOverride?: string) => {
 const textToSend = textOverride || copilotInput.trim();
 if ((!textToSend && attachments.length === 0) || copilotLoading) return;
 
 setCopilotInput('');
 const currentAttachments = [...attachments];
 setAttachments([]);

 setCopilotMessages(prev => [...prev, { role: 'user', content: textToSend + (currentAttachments.length > 0 ? ` [Attached ${currentAttachments.length} file(s)]` : '') }]);

 // Route to DocumentEngine if attachments are present
 if (currentAttachments.length > 0) {
 setCopilotMessages(prev => [
 ...prev,
 { role: 'assistant', content: `I'll analyze those ${currentAttachments.length} document(s) for you.` }
 ]);
 triggerDocumentUnderstanding(currentAttachments, textToSend);
 setTimeout(() => copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 return;
 }

 if (detectCabBookingIntent(textToSend)) {
 const conversationId = `conv-${Date.now()}`;
 // Clear previous messages so old zombie workflows don't confuse the user
 setCopilotMessages([{ role: 'user', content: textToSend }]);
 const workflowId = await triggerCabBooking(conversationId, {
 rawText: textToSend,
 });
 setCopilotMessages([
 { role: 'user', content: textToSend },
 { role: 'assistant', content: "Sure, I'll book a cab for you. Working on it...", workflowId }
 ]);
 setTimeout(() => copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 return;
 }

 if (detectCalendarMeetingIntent(textToSend)) {
 const conversationId = `conv-${Date.now()}`;
 setCopilotMessages([{ role: 'user', content: textToSend }]);
 
 let attendees = 'Team';
 const match = textToSend.match(/with\s+([a-zA-Z\s]+)(?:for|next|tomorrow|$)/i);
 if (match) attendees = match[1].trim();

 const workflowId = await triggerCalendarMeeting(conversationId, {
 rawText: textToSend,
 attendees,
 });

 setCopilotMessages([
 { role: 'user', content: textToSend },
 { role: 'assistant', content: `I'll help you schedule a meeting with ${attendees}. Checking calendars...`, workflowId }
 ]);
 setTimeout(() => copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 return;
 }

 if (detectWeatherIntent(textToSend)) {
 const conversationId = `conv-${Date.now()}`;
 setCopilotMessages([{ role: 'user', content: textToSend }]);
 
 const workflowId = await triggerWeatherWorkflow(conversationId, {
 location: textToSend,
 });

 setCopilotMessages([
 { role: 'user', content: textToSend },
 { role: 'assistant', content: `Checking the live weather for you...`, workflowId }
 ]);
 setTimeout(() => copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 return;
 }

 if (detectFoodOrderingIntent(textToSend)) {
 const conversationId = `conv-${Date.now()}`;
 setCopilotMessages([{ role: 'user', content: textToSend }]);
 
 let foodItem = 'food';
 if (textToSend.toLowerCase().includes('pizza')) foodItem = 'Pizza';
 else if (textToSend.toLowerCase().includes('burger')) foodItem = 'Burger';
 else if (textToSend.toLowerCase().includes('sushi')) foodItem = 'Sushi';

 const workflowId = await triggerFoodOrdering(conversationId, {
 rawText: textToSend,
 foodItem,
 });

 setCopilotMessages([
 { role: 'user', content: textToSend },
 { role: 'assistant', content: `I'll help you order some ${foodItem.toLowerCase()}. Looking for the best places nearby...`, workflowId }
 ]);
 setTimeout(() => copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 return;
 }

 if (detectFlightDepartureIntent(textToSend)) {
 const conversationId = `conv-${Date.now()}`;
 setCopilotMessages([{ role: 'user', content: textToSend }]);
 
 const workflowId = await triggerFlightBooking(conversationId, {
 rawText: textToSend,
 });

 setCopilotMessages([
 { role: 'user', content: textToSend },
 { role: 'assistant', content: `I'll make sure you catch your flight. Let me coordinate everything for you...`, workflowId }
 ]);
 setTimeout(() => copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 return;
 }

 if (detectEnterpriseApprovalIntent(textToSend)) {
 const conversationId = `conv-${Date.now()}`;
 setCopilotMessages([{ role: 'user', content: textToSend }]);
 
 const workflowId = await triggerEnterpriseApproval(conversationId, {
 rawText: textToSend,
 });

 setCopilotMessages([
 { role: 'user', content: textToSend },
 { role: 'assistant', content: `I'll help you request access. Checking IAM policies...`, workflowId }
 ]);
 setTimeout(() => copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 return;
 }

 setCopilotLoading(true);
 
 try {
 const context = selectedRoom ? `The user is currently in a chat named "${selectedRoom.name}". ` : '';
 const conversationHistory = copilotMessages.map(m => `${m.role === 'user' ? 'User' : 'CHATR AI'}: ${m.content}`).join('\n');
 const prompt = `${context}You are CHATR AI, an AI assistant embedded in the CHATR enterprise messaging platform. Help the user with their question concisely and professionally.\n\n${conversationHistory}\nUser: ${textToSend}\nCHATR AI:`;
 const reply = await generate({ prompt, preferLocal: true });
 setCopilotMessages(prev => [...prev, { role: 'assistant', content: reply }]);
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Local AI is unavailable.';
 setCopilotMessages(prev => [...prev, { role: 'assistant', content: message }]);
 } finally {
 setCopilotLoading(false);
 setTimeout(() => copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 }
 }, [copilotInput, copilotLoading, copilotMessages, selectedRoom]);

 const handleRewrite = async () => {
 if (!messageInput.trim()) return;
 setIsRewriting(true);
 try {
 const prompt = `Rewrite the following message to be more professional, clear, and concise. Only output the rewritten text without any quotes or preamble.\n\nOriginal: ${messageInput}`;
 const rewritten = await generate({ prompt, preferLocal: true });
 setMessageInput(rewritten.trim());
 toast.success('Message rewritten by AI');
 } catch (e) {
 toast.error('Failed to rewrite message');
 } finally {
 setIsRewriting(false);
 }
 };

 const handleSendMessage = useCallback(async () => {
 if ((!messageInput.trim() && attachments.length === 0) || !selectedId || !messagingService) return;
 
 const content = messageInput.trim();
 const currentAttachments = [...attachments];
 setMessageInput('');
 setAttachments([]);

 // 1. If it's explicitly directed at CHATR AI via inline @chatr or we are in the CHATR AI room
 const isAiRoom = selectedRoom?.name === 'CHATR AI';
 if (isAiRoom || content.toLowerCase().startsWith('@chatr ') || (currentAttachments.length > 0 && content.toLowerCase().includes('@chatr'))) {
 const question = isAiRoom ? content : content.replace(/@chatr/i, '').trim();
 
 // Optimistically show the user's message
 const tempUserMsg: Message = {
 id: crypto.randomUUID(),
 senderId: 'local-user',
 senderName: 'You',
 roomId: selectedId,
 content: content || `[Attached ${currentAttachments.length} file(s)]`,
 timestamp: new Date().toISOString(),
 };
 setMessages(prev => [...prev, tempUserMsg]);
 setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

 // Trigger the Document Understanding Workflow directly in the chat if there are attachments
 if (currentAttachments.length > 0) {
 triggerDocumentUnderstanding(currentAttachments, question);
 } else {
 // Normal text-based @chatr response
 const recentMessages = messages.slice(-10).map(m => `${m.senderName || 'User'}: ${m.content}`).join('\n');
 const prompt = `You are CHATR AI, an AI assistant embedded in this conversation. Answer the following question concisely based on recent context:\n\nRecent messages:\n${recentMessages}\n\nQuestion: ${question}\nCHATR AI:`;
 try {
 const reply = await generate({ prompt, preferLocal: true });
 const aiMsg = await messagingService.sendAiMessage(selectedId, reply);
 if (aiMsg) {
 setMessages(prev => [...prev, aiMsg]);
 setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 }
 } catch {
 const errAiMsg = await messagingService.sendAiMessage(selectedId, 'I could not generate a response right now.');
 if (errAiMsg) {
 setMessages(prev => [...prev, errAiMsg]);
 setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 }
 }
 }
 return; // Stop here, we don't send the raw message to the human room if it's meant for @chatr
 }

 // 2. Otherwise, send as a normal human-to-human message
 intentObserver.observe(content);
 intentObserver.triggerBackendObservation(content);
 chatrOS.observeText(content); // Feed into Intelligence Panel

 // Convert File objects to metadata for the mock messaging service
 const uploadedMetadata = currentAttachments.map(f => ({
 id: crypto.randomUUID(),
 name: f.name,
 size: f.size,
 url: URL.createObjectURL(f),
 type: f.type
 }));

 // If they only attached files with no text, provide a default text
 const finalContent = content || `Shared ${currentAttachments.length} file(s)`;
 const sentMsg = await messagingService.sendMessage(selectedId, finalContent, uploadedMetadata);
 
 if (!sentMsg) {
 toast.error('Failed to send message');
 return;
 }

 // Optimistically update the UI
 setMessages(prev => {
 if (prev.some(m => m.id === sentMsg.id)) return prev;
 return [...prev, sentMsg];
 });
 setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
 }, [messageInput, attachments, selectedId, messagingService, messages]);

 const handleSendThreadReply = async () => {
 if (!threadInput.trim() || !selectedId || !activeThreadId || !messagingService) return;
 const content = threadInput.trim();
 setThreadInput('');

 intentObserver.observe(content);
 
 const sentMsg = await messagingService.sendMessage(selectedId, content, [], activeThreadId);
 if (!sentMsg) {
 toast.error('Failed to send thread reply');
 return;
 }

 setMessages(prev => {
 if (prev.some(m => m.id === sentMsg.id)) return prev;
 return [...prev, sentMsg];
 });
 };

 const handleInputKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter') handleSendMessage();
 else if (typingChannelRef.current && currentUserId) {
 typingChannelRef.current.send({
 type: 'broadcast',
 event: 'typing',
 payload: { userId: currentUserId }
 });
 }
 };


 // New DM search
 const searchDmUsers = useCallback(async (q: string) => {
 if (!q.trim()) { setDmSearchResults([]); return; }
 setDmSearchLoading(true);
 const { data } = await supabase
 .from('profiles')
 .select('id, username, full_name, avatar_url')
 .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
 .limit(8);
 setDmSearchResults(data || []);
 setDmSearchLoading(false);
 }, []);

 useEffect(() => {
 const t = setTimeout(() => searchDmUsers(dmSearchQuery), 300);
 return () => clearTimeout(t);
 }, [dmSearchQuery, searchDmUsers]);

 const openDmWithUser = useCallback(async (profile: any) => {
 try {
 const { data: convId, error } = await supabase
 .rpc('create_direct_conversation', { other_user_id: profile.id });
 if (error) throw error;
 setShowNewDmModal(false);
 setDmSearchQuery('');
 // Reload rooms so it appears, then select it
 messagingService?.getRooms().then((r: Room[]) => {
 setRooms(r);
 setSelectedId(convId);
 });
 } catch {
 toast.error('Could not open conversation.');
 }
 }, [messagingService]);


 return (
 <div className={cn("flex h-full font-sans", isDark ? "bg-[#0a0a12] text-white" : "bg-white text-zinc-950")}>
 {/* Hidden File Input Picker (always mounted) */}
 <input 
 type="file" 
 ref={fileInputRef} 
 onChange={handleFileChange} 
 className="hidden" 
 />


 {/* ── NEW DM MODAL ──────────────────────────────────────── */}
 {showNewDmModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
 <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
 <div className="flex items-center justify-between p-4 border-b border-white/10">
 <h2 className="text-secondary font-bold text-white">New Direct Message</h2>
 <button onClick={() => { setShowNewDmModal(false); setDmSearchQuery(''); setDmSearchResults([]); }} className="p-1 rounded-md hover:bg-white/10 text-white/50">
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className="p-4 space-y-3">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
 <input
 autoFocus
 value={dmSearchQuery}
 onChange={e => setDmSearchQuery(e.target.value)}
 placeholder="Search by name or @username..."
 className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-secondary text-white placeholder-white/30 outline-none focus:border-violet-500/60"
 />
 </div>
 <ScrollArea className="max-h-64">
 {dmSearchResults.map(p => (
 <button key={p.id} onClick={() => openDmWithUser(p)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 text-left">
 <Avatar className="h-9 w-9 shrink-0">
 <AvatarImage src={p.avatar_url} />
 <AvatarFallback className="bg-violet-600/30 text-violet-300 text-label">{(p.full_name || p.username || '?')[0].toUpperCase()}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <p className="text-secondary font-medium text-white truncate">{p.full_name || p.username}</p>
 <p className="text-label text-white/40 truncate">@{p.username}</p>
 </div>
 </button>
 ))}
 {dmSearchQuery.trim() && dmSearchResults.length === 0 && !dmSearchLoading && (
 <p className="text-center text-secondary text-white/30 py-4">No users found</p>
 )}
 </ScrollArea>
 </div>
 </div>
 </div>
 )}

 {/* ── LEFT PANE: Channels & DMs ────────────────────────────────────── */}
 <div className="w-72 shrink-0 border-r border-white/[0.06] bg-[#0b0b14] flex flex-col relative z-20">
 
 {/* Header */}
 <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
 <h2 className="text-secondary font-bold text-white/90">Messages</h2>
 <div className="flex gap-1">
 <button className="w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-white/50 transition-colors">
 <Search className="w-4 h-4" />
 </button>
 <button onClick={() => setShowNewDmModal(true)} title="New Direct Message" className="w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-violet-300 transition-colors">
 <UserPlus className="w-4 h-4" />
 </button>
 <button onClick={() => setShowCreateModal(true)} className="w-7 h-7 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 flex items-center justify-center transition-colors">
 <Plus className="w-4 h-4" />
 </button>
 </div>
 </div>

 <ScrollArea className="flex-1">
 <div className="p-2 space-y-4 pb-4">
 {/* Favorites */}
 <div className="mb-4">
 <div className="flex items-center justify-between px-2 mb-1 group cursor-pointer">
 <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest group-hover:text-white/50 transition-colors">Favorites</span>
 <ChevronDown className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
 </div>
 <div className="space-y-0.5">
 <button onClick={() => {
 const aiRoom = rooms.find(r => r.name === 'AI Assistant');
 if (aiRoom) setSelectedId(aiRoom.id);
 }} className={cn(
 'w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors group',
 selectedRoom?.name === 'AI Assistant' ? 'bg-violet-600/20 text-violet-300' : 'hover:bg-white/[0.04] text-white/70 hover:text-white/90'
 )}>
 <div className="flex items-center gap-2 overflow-hidden">
 <BrainCircuit className="w-3.5 h-3.5 shrink-0 text-violet-400" />
 <span className="text-[13px] truncate font-medium">CHATR AI</span>
 </div>
 </button>

 </div>
 </div>


 {/* Channels */}
 <div>
 <div className="flex items-center justify-between px-2 mb-1 group cursor-pointer">
 <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest group-hover:text-white/50 transition-colors">Workspace Channels</span>
 <ChevronDown className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
 </div>
 <div className="space-y-0.5">
 {isLoadingRooms ? (
 <div className="px-2 py-2 text-label text-white/30 animate-pulse">Loading…</div>
 ) : channels.length === 0 ? (
 <div className="px-2 py-2 text-label text-white/30">No channels yet</div>
 ) : channels.map(c => (
 <button key={c.id} onClick={() => setSelectedId(c.id)} className={cn(
 'w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors group',
 selectedId === c.id ? 'bg-violet-600/20 text-violet-300' : 'hover:bg-white/[0.04] text-white/70 hover:text-white/90',
 c.isMuted && 'opacity-50'
 )}>
 <div className="flex items-center gap-2 overflow-hidden">
 {c.isPrivate ? <Lock className="w-3.5 h-3.5 shrink-0 opacity-50" /> : <Hash className="w-3.5 h-3.5 shrink-0 opacity-50" />}
 <span className={cn("text-[13px] truncate", c.unreadCount > 0 && selectedId !== c.id && "font-bold text-white")}>{c.name}</span>
 </div>
 {c.unreadCount > 0 && (
 <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", selectedId === c.id ? "bg-violet-500/30 text-violet-200" : "bg-white/10 text-white")}>
 {c.unreadCount}
 </span>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* People */}
 <div className="mt-4">
 <div className="flex items-center justify-between px-2 mb-1 group cursor-pointer">
 <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest group-hover:text-white/50 transition-colors">People</span>
 <Plus className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
 </div>
 <div className="space-y-0.5">
 {dms.filter(dm => dm.name !== 'AI Assistant').length === 0 ? (
 <div className="px-2 py-2 text-label text-white/30">No direct messages yet</div>
 ) : dms.filter(dm => dm.name !== 'AI Assistant').map(dm => (
 <button key={dm.id} onClick={() => setSelectedId(dm.id)} className={cn(
 'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors text-left group relative',
 selectedId === dm.id ? 'bg-violet-600/20' : 'hover:bg-white/[0.04]'
 )}>
 <div className="relative shrink-0">
 {dm.avatarUrl ? (
 <img src={dm.avatarUrl} alt={dm.name} className="w-6 h-6 rounded-[6px] object-cover" />
 ) : (
 <div className={cn("w-6 h-6 rounded-[6px] bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white")}>
 {dm.name.slice(0, 2).toUpperCase()}
 </div>
 )}
 <div className="absolute -bottom-0.5 -right-0.5 border-2 border-[#0b0b14] rounded-full">
 <PresenceDot status={(dm.otherUserPresence || 'offline') as any} />
 </div>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <span className={cn("text-[13px] truncate", selectedId === dm.id ? "font-semibold text-violet-300" : dm.unreadCount > 0 ? "font-semibold text-white" : "text-white/80")}>
 {dm.name}
 </span>
 {dm.unreadCount > 0 && (
 <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
 {dm.unreadCount}
 </span>
 )}
 </div>
 </div>
 </button>
 ))}
 </div>
 </div>

 </div>
 </ScrollArea>
 </div>

 {/* ── CENTER PANE: Chat View ───────────────────────────────────────── */}
 <div className="flex-1 flex flex-col min-w-0 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
 <div className="absolute inset-0 bg-zinc-950/95" /> {/* Overlay for dark mode text readability */}
 
 {!selectedRoom ? (
 <div className="flex-1 flex flex-col relative z-10 p-8 overflow-y-auto">
 <div className="max-w-5xl mx-auto w-full">
 <div className="flex items-center gap-4 mb-8">
 <div className="w-16 h-16 rounded-[20px] bg-gradient-to-tr from-violet-600 to-indigo-500 p-0.5 shadow-2xl shadow-violet-500/20">
 <div className="w-full h-full bg-[#0b0b14] rounded-[18px] flex items-center justify-center">
 <Sparkles className="w-6 h-6 text-violet-400" />
 </div>
 </div>
 <div>
 <h2 className="text-page font-bold text-white mb-1">Welcome back.</h2>
 <p className="text-white/50 text-secondary">Here's your intelligent workspace overview for today.</p>
 </div>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
 <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group text-left">
 <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
 <Plus className="w-5 h-5" />
 </div>
 <div>
 <span className="text-secondary font-bold text-white/90 block mb-0.5">Create Channel</span>
 <span className="text-label text-white/50">Start a new project space</span>
 </div>
 </button>
 <button onClick={() => navigate('/desktop/intelligence')} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group text-left">
 <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
 <Zap className="w-5 h-5" />
 </div>
 <div>
 <span className="text-secondary font-bold text-white/90 block mb-0.5">AI Insights</span>
 <span className="text-label text-white/50">View network intelligence</span>
 </div>
 </button>
 <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group text-left">
 <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
 <MessageSquare className="w-5 h-5" />
 </div>
 <div>
 <span className="text-secondary font-bold text-white/90 block mb-0.5">New Direct Message</span>
 <span className="text-label text-white/50">Chat with a coworker</span>
 </div>
 </button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 {/* Activity Feed */}
 <div className="bg-zinc-900/50 border border-white/[0.04] rounded-2xl p-6">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-secondary font-bold text-white/90 uppercase tracking-wider">Live Activity</h3>
 <button className="text-button text-violet-400 hover:text-violet-300">View All</button>
 </div>
 <div className="space-y-4">
 {[
 { icon: <FileText className="w-4 h-4 text-blue-400" />, title: 'Quotation_v2.pdf uploaded', desc: 'Sanobar shared a file in #sales', time: '10m ago' },
 { icon: <CheckCheck className="w-4 h-4 text-emerald-400" />, title: 'Action Item Completed', desc: 'You resolved "Update pricing model"', time: '1h ago' },
 { icon: <Video className="w-4 h-4 text-orange-400" />, title: 'Sync Call Scheduled', desc: 'Marketing team sync starts in 30m', time: 'Just now' }
 ].map((act, i) => (
 <div key={i} className="flex gap-4 items-start group">
 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mt-0.5 shrink-0 group-hover:bg-white/10 transition-colors">
 {act.icon}
 </div>
 <div className="flex-1">
 <p className="text-secondary font-medium text-white/90">{act.title}</p>
 <p className="text-label text-white/50">{act.desc}</p>
 </div>
 <span className="text-[10px] text-white/30">{act.time}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Extracted Context */}
 <div className="bg-zinc-900/50 border border-white/[0.04] rounded-2xl p-6">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-secondary font-bold text-white/90 uppercase tracking-wider">AI Priority Context</h3>
 <Sparkles className="w-4 h-4 text-violet-400" />
 </div>
 <div className="space-y-3">
 <div className="p-4 rounded-xl bg-violet-600/10 border border-violet-500/20">
 <p className="text-secondary text-white/90 font-medium mb-1">Awaiting your approval on Q3 Marketing Budget.</p>
 <p className="text-label text-white/50">Requested by Sanobar in #marketing 2 hours ago.</p>
 <div className="flex gap-2 mt-3">
 <button className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-button font-bold transition-colors">Approve</button>
 <button className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-button transition-colors">Review Thread</button>
 </div>
 </div>
 <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
 <p className="text-secondary text-white/90 font-medium mb-1">Unread mention in #engineering.</p>
 <p className="text-label text-white/50">"Could you take a look at the deployment logs?"</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 ) : (
 <>
 {/* Header */}
 <div className="h-14 shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-5 relative z-10">
 <div className="flex items-center gap-3">
 <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-label font-bold text-white shadow-lg", 
 selectedRoom.name === 'AI Assistant' ? 'bg-violet-600' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
 )}>
 {selectedRoom.name === 'AI Assistant' ? <BrainCircuit className="w-4 h-4 text-white" /> : (selectedRoom.name?.slice(0, 2).toUpperCase() || '??')}
 </div>
 <div>
 <h2 className="text-secondary font-bold text-white/90 flex items-center gap-2">
 {selectedRoom.name}
 </h2>
 <div className="flex items-center gap-1.5 mt-0.5">
 {selectedRoom.type === 'dm' && selectedRoom.name !== 'AI Assistant' ? (
 <>
 <div className="relative w-2 h-2 rounded-full mt-0.5">
 <PresenceDot status={(selectedRoom.otherUserPresence || 'offline') as any} />
 </div>
 <p className="text-[10px] text-white/60 capitalize font-medium">
 {selectedRoom.otherUserPresence || 'offline'}
 </p>
 </>
 ) : (
 <p className="text-[10px] text-white/40">{selectedRoom.type === 'channel' ? 'Workspace Channel' : 'Direct Message'}</p>
 )}
 </div>
 </div>
 </div>
 <div className="flex items-center gap-1">
 {selectedRoom?.type === 'dm' && peerUsername && (
 <>
 <button
 title="Voice Call"
 onClick={() => startCall(peerUsername, false)}
 className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400 transition-colors"
 >
 <Phone className="w-4 h-4" />
 </button>
 <button
 title="Video Call"
 onClick={() => startCall(peerUsername, true)}
 className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-violet-500/20 text-white/50 hover:text-violet-400 transition-colors"
 >
 <Video className="w-4 h-4" />
 </button>
 </>
 )}
 <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors">
 <Search className="w-4 h-4" />
 </button>
 <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors">
 <Pin className="w-4 h-4" />
 </button>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors outline-none">
 <MoreVertical className="w-4 h-4" />
 </button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="bg-[#111] border-white/10 text-white w-56 p-1.5 shadow-2xl rounded-xl">
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label ">
 <Search className="w-4 h-4 mr-2.5 text-white/50" /> Search in chat
 </DropdownMenuItem>
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label ">
 <FileText className="w-4 h-4 mr-2.5 text-white/50" /> Summarize chat
 </DropdownMenuItem>
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label ">
 <MessageSquare className="w-4 h-4 mr-2.5 text-white/50" /> Smart replies
 </DropdownMenuItem>
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label ">
 <BrainCircuit className="w-4 h-4 mr-2.5 text-white/50" /> Analyze conversation
 </DropdownMenuItem>
 <DropdownMenuSeparator className="bg-white/10 my-1.5" />
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label ">
 <UserPlus className="w-4 h-4 mr-2.5 text-white/50" /> Add participant
 </DropdownMenuItem>
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label ">
 <User className="w-4 h-4 mr-2.5 text-white/50" /> Contact info
 </DropdownMenuItem>
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label ">
 <ListChecks className="w-4 h-4 mr-2.5 text-white/50" /> Select Messages
 </DropdownMenuItem>
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label ">
 <Zap className="w-4 h-4 mr-2.5 text-white/50" /> Disappearing Messages
 </DropdownMenuItem>
 <DropdownMenuItem className="hover:bg-white/10 focus:bg-white/10 cursor-pointer py-2.5 rounded-lg text-label text-violet-300 focus:text-violet-200">
 <Sparkles className="w-4 h-4 mr-2.5 text-violet-400" /> AI features
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>

 {/* Messages */}
 <ScrollArea className="flex-1 relative z-10">
 <div className="p-5 space-y-6">

 {chatMessages.map((msg) => {
 const isOwn = msg.senderId === currentUserId;
 const dateObj = new Date(msg.createdAt);
 const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 const displayTime = isToday(dateObj) ? time : (isYesterday(dateObj) ? `Yesterday ${time}` : `${dateObj.toLocaleDateString()} ${time}`);
 
 // Map AI system messages to proper UI
 const isAI = msg.senderId === '11111111-1111-1111-1111-111111111111' || msg.actorId === '11111111-1111-1111-1111-111111111111';
 const avatar = isAI ? 'AI' : (msg.senderName ? msg.senderName.substring(0, 2).toUpperCase() : 'U');
 const senderName = isAI ? 'CHATR AI' : (msg.senderName || 'Unknown User');

 if (msg.metadata?.isAction && msg.metadata?.actionType) {
 return (
 <div key={msg.id} className={cn("my-4 animate-in fade-in slide-in-from-bottom-2 flex", isOwn ? "justify-end" : "justify-start")}>
 <div className="max-w-[80%]">
 <AgentActionCard
 action={{
 id: msg.id,
 type: msg.metadata.actionType as any,
 title: msg.metadata.actionTitle || 'Action Completed',
 description: msg.metadata.actionDescription || msg.content,
 status: msg.metadata.status || 'completed',
 createdAt: msg.createdAt,
 data: msg.metadata.actionData || {}
 }}
 onConfirm={async () => {}}
 onCancel={() => {}}
 />
 </div>
 </div>
 );
 }

 // Render premium completion receipt card
 if (msg.type === 'os_completion_receipt') {
 let receipt: any = {};
 try { receipt = JSON.parse(msg.content); } catch { receipt = { title: msg.content }; }
 const capabilityIcons: Record<string, string> = {
 REMINDER: '🔔', TASK: '✅', NOTE: '📝', CHECKLIST: '☑️', FOLLOW_UP: '🔄',
 CALL: '📞', EMAIL: '✉️', CONTACT: '👤', CALENDAR_EVENT: '📅',
 DOCUMENT: '📄', CANDIDATE_INTERVIEW: '👔', EXPENSE: '💵', MEETING: '📅'
 };
 const icon = capabilityIcons[receipt.type || ''] || '✅';
 return (
 <div key={msg.id} className="my-3 flex justify-start animate-in fade-in slide-in-from-bottom-2">
 <div className="max-w-[70%] bg-gradient-to-br from-emerald-950/80 to-zinc-900/80 border border-emerald-500/30 rounded-2xl p-3 shadow-lg shadow-emerald-900/20">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-section">{icon}</span>
 <div>
 <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-widest">Reality Verified</p>
 <p className="text-label font-semibold text-white/90">{receipt.title}</p>
 </div>
 </div>
 {receipt.transactionId && (
 <p className="text-[9px] text-white/30 font-mono mt-1">TXN: {receipt.transactionId}</p>
 )}
 </div>
 </div>
 );
 }

 return (
 <div key={msg.id} className={cn("flex gap-3 group relative animate-in fade-in slide-in-from-bottom-2", isOwn ? "flex-row-reverse" : "flex-row")}>
 
 {/* Avatar (only for others) */}
 {!isOwn && (
 <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-1",
 isAI ? 'bg-violet-600' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
 )}>
 {isAI ? <BrainCircuit className="w-4 h-4" /> : (msg.senderAvatar ? <img src={msg.senderAvatar} className="w-full h-full rounded-[8px] object-cover" /> : avatar)}
 </div>
 )}

 <div className={cn("flex flex-col max-w-[70%]", isOwn ? "items-end" : "items-start")}>
 
 {/* Sender Name & Time */}
 {!isOwn && (
 <div className="flex items-baseline gap-2 mb-1 pl-1">
 <span className={cn("text-label font-bold", isAI ? 'text-violet-400' : 'text-white/90')}>{senderName}</span>
 <span className="text-[10px] text-white/30">{displayTime}</span>
 </div>
 )}

 {/* Message Bubble */}
 <div className="relative group/bubble">
 <div className={cn(
 "px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm relative whitespace-pre-wrap flex flex-col gap-1 transition-all",
 isOwn 
 ? "bg-violet-600 text-white rounded-tr-sm min-w-[80px]" 
 : isAI 
 ? "bg-violet-500/10 border border-violet-500/20 text-white/90 rounded-tl-sm shadow-black/20"
 : "bg-zinc-900 border border-white/[0.05] text-white/90 rounded-tl-sm shadow-black/20"
 )}>
 {/* Render Attachments */}
 {msg.attachments && msg.attachments.length > 0 && (
 <div className="flex flex-col gap-2 mb-1">
 {msg.attachments.map((att: any, i: number) => {
 const isImage = att.mimeType?.startsWith('image/');
 if (isImage) {
 return (
 <div key={i} className="relative rounded-lg overflow-hidden border border-white/10 group/img">
 <img src={att.url} alt={att.name || 'Attachment'} className="w-full max-w-[240px] max-h-[240px] object-cover" />
 <button onClick={() => setFullscreenImage(att.url)} className="absolute inset-0 w-full h-full bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-label font-semibold backdrop-blur-sm">View Full</button>
 </div>
 );
 }
 return (
 <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 p-2 rounded-lg border transition-colors shadow-sm w-full max-w-[240px]", isOwn ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-white/5 border-white/10 hover:bg-white/10")}>
 <div className={cn("p-1.5 rounded-md", isOwn ? "bg-white/20" : "bg-white/10")}>
 <FileText className="w-4 h-4" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-semibold truncate">{att.name || 'Document'}</p>
 {att.sizeBytes && <p className="text-[9px] opacity-70">{(att.sizeBytes / 1024).toFixed(1)} KB</p>}
 </div>
 <Download className="w-3.5 h-3.5 opacity-50" />
 </a>
 );
 })}
 </div>
 )}

 {/* Render Content */}
 {msg.content && <div>{msg.content}</div>}

 {isOwn && (
 <div className="flex items-center justify-end gap-1 text-[9px] text-white/70 select-none self-end mt-0.5">
 <span>{displayTime}</span>
 <CheckCheck className="w-3 h-3 text-blue-300" />
 </div>
 )}
 </div>
 
 {/* Hover Actions */}
 <div className={cn(
 "absolute top-0 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl p-1 z-10",
 isOwn ? "-left-4 -translate-x-full" : "-right-4 translate-x-full"
 )}>
 <button onClick={() => toast.success('Reacted with 😂')} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="React">
 <Smile className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => { setActiveThreadId(msg.id); setRightPaneTab('copilot'); toast.info('Opened thread'); }} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="Reply">
 <Reply className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => setForwardMessage(msg)} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="Forward">
 <Forward className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => { setRightPaneTab('copilot'); setCopilotInput(`Explain this message: "${msg.content}"`); }} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="Ask AI">
 <Sparkles className="w-3.5 h-3.5 text-violet-400 hover:text-violet-300" />
 </button>
 <button onClick={() => toast.info('More options coming soon')} className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors group/btn relative" title="More">
 <MoreVertical className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 </div>
 </div>
 );
 })}
 {isUploading && (
 <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 mt-2">
 <div className="px-3 py-2 rounded-2xl bg-zinc-900 border border-white/[0.05] rounded-tr-sm shadow-black/20 text-label text-amber-400 animate-pulse">
 Uploading file attachment...
 </div>
 </div>
 )}
 {isAiLoading && (
 <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 mt-2">
 <div className="px-3 py-2 rounded-2xl bg-zinc-900 border border-white/[0.05] rounded-tl-sm shadow-black/20 text-label text-violet-400 flex items-center gap-2">
 <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI Coworker processing...
 </div>
 </div>
 )}
 {Object.keys(typingUsers).length > 0 && (
 <div className="flex gap-3 items-end animate-in fade-in slide-in-from-bottom-2 mt-4">
 <div className="w-8 h-8 rounded-[8px] bg-white/5 flex items-center justify-center shrink-0">
 <MessageSquare className="w-3.5 h-3.5 text-white/40" />
 </div>
 <div className="flex flex-col items-start">
 <div className="px-4 py-3 rounded-2xl bg-zinc-900 border border-white/[0.05] rounded-tl-sm shadow-black/20">
 <TypingIndicator />
 </div>
 </div>
 </div>
 )}
 <div ref={messagesEndRef} />
 </div>
 </ScrollArea>

 {/* Smart Composer Area */}
 <div className="p-4 pr-24 bg-zinc-950/80 backdrop-blur-xl border-t border-white/[0.06] relative z-20 shrink-0">
 <div className="max-w-4xl mx-auto relative group flex flex-col gap-2 bg-zinc-900 border border-white/[0.08] rounded-2xl p-2 focus-within:border-violet-500/50 shadow-inner">
 
 <div className="flex items-center">
 <div className="pl-2 pr-1">
 <Popover>
 <PopoverTrigger asChild>
 <button className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 transition-colors outline-none focus:ring-1 focus:ring-violet-500/50">
 <Plus className="w-4 h-4" />
 </button>
 </PopoverTrigger>
 <PopoverContent align="start" side="top" className="bg-[#111] border border-white/10 p-2 w-48 shadow-2xl rounded-2xl mb-2">
 <div className="flex flex-col gap-1">
 <button onClick={() => toast.info('Camera coming soon')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <Camera className="w-4 h-4 text-pink-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Camera</p>
 <p className="text-[9px] text-white/40">Take a photo</p>
 </div>
 </button>
 <button onClick={() => triggerFilePicker('image/*')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <ImageIcon className="w-4 h-4 text-purple-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Gallery</p>
 <p className="text-[9px] text-white/40">Choose from gallery</p>
 </div>
 </button>
 <button onClick={() => triggerFilePicker('.pdf,.doc,.docx,.xls,.xlsx,.txt')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <FileText className="w-4 h-4 text-blue-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Document</p>
 <p className="text-[9px] text-white/40">Share a file</p>
 </div>
 </button>
 <button onClick={() => { toast.info('Location coming soon') }} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <MapPin className="w-4 h-4 text-emerald-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Location</p>
 <p className="text-[9px] text-white/40">Share your location</p>
 </div>
 </button>
 <button onClick={() => { toast.info('Contact coming soon') }} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <User className="w-4 h-4 text-orange-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Contact</p>
 <p className="text-[9px] text-white/40">Share a contact</p>
 </div>
 </button>
 </div>
 </PopoverContent>
 </Popover>
 </div>
 
 <div className="absolute bottom-full left-0 w-full mb-2 z-50 flex flex-col justify-end gap-2">
 {outcomes.filter(o => ['suggested', 'extracting', 'needs_input', 'searching', 'results_ready', 'preview_ready'].includes(o.status)).map(o => (
 <OutcomeCard key={o.id} outcome={o} />
 ))}
 {attachments.length > 0 && (
 <div className="flex gap-2 overflow-x-auto px-2 pb-1">
 {attachments.map((file, idx) => (
 <div key={idx} className="relative group bg-white/10 border border-white/20 rounded-lg p-2 flex items-center gap-2 pr-6 shrink-0 backdrop-blur-md">
 <FileText className="w-4 h-4 text-violet-300" />
 <div className="flex flex-col max-w-[120px]">
 <span className="text-label text-white truncate ">{file.name}</span>
 <span className="text-[10px] text-white/50">{(file.size / 1024).toFixed(0)} KB</span>
 </div>
 <button 
 onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
 className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
 >
 <X className="w-3 h-3" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>

 <input 
 value={messageInput}
 onChange={e => setMessageInput(e.target.value)}
 onKeyDown={handleInputKeyDown}
 placeholder={`Message ${selectedRoom.name}... (Type @chatr to ask AI)`}
 className="flex-1 h-10 bg-transparent text-secondary px-2 focus:outline-none placeholder:text-white/30 text-white"
 />
 <div className="pr-1">
 <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 transition-colors">
 <Smile className="w-4 h-4" />
 </button>
 </div>
 </div>

 <div className="flex items-center justify-between px-2 pt-1">
 <div className="flex items-center gap-1">
 <button onClick={() => triggerFilePicker('image/*, .pdf, .doc, .docx, .xls, .xlsx, .txt')} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Attach file">
 <Paperclip className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => toast.info('Voice notes coming soon')} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Voice note">
 <Mic className="w-3.5 h-3.5" />
 </button>
 <div className="w-px h-3 bg-white/10 mx-1" />
 <button onClick={() => toast.info('Rich formatting coming soon')} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Formatting">
 <Type className="w-3.5 h-3.5" />
 </button>
 <Popover>
 <PopoverTrigger asChild>
 <button disabled={!messageInput.trim()} className="p-1.5 rounded-md hover:bg-white/10 text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1.5 disabled:opacity-50 outline-none" title="AI Features">
 <Sparkles className="w-3.5 h-3.5" />
 <span className="text-[10px] font-bold tracking-wider uppercase">CHATR AI</span>
 </button>
 </PopoverTrigger>
 <PopoverContent align="center" side="top" className="bg-[#111] border border-white/10 p-2 w-48 shadow-2xl rounded-2xl mb-2">
 <div className="flex flex-col gap-1">
 <button onClick={() => { handleSmartReply() }} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
 <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Smart Replies</p>
 <p className="text-[9px] text-white/40">Get AI suggestions</p>
 </div>
 </button>
 <button onClick={handleRewrite} disabled={isRewriting || !messageInput.trim()} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
 {isRewriting ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-blue-400" />}
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Rewrite</p>
 <p className="text-[9px] text-white/40">Improve message</p>
 </div>
 </button>
 <button onClick={() => { toast.info('Translate coming soon') }} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
 <Languages className="w-3.5 h-3.5 text-emerald-400" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Translate</p>
 <p className="text-[9px] text-white/40">Auto-translate</p>
 </div>
 </button>
 <button onClick={() => { handleExtractActions() }} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
 <ListChecks className="w-3.5 h-3.5 text-orange-400" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Extract Actions</p>
 <p className="text-[9px] text-white/40">Find tasks & reminders</p>
 </div>
 </button>
 </div>
 </PopoverContent>
 </Popover>
 </div>
 <button onClick={handleSendMessage} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 flex items-center gap-1.5 text-white shadow-lg transition-colors text-button font-bold">
 <span>Send</span>
 <CornerUpRight className="w-3 h-3" />
 </button>
 </div>
 </div>
 </div>
 </>
 )}
 </div>

 {/* ── RIGHT PANE: Copilot / Thread ─────────────────────────────────── */}
 {selectedRoom && (
 <div className="w-80 shrink-0 border-l border-white/[0.06] bg-[#0b0b14] flex flex-col relative z-20">
 
 {/* State 1: Active Thread */}
 {activeThreadId ? (
 <>
 <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/[0.04]">
 <div className="flex items-center gap-2">
 <h3 className="text-secondary font-bold text-white/90">Thread</h3>
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">#{selectedRoom.name}</span>
 </div>
 <button onClick={() => setActiveThreadId(null)} className="p-1.5 rounded-md hover:bg-white/10 text-white/50 transition-colors">
 <X className="w-4 h-4" />
 </button>
 </div>
 
 <ScrollArea className="flex-1">
 <div className="p-4 flex flex-col gap-4">
 {(() => {
 const parentMsg = chatMessages.find(m => m.id === activeThreadId);
 if (!parentMsg) return <div className="text-white/40 text-label text-center py-4">Message not found</div>;
 
 return (
 <div className="flex flex-col gap-4">
 {/* Parent Message */}
 <div className="flex gap-3">
 <div className="w-8 h-8 rounded-[8px] bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
 {parentMsg.senderAvatar ? (
 <img src={parentMsg.senderAvatar} className="w-full h-full object-cover" />
 ) : (
 <span className="text-label font-bold text-white">{parentMsg.senderId === currentUserId ? 'Me' : parentMsg.senderName?.[0]?.toUpperCase() || 'U'}</span>
 )}
 </div>
 <div className="flex-1">
 <div className="flex items-baseline gap-2 mb-1">
 <span className="text-label font-bold text-white/90">{parentMsg.senderId === currentUserId ? 'Me' : parentMsg.senderName}</span>
 <span className="text-[10px] text-white/30">{new Date(parentMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
 </div>
 <p className="text-[13px] text-white/80 leading-relaxed">{parentMsg.content}</p>
 </div>
 </div>

 <div className="flex items-center gap-4">
 <div className="h-px bg-white/[0.06] flex-1" />
 <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Replies</span>
 <div className="h-px bg-white/[0.06] flex-1" />
 </div>

 {/* Real Replies */}
 <div className="flex flex-col gap-4 py-2">
 {chatMessages
 .filter(m => m.replyToId === activeThreadId)
 .map(reply => (
 <div key={reply.id} className="flex gap-3">
 <div className="w-6 h-6 rounded-[6px] bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
 {reply.senderAvatar ? (
 <img src={reply.senderAvatar} className="w-full h-full object-cover" />
 ) : (
 <span className="text-[10px] font-bold text-white">{reply.senderName?.[0]?.toUpperCase() || 'U'}</span>
 )}
 </div>
 <div className="flex-1">
 <div className="flex items-baseline gap-2 mb-0.5">
 <span className="text-[11px] font-bold text-white/90">{reply.senderId === currentUserId ? 'Me' : reply.senderName}</span>
 <span className="text-[9px] text-white/30">{new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
 </div>
 <p className="text-[13px] text-white/90 leading-relaxed break-words whitespace-pre-wrap">{reply.content}</p>
 
 {/* Attachments */}
 {reply.attachments && reply.attachments.length > 0 && (
 <div className="mt-2 flex flex-col gap-2">
 {reply.attachments.map((att, i) => (
 <div key={i} className="rounded-lg overflow-hidden border border-white/[0.05]">
 {att.mimeType?.startsWith('image/') ? (
 <img src={att.url} alt={att.name} className="max-w-full max-h-60 object-cover cursor-pointer" onClick={() => setFullscreenImage(att.url)} />
 ) : (
 <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 transition-colors">
 <FileText className="w-4 h-4 text-blue-400" />
 <span className="text-label text-blue-400 truncate flex-1">{att.name}</span>
 {att.sizeBytes && <span className="text-[10px] text-white/30">{Math.round(att.sizeBytes / 1024)} KB</span>}
 </a>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 ))}
 {chatMessages.filter(m => m.replyToId === activeThreadId).length === 0 && (
 <div className="flex items-center justify-center py-2">
 <span className="text-label text-white/30">No replies yet.</span>
 </div>
 )}
 </div>
 </div>
 );
 })()}
 </div>
 </ScrollArea>
 <div className="p-3 pb-24 border-t border-white/[0.04]">
 <div className="flex gap-2">
 <input
 value={threadInput}
 onChange={e => setThreadInput(e.target.value)}
 placeholder="Reply in thread..."
 className="flex-1 bg-zinc-900 border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
 onKeyDown={e => {
 if (e.key === 'Enter') handleSendThreadReply();
 }}
 />
 <button 
 onClick={handleSendThreadReply}
 className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-colors shrink-0"
 >
 <CornerUpRight className="w-3.5 h-3.5 text-white" />
 </button>
 </div>
 </div>
 </>
 ) : (
 /* State 2: OS Panel */
 <>
 <div className="h-14 shrink-0 flex items-center justify-between px-2 border-b border-white/[0.04]">
 <div className="flex items-center gap-1">
 <button onClick={() => setRightPaneTab('copilot')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'copilot' ? "bg-white/10 text-violet-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Conversation Intelligence"><BrainCircuit className="w-4 h-4" /></button>
 <button onClick={() => setRightPaneTab('outcomes')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'outcomes' ? "bg-white/10 text-emerald-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Outcome Center"><CheckCheck className="w-4 h-4" /></button>
 <button onClick={() => setRightPaneTab('timeline')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'timeline' ? "bg-white/10 text-orange-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Daily Timeline"><Calendar className="w-4 h-4" /></button>
 <button onClick={() => setRightPaneTab('decisions')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'decisions' ? "bg-white/10 text-blue-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Decisions"><Zap className="w-4 h-4" /></button>
 <button onClick={() => setRightPaneTab('notes')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'notes' ? "bg-white/10 text-amber-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Notes"><FileText className="w-4 h-4" /></button>
 <button onClick={() => setRightPaneTab('calendar')} className={cn("p-2 rounded-xl transition-colors", rightPaneTab === 'calendar' ? "bg-white/10 text-cyan-400" : "text-white/40 hover:text-white hover:bg-white/5")} title="Calendar Settings"><Calendar className="w-4 h-4" /></button>
 </div>
 <button 
 onClick={handleExtract}
 disabled={isExtracting}
 className="w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 hover:bg-violet-600/40 transition-colors disabled:opacity-50"
 title="Extract OS Entities from Chat"
 >
 {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
 </button>
 </div>

 {rightPaneTab === 'copilot' && (
 <IntelligencePanel
 onActionClick={(action) => {
 setMessageInput(action);
 // Focus message input
 setTimeout(() => {
 (document.querySelector('[data-message-input]') as HTMLTextAreaElement)?.focus();
 }, 50);
 }}
 />
 )}

 {rightPaneTab === 'outcomes' && (
 <OutcomeCenter outcomes={outcomes} />
 )}

 {rightPaneTab === 'timeline' && (
 <DailyTimeline outcomes={outcomes} />
 )}

 {rightPaneTab === 'calendar' && (
 <CalendarSettings />
 )}
 </>
 )}
 </div>
 )}

 <CreateNewModal 
 isOpen={showCreateModal} 
 onClose={() => setShowCreateModal(false)} 
 onSelect={(id) => {
 setShowCreateModal(false);
 if (id === 'community') navigate('/create-community');
 else navigate('/contacts');
 }}
 />

 {/* Global CSS for animations */}
 <style>{`
 @keyframes bounce {
 0%, 100% { transform: translateY(0); }
 50% { transform: translateY(-3px); }
 }
 `}</style>

 {/* ── Forward Modal ───────────────────────────────────────────────────── */}
 {forwardMessage && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
 <div className="w-full max-w-md bg-[#0f0f13] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
 <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
 <h3 className="font-semibold text-white/90">Forward Message</h3>
 <button onClick={() => { setForwardMessage(null); setForwardSelectedRooms(new Set()); setForwardSearchQuery(''); }} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
 <X className="w-4 h-4 text-white/60" />
 </button>
 </div>
 
 <div className="p-4 bg-black/20 border-b border-white/[0.05]">
 <div className="text-label text-white/50 mb-1 uppercase tracking-wider font-semibold">Original Message</div>
 <div className="text-secondary text-white/80 bg-white/5 p-3 rounded-xl border border-white/10 max-h-24 overflow-y-auto line-clamp-3">
 {forwardMessage.content || (forwardMessage.attachments?.length ? `[${forwardMessage.attachments.length} Attachment${forwardMessage.attachments.length > 1 ? 's' : ''}]` : 'Empty message')}
 </div>
 </div>

 <div className="p-4 border-b border-white/10">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
 <input 
 type="text" 
 value={forwardSearchQuery}
 onChange={(e) => setForwardSearchQuery(e.target.value)}
 placeholder="Search chats to forward to..." 
 className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-secondary text-white focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
 />
 </div>
 </div>
 
 <div className="flex-1 overflow-y-auto p-2">
 {rooms
 .filter(r => r.id !== selectedId && r.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()))
 .map(room => {
 const isSelected = forwardSelectedRooms.has(room.id);
 return (
 <button 
 key={room.id}
 onClick={() => {
 const next = new Set(forwardSelectedRooms);
 if (isSelected) next.delete(room.id);
 else next.add(room.id);
 setForwardSelectedRooms(next);
 }}
 className={cn(
 "w-full flex items-center gap-3 p-2 rounded-xl transition-all text-left mt-1",
 isSelected ? "bg-violet-500/10 border border-violet-500/20" : "hover:bg-white/5 border border-transparent"
 )}
 >
 <div className="relative">
 <img 
 src={room.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${room.name}&backgroundColor=0f0f13,1a1a24`} 
 className="w-10 h-10 rounded-full object-cover border border-white/10" 
 alt={room.name} 
 />
 {isSelected && (
 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-violet-500 rounded-full border-2 border-[#0f0f13] flex items-center justify-center">
 <CheckCheck className="w-3 h-3 text-white" />
 </div>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-secondary font-semibold text-white/90 truncate">{room.name}</div>
 <div className="text-[11px] text-white/40 capitalize">{room.type === 'direct' ? 'Direct Message' : 'Channel'}</div>
 </div>
 </button>
 );
 })}
 {rooms.filter(r => r.id !== selectedId && r.name.toLowerCase().includes(forwardSearchQuery.toLowerCase())).length === 0 && (
 <div className="p-8 text-center text-secondary text-white/40">No chats found.</div>
 )}
 </div>
 
 <div className="p-4 border-t border-white/10 bg-white/[0.02]">
 <button
 disabled={forwardSelectedRooms.size === 0 || isForwarding}
 onClick={executeForward}
 className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-button transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/20"
 >
 {isForwarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Forward className="w-4 h-4" />}
 Forward to {forwardSelectedRooms.size} chat{forwardSelectedRooms.size !== 1 ? 's' : ''}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Fullscreen Image Overlay ────────────────────────────────────────── */}
 {fullscreenImage && (
 <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200" onClick={() => setFullscreenImage(null)}>
 <button onClick={() => setFullscreenImage(null)} className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors text-white z-50">
 <X className="w-5 h-5" />
 </button>
 <img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Fullscreen attachment" onClick={e => e.stopPropagation()} />
 </div>
 )}

 <UniversalSearch />
 </div>
 );
}
