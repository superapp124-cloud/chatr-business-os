import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessageBubble } from './MessageBubble';
import { MessageListSkeleton } from './MessageListSkeleton';
import { SwipeableMessage } from '../SwipeableMessage';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConversationReceipt } from './ConversationReceipt';

const VIRTUAL_LIST_START_INDEX = 100000;

interface Message {
 id: string;
 content: string;
 sender_id: string;
 created_at: string;
 message_type?: string;
 media_url?: string;
 read_at?: string;
 is_starred?: boolean;
 is_edited?: boolean;
 reactions?: any[];
 status?: string;
 isReceipt?: boolean;
 receiptType?: string;
 receiptTitle?: string;
 receiptDetails?: { label: string; value: string }[];
}

interface TrueVirtualMessageListProps {
 messages: Message[];
 userId: string;
 otherUser?: {
 username: string;
 avatar_url?: string;
 };
 currentUser?: {
 username?: string;
 avatar_url?: string;
 };
 onLoadMore?: () => void;
 hasMore?: boolean;
 isLoading?: boolean;
 onForward?: (message: Message) => void;
 onStar?: (messageId: string) => void;
 onReply?: (message: Message) => void;
 onDelete?: (messageId: string) => void;
 onEdit?: (messageId: string, content: string) => void;
 onPin?: (messageId: string) => void;
 onReport?: (message: Message) => void;
 selectionMode?: boolean;
 selectedMessages?: Set<string>;
 onSelectMessage?: (messageId: string) => void;
}

export const TrueVirtualMessageList = React.memo(({
 messages,
 userId,
 otherUser,
 currentUser,
 onLoadMore,
 hasMore,
 isLoading = false,
 onForward,
 onStar,
 onReply,
 onDelete,
 onEdit,
 onPin,
 onReport,
 selectionMode = false,
 selectedMessages = new Set(),
 onSelectMessage
}: TrueVirtualMessageListProps) => {
 const virtuosoRef = useRef<VirtuosoHandle>(null);
 const wasAtBottom = useRef(true);
 const previousWindowRef = useRef<{ firstId?: string; lastId?: string; length: number }>({ length: 0 });
 const [firstItemIndex, setFirstItemIndex] = useState(VIRTUAL_LIST_START_INDEX);
 const [showScrollButton, setShowScrollButton] = useState(false);
 const [receipts, setReceipts] = useState<Message[]>([]);

 useEffect(() => {
 const handleOutcome = (e: Event) => {
 const customEvent = e as CustomEvent;
 const { type, text, raw } = customEvent.detail;
 
 const details: {label: string, value: string}[] = [];
 if (raw?.entities) {
 Object.entries(raw.entities).forEach(([k, v]) => {
 if (v && typeof v === 'string' && !k.startsWith('_')) {
 details.push({ label: k.charAt(0).toUpperCase() + k.slice(1), value: v });
 } else if (v && typeof v === 'number') {
 details.push({ label: k.charAt(0).toUpperCase() + k.slice(1), value: v.toString() });
 }
 });
 }
 
 if (raw?.verifiedAt) {
 const d = new Date(raw.verifiedAt);
 details.push({ label: 'Scheduled For', value: d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
 }

 const newReceipt: Message = {
 id: `receipt-${Date.now()}-${Math.random()}`,
 content: '',
 sender_id: 'system',
 created_at: new Date().toISOString(),
 isReceipt: true,
 receiptType: type,
 receiptTitle: text.replace('✅ ', ''),
 receiptDetails: details
 };
 
 setReceipts(prev => [...prev, newReceipt]);
 };

 window.addEventListener('chatr:outcome-executed', handleOutcome);
 return () => window.removeEventListener('chatr:outcome-executed', handleOutcome);
 }, []);

 const combinedMessages = React.useMemo(() => {
 const all = [...messages, ...receipts];
 all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
 return all;
 }, [messages, receipts]);

 useEffect(() => {
 const firstId = combinedMessages[0]?.id;
 const lastId = combinedMessages[combinedMessages.length - 1]?.id;
 const previous = previousWindowRef.current;
 const addedCount = combinedMessages.length - previous.length;

 if (combinedMessages.length === 0 || (previous.length > 0 && previous.lastId !== lastId && previous.firstId !== firstId)) {
 setFirstItemIndex(VIRTUAL_LIST_START_INDEX);
 } else if (addedCount > 0 && previous.firstId && previous.firstId !== firstId && previous.lastId === lastId) {
 setFirstItemIndex((current) => Math.max(0, current - addedCount));
 }

 previousWindowRef.current = { firstId, lastId, length: combinedMessages.length };
 }, [combinedMessages]);

 // Auto-scroll to bottom on new messages (like WhatsApp)
 useEffect(() => {
 if (wasAtBottom.current && combinedMessages.length > 0) {
 virtuosoRef.current?.scrollToIndex({
 index: combinedMessages.length - 1,
 behavior: 'smooth'
 });
 }
 }, [combinedMessages.length]);

 const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
 wasAtBottom.current = atBottom;
 setShowScrollButton(!atBottom);
 }, []);

 const scrollToBottom = () => {
 virtuosoRef.current?.scrollToIndex({
 index: combinedMessages.length - 1,
 behavior: 'smooth'
 });
 };

 const handleStartReached = useCallback(() => {
 if (hasMore && !isLoading && onLoadMore) {
 onLoadMore();
 }
 }, [hasMore, isLoading, onLoadMore]);

 const Header = useCallback(() => {
 if (isLoading && hasMore) {
 return (
 <div className="text-center py-3">
 <div className="w-5 h-5 border-2 border-primary/60 border-t-transparent rounded-full animate-spin mx-auto" />
 </div>
 );
 }
 return null;
 }, [isLoading, hasMore]);

 const Footer = useCallback(() => {
 return <div className="h-2" />;
 }, []);

 if (isLoading && combinedMessages.length === 0) {
 return <MessageListSkeleton />;
 }

 if (combinedMessages.length === 0) {
 return (
 <div className="flex-1 flex items-center justify-center p-8">
 <p className="text-muted-foreground bg-background/80 px-4 py-2 rounded-full text-secondary shadow-sm backdrop-blur-sm">
 No messages yet. Send a message to start the conversation!
 </p>
 </div>
 );
 }


 return (
 <div className="flex-1 h-full bg-transparent relative">
 <Virtuoso
 ref={virtuosoRef}
 data={combinedMessages}
 firstItemIndex={firstItemIndex}
 initialTopMostItemIndex={combinedMessages.length > 0 ? combinedMessages.length - 1 : 0}
 atBottomStateChange={handleAtBottomStateChange}
 startReached={handleStartReached}
 overscan={200}
 components={{
 Header,
 Footer
 }}
 itemContent={(index, message) => {
 if (message.isReceipt) {
 return (
 <div className="px-2">
 <ConversationReceipt 
 type={message.receiptType || 'COMMITMENT'}
 title={message.receiptTitle || ''}
 details={message.receiptDetails || []}
 />
 </div>
 );
 }
 
 const isOwn = message.sender_id === userId;
 const prevMessage = index > 0 ? combinedMessages[index - 1] : null;
 
 const msgDate = new Date(message.created_at);
 const prevDate = prevMessage ? new Date(prevMessage.created_at) : null;
 
 const showDateSeparator = !prevDate || msgDate.toDateString() !== prevDate.toDateString();
 const isSameSender = prevMessage?.sender_id === message.sender_id;
 const timeDiff = prevDate ? msgDate.getTime() - prevDate.getTime() : 0;
 const showAvatar = !isSameSender || timeDiff > 120000 || showDateSeparator;

 const getDateLabel = (d: Date) => {
 const today = new Date();
 const yesterday = new Date(today);
 yesterday.setDate(yesterday.getDate() - 1);
 if (d.toDateString() === today.toDateString()) return 'Today';
 if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
 return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
 };

 return (
 <div className="px-2 py-[2px] flex flex-col">
 {showDateSeparator && (
 <div className="flex justify-center my-[16px]">
 <div className="bg-[#FFFFFF] border-[0.5px] border-[#EEEEF4] text-[#3D3D5C] text-[12px] font-[600] px-[12px] py-[4px] rounded-full shadow-sm">
 {getDateLabel(msgDate)}
 </div>
 </div>
 )}
 <SwipeableMessage
 messageId={message.id}
 onReply={() => onReply?.(message)}
 onDelete={() => onDelete?.(message.id)}
 >
 <div className={showAvatar && !showDateSeparator ? 'mt-[8px]' : ''}>
 <MessageBubble
 message={message}
 isOwn={isOwn}
 showAvatar={showAvatar}
 showTimestamp={showAvatar}
 otherUser={otherUser}
 onForward={onForward}
 onStar={onStar}
 onReply={onReply}
 onDelete={onDelete}
 onEdit={onEdit}
 onPin={onPin}
 onReport={onReport}
 selectionMode={selectionMode}
 isSelected={selectedMessages.has(message.id)}
 onSelect={onSelectMessage}
 currentUser={currentUser}
 />
 </div>
 </SwipeableMessage>
 </div>
 );
 }}
 />
 
 {/* Scroll to bottom FAB */}
 {showScrollButton && (
 <div className="absolute bottom-[16px] right-[16px] z-20">
 <Button
 size="icon"
 onClick={scrollToBottom}
 className="w-[40px] h-[40px] rounded-full bg-[#FFFFFF] text-[#3D3D5C] border border-[#EEEEF4] shadow-md hover:bg-[#F5F5FA] transition-all"
 >
 <ChevronDown className="w-[20px] h-[20px]" />
 </Button>
 </div>
 )}
 </div>
 );
});

TrueVirtualMessageList.displayName = 'TrueVirtualMessageList';
