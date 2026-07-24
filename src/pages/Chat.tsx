import * as React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NetworkStatus } from '@/components/NetworkStatus';
import { clearPreCallMediaStream, setPreCallMediaStream } from '@/utils/preCallMedia';
import { useChatContext, ChatProvider } from '@/contexts/ChatContext';
import { useChatPushNotifications } from '@/hooks/useChatPushNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Phone, Video, MoreVertical, User, Users, Search, QrCode, UserX, Radio, Sparkles, Heart, Menu, Send, Share2, Bell, Globe, Zap, Megaphone, Smartphone, Settings, Wifi, WifiOff, Bluetooth, Info, Trash, Star, MessageCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useCall } from '@/contexts/CallContext';
import { toast } from 'sonner';
import { normalizePhoneNumber } from '@/utils/phoneHashUtil';
import { fetchConversationPeerProfile, normalizeConversationProfile } from '@/core/platformParity/sharedConversationHydrator';
import { fetchSharedProfile } from '@/core/platformParity/sharedProfileCache';
import { resolveSharedDisplayName, type SharedIdentityProfile } from '@/core/platformParity/sharedIdentityResolver';
import { VirtualizedConversationList } from '@/components/chat/VirtualizedConversationList';
import { ContactsDrawer } from '@/components/chat/ContactsDrawer';
import { TrueVirtualMessageList } from '@/components/chat/TrueVirtualMessageList';
import { UniversalTimelineList } from '@/components/chat/UniversalTimelineList';
import { VisualIntelligenceScanner } from '@/components/chat/VisualIntelligenceScanner';
import { useUniversalTimeline } from '@/hooks/useUniversalTimeline';
import { WhatsAppStyleInput } from '@/components/chat/WhatsAppStyleInput';
import { MessageForwardDialog } from '@/components/chat/MessageForwardDialog';

import { MessageReportDialog } from '@/components/chat/MessageReportDialog';
import { MessageSearchBar } from '@/components/MessageSearchBar';
import { PinnedMessagesViewer } from '@/components/chat/PinnedMessagesViewer';
import { MessageFilters } from '@/components/chat/MessageFilters';
import { useVirtualizedMessages } from "@/hooks/useVirtualizedMessages";
import { useSocketTyping } from "@/hooks/useSocketTyping";
import { AddParticipantDialog } from '@/components/chat/AddParticipantDialog';
import { GroupSettingsDialog } from '@/components/chat/GroupSettingsDialog';
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { formatPhone } from '@/components/chat/SaveContactSheet';
import { ClusterCreator } from '@/components/chat/ClusterCreator';
import { PulseCreator } from '@/components/chat/PulseCreator';
import { GroupChatCreator } from '@/components/GroupChatCreator';
import { DisappearingMessagesDialog } from '@/components/DisappearingMessagesDialog';
import { BroadcastCreator } from '@/components/BroadcastCreator';
import { VoiceInterface } from '@/components/voice/VoiceInterface';
import { EmotionCircleMatch } from '@/components/EmotionCircleMatch';
import { LiveRooms } from '@/components/LiveRooms';
import { AIMoments } from '@/components/AIMoments';
import { useMoodTracking } from '@/hooks/useMoodTracking';
import { useStreakTracking } from '@/hooks/useStreakTracking';
import logo from '@/assets/chatr-logo.png';
import contactsIcon from '@/assets/contacts-icon.png';
import GlobalSearch from '@/components/GlobalSearch';
import { Badge } from '@/components/ui/badge';
import { AIChatToolbar } from '@/components/chat/AIChatToolbar';
import { AIInsightsPanel } from '@/components/chat/AIInsightsPanel';
import { SmartRepliesPanel } from '@/components/chat/SmartRepliesPanel';
import { useAIChatAssistant } from '@/hooks/useAIChatAssistant';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OfflineChat } from '@/components/OfflineChat';
import { UserInfoSidebar } from '@/components/UserInfoSidebar';
import { UnifiedPermissionsSetup } from '@/components/UnifiedPermissionsSetup';
import { QuickReplyPanel } from '@/components/chat/QuickReplyPanel';
import { DocumentPreviewModal } from '@/components/chat/DocumentPreviewModal';


import { VoicemailList } from '@/components/calls/VoicemailList';
import { BackupRestoreSheet } from '@/components/chat/BackupRestoreSheet';
import { LinkedDevicesSheet } from '@/components/chat/LinkedDevicesSheet';
import { MessageSearchSheet } from '@/components/chat/MessageSearchSheet';
import { FormattedText } from '@/hooks/useMessageFormatting';
import { WALLPAPER_KEY, getWallpaperClass } from '@/utils/wallpaper';
import { UnderstandingLayer } from '@/components/semantic/UnderstandingLayer';
import { useIntentObserver } from '@/hooks/useIntentObserver';

const ChatEnhancedContent = () => {
 const [wallpaperClass, setWallpaperClass] = React.useState('bg-[#F0F0F8]');
 
 React.useEffect(() => {
 const savedWallpaperId = localStorage.getItem(WALLPAPER_KEY) || 'default';
 const wpClass = getWallpaperClass(savedWallpaperId);
 setWallpaperClass(savedWallpaperId === 'default' ? 'bg-[#F0F0F8]' : wpClass);
 
 const handleStorage = (e: StorageEvent) => {
 if (e.key === WALLPAPER_KEY) {
 const newClass = getWallpaperClass(e.newValue || 'default');
 setWallpaperClass(e.newValue === 'default' || !e.newValue ? 'bg-[#F0F0F8]' : newClass);
 }
 };
 
 const handleCustom = () => {
 const id = localStorage.getItem(WALLPAPER_KEY) || 'default';
 const newClass = getWallpaperClass(id);
 setWallpaperClass(id === 'default' ? 'bg-[#F0F0F8]' : newClass);
 };
 
 window.addEventListener('storage', handleStorage);
 window.addEventListener('chatr-wallpaper-changed', handleCustom);
 return () => {
 window.removeEventListener('storage', handleStorage);
 window.removeEventListener('chatr-wallpaper-changed', handleCustom);
 };
 }, []);

 const { user, session, isAuthReady } = useChatContext();
 const { initiateCall } = useCall();
 const navigate = useNavigate();
 const location = useLocation();
 const isNative = Capacitor.isNativePlatform();
 const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>();
 const queryConversationId = React.useMemo(
 () => new URLSearchParams(location.search).get('conversation'),
 [location.search]
 );
 const isLegacyConversationQueryRoute = location.pathname === '/chat' && Boolean(queryConversationId);
 const routeConversationId = urlConversationId || queryConversationId;
 const isStandaloneConversationRoute = location.pathname.startsWith('/standalone-messenger/');
 const [activeConversationId, setActiveConversationId] = React.useState<string | null>(routeConversationId || null);
 const isConversationRoute = Boolean(routeConversationId) || isStandaloneConversationRoute;
 const isNativeConversationRoute = isNative && isConversationRoute;

 // Sync URL param to state when it changes
 React.useEffect(() => {
 if (!routeConversationId) {
 if (!activeConversationId) {
 setOtherUser(null);
 }
 return;
 }

 if (routeConversationId !== activeConversationId) {
 setLoading(true);
 setOtherUser(null);
 setActiveConversationId(routeConversationId);
 }
 }, [routeConversationId, activeConversationId]);

 React.useEffect(() => {
 if (!activeConversationId) return;
 const canonicalRoute = `/chat/${activeConversationId}`;
 const isAlreadyCanonical = location.pathname === canonicalRoute;

 if (!isAlreadyCanonical && (location.pathname === '/chat' || isStandaloneConversationRoute)) {
 navigate(canonicalRoute, { replace: true });
 }
 }, [activeConversationId, isStandaloneConversationRoute, location.pathname, navigate]);
 const [otherUser, setOtherUser] = React.useState<any>(null);
 const [loading, setLoading] = React.useState(true);
 React.useEffect(() => {
 if (!activeConversationId || !user?.id) return;
 let cancelled = false;

 fetchConversationPeerProfile(activeConversationId, user.id)
 .then((peer) => {
 if (!cancelled && peer) {
 setOtherUser(peer);
 }
 })
 .catch((error) => {
 console.warn('[Chat] peer hydration failed', { activeConversationId, error });
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });

 return () => {
 cancelled = true;
 };
 }, [activeConversationId, user?.id]);
 const [showClusterCreator, setShowClusterCreator] = React.useState(false);
 const [showPulseCreator, setShowPulseCreator] = React.useState(false);
 const [showAIFeatures, setShowAIFeatures] = React.useState(false);
 const [showGroupCreator, setShowGroupCreator] = React.useState(false);
 const [showBroadcastCreator, setShowBroadcastCreator] = React.useState(false);
 const [showDisappearingSettings, setShowDisappearingSettings] = React.useState(false);
 const [showGlobalSearch, setShowGlobalSearch] = React.useState(false);
 const [contacts, setContacts] = React.useState<any[]>([]);

 // Call state variables
 const [callActive, setCallActive] = React.useState(false);
 const [callType, setCallType] = React.useState<'voice' | 'video' | null>(null);
 const [callPhase, setCallPhase] = React.useState<'idle'|'ringing'|'active'|'ended'>('idle');
 const [callSeconds, setCallSeconds] = React.useState(0);
 const [isMuted, setIsMuted] = React.useState(false);
 const localStreamRef = React.useRef<MediaStream | null>(null);
 const callTimerRef = React.useRef<NodeJS.Timeout | null>(null);

 const startCall = async (type: 'voice' | 'video', peerOverride?: SharedIdentityProfile | null) => {
 const peer = (peerOverride || otherUser) as SharedIdentityProfile | null;
 try {
 console.log(`📞 [Chat] startCall: type=${type}, partner=${otherUser?.username} (${otherUser?.id})`);
 if (!peer?.id) {
 console.error('❌ [Chat] Cannot start call: otherUser.id is missing');
 toast.error('Contact info not available. Please try refreshing.');
 return;
 }

 const callId = await initiateCall({
 partnerId: peer.id,
 partnerName: resolveSharedDisplayName(peer),
 partnerAvatar: peer.avatar_url,
 partnerPhone: peer.phone_number,
 callType: type,
 conversationId: activeConversationId || undefined
 });

 if (callId) {
 toast.success(`${type === 'video' ? '📹 Video' : '📞 Voice'} call started`);
 
 // Local UI state update
 setCallType(type);
 setCallPhase('ringing');
 setCallSeconds(0);
 setCallActive(true);
 }
 } catch (err: any) {
 console.error('Call start error:', err);
 toast.error('Failed to start call. Please try again.');
 }
 };

 const endCall = () => {
 if (callTimerRef.current) clearInterval(callTimerRef.current);
 localStreamRef.current?.getTracks().forEach(t => t.stop());
 localStreamRef.current = null;
 setCallPhase('ended');
 setTimeout(() => {
 setCallActive(false);
 setCallPhase('idle');
 setCallSeconds(0);
 }, 1500);
 };

 const formatCallTime = (s: number) => 
 `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
 const [profile, setProfile] = React.useState<any>(null);
 const [isOnline, setIsOnline] = React.useState(navigator.onLine);
 const [notificationCount, setNotificationCount] = React.useState(0);
 const { streak } = useStreakTracking('ai_chat');
 const networkQuality = useNetworkQuality();
 const [showOfflineMode, setShowOfflineMode] = React.useState(false);
 const [messageToForward, setMessageToForward] = React.useState<any>(null);
 const [showForwardDialog, setShowForwardDialog] = React.useState(false);
 const [showContactInfo, setShowContactInfo] = React.useState(false);
 const [showMessageSearch, setShowMessageSearch] = React.useState(false);
 const [searchResultMessageId, setSearchResultMessageId] = React.useState<string | null>(null);
 const [messageFilter, setMessageFilter] = React.useState<'all' | 'media' | 'links' | 'documents' | 'location'>('all');
 
 // Selection Mode State
 const [selectionMode, setSelectionMode] = React.useState(false);
 const [selectedMessages, setSelectedMessages] = React.useState<Set<string>>(new Set());
 
 // AI Features State
 const [showSmartReplies, setShowSmartReplies] = React.useState(false);
 const [showSummary, setShowSummary] = React.useState(false);
 const [showInsights, setShowInsights] = React.useState(false);
 const [insightsType, setInsightsType] = React.useState<'sentiment' | 'topics' | 'urgency' | 'language'>('sentiment');
 
 const [currentUserProfile, setCurrentUserProfile] = React.useState<any>(null);
 const currentUserFallbackName = user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email;

 // Load current user profile
 React.useEffect(() => {
 const loadProfile = async () => {
 if (!user?.id) return;
 const data = await fetchSharedProfile(
 user.id,
 currentUserFallbackName
 );
 if (data) setCurrentUserProfile(data);
 };
 loadProfile();
 }, [currentUserFallbackName, user?.id]);

 const {
 loading: aiLoading,
 summary,
 smartReplies,
 insights,
 generateSummary,
 generateSmartReplies,
 analyzeMessages,
 clearSummary,
 clearSmartReplies,
 clearInsights
 } = useAIChatAssistant();
 
 const [showAddParticipant, setShowAddParticipant] = React.useState(false);
 const [isGroup, setIsGroup] = React.useState(false);
 const [showGroupSettings, setShowGroupSettings] = React.useState(false);
 const [conversationParticipants, setConversationParticipants] = React.useState<string[]>([]);
 
 // New features state
 const [showBackupSheet, setShowBackupSheet] = React.useState(false);
 const [showDevicesSheet, setShowDevicesSheet] = React.useState(false);
 const [showFullSearch, setShowFullSearch] = React.useState(false);
 const [scanningImageUrl, setScanningImageUrl] = React.useState<string | null>(null);
 
 // Error boundary for chat to prevent crashes
 const [chatError, setChatError] = React.useState<Error | null>(null);
 
 // Use virtualized messages hook - WhatsApp-style performance
 const { 
 messages: displayMessages, 
 sendMessage,
 loadMessages,
 loadOlderMessages,
 hasMore,
 isLoading: messagesLoading, 
 sending,
 deleteMessage,
 editMessage,
 reactToMessage
 } = useVirtualizedMessages(
 activeConversationId,
 user?.id || ''
 );

 const { items: timelineItems, loadMore: loadOlderTimeline, hasMore: timelineHasMore } = useUniversalTimeline(
 activeConversationId, 
 user?.id || null
 );

 const mergedTimeline = React.useMemo(() => {
 const messageTimelineItems = displayMessages.map(msg => ({
 id: msg.id,
 timeline_type: 'message' as const,
 created_at: msg.created_at,
 sender_id: msg.sender_id,
 payload: msg
 }));

 const nonMessageItems = timelineItems.filter(item => item.timeline_type !== 'message');

 return [...messageTimelineItems, ...nonMessageItems].sort(
 (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
 );
 }, [displayMessages, timelineItems]);
 
 // Enable WhatsApp-style chat push notifications
 useChatPushNotifications({ 
 userId: user?.id || '', 
 activeConversationId 
 });

 // ⚡ Socket.IO typing indicators (additive — no-op when socket is off)
 const { onTypingInput, isSomeoneTyping } = useSocketTyping(
 activeConversationId,
 user?.id
 );
 
 // Enable realtime notifications with sound
 useRealtimeNotifications(user?.id);

 // Load user profile - deferred slightly to prioritize chat list
 React.useEffect(() => {
 if (!user?.id) return;
 
 // Defer profile load by 500ms
 const timer = setTimeout(async () => {
 const data = await fetchSharedProfile(
 user.id,
 currentUserFallbackName
 );
 
 setProfile(data);
 }, 500);
 
 return () => clearTimeout(timer);
 }, [currentUserFallbackName, user?.id]);

 // Monitor online status
 React.useEffect(() => {
 const handleOnline = () => setIsOnline(true);
 const handleOffline = () => setIsOnline(false);
 
 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);
 
 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
 }, []);

 // Load notification count - deferred to not block initial render
 React.useEffect(() => {
 if (!user?.id) return;
 
 const loadNotifications = async () => {
 const { count } = await supabase
 .from('notifications')
 .select('*', { count: 'exact', head: true })
 .eq('user_id', user.id)
 .eq('read', false);
 
 setNotificationCount(count || 0);
 };
 
 // Defer by 2 seconds
 const timer = setTimeout(() => {
 loadNotifications();
 
 // Subscribe to new notifications
 const channel = supabase
 .channel('notifications')
 .on('postgres_changes', {
 event: 'INSERT',
 schema: 'public',
 table: 'notifications',
 filter: `user_id=eq.${user.id}`
 }, loadNotifications)
 .subscribe();
 
 // Store channel for cleanup
 (window as any).__notifChannel = channel;
 }, 2000);
 
 return () => {
 clearTimeout(timer);
 if ((window as any).__notifChannel) {
 supabase.removeChannel((window as any).__notifChannel);
 }
 };
 }, [user?.id]);

 // Load registered contacts for display. Native contact sync runs globally via
 // useAutoContactSync; doing it again on chat open creates large REST lookups.
 React.useEffect(() => {
 if (!user?.id) return;
 
 // Defer by 3 seconds to prioritize chat rendering
 const syncTimer = setTimeout(async () => {
 try {
 const { data } = await supabase
 .from('contacts')
 .select('contact_user_id, contact_name, contact_phone')
 .eq('user_id', user.id)
 .eq('is_registered', true)
 .not('contact_user_id', 'is', null)
 .limit(50);

 if (!data?.length) {
 setContacts([]);
 return;
 }

 const userIds = data.map(c => c.contact_user_id).filter(Boolean);
 const { data: profiles } = await supabase
 .from('profiles')
 .select('id, username, full_name, avatar_url, phone_number, email')
 .in('id', userIds);

 if (profiles) {
 const profileMap = new Map(profiles.map(p => [p.id, p]));
 const contactProfiles = data
 .map(contact => {
 const profile = profileMap.get(contact.contact_user_id!);
 const normalized = normalizeConversationProfile(profile, contact.contact_name);
 return normalized ? {
 id: profile.id,
 username: normalized.username || contact.contact_name,
 avatar_url: normalized.avatar_url,
 phone_number: normalized.phone_number || contact.contact_phone
 } : null;
 })
 .filter(Boolean);
 setContacts(contactProfiles);
 }
 } catch (error) {
 console.error('Error syncing contacts:', error);
 }
 }, 3000); // 3 second delay to prioritize chat loading

 return () => clearTimeout(syncTimer);
 }, [user?.id]);

 // Fast auth check - non-blocking
 React.useEffect(() => {
 const checkAuth = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 
 if (!session) {
 navigate('/auth');
 } else {
 setLoading(false);
 }
 };
 
 checkAuth();
 }, [navigate]);

 // Load conversation details when activeConversationId changes
 React.useEffect(() => {
 if (activeConversationId) {
 loadConversationDetails(activeConversationId);
 }
 }, [activeConversationId]);
 
 const loadConversationDetails = async (convId: string) => {
 const { data: convData } = await supabase
 .from('conversations')
 .select('is_group')
 .eq('id', convId)
 .maybeSingle();
 
 if (convData) {
 setIsGroup(convData.is_group || false);
 }

 const { data } = await supabase
 .from('conversation_participants')
 .select('user_id')
 .eq('conversation_id', convId);
 
 setConversationParticipants(data?.map(p => p.user_id) || []);
 };

 if (isLegacyConversationQueryRoute && routeConversationId) {
 return (
 <div className="flex min-h-[100dvh] items-center justify-center bg-[linear-gradient(180deg,#f8f6ff_0%,#f7f8fc_18%,#f7f8fc_100%)]">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
 <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/70 border-t-transparent" />
 </div>
 </div>
 );
 }

 const handleStartConversation = async (contact: any) => {
 try {
 const contactUserId = contact.contact_user_id || contact.id;
 
 // First, ensure they're in our contacts
 await supabase
 .from('contacts')
 .upsert({
 user_id: user!.id,
 contact_name: contact.contact_name || contact.username,
 contact_phone: contact.email || contact.phone_number || '',
 contact_user_id: contactUserId,
 is_registered: true
 }, {
 onConflict: 'user_id,contact_phone'
 });

 // Call the create_direct_conversation function
 const { data, error } = await supabase.rpc('create_direct_conversation', {
 other_user_id: contactUserId
 });

 if (error) throw error;

 setActiveConversationId(data);
 setOtherUser(normalizeConversationProfile({
 id: contactUserId,
 username: contact.contact_name || contact.username,
 avatar_url: contact.avatar_url,
 phone_number: contact.phone_number || contact.contact_phone
 }));
 navigate(`/chat/${data}`);
 } catch (error) {
 console.error('Error creating conversation:', error);
 toast.error('Failed to start conversation');
 }
 };

 // Handle contact selected from location state
 React.useEffect(() => {
 const selectedContact = (location.state as any)?.selectedContact;
 if (selectedContact && user) {
 handleStartConversation(selectedContact);
 }
 }, [location.state, user]);

 const handleConversationSelect = (conversationId: string, user?: any) => {
 setActiveConversationId(conversationId);
 setOtherUser(normalizeConversationProfile(user));
 navigate(`/chat/${conversationId}`);
 };

 // ── Intent Observer ─────────────────────────────────────────────────────────
 const intentObserver = useIntentObserver({
 conversationId: activeConversationId,
 userId: user?.id,
 });

 const handleSendMessage = async (content: string, type?: string, mediaAttachments?: any[]) => {
 if (!activeConversationId) return;
 try {
 // Observe for intents on text messages only (< 1ms, non-blocking)
 if (type !== 'image' && type !== 'video' && type !== 'audio' && type !== 'file') {
 intentObserver.observe(content);
 }
 await sendMessage(content, type, mediaAttachments);
 } catch (error) {
 console.error('Send failed:', error);
 toast.error('Failed to send message');
 }
 };

 const handleForwardMessage = (message: any) => {
 setMessageToForward(message);
 setShowForwardDialog(true);
 };

 const handleStarMessage = async (messageId: string) => {
 try {
 if (!user?.id) return;

 // Check if already starred
 const { data: existing } = await supabase
 .from('starred_messages')
 .select('id')
 .eq('user_id', user.id)
 .eq('message_id', messageId)
 .maybeSingle();

 if (existing) {
 // Unstar
 const { error } = await supabase
 .from('starred_messages')
 .delete()
 .eq('user_id', user.id)
 .eq('message_id', messageId);

 if (error) throw error;
 toast.success('Message unstarred');
 } else {
 // Star
 const { error } = await supabase
 .from('starred_messages')
 .insert({
 user_id: user.id,
 message_id: messageId,
 conversation_id: activeConversationId!,
 });

 if (error) throw error;
 toast.success('Message starred');
 }
 
 // Reload messages to reflect the change
 await loadMessages();
 } catch (error) {
 console.error('Star error:', error);
 toast.error('Failed to update message');
 }
 };

 const [replyToMessage, setReplyToMessage] = React.useState<any>(null);
 const [showReportDialog, setShowReportDialog] = React.useState(false);
 const [messageToReport, setMessageToReport] = React.useState<any>(null);

 const handleReplyMessage = (message: any) => {
 setReplyToMessage(message);
 };

 const cancelReply = () => {
 setReplyToMessage(null);
 };

 const handlePinMessage = async (messageId: string) => {
 try {
 if (!user?.id || !activeConversationId) return;

 // Check if already pinned
 const { data: existing } = await supabase
 .from('pinned_messages')
 .select('id')
 .eq('conversation_id', activeConversationId)
 .eq('message_id', messageId)
 .maybeSingle();

 if (existing) {
 // Unpin
 const { error } = await supabase
 .from('pinned_messages')
 .delete()
 .eq('conversation_id', activeConversationId)
 .eq('message_id', messageId);

 if (error) throw error;
 toast.success('Message unpinned');
 } else {
 // Check pin limit (max 3)
 const { data: pinnedCount } = await supabase
 .from('pinned_messages')
 .select('id', { count: 'exact', head: true })
 .eq('conversation_id', activeConversationId);

 if (pinnedCount && (pinnedCount as any).count >= 3) {
 toast.error('Maximum 3 messages can be pinned per chat');
 return;
 }

 // Pin
 const { error } = await supabase
 .from('pinned_messages')
 .insert({
 conversation_id: activeConversationId,
 message_id: messageId,
 pinned_by: user.id,
 });

 if (error) throw error;
 toast.success('Message pinned');
 }
 
 // Reload messages
 await loadMessages();
 } catch (error) {
 console.error('Pin error:', error);
 toast.error('Failed to update message');
 }
 };

 const handleReportMessage = (message: any) => {
 setMessageToReport(message);
 setShowReportDialog(true);
 };

 const handleDeleteMessage = async (messageId: string) => {
 console.log('[Chat] handleDeleteMessage called:', messageId);
 try {
 const message = displayMessages.find(m => m.id === messageId);
 console.log('[Chat] Found message:', message?.id, 'sender:', message?.sender_id, 'user:', user?.id);
 if (!message) {
 console.error('[Chat] Message not found in displayMessages');
 return;
 }

 // Only allow deleting own messages
 if (message.sender_id !== user?.id) {
 toast.error('You can only delete your own messages');
 return;
 }

 // Soft delete
 const { error } = await supabase
 .from('messages')
 .update({ 
 is_deleted: true, 
 deleted_at: new Date().toISOString(),
 content: 'This message was deleted' // Keep placeholder
 })
 .eq('id', messageId);

 if (error) {
 console.error('[Chat] Delete error:', error);
 throw error;
 }
 
 console.log('[Chat] Message deleted successfully');
 await loadMessages();
 toast.success('Message deleted');
 } catch (error) {
 console.error('Error deleting message:', error);
 toast.error('Failed to delete message');
 }
 };

 const handleEditMessage = async (messageId: string, newContent: string) => {
 try {
 await editMessage(messageId, newContent);
 toast.success('Message updated');
 } catch (error) {
 console.error('Error editing message:', error);
 toast.error('Failed to edit message');
 }
 };

 const handleSelectMessage = (messageId: string) => {
 setSelectedMessages(prev => {
 const newSet = new Set(prev);
 if (newSet.has(messageId)) {
 newSet.delete(messageId);
 } else {
 newSet.add(messageId);
 }
 return newSet;
 });
 };

 const handleDeleteSelected = async () => {
 try {
 for (const msgId of selectedMessages) {
 await deleteMessage(msgId);
 }
 toast.success(`Deleted ${selectedMessages.size} message${selectedMessages.size > 1 ? 's' : ''}`);
 setSelectedMessages(new Set());
 setSelectionMode(false);
 } catch (error) {
 toast.error('Failed to delete messages');
 }
 };

 const handleForwardSelected = () => {
 const messagesToForward = displayMessages.filter(m => selectedMessages.has(m.id));
 if (messagesToForward.length > 0) {
 setMessageToForward(messagesToForward[0]);
 setShowForwardDialog(true);
 }
 };

 const exitSelectionMode = () => {
 setSelectionMode(false);
 setSelectedMessages(new Set());
 };

 // Generate UUID for call
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

 const handleStartCall = async (type: 'voice' | 'video') => {
 console.log(`🚀 [Chat] handleStartCall triggered: type=${type}, conversationId=${activeConversationId}`);
 if (!activeConversationId) {
 console.warn('[Chat] No active conversation ID');
 toast.error('Please select a conversation first');
 return;
 }
 let peer = otherUser;
 if (!peer && user?.id) {
 console.log('[Chat] otherUser is null, proceeding with basic call');
 toast.info('Loading contact info...');
 peer = await fetchConversationPeerProfile(activeConversationId, user.id);
 if (peer) setOtherUser(peer);
 }
 await startCall(type, peer);
 };

 const handleAIAction = (action: any) => {
 switch (action) {
 case 'smart_reply':
 setShowSmartReplies(true);
 break;
 case 'summarize':
 setShowSummary(true);
 break;
 case 'translate':
 toast.info('Translation feature coming soon!');
 break;
 case 'extract_action':
 toast.info('Action extraction coming soon!');
 break;
 case 'improve_tone':
 toast.info('Tone improvement coming soon!');
 break;
 default:
 console.warn('Unknown AI action:', action);
 }
 };

 // Show loading only during initial check
 if (loading || !isAuthReady) {
 return (
 <div className="flex min-h-[100dvh] flex-1 items-center justify-center bg-background">
 <div className="text-center space-y-2">
 <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
 <p className="text-secondary text-muted-foreground">Loading chat...</p>
 </div>
 </div>
 );
 }

 // If no user after loading, redirect will handle it
 if (!user?.id) {
 return null;
 }

 // Show offline mode if enabled
 if (showOfflineMode) {
 return (
 <div className="relative flex min-h-[100dvh] flex-1 bg-background">
 <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between bg-card/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowOfflineMode(false)}
 >
 <ArrowLeft className="w-4 h-4 mr-2" />
 Back to Online Chat
 </Button>
 <div className="flex items-center gap-2">
 <Badge variant="secondary" className="gap-1">
 <Bluetooth className="w-3 h-3" />
 Bluetooth Mode Active
 </Badge>
 <Badge variant="outline" className="gap-1">
 <WifiOff className="w-3 h-3" />
 No Internet Required
 </Badge>


 </div>
 </div>
 <div className="pt-20 h-full">
 <OfflineChat />
 </div>
 </div>
 );
 }

 return (
 <>
 {/* NOTE: Call notifications handled by GlobalCallListener in App.tsx */}

 <div
 className={`flex flex-1 flex-col ${
 isNativeConversationRoute
 ? 'fixed inset-0 z-[140] h-[100dvh] overflow-hidden bg-[#edf2f7]'
 : isConversationRoute
 ? 'h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#edf2f7] pb-0'
 : 'min-h-0 bg-[#f5f7fb] pb-28'
 }`}
 style={
 isConversationRoute
 ? {
 paddingTop:
 isNativeConversationRoute || isStandaloneConversationRoute
 ? 'env(safe-area-inset-top)'
 : '0px',
 }
 : undefined
 }
 >
 {!isConversationRoute && !isNative && <NetworkStatus />}
 
 {isConversationRoute && activeConversationId ? (
 // Conversation View
 <>
 <div
 data-chat-container
 className="sticky top-0 z-20 shrink-0 border-b-[0.5px] border-[#EEEEF4] bg-[#FFFFFF] px-[16px] flex items-center min-h-[56px]"
 >
 {selectionMode ? (
 <div className="flex items-center gap-2 w-full py-[8px]">
 <Button
 variant="ghost"
 size="icon"
 onClick={exitSelectionMode}
 className="min-h-[44px] min-w-[44px] rounded-full text-[#3D3D5C]"
 >
 <ArrowLeft className="w-[24px] h-[24px]" />
 </Button>
 <span className="font-[600] text-[15px] flex-1 text-[#1A1A2E]">{selectedMessages.size} selected</span>
 <div className="flex items-center gap-1">
 <Button
 variant="ghost"
 size="icon"
 onClick={handleForwardSelected}
 disabled={selectedMessages.size === 0}
 className="min-h-[44px] min-w-[44px] rounded-full text-[#3D3D5C]"
 >
 <Share2 className="w-[24px] h-[24px]" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 onClick={handleDeleteSelected}
 disabled={selectedMessages.size === 0}
 className="min-h-[44px] min-w-[44px] rounded-full text-[#E53935]"
 >
 <Trash className="w-[24px] h-[24px]" />
 </Button>
 </div>
 </div>
 ) : (
 <div className="flex items-center w-full py-[8px]">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => {
 navigate('/chat');
 }}
 className="min-h-[44px] min-w-[44px] rounded-full text-[#3D3D5C] hover:bg-black/[0.04] mr-1"
 >
 <ArrowLeft className="w-[24px] h-[24px]" />
 </Button>
 {(() => {
 if (!otherUser) {
 if (loading) {
 return (
 <div className="flex items-center gap-3 flex-1">
 <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
 <div className="space-y-1">
 <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
 <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
 </div>
 </div>
 );
 }
 
 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
 <div style={{ position: 'relative', flexShrink: 0 }}>
 <div style={{
 width: 38, height: 38, borderRadius: '50%',
 background: '#EDE8FF',
 color: '#6C63FF',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 15, fontWeight: 700
 }}>
 📝
 </div>
 </div>

 <div style={{ minWidth: 0 }}>
 <div style={{
 fontSize: 15, fontWeight: 600, color: '#1A1A2E',
 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
 }}>
 Note to Self
 </div>
 <div style={{ fontSize: 12, color: '#9898B3' }}>
 Saved Messages
 </div>
 </div>
 </div>
 );
 }
 
 const isUnknown = !otherUser.username || otherUser.username === 'Unknown Contact';
 const displayName = isUnknown 
 ? formatPhone(otherUser.phone_number) 
 : otherUser.username;
 const initials = displayName.slice(0,2).toUpperCase();

 return (
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
 <div style={{ position: 'relative', flexShrink: 0 }}>
 {otherUser.avatar_url ? (
 <img src={otherUser.avatar_url} style={{
 width: 38, height: 38, borderRadius: '50%', objectFit: 'cover'
 }} />
 ) : (
 <div style={{
 width: 38, height: 38, borderRadius: '50%',
 background: isUnknown ? '#EEEEF4' : '#EDE8FF',
 color: isUnknown ? '#9898B3' : '#6C63FF',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 13, fontWeight: 700
 }}>
 {isUnknown ? '📞' : initials}
 </div>
 )}
 {otherUser.is_online && (
 <div style={{
 position: 'absolute', bottom: 1, right: 1,
 width: 10, height: 10, borderRadius: '50%',
 background: '#43A047', border: '2px solid white', zIndex: 10
 }} />
 )}
 </div>

 <div style={{ minWidth: 0 }}>
 <div style={{
 fontSize: 15, fontWeight: 600, color: '#1A1A2E',
 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
 }}>
 {displayName}
 </div>
 <div style={{ fontSize: 12, color: otherUser.is_online ? '#00BFA5' : '#9898B3' }}>
 {otherUser.is_online ? 'Online' 
 : otherUser.last_seen ? `Last seen recently` 
 : 'Tap to view profile'}
 </div>
 </div>
 </div>
 );
 })()}

 <div className="ml-auto flex shrink-0 items-center gap-1">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleStartCall('voice')}
 className="min-h-[44px] min-w-[44px] rounded-full text-[#3D3D5C] hover:bg-black/[0.04]"
 title="Voice Call"
 >
 <Phone className="w-[24px] h-[24px]" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 onClick={() => handleStartCall('video')}
 className="min-h-[44px] min-w-[44px] rounded-full text-[#3D3D5C] hover:bg-black/[0.04]"
 title="Video Call"
 >
 <Video className="w-[24px] h-[24px]" />
 </Button>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="ghost"
 size="icon"
 className="min-h-[44px] min-w-[44px] rounded-full text-[#3D3D5C] hover:bg-black/[0.04]"
 >
 <MoreVertical className="w-[24px] h-[24px]" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => setShowMessageSearch(true)}>
 Search in chat
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={async () => {
 if (displayMessages.length === 0) return;
 await generateSummary(displayMessages, 'brief');
 setShowSummary(true);
 }}
 >
 Summarize chat
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={async () => {
 if (displayMessages.length === 0) return;
 const lastMsg = displayMessages[displayMessages.length - 1];
 if (lastMsg.sender_id !== user?.id) {
 await generateSmartReplies(lastMsg.content, displayMessages.slice(-5));
 setShowSmartReplies(true);
 } else {
 toast.info('Smart replies work on received messages');
 }
 }}
 >
 Smart replies
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={async () => {
 if (displayMessages.length === 0) return;
 setInsightsType('topics');
 await analyzeMessages(displayMessages, 'topics');
 setShowInsights(true);
 }}
 >
 Analyze conversation
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 {conversationParticipants.length > 0 && conversationParticipants.length < 5 ? (
 <DropdownMenuItem onClick={() => setShowAddParticipant(true)}>
 Add participant
 </DropdownMenuItem>
 ) : null}
 {isGroup ? (
 <DropdownMenuItem onClick={() => setShowGroupSettings(true)}>
 Group info
 </DropdownMenuItem>
 ) : (
 <DropdownMenuItem onClick={() => setShowContactInfo(true)}>
 Contact info
 </DropdownMenuItem>
 )}
 <DropdownMenuItem onClick={() => setSelectionMode(true)}>
 Select Messages
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => setShowDisappearingSettings(true)}>
 Disappearing Messages
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => setShowAIFeatures(true)}>
 AI features
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>
 )}
 </div>

 {showMessageSearch && (
 <div className="border-b border-black/[0.05] bg-white px-3 py-2">
 <MessageSearchBar
 messages={displayMessages}
 onResultSelect={(messageId) => {
 setSearchResultMessageId(messageId);
 setShowMessageSearch(false);
 toast.success('Message found - scrolling to message');
 }}
 onClose={() => setShowMessageSearch(false)}
 />
 </div>
 )}

 {isSomeoneTyping && (
 <div className="border-b border-black/[0.04] bg-white/70 px-4 py-1.5 text-label text-muted-foreground backdrop-blur-sm">
 {otherUser?.username || 'Someone'} is typing...
 </div>
 )}

 <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${wallpaperClass}`}>
 {user?.id ? (
 <UniversalTimelineList
 items={mergedTimeline}
 userId={user.id}
 otherUser={otherUser}
 onLoadMore={() => {
 loadOlderMessages();
 loadOlderTimeline();
 }}
 hasMore={hasMore || timelineHasMore}
 isLoading={messagesLoading}
 onForward={handleForwardMessage}
 onStar={handleStarMessage}
 onReply={handleReplyMessage}
 onDelete={handleDeleteMessage}
 onEdit={handleEditMessage}
 onPin={handlePinMessage}
 onReport={handleReportMessage}
 selectionMode={selectionMode}
 selectedMessages={selectedMessages}
 onSelectMessage={handleSelectMessage}
 onScanImage={setScanningImageUrl}
 currentUser={{
 username: currentUserProfile?.username || user.user_metadata?.username || user.email || 'Me',
 avatar_url: currentUserProfile?.avatar_url || user.user_metadata?.avatar_url
 }}
 />
 ) : (
 <div className="flex items-center justify-center h-full">
 <div className="w-6 h-6 border-2 border-primary/60 border-t-transparent rounded-full animate-spin" />
 </div>
 )}
 </div>

 <div
 className="shrink-0 border-t border-black/[0.05] bg-white/96 backdrop-blur-2xl"
 style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
 >
 {/* ── Experience Alpha: Understanding Layer ── */}
 <UnderstandingLayer
 understanding={intentObserver.understanding}
 isReady={intentObserver.isReady}
 onDismiss={intentObserver.dismiss}
 onExecute={() => {
 // Execute logic
 toast.success('Action executed');
 intentObserver.dismiss();
 }}
 />
 <div className="px-3 pt-2">
 <WhatsAppStyleInput
 onSendMessage={handleSendMessage}
 conversationId={activeConversationId}
 userId={user.id}
 disabled={messagesLoading}
 replyToMessage={replyToMessage}
 onCancelReply={cancelReply}
 lastMessage={displayMessages.length > 0 && displayMessages[displayMessages.length - 1].sender_id !== user.id 
 ? displayMessages[displayMessages.length - 1].content 
 : undefined}
 conversationContext={displayMessages.slice(-5).map(m => m.content)}
 onAIAction={handleAIAction}
 onTyping={intentObserver.observe}
 />
 </div>
 </div>
 </>
 ) : (
 <div className="flex flex-1 flex-col h-full bg-white">
 <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)] pb-2 bg-white border-b border-[#EEEEF4] shrink-0 sticky top-0 z-10 shadow-sm">
 <h1 className="text-page font-bold text-[#1A1A2E] flex items-center gap-2">
 Chats
 {notificationCount > 0 && (
 <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
 {notificationCount}
 </span>
 )}
 </h1>
 <div className="flex gap-1">
 <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-[#3D3D5C] hover:bg-black/5" onClick={() => setShowGroupCreator(true)}>
 <Users className="w-[20px] h-[20px]" />
 </Button>
 <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-[#3D3D5C] hover:bg-black/5" onClick={() => setShowGlobalSearch(true)}>
 <Search className="w-[20px] h-[20px]" />
 </Button>
 </div>
 </div>
 <div className="flex-1 min-h-0 overflow-hidden relative">
 <VirtualizedConversationList
 userId={user.id}
 onConversationSelect={handleConversationSelect}
 />
 </div>
 </div>
 )}

 {/* Contact Info Sidebar */}
 <UserInfoSidebar
 contact={otherUser ? {
 id: otherUser.id,
 username: otherUser.username || 'Unknown',
 avatar_url: otherUser.avatar_url || null,
 email: null,
 phone_number: otherUser.phone_number || null,
 status: otherUser.status || null,
 is_online: otherUser.is_online || false,
 last_seen: otherUser.last_seen || new Date().toISOString(),
 created_at: otherUser.created_at || new Date().toISOString(),
 age: null,
 gender: null
 } : null}
 open={showContactInfo}
 onOpenChange={setShowContactInfo}
 />

 {/* Message Forward Dialog */}
 {messageToForward && (
 <MessageForwardDialog
 open={showForwardDialog}
 onClose={() => {
 setShowForwardDialog(false);
 setMessageToForward(null);
 }}
 messageId={messageToForward.id}
 messageContent={messageToForward.content}
 userId={user.id}
 />
 )}

 {/* Message Report Dialog */}
 {messageToReport && (
 <MessageReportDialog
 open={showReportDialog}
 onClose={() => {
 setShowReportDialog(false);
 setMessageToReport(null);
 }}
 messageId={messageToReport.id}
 conversationId={activeConversationId!}
 reportedUserId={messageToReport.sender_id}
 userId={user.id}
 />
 )}
 
 {/* Backup & Restore Sheet */}
 <BackupRestoreSheet
 open={showBackupSheet}
 onOpenChange={setShowBackupSheet}
 />
 
 {/* Linked Devices Sheet */}
 <LinkedDevicesSheet
 open={showDevicesSheet}
 onOpenChange={setShowDevicesSheet}
 />
 
 {/* Full-Text Message Search */}
 <MessageSearchSheet
 open={showFullSearch}
 onOpenChange={setShowFullSearch}
 conversationId={activeConversationId || undefined}
 onMessageSelect={(messageId, conversationId) => {
 setActiveConversationId(conversationId);
 setSearchResultMessageId(messageId);
 navigate(`/chat/${conversationId}`);
 }}
 />

 <VisualIntelligenceScanner 
 isOpen={!!scanningImageUrl}
 imageUrl={scanningImageUrl}
 onClose={() => setScanningImageUrl(null)}
 onShareToChat={handleSendMessage}
 />
 </div>
 </>
 );
};

export default function ChatEnhanced() {
 return (
 <ErrorBoundary>
 <ChatProvider>
 <ChatEnhancedContent />
 </ChatProvider>
 </ErrorBoundary>
 );
}

