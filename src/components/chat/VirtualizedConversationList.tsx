import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Loader2, Phone, Video, Check, CheckCheck, Pin, BellOff, Archive, UserPlus, Users, Mail, Hash, AtSign, Search, Fingerprint, CircleDollarSign, Briefcase, ShoppingCart, Brain, X } from 'lucide-react';
import { categorizeConversation } from '@/utils/smartInboxCategorizer';
import { toast } from 'sonner';
import { useConversationCache } from '@/hooks/useConversationCache';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationListSkeleton } from './ConversationListSkeleton';
import { ConversationContextMenu } from './ConversationContextMenu';
import { UnreadBadge } from './UnreadBadge';
import { useChatContext } from '@/contexts/ChatContext';
import { ContactAvatar } from '../shared/ContactAvatar';
import { SaveContactSheet, formatPhone } from './SaveContactSheet';
import { ContactsDrawer } from './ContactsDrawer';
import { CommunicationMemoryDialog } from './CommunicationMemoryDialog';

interface Contact {
 id: string;
 contact_name: string;
 contact_phone?: string;
 contact_user_id?: string;
 is_registered: boolean;
 avatar_url?: string;
 username?: string;
 email?: string;
}

interface Conversation {
 id: string;
 is_group: boolean;
 group_name?: string;
 group_icon_url?: string;
 updated_at: string;
 is_archived?: boolean;
 is_muted?: boolean;
 other_user?: {
 id: string;
 username: string;
 avatar_url?: string;
 is_online: boolean;
 phone_number?: string;
 };
 last_message?: {
 content: string;
 created_at: string;
 sender_id: string;
 read_at?: string;
 };
 unread_count?: number;
 category?: string;
}

interface VirtualizedConversationListProps {
 userId: string;
 onConversationSelect: (conversationId: string, otherUser?: any) => void;
}

// Highlight matching text component
const HighlightText = ({ text, query }: { text: string; query: string }) => {
 if (!query.trim() || !text) return <>{text}</>;
 
 const cleanQuery = query.replace(/^[@#]/, '').toLowerCase();
 if (!cleanQuery) return <>{text}</>;
 
 const parts = text.split(new RegExp(`(${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
 
 return (
 <>
 {parts.map((part, i) => 
 part.toLowerCase() === cleanQuery ? (
 <span key={i} className="bg-primary/20 text-primary font-semibold rounded-sm px-0.5">{part}</span>
 ) : part
 )}
 </>
 );
};

interface PlatformUser {
 id: string;
 username: string;
 avatar_url?: string;
 phone_number?: string;
 is_online?: boolean;
}

export const VirtualizedConversationList = ({ userId, onConversationSelect }: VirtualizedConversationListProps) => {
 const [conversations, setConversations] = useState<Conversation[]>([]);
 const [contacts, setContacts] = useState<Contact[]>([]);
 const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [saveContactTarget, setSaveContactTarget] = useState<any>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [filterTab, setFilterTab] = useState<'all' | 'personal' | 'work' | 'finance' | 'otp' | 'shopping' | 'unread' | 'groups' | 'archived'>('all');
 const [startingChat, setStartingChat] = useState<string | null>(null);
 const [searchingPlatform, setSearchingPlatform] = useState(false);
 const [showMemory, setShowMemory] = useState(false);
 const { getCachedConversations, setCachedConversations } = useConversationCache();
 const inputRef = useRef<HTMLInputElement>(null);
 
 // Real-time presence from context
 const { isUserOnline } = useChatContext();

 // Detect search mode from query prefix
 const searchMode = useMemo(() => {
 if (searchQuery.startsWith('@')) return 'people';
 if (searchQuery.startsWith('#')) return 'groups';
 if (/^\d+$/.test(searchQuery.trim())) return 'numbers';
 return 'all';
 }, [searchQuery]);

 // Helper to format message content for display
 const formatMessageContent = (content: string) => {
 if (content.startsWith('[Contact]')) {
 const match = content.match(/\[Contact\]\s*(.+?)\s*-/);
 return match ? `Contact: ${match[1]}` : 'Contact shared';
 }
 if (content.startsWith('[Poll]')) {
 try {
 const jsonMatch = content.match(/\[Poll\]\s*({.+})/);
 if (jsonMatch) {
 const pollData = JSON.parse(jsonMatch[1]);
 return `📊 Poll: ${pollData.question}`;
 }
 } catch (e) {
 return '📊 Poll';
 }
 }
 if (content === '📍' || content.startsWith('📍')) {
 return '📍 Location';
 }
 return content;
 };

 // Helper to format display names
 const formatDisplayName = (name: string | undefined) => {
 if (!name) return 'Unknown';
 return name.split('@')[0].replace(/^\d+/, '').trim() || name;
 };

 const loadConversations = useCallback(async () => {
 if (!userId) return;

 try {
 const cached = await getCachedConversations();
 if (cached) {
 setConversations(cached);
 setIsLoading(false);
 }

 const { data: optimizedData, error: rpcError } = await supabase
 .rpc('get_user_conversations_optimized', { p_user_id: userId });

 if (!rpcError && optimizedData) {
 const conversationData = optimizedData.map((conv: any) => {
 const lastMsgStr = conv.lastmessage || '';
 const otherUsername = conv.otheruser?.username || '';
 const categoryResult = categorizeConversation(conv.is_group, conv.is_group ? conv.group_name : otherUsername, lastMsgStr);
 
 return {
 id: conv.id,
 is_group: conv.is_group,
 group_name: conv.group_name,
 group_icon_url: conv.group_icon_url,
 is_community: conv.is_community,
 community_description: conv.community_description,
 updated_at: conv.lastmessagetime || new Date().toISOString(),
 last_message: conv.lastmessage ? {
 content: conv.lastmessage,
 created_at: conv.lastmessagetime,
 sender_id: '',
 read_at: undefined
 } : undefined,
 other_user: conv.otheruser || undefined,
 category: categoryResult.category.toLowerCase()
 };
 });

 setConversations(conversationData);
 await setCachedConversations(conversationData);
 setIsLoading(false);
 return;
 }

 const { data: participations } = await supabase
 .from('conversation_participants')
 .select(`
 conversation_id,
 conversations!inner (id, is_group, group_name, group_icon_url, updated_at)
 `)
 .eq('user_id', userId)
 .limit(50);

 if (!participations?.length) {
 setConversations([]);
 setIsLoading(false);
 return;
 }

 const convIds = participations.map(p => (p.conversations as any).id);

 const [messagesResult, participantsResult] = await Promise.all([
 supabase
 .from('messages')
 .select('conversation_id, content, created_at')
 .in('conversation_id', convIds)
 .order('created_at', { ascending: false })
 .limit(convIds.length),
 supabase
 .from('conversation_participants')
 .select('conversation_id, user_id, profiles!inner(id, username, avatar_url, is_online)')
 .in('conversation_id', convIds)
 .neq('user_id', userId)
 ]);

 const lastMessageMap = new Map();
 messagesResult.data?.forEach(msg => {
 if (!lastMessageMap.has(msg.conversation_id)) {
 lastMessageMap.set(msg.conversation_id, msg);
 }
 });

 const otherUserMap = new Map();
 participantsResult.data?.forEach((p: any) => {
 if (!otherUserMap.has(p.conversation_id)) {
 otherUserMap.set(p.conversation_id, p.profiles);
 }
 });

 const conversationData = participations
 .map((p: any) => {
 const conv = p.conversations;
 const lastMsg = lastMessageMap.get(conv.id) || null;
 const otherUser = otherUserMap.get(conv.id) || null;
 const categoryResult = categorizeConversation(
 conv.is_group, 
 conv.is_group ? conv.group_name : otherUser?.username, 
 lastMsg?.content
 );
 
 return {
 ...conv,
 last_message: lastMsg,
 other_user: otherUser,
 category: categoryResult.category.toLowerCase()
 };
 })
 .sort((a, b) => {
 const aTime = a.last_message?.created_at || a.updated_at;
 const bTime = b.last_message?.created_at || b.updated_at;
 return new Date(bTime).getTime() - new Date(aTime).getTime();
 });

 setConversations(conversationData);
 await setCachedConversations(conversationData);
 setIsLoading(false);
 } catch (error) {
 console.error('Error loading conversations:', error);
 setIsLoading(false);
 }
 }, [userId, getCachedConversations, setCachedConversations]);

 // Load contacts for search
 const loadContacts = useCallback(async () => {
 if (!userId) return;
 try {
 const { data } = await supabase
 .from('contacts')
 .select('id, contact_name, contact_phone, contact_user_id, is_registered')
 .eq('user_id', userId)
 .limit(200);
 
 if (data) {
 // Enrich with profile data for registered contacts
 const registeredIds = data.filter(c => c.contact_user_id).map(c => c.contact_user_id);
 let profileMap = new Map();
 
 if (registeredIds.length > 0) {
 const { data: profiles } = await supabase
 .from('profiles')
 .select('id, username, avatar_url')
 .in('id', registeredIds);
 profiles?.forEach(p => profileMap.set(p.id, p));
 }
 
 const enrichedContacts = data.map(c => ({
 ...c,
 username: profileMap.get(c.contact_user_id)?.username,
 avatar_url: profileMap.get(c.contact_user_id)?.avatar_url
 }));
 
 setContacts(enrichedContacts);
 }
 } catch (error) {
 console.error('Error loading contacts:', error);
 }
 }, [userId]);

 // Search platform users (all Chatr users)
 const searchPlatformUsers = useCallback(async (query: string) => {
 if (!query.trim() || query.length < 2) {
 setPlatformUsers([]);
 return;
 }
 
 setSearchingPlatform(true);
 try {
 const cleanQuery = query.replace(/^[@#]/, '').trim().toLowerCase();
 
 // Search by username or phone number
 const { data, error } = await supabase
 .from('profiles')
 .select('id, username, avatar_url, phone_number, is_online')
 .neq('id', userId)
 .or(`username.ilike.%${cleanQuery}%,phone_number.ilike.%${cleanQuery}%`)
 .limit(15);
 
 if (error) throw error;
 
 setPlatformUsers(data || []);
 } catch (error) {
 console.error('Error searching platform users:', error);
 setPlatformUsers([]);
 } finally {
 setSearchingPlatform(false);
 }
 }, [userId]);

 // Debounced platform search
 useEffect(() => {
 const timer = setTimeout(() => {
 if (searchQuery.trim().length >= 2) {
 searchPlatformUsers(searchQuery);
 } else {
 setPlatformUsers([]);
 }
 }, 300);
 
 return () => clearTimeout(timer);
 }, [searchQuery, searchPlatformUsers]);

 const handleStartChat = async (contact: Contact) => {
 if (!contact.contact_user_id || !contact.is_registered) {
 const inviteText = `Hey! Join me on Chatr - India's super app for messaging, jobs, healthcare & more. Download now: https://chatr.chat/join`;
 if (contact.contact_phone) {
 window.open(`https://wa.me/${contact.contact_phone.replace(/\D/g, '')}?text=${encodeURIComponent(inviteText)}`, '_blank');
 } else if (contact.email) {
 window.open(`mailto:${contact.email}?subject=Join me on Chatr&body=${encodeURIComponent(inviteText)}`, '_blank');
 }
 return;
 }

 setStartingChat(contact.id);
 try {
 const { data, error } = await supabase.rpc('create_direct_conversation', {
 other_user_id: contact.contact_user_id
 });

 if (error) throw error;

 onConversationSelect(data, {
 id: contact.contact_user_id,
 username: contact.username || contact.contact_name,
 avatar_url: contact.avatar_url
 });
 setSearchQuery(''); // Clear search after selection
 } catch (error) {
 console.error('Error starting chat:', error);
 toast.error('Failed to start conversation');
 } finally {
 setStartingChat(null);
 }
 };

 // Start chat with platform user
 const handleStartChatWithUser = async (user: PlatformUser) => {
 setStartingChat(user.id);
 try {
 const { data, error } = await supabase.rpc('create_direct_conversation', {
 other_user_id: user.id
 });

 if (error) throw error;

 onConversationSelect(data, {
 id: user.id,
 username: user.username,
 avatar_url: user.avatar_url,
 is_online: user.is_online
 });
 setSearchQuery('');
 } catch (error) {
 console.error('Error starting chat:', error);
 toast.error('Failed to start conversation');
 } finally {
 setStartingChat(null);
 }
 };

 // Debounced reload for realtime updates - batch updates to prevent excessive re-renders
 const pendingReloadRef = useRef<NodeJS.Timeout | null>(null);
 const lastReloadRef = useRef<number>(0);
 
 const debouncedReload = useCallback(() => {
 const now = Date.now();
 // Minimum 500ms between reloads to prevent thrashing
 if (now - lastReloadRef.current < 500) {
 if (pendingReloadRef.current) clearTimeout(pendingReloadRef.current);
 pendingReloadRef.current = setTimeout(() => {
 lastReloadRef.current = Date.now();
 loadConversations();
 }, 500);
 return;
 }
 
 lastReloadRef.current = now;
 loadConversations();
 }, [loadConversations]);

 useEffect(() => {
 if (!userId) return;
 loadConversations();
 // Defer contacts loading to not block initial render
 const contactsTimer = setTimeout(loadContacts, 1000);
 // Failsafe to unblock UI if loading hangs
 const failsafeTimer = setTimeout(() => {
 setIsLoading(false);
 }, 2500);

 const channel = supabase
 .channel('conv-updates-realtime', {
 config: { broadcast: { self: true } }
 })
 .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, debouncedReload)
 .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, debouncedReload)
 .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, debouncedReload)
 .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, debouncedReload)
 .subscribe();

 // Remove aggressive 5s polling - rely on realtime only
 return () => {
 clearTimeout(contactsTimer);
 clearTimeout(failsafeTimer);
 if (pendingReloadRef.current) clearTimeout(pendingReloadRef.current);
 supabase.removeChannel(channel);
 };
 }, [userId, loadConversations, loadContacts, debouncedReload]);

 const pinnedConversations = useMemo(() => {
 const pinnedKey = `chatr-pinned-${userId}`;
 return JSON.parse(localStorage.getItem(pinnedKey) || '[]') as string[];
 }, [userId]);

 const [showArchived, setShowArchived] = useState(false);

 // Smart search filtering
 const searchResults = useMemo(() => {
 const cleanQuery = searchQuery.replace(/^[@#]/, '').toLowerCase().trim();
 
 if (!cleanQuery) {
 // No search - show all conversations based on active tab
 let filtered = conversations.filter(conv => {
 if (filterTab === 'archived') return conv.is_archived;
 if (conv.is_archived && filterTab !== 'archived') return false;
 
 if (filterTab === 'unread') return (conv.unread_count || 0) > 0;
 if (filterTab === 'groups') return conv.is_group;
 
 if (['personal', 'work', 'finance', 'otp', 'shopping'].includes(filterTab)) {
 return conv.category === filterTab;
 }
 
 return true;
 });
 
 return {
 conversations: filtered.sort((a, b) => {
 const aIsPinned = pinnedConversations.includes(a.id);
 const bIsPinned = pinnedConversations.includes(b.id);
 if (aIsPinned && !bIsPinned) return -1;
 if (!aIsPinned && bIsPinned) return 1;
 return 0;
 }),
 contacts: [],
 platformUsers: [],
 unknownNumbers: []
 };
 }

 // Filter conversations
 let filteredConvs = conversations.filter(conv => {
 // Mode filtering
 if (searchMode === 'people' && conv.is_group) return false;
 if (searchMode === 'groups' && !conv.is_group) return false;
 
 const name = conv.is_group ? conv.group_name : conv.other_user?.username;
 const phone = conv.other_user?.phone_number || '';
 const lastMsg = conv.last_message?.content || '';
 
 // Match name, phone, or message content
 return (
 name?.toLowerCase().includes(cleanQuery) ||
 phone.includes(cleanQuery) ||
 lastMsg.toLowerCase().includes(cleanQuery)
 );
 });

 // Filter contacts (not already in conversations)
 const convUserIds = new Set(conversations.map(c => c.other_user?.id).filter(Boolean));
 let filteredContacts = contacts.filter(c => {
 // Skip if already has conversation
 if (c.contact_user_id && convUserIds.has(c.contact_user_id)) return false;
 
 // Mode filtering
 if (searchMode === 'groups') return false;
 
 const name = (c.contact_name || c.username || '').toLowerCase();
 const phone = (c.contact_phone || '').replace(/\D/g, '');
 const email = (c.email || '').toLowerCase();
 
 // Prioritize phone number matches for number searches
 if (searchMode === 'numbers') {
 return phone.includes(cleanQuery);
 }
 
 return (
 name.includes(cleanQuery) ||
 phone.includes(cleanQuery) ||
 email.includes(cleanQuery)
 );
 });

 // Find unknown numbers (raw number search that doesn't match any contact)
 let unknownNumbers: string[] = [];
 if (searchMode === 'numbers' && cleanQuery.length >= 3) {
 const matchedPhones = new Set([
 ...filteredContacts.map(c => c.contact_phone?.replace(/\D/g, '')),
 ...filteredConvs.map(c => c.other_user?.phone_number?.replace(/\D/g, ''))
 ]);
 
 // Show the searched number as potential new contact if not matched
 if (!matchedPhones.has(cleanQuery) && cleanQuery.length >= 10) {
 unknownNumbers.push(cleanQuery);
 }
 }

 // Filter platform users (not already in conversations or contacts)
 const contactUserIds = new Set(contacts.map(c => c.contact_user_id).filter(Boolean));
 const filteredPlatformUsers = platformUsers.filter(user => {
 if (convUserIds.has(user.id)) return false;
 if (contactUserIds.has(user.id)) return false;
 if (searchMode === 'groups') return false;
 return true;
 });

 return {
 conversations: filteredConvs,
 contacts: filteredContacts.slice(0, 10),
 platformUsers: filteredPlatformUsers,
 unknownNumbers
 };
 }, [conversations, contacts, platformUsers, searchQuery, searchMode, filterTab, pinnedConversations]);

 const isSearching = searchQuery.trim().length > 0;
 const hasResults = searchResults.conversations.length > 0 || searchResults.contacts.length > 0 || searchResults.platformUsers.length > 0 || searchResults.unknownNumbers.length > 0;

 if (isLoading) {
 return <ConversationListSkeleton />;
 }

 return (
 <div className="flex flex-col h-full min-h-0">
 {/* Filter Tabs */}
 <div className="flex items-center overflow-x-auto scrollbar-hide bg-[#FFFFFF] border-b-[0.5px] border-[#EEEEF4] px-2 space-x-1">
 {['all', 'personal', 'work', 'finance', 'otp', 'shopping', 'unread', 'groups', 'archived'].map((tab) => (
 <button
 key={tab}
 onClick={() => setFilterTab(tab as any)}
 className={`flex-shrink-0 h-[32px] mt-[4px] mb-[4px] px-[12px] text-[13px] capitalize rounded-full transition-colors ${
 filterTab === tab
 ? 'font-[600] text-[#FFFFFF] bg-[#6C63FF]'
 : 'font-[500] text-[#6B7280] bg-[#F3F4F6] hover:bg-[#E5E7EB]'
 }`}
 >
 {tab}
 </button>
 ))}
 </div>

 {/* Clean pill search bar */}
 <div className="sticky top-0 z-10 bg-[#FFFFFF] px-[8px] py-[8px]">
 <div className="relative w-full">
 <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
 <Search className="w-[18px] h-[18px] text-[#9898B3]" />
 </div>
 <Input
 ref={inputRef}
 type="text"
 placeholder="Search chats, contacts, numbers"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full h-11 pl-11 pr-[80px] bg-white border-0 text-[#1A1A2E] placeholder:text-[#9898B3] rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] focus-visible:ring-1 focus-visible:ring-[#7C3AED]/20"
 />
 <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
 {searchQuery && (
 <Button 
 variant="ghost" 
 size="icon" 
 className="h-8 w-8 text-[#9898B3] hover:text-[#1A1A2E] rounded-xl hover:bg-[#F3F4F6]"
 onClick={() => {
 setSearchQuery('');
 inputRef.current?.focus();
 }}
 >
 <X className="h-4 w-4" />
 </Button>
 )}
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-violet-500 hover:text-violet-600 rounded-xl hover:bg-violet-50 ml-1 shadow-sm border border-violet-100 bg-violet-50/50"
 onClick={() => setShowMemory(true)}
 title="Communication Memory"
 >
 <Brain className="h-4 w-4" />
 </Button>
 </div>
 {/* Search mode indicator */}
 {searchMode !== 'all' && searchQuery && (
 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
 {searchMode === 'people' && <AtSign className="w-4 h-4 text-[#6C63FF]" />}
 {searchMode === 'groups' && <Hash className="w-4 h-4 text-[#6C63FF]" />}
 {searchMode === 'numbers' && <Phone className="w-4 h-4 text-[#6C63FF]" />}
 </div>
 )}
 </div>
 </div>

 {/* Empty state */}
 {!isSearching && searchResults.conversations.length === 0 ? (
 <div className="flex flex-col items-center justify-center flex-1 p-8">
 <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
 <p className="text-section ">No conversations yet</p>
 <p className="text-secondary text-muted-foreground text-center">
 Tap the contacts icon above to find friends and start chatting!
 </p>
 </div>
 ) : isSearching && !hasResults ? (
 <div className="flex flex-col items-center justify-center flex-1 p-8">
 {searchingPlatform ? (
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mb-2" />
 ) : null}
 <p className="text-muted-foreground text-secondary">
 {searchingPlatform ? 'Searching...' : searchQuery.length < 2 ? 'Type at least 2 characters to search' : 'No users found'}
 </p>
 </div>
 ) : (
 <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide -webkit-overflow-scrolling-touch">
 {/* Contacts section (when searching) */}
 {isSearching && searchResults.contacts.length > 0 && (
 <div className="px-3 py-2">
 <p className="text-label text-muted-foreground uppercase tracking-wide px-1 mb-2">Contacts</p>
 {searchResults.contacts.map(contact => (
 <div
 key={contact.id}
 onClick={() => handleStartChat(contact)}
 className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/40 cursor-pointer transition-colors rounded-xl"
 >
 <ContactAvatar 
 contact={{ name: contact.contact_name || contact.username, avatar_url: contact.avatar_url }} 
 size={40} 
 />
 <div className="flex-1 min-w-0">
 <p className="font-medium text-secondary truncate">
 <HighlightText text={contact.contact_name || contact.username || 'Unknown'} query={searchQuery} />
 </p>
 {contact.contact_phone && (
 <p className="text-label text-muted-foreground truncate">
 <HighlightText text={contact.contact_phone} query={searchQuery} />
 </p>
 )}
 </div>
 {!contact.is_registered && (
 <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">Invite</span>
 )}
 {startingChat === contact.id && <Loader2 className="w-4 h-4 animate-spin" />}
 </div>
 ))}
 </div>
 )}

 {/* Platform users section (discover new people) */}
 {isSearching && searchResults.platformUsers.length > 0 && (
 <div className="px-3 py-2">
 <p className="text-label text-muted-foreground uppercase tracking-wide px-1 mb-2">
 People on Chatr {searchingPlatform && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
 </p>
 {searchResults.platformUsers.map(user => (
 <div
 key={user.id}
 onClick={() => handleStartChatWithUser(user)}
 className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/40 cursor-pointer transition-colors rounded-xl"
 >
 <div className="relative">
 <ContactAvatar 
 contact={{ name: user.username, avatar_url: user.avatar_url }} 
 size={40} 
 />
 {isUserOnline(user.id) && (
 <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-secondary truncate">
 <HighlightText text={user.username || 'User'} query={searchQuery} />
 </p>
 {user.phone_number && (
 <p className="text-label text-muted-foreground truncate">
 <HighlightText text={user.phone_number} query={searchQuery} />
 </p>
 )}
 </div>
 <span className="text-[10px] px-2 py-0.5 bg-primary/10 rounded-full text-primary">Message</span>
 {startingChat === user.id && <Loader2 className="w-4 h-4 animate-spin" />}
 </div>
 ))}
 </div>
 )}

 {/* Unknown numbers section */}
 {isSearching && searchResults.unknownNumbers.length > 0 && (
 <div className="px-3 py-2">
 <p className="text-label text-muted-foreground uppercase tracking-wide px-1 mb-2">Unknown Numbers</p>
 {searchResults.unknownNumbers.map(number => (
 <div
 key={number}
 className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/40 cursor-pointer transition-colors rounded-xl"
 >
 <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
 <Phone className="w-4 h-4 text-muted-foreground" />
 </div>
 <div className="flex-1">
 <p className="font-medium text-secondary">+{number}</p>
 <p className="text-label text-muted-foreground">Not in contacts</p>
 </div>
 <Button size="sm" variant="ghost" className="h-8 text-label">
 <UserPlus className="w-3 h-3 mr-1" /> Add
 </Button>
 </div>
 ))}
 </div>
 )}

 {/* Conversations section */}
 {searchResults.conversations.length > 0 && (
 <div className={isSearching && (searchResults.contacts.length > 0 || searchResults.unknownNumbers.length > 0) ? 'px-3 py-2' : ''}>
 {isSearching && (searchResults.contacts.length > 0 || searchResults.unknownNumbers.length > 0) && (
 <p className="text-label text-muted-foreground uppercase tracking-wide px-1 mb-2">Chats</p>
 )}
 {searchResults.conversations.map(conv => {
 const rawDisplayName = conv.is_group ? conv.group_name : (conv.other_user?.username || 'User');
 const rawPhone = conv.other_user?.phone_number || '';
 
 // Strict name resolution rule
 const resolveContactName = (rawName: string, phoneStr: string) => {
 const cleanName = (rawName || '').replace(/_fb/i, '');
 if (!cleanName || /^\d+$/.test(cleanName.replace(/\D/g, ''))) {
 return `Unknown Contact`;
 }
 return cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
 };
 
 const resolvedName = resolveContactName(rawDisplayName || '', rawPhone);
 const isUnknown = !conv.is_group && (!resolvedName || resolvedName === 'Unknown Contact');
 const displayName = isUnknown ? formatPhone(rawPhone || rawDisplayName) : resolvedName;
 
 const lastMessage = conv.last_message;
 const isRead = lastMessage?.read_at != null;
 const isSent = lastMessage?.sender_id === userId;
 const messagePreview = lastMessage?.content ? formatMessageContent(lastMessage.content) : 'Start chatting';
 const isOnline = conv.other_user?.id ? isUserOnline(conv.other_user.id) : false;
 const isPinned = pinnedConversations.includes(conv.id);

 // Deterministic color
 let hash = 0;
 for (let i = 0; i < displayName.length; i++) hash = displayName.charCodeAt(i) + ((hash << 5) - hash);
 const colors = ['bg-[#6C63FF]', 'bg-[#00BFA5]', 'bg-[#F59E0B]'];
 const avatarBg = colors[Math.abs(hash) % colors.length];

 // Timestamp logic
 const formatCustomTimestamp = (dateString: string) => {
 const date = new Date(dateString);
 const now = new Date();
 const diffMins = (now.getTime() - date.getTime()) / 60000;
 const diffHours = diffMins / 60;
 if (diffMins < 60) return `${Math.max(1, Math.floor(diffMins))}m`;
 if (diffHours < 24) return `${Math.floor(diffHours)}h`;
 if (diffHours < 48 && now.getDate() !== date.getDate()) return 'Yesterday';
 if (diffHours < 168) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
 return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
 };

 const timestamp = lastMessage?.created_at ? formatCustomTimestamp(lastMessage.created_at) : '';

 return (
 <ConversationContextMenu
 key={conv.id}
 conversationId={conv.id}
 userId={userId}
 isArchived={conv.is_archived}
 isMuted={conv.is_muted}
 isPinned={isPinned}
 onUpdate={loadConversations}
 >
 <div
 onClick={() => {
 onConversationSelect(conv.id, conv.other_user);
 setSearchQuery(''); // Clear search after selection
 }}
 className="flex items-center gap-[12px] px-[12px] py-[10px] min-h-[72px] cursor-pointer transition-colors hover:bg-accent/30 relative"
 >
 <div className="relative shrink-0">
 {isUnknown ? (
 <div style={{
 width: 48, height: 48, borderRadius: '50%',
 background: '#EEEEF4', color: '#9898B3',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 flexShrink: 0
 }}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" 
 stroke="#9898B3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
 <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 
 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .42h3a2 2 0 
 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.18a16 16 
 0 006.29 6.29l1.13-1.13a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 
 2 0 0122 16.92z"/>
 </svg>
 </div>
 ) : (
 <ContactAvatar 
 contact={{ 
 name: conv.is_group ? conv.group_name : displayName, 
 avatar_url: conv.is_group ? conv.group_icon_url : conv.other_user?.avatar_url 
 }} 
 size={48} 
 />
 )}
 {!conv.is_group && isOnline && (
 <div className="absolute bottom-[2px] right-[2px] w-[10px] h-[10px] bg-[#2E7D32] rounded-full border-[2px] border-white z-10" />
 )}
 </div>
 
 {/* Inset Divider container */}
 <div className="flex-1 min-w-0 border-b-[0.5px] border-[#EEEEF4] pb-[10px] self-stretch flex flex-col justify-center">
 <div className="flex justify-between items-baseline mb-[4px]">
 <div className="flex items-center gap-[6px] min-w-0">
 <p className={`text-[15px] text-[#1A1A2E] truncate ${(conv.unread_count || 0) > 0 ? 'font-[700]' : 'font-[600]'}`}>
 <HighlightText text={displayName} query={searchQuery} />
 </p>
 {isPinned && <Pin className="w-[12px] h-[12px] text-[#6C63FF] shrink-0" />}
 {conv.is_muted && <BellOff className="w-[12px] h-[12px] text-[#9898B3] shrink-0" />}
 {conv.is_group && <Users className="w-[12px] h-[12px] text-[#9898B3] shrink-0" />}
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {conv.category === 'otp' && <Fingerprint className="w-[14px] h-[14px] text-blue-500" />}
 {conv.category === 'finance' && <CircleDollarSign className="w-[14px] h-[14px] text-emerald-500" />}
 {conv.category === 'shopping' && <ShoppingCart className="w-[14px] h-[14px] text-orange-500" />}
 {conv.category === 'work' && <Briefcase className="w-[14px] h-[14px] text-purple-500" />}
 <span className={`text-[12px] ${(!isRead && !isSent) || (conv.unread_count || 0) > 0 ? 'text-[#6C63FF] font-[600]' : 'text-[#3D3D5C]'}`}>
 {timestamp}
 </span>
 </div>
 </div>
 
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-[4px] min-w-0 flex-1">
 {isSent && lastMessage && (
 isRead 
 ? <CheckCheck className="w-[14px] h-[14px] text-[#00BFA5] shrink-0" /> 
 : <Check className="w-[14px] h-[14px] text-[#9898B3] shrink-0" />
 )}
 <p className={`text-[13px] truncate ${(conv.unread_count || 0) > 0 || (!isRead && !isSent) ? 'font-[600] text-[#1A1A2E]' : 'font-[400] text-[#9898B3]'}`}>
 <HighlightText text={messagePreview} query={searchQuery} />
 </p>
 </div>
 {/* Unread Badge overrides */}
 {(conv.unread_count || 0) > 0 ? (
 <div className="bg-[#6C63FF] text-white text-[11px] font-[600] px-[6px] py-[2px] rounded-full min-w-[20px] text-center shrink-0">
 {(conv.unread_count || 0) > 99 ? '99+' : conv.unread_count}
 </div>
 ) : isUnknown ? (
 <button 
 onClick={(e) => { e.stopPropagation(); setSaveContactTarget(conv); }}
 style={{
 background: '#EDE8FF', color: '#6C63FF',
 border: 'none', borderRadius: 20,
 padding: '4px 12px', fontSize: 12, fontWeight: 600,
 cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap'
 }}>
 + Save
 </button>
 ) : null}
 </div>
 </div>
 </div>
 </ConversationContextMenu>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* FAB */}
 <div className="absolute bottom-[24px] right-[24px] z-20">
 <ContactsDrawer
 userId={userId}
 onStartChat={(conversationId, contactName, avatarUrl) => {
 onConversationSelect(conversationId, { username: contactName, avatar_url: avatarUrl });
 }}
 >
 <Button 
 className="w-[56px] h-[56px] rounded-full bg-[#6C63FF] hover:bg-[#4A44CC] shadow-lg flex items-center justify-center text-white"
 >
 <MessageCircle className="w-[24px] h-[24px]" />
 </Button>
 </ContactsDrawer>
 </div>
 
 {saveContactTarget && (
 <SaveContactSheet 
 contact={saveContactTarget} 
 onSave={(updated) => {
 // Optimistically update the UI by modifying the conversation list
 setConversations(prev => prev.map(c => 
 c.id === updated.id 
 ? { ...c, other_user: { ...c.other_user, username: updated.contact_name, full_name: updated.contact_name } } 
 : c
 ));
 }}
 onClose={() => setSaveContactTarget(null)} 
 />
 )}

 <CommunicationMemoryDialog
 isOpen={showMemory}
 onClose={() => setShowMemory(false)}
 onJumpToConversation={(convId) => {
 onConversationSelect(convId);
 }}
 />
 </div>
 );
};
