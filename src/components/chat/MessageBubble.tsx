import React, { useState, memo, useCallback, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, isToday, isYesterday } from 'date-fns';
import { Check, CheckCheck, MapPin, FileText, Timer, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { WhatsAppContextMenu } from './WhatsAppContextMenu';
import { PollMessageWrapper } from './PollMessageWrapper';
import { ContactMessage } from './ContactMessage';
import { EventMessage } from './EventMessage';
import { PaymentMessage } from './PaymentMessage';
import { MediaLightbox } from './MediaLightbox';
import { EncryptionIndicator } from './EncryptionIndicator';
import { autoSaveReceivedMedia } from '@/utils/mediaGallery';
import { highlightMentions } from './MentionInput';
import { MessageTranslateButton } from './MessageTranslateButton';
import { LinkPreviewCard } from './LinkPreviewCard';
import { VoiceTranscript } from './VoiceTranscript';
import { MessageReactions } from './MessageReactions';
import { ChatrShieldWarning } from './ChatrShieldWarning';
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { ContactAvatar } from '../shared/ContactAvatar';

function MessageAvatar({ contact, isOwn }: { contact: any, isOwn?: boolean }) {
 const getInitials = (name: string) => {
 if (!name) return '?';
 const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
 if (!clean) return '?';
 
 const digits = clean.replace(/\s+/g, '');
 if (/^\d+$/.test(digits)) {
 return digits.slice(0, 2);
 }
 
 const parts = clean.split(/\s+/).filter(Boolean);
 if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
 return clean.slice(0, 2).toUpperCase();
 };

 const displayName = contact?.username || contact?.phone_number || contact?.name || (isOwn ? 'Me' : 'Unknown');
 const label = getInitials(displayName);
 
 const colors = [
 { bg: '#EDE8FF', text: '#6C63FF' }, // Purple
 { bg: '#E0F7F4', text: '#00BFA5' }, // Teal
 { bg: '#FAEEDA', text: '#FF8F00' }, // Amber
 { bg: '#FCE4EC', text: '#F06292' }, // Pink
 { bg: '#E3F2FD', text: '#2196F3' }, // Blue
 ];
 
 const hashString = (str: string) => {
 let hash = 0;
 for (let i = 0; i < str.length; i++) {
 hash = str.charCodeAt(i) + ((hash << 5) - hash);
 }
 return hash;
 };

 const idx = Math.abs(hashString(displayName || '')) % colors.length;
 const color = colors[idx];

 if (contact?.avatar_url) {
 return (
 <div style={{
 width: 32, height: 32, borderRadius: '50%', flexShrink: 0, alignSelf: 'flex-end',
 overflow: 'hidden', border: '1px solid rgba(255,255,255,0.8)',
 boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
 marginBottom: 4
 }}>
 <img src={contact.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
 </div>
 );
 }

 return (
 <div style={{
 width: 32, height: 32, borderRadius: '50%', flexShrink: 0, alignSelf: 'flex-end',
 background: color.bg, color: color.text,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 10, fontWeight: 800,
 border: '1px solid rgba(255,255,255,0.8)',
 boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
 marginBottom: 4
 }}>
 {label || '?'}
 </div>
 );
}

interface Message {
 id: string;
 content: string;
 sender_id: string;
 created_at: string;
 read_at?: string;
 message_type?: string;
 media_url?: string;
 media_attachments?: any;
 is_starred?: boolean;
 is_edited?: boolean;
 is_encrypted?: boolean;
 decrypted?: boolean;
 decryptionFailed?: boolean;
 reactions?: any[];
 reply_to?: string;
 expires_at?: string;
 replied_message?: {
 id: string;
 content: string;
 sender_id: string;
 };
 message_security_scans?: any[];
}

interface MessageBubbleProps {
 message: Message;
 isOwn: boolean;
 showAvatar: boolean;
 otherUser?: {
 username: string;
 avatar_url?: string;
 };
 onReply?: (message: Message) => void;
 onStar?: (messageId: string) => void;
 onForward?: (message: Message) => void;
 onDelete?: (messageId: string) => void;
 onEdit?: (messageId: string, content: string) => void;
 onPin?: (messageId: string) => void;
 onReport?: (message: Message) => void;
 isSelected?: boolean;
 onSelect?: (messageId: string) => void;
 selectionMode?: boolean;
 showTimestamp?: boolean;
 onScanImage?: (mediaUrl: string) => void;
 currentUser?: {
 username?: string;
 avatar_url?: string;
 };
}

const MessageBubbleComponent = ({ 
 message, 
 isOwn, 
 showAvatar, 
 otherUser,
 onReply,
 onStar,
 onForward,
 onDelete,
 onEdit,
 onPin,
 onReport,
 isSelected = false,
 onSelect,
 selectionMode = false,
 showTimestamp = true,
 onScanImage,
 currentUser
}: MessageBubbleProps) => {
 const [showMenu, setShowMenu] = useState(false);
 const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
 const [showDeleteDialog, setShowDeleteDialog] = useState(false);
 const [isLongPressing, setIsLongPressing] = useState(false);
 const [showMediaViewer, setShowMediaViewer] = useState(false);
 const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
 const [lightboxMedia, setLightboxMedia] = useState<any[]>([]);
 const [lightboxIndex, setLightboxIndex] = useState(0);
 const longPressTimerRef = React.useRef<NodeJS.Timeout>();
 const touchStartPosRef = React.useRef({ x: 0, y: 0 });
 const autoSaveAttemptedRef = React.useRef(false);
 const [contextMenu, setContextMenu] = useState<{messageId: string, x: number, y: number} | null>(null);

 // Auto-save received media (once per message)
 useEffect(() => {
 if (!isOwn && !autoSaveAttemptedRef.current && message.media_url && 
 (message.message_type === 'image' || message.message_type === 'video')) {
 autoSaveAttemptedRef.current = true;
 autoSaveReceivedMedia(
 message.media_url,
 `chatr-${message.id}`,
 message.message_type as 'image' | 'video'
 );
 }
 }, [message, isOwn]);

 const formatMessageTime = (date: Date) => {
 if (isToday(date)) {
 return format(date, 'HH:mm');
 } else if (isYesterday(date)) {
 return 'Yesterday ' + format(date, 'HH:mm');
 } else {
 return format(date, 'MMM dd, HH:mm');
 }
 };

 const handleTouchStart = useCallback((e: React.TouchEvent) => {
 if (selectionMode) {
 onSelect?.(message.id);
 return;
 }
 
 const touch = e.touches[0];
 touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
 
 setIsLongPressing(false);
 longPressTimerRef.current = setTimeout(() => {
 setIsLongPressing(true);
 setContextMenu({ messageId: message.id, x: touch.clientX, y: touch.clientY });
 // Vibrate on long press if available
 if (navigator.vibrate) {
 navigator.vibrate(50);
 }
 }, 500);
 }, [selectionMode, message.id, onSelect]);

 const handleTouchMove = useCallback((e: React.TouchEvent) => {
 const touch = e.touches[0];
 const moveThreshold = 10;
 const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
 const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
 
 if (dx > moveThreshold || dy > moveThreshold) {
 if (longPressTimerRef.current) {
 clearTimeout(longPressTimerRef.current);
 }
 }
 }, []);

 const handleTouchEnd = useCallback(() => {
 setIsLongPressing(false);
 if (longPressTimerRef.current) {
 clearTimeout(longPressTimerRef.current);
 }
 }, []);

 const handleCopy = () => {
 navigator.clipboard.writeText(message.content);
 toast.success('Message copied');
 };

 const handleStar = () => {
 onStar?.(message.id);
 toast.success(message.is_starred ? 'Message unstarred' : 'Message starred');
 };

 const handleDownload = () => {
 if (message.media_url) {
 window.open(message.media_url, '_blank');
 toast.success('Download started');
 }
 };

 const handleShare = () => {
 if (navigator.share) {
 navigator.share({
 text: message.content,
 url: message.media_url
 });
 } else {
 handleCopy();
 }
 };

 const extractLocationCoords = (content: string) => {
 const match = content.match(/q=([^&]+)/);
 return match ? match[1] : '';
 };

 const handlePin = () => {
 console.log('Pin clicked', message.id);
 // Store pinned messages in localStorage for now
 const pinnedKey = `pinned_messages`;
 const pinned = JSON.parse(localStorage.getItem(pinnedKey) || '[]');
 
 if (!pinned.includes(message.id)) {
 pinned.push(message.id);
 localStorage.setItem(pinnedKey, JSON.stringify(pinned));
 toast.success('Message pinned');
 } else {
 const filtered = pinned.filter((id: string) => id !== message.id);
 localStorage.setItem(pinnedKey, JSON.stringify(filtered));
 toast.success('Message unpinned');
 }
 };

 const handleReport = () => {
 // Simple report with confirmation
 toast.success('Message reported to moderators');
 console.log('Reported message:', message.id);
 };

 const handleReply = () => {
 console.log('Reply clicked', { hasOnReply: !!onReply, message: message.id });
 if (onReply) {
 onReply(message);
 } else {
 toast.error('Reply handler not connected');
 }
 };

 const handleForward = () => {
 if (onForward) {
 onForward(message);
 }
 };

 const handleDelete = () => {
 console.log('Delete clicked', { hasOnDelete: !!onDelete, message: message.id });
 if (onDelete) {
 setShowDeleteDialog(true);
 } else {
 toast.error('Delete handler not connected');
 }
 };

 const confirmDelete = async () => {
 setShowDeleteDialog(false);
 setShowMenu(false); // Close the context menu
 console.log('Confirm delete', message.id);
 if (onDelete) {
 onDelete(message.id);
 // Toast is shown in Chat.tsx after successful deletion
 }
 };

 const handleStarToggle = async () => {
 console.log('Star clicked', { hasOnStar: !!onStar, message: message.id });
 if (onStar) {
 onStar(message.id);
 } else {
 toast.error('Star handler not connected');
 }
 };

 const handleReact = async (emoji: string) => {
 try {
 await supabase.rpc('toggle_message_reaction', {
 p_message_id: message.id,
 p_user_id: message.sender_id,
 p_emoji: emoji
 });
 toast.success(`Reacted with ${emoji}`);
 } catch (error) {
 console.error('Failed to react:', error);
 }
 };

 const shieldScan = message.message_security_scans?.[0];

 const renderBubbleContent = () => {
 return (
 <>
 {showTimestamp && (
 <div style={{
 textAlign: isOwn ? 'right' : 'left',
 fontSize: 10, color: '#9898B3',
 padding: isOwn ? '1px 14px 0 0' : '1px 0 0 46px',
 marginBottom: 2,
 width: '100%'
 }}>
 {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
 </div>
 )}
 <motion.div
 initial={{ opacity: 0, y: 8, scale: 0.96 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
 id={`message-${message.id}`}
 className={`flex gap-2 w-full mb-[2px] px-[4px] transition-all duration-200 ${
 isOwn ? 'flex-row-reverse' : 'flex-row'
 } ${isSelected ? 'bg-[#6C63FF]/10 ring-1 ring-[#6C63FF]/20' : ''} ${isOwn ? 'message-send-animation' : 'message-receive-animation'}`}
 onTouchStart={handleTouchStart}
 onTouchMove={handleTouchMove}
 onTouchEnd={handleTouchEnd}
 onContextMenu={(e) => {
 e.preventDefault();
 setContextMenu({ messageId: message.id, x: e.clientX, y: e.clientY });
 }}
 >
 {/* Selection checkbox */}
 {selectionMode && (
 <div className={`shrink-0 ${isOwn ? 'order-last' : 'order-first'}`}>
 <div 
 className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
 isSelected 
 ? 'bg-primary border-primary' 
 : 'border-muted-foreground/40 bg-background'
 }`}
 >
 {isSelected && <Check className="w-3 h-3 text-white" />}
 </div>
 </div>
 )}
 
 {!selectionMode && !isOwn && (
 showAvatar ? (
 <MessageAvatar 
 contact={otherUser} 
 isOwn={false} 
 />
 ) : (
 <div className="w-[32px] shrink-0" />
 )
 )}

 <div className={`flex flex-col gap-0.5 max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
 {/* Multiple media attachments - Images/Videos */}
 {(() => {
 const hasMediaAttachments = message.media_attachments && 
 (Array.isArray(message.media_attachments) ? message.media_attachments.length > 0 : Object.keys(message.media_attachments).length > 0);
 const isMediaType = message.message_type === 'image' || message.message_type === 'video';
 
 if (hasMediaAttachments && isMediaType) {
 const attachments = Array.isArray(message.media_attachments) ? message.media_attachments : [message.media_attachments];
 
 const mediaItems = attachments.map((media: any) => ({
 url: media.url,
 type: message.message_type as 'image' | 'video',
 filename: media.name,
 path: media.url.split('/chat-media/')[1] // Extract storage path
 }));

 return (
 <div className="max-w-[280px]">
 <div className={`grid gap-1 mb-1 ${attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
 {attachments.map((media: any, idx: number) => (
 <div key={idx} className="relative group/image">
 {message.message_type === 'image' ? (
 <>
 <img 
 src={media.url} 
 alt={media.name || `Image ${idx + 1}`} 
 className="w-full h-32 object-cover hover:opacity-90 transition-opacity rounded-xl cursor-pointer" 
 onClick={() => {
 if (!selectionMode) {
 setLightboxMedia(mediaItems);
 setLightboxIndex(idx);
 }
 }}
 />
 {onScanImage && !selectionMode && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onScanImage(media.url);
 }}
 className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 opacity-0 group-hover/image:opacity-100 transition-opacity backdrop-blur-sm"
 title="Scan with AI Vision"
 >
 <Sparkles className="w-4 h-4" />
 </button>
 )}
 </>
 ) : (
 <video 
 src={media.url} 
 className="w-full h-32 object-cover hover:opacity-90 transition-opacity rounded-xl"
 />
 )}
 </div>
 ))}
 </div>
 <MediaLightbox
 media={mediaItems}
 initialIndex={lightboxIndex}
 open={lightboxMedia.length > 0 && lightboxMedia === mediaItems}
 onClose={() => setLightboxMedia([])}
 />
 {/* Caption if present */}
 {message.content && !message.content.startsWith('image_') && !message.content.startsWith('photo_') && (
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.2 }}
 className={`rounded-2xl px-4 py-2.5 mt-1 shadow-sm ${
 isOwn
 ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 text-white shadow-purple-500/20'
 : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
 }`}
 >
 <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
 {message.content}
 </p>
 </motion.div>
 )}
 </div>
 );
 }
 return null;
 })()}
 
 {/* Single image (legacy) */}
 {message.media_url && message.message_type === 'image' && !message.media_attachments && (() => {
 return (
 <div className="relative group/single-image">
 <img 
 src={message.media_url} 
 alt="Shared media" 
 className="rounded-2xl max-w-[240px] max-h-[240px] object-cover mb-1 cursor-pointer hover:opacity-90 transition-opacity" 
 onClick={() => {
 if (!selectionMode) {
 setLightboxMedia([{
 id: '0',
 type: 'image',
 url: message.media_url!
 }]);
 setLightboxIndex(0);
 }
 }}
 />
 <MediaLightbox
 media={lightboxMedia}
 initialIndex={lightboxIndex}
 open={lightboxMedia.length > 0 && lightboxMedia[0].url === message.media_url}
 onClose={() => setLightboxMedia([])}
 />
 {onScanImage && !selectionMode && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onScanImage(message.media_url!);
 }}
 className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 opacity-0 group-hover/single-image:opacity-100 transition-opacity backdrop-blur-sm z-10 shadow-sm"
 title="Scan with AI Vision"
 >
 <Sparkles className="w-4 h-4" />
 </button>
 )}
 </div>
 );
 })()}

 {/* Poll message */}
 {message.message_type === 'poll' && message.content.startsWith('[Poll]') && (() => {
 try {
 const pollData = JSON.parse(message.content.replace('[Poll] ', ''));
 return (
 <PollMessageWrapper 
 messageId={message.id}
 data={pollData}
 isOwn={isOwn}
 />
 );
 } catch (error) {
 console.error('Failed to parse poll data:', error);
 return <div className="text-secondary text-muted-foreground">Invalid poll data</div>;
 }
 })()}

 {/* Contact message */}
 {message.message_type === 'contact' && message.content.startsWith('[Contact]') && (
 <ContactMessage 
 content={message.content.replace(/\[Contact\]\s*\[Contact\]\s*/g, '[Contact] ')} 
 isOwn={isOwn}
 />
 )}

 {/* Event message */}
 {message.message_type === 'event' && message.content.startsWith('[Event]') && (() => {
 try {
 const eventData = JSON.parse(message.content.replace('[Event] ', ''));
 return <EventMessage data={eventData} isOwn={isOwn} />;
 } catch (error) {
 console.error('Failed to parse event data:', error);
 return <div className="text-secondary text-muted-foreground">Invalid event data</div>;
 }
 })()}

 {/* Payment message */}
 {message.message_type === 'payment' && message.content.startsWith('[Payment]') && (() => {
 try {
 const paymentData = JSON.parse(message.content.replace('[Payment] ', ''));
 return <PaymentMessage data={paymentData} />;
 } catch (error) {
 console.error('Failed to parse payment data:', error);
 return <div className="text-secondary text-muted-foreground">Invalid payment data</div>;
 }
 })()}

 {/* Location message with map preview */}
 {message.message_type === 'location' && message.content && message.content.includes('maps.google.com') && (() => {
 console.log('📍 Rendering location:', message.content);
 return (
 <div className={`rounded-2xl overflow-hidden border ${isOwn ? 'border-teal-600/20' : 'border-border'} mb-1 max-w-[280px] bg-background`}>
 <iframe
 src={`https://maps.google.com/maps?q=${extractLocationCoords(message.content)}&output=embed`}
 className="w-full h-40"
 loading="lazy"
 title="Location"
 />
 <div className={`p-3 ${isOwn ? 'bg-teal-600/10' : 'bg-muted/50'}`}>
 <a
 href={message.content.split(' ').pop()}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-2 text-primary font-medium text-secondary hover:underline"
 >
 <MapPin className="w-4 h-4" />
 View in Maps
 </a>
 </div>
 </div>
 );
 })()}

 {/* Document message */}
 {message.message_type === 'document' && message.media_attachments && (() => {
 const attachments = Array.isArray(message.media_attachments) ? message.media_attachments : [message.media_attachments];
 if (attachments.length === 0) return null;
 
 const doc = attachments[0];
 console.log('📄 Rendering document:', doc);
 const fileUrl = doc.url;
 const fileName = doc.name || 'Document';
 const fileSize = doc.size;
 
 const formatSize = (bytes?: number) => {
 if (!bytes) return '';
 if (bytes < 1024) return bytes + ' B';
 if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
 return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
 };
 
 return (
 <a
 href={fileUrl}
 target="_blank"
 rel="noopener noreferrer"
 className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors shadow-sm ${
 isOwn 
 ? 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-purple-500/20 hover:from-indigo-500/20 hover:to-purple-500/20' 
 : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
 } max-w-[280px]`}
 >
 <div className="p-2 rounded-lg bg-primary/10">
 <FileText className="w-5 h-5 text-primary" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-medium text-secondary truncate">{fileName}</p>
 <p className="text-label text-muted-foreground">{formatSize(fileSize) || 'Tap to download'}</p>
 </div>
 </a>
 );
 })()}
 
 {/* Reply Preview - Show quoted message */}
 {message.replied_message && (
 <div className={`mb-2 rounded-lg p-2 border-l-4 ${
 isOwn 
 ? 'bg-teal-700/20 border-teal-400' 
 : 'bg-muted/60 border-primary'
 }`}>
 <p className="text-label text-muted-foreground mb-0.5">
 Replying to {message.replied_message.sender_id === message.sender_id ? 'yourself' : otherUser?.username}
 </p>
 <p className="text-label text-muted-foreground line-clamp-2">
 {message.replied_message.content}
 </p>
 </div>
 )}
 
 {/* Regular text message - ONLY if not a special type */}
 {!message.media_url && 
 message.message_type !== 'location' && 
 message.message_type !== 'poll' && 
 message.message_type !== 'contact' &&
 message.message_type !== 'event' &&
 message.message_type !== 'payment' &&
 message.message_type !== 'image' &&
 message.message_type !== 'video' &&
 message.message_type !== 'document' && (
 <motion.div 
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 transition={{ duration: 0.2, ease: "easeOut" }}
 className={`min-w-[64px] px-[16px] py-[10px] transition-all shadow-sm ${
 isLongPressing ? 'scale-95 opacity-70' : ''
 } ${
 isOwn
 ? 'rounded-[18px] rounded-tr-[4px] bg-[#6C63FF] text-white'
 : 'rounded-[18px] rounded-tl-[4px] bg-[#FFFFFF] border-[0.5px] border-[#EEEEF4] text-[#1A1A2E]'
 }`}
 >
 <p className="text-[15px] leading-[1.4] whitespace-pre-wrap break-words">
 {highlightMentions(message.content)}
 </p>
 </motion.div>
 )}

 {/* Link Preview for URLs in message */}
 {message.content?.match(/https?:\/\/[^\s]+/) && message.message_type !== 'location' && (
 <LinkPreviewCard 
 url={message.content.match(/https?:\/\/[^\s]+/)?.[0] || ''} 
 className="mt-1"
 />
 )}

 {/* Voice Transcript for voice messages */}
 {message.message_type === 'voice' && message.media_url && (
 <VoiceTranscript 
 audioUrl={message.media_url} 
 messageId={message.id}
 className="mt-1"
 />
 )}

 {/* Message Reactions */}
 {message.reactions && message.reactions.length > 0 && (
 <MessageReactions
 reactions={message.reactions}
 userId={message.sender_id}
 onReact={async (emoji) => {
 await supabase.rpc('toggle_message_reaction', {
 p_message_id: message.id,
 p_user_id: message.sender_id,
 p_emoji: emoji
 });
 }}
 isOwn={isOwn}
 />
 )}

 <div className="flex items-center gap-[4px] px-1.5 mt-1 self-end">
 {/* Encryption indicator */}
 {message.is_encrypted && (
 <EncryptionIndicator
 isEncrypted={message.is_encrypted}
 decrypted={message.decrypted}
 decryptionFailed={message.decryptionFailed}
 size="sm"
 />
 )}
 {message.expires_at && (
 <span title="This message will disappear">
 <Timer className="w-[12px] h-[12px] text-[#9898B3]" />
 </span>
 )}
 {isOwn && (
 <span title={message.read_at ? "Read" : "Delivered"}>
 {message.read_at ? (
 <CheckCheck className="w-[14px] h-[14px] text-[#00BFA5]" />
 ) : (
 <Check className={`w-[14px] h-[14px] text-[#9898B3]`} />
 )}
 </span>
 )}
 {message.is_edited && (
 <span className={`text-[10px] text-[#9898B3]`}>(edited)</span>
 )}
 </div>
 </div>

 {/* Delete confirmation dialog */}
 <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
 <AlertDialogContent className="sm:max-w-[90%] max-w-[320px]">
 <AlertDialogHeader>
 <AlertDialogTitle>Delete message?</AlertDialogTitle>
 <AlertDialogDescription>
 This message will be deleted. This action cannot be undone.
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel onClick={() => setShowMenu(false)}>Cancel</AlertDialogCancel>
 <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
 Delete
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

 {contextMenu?.messageId === message.id && (
 <div style={{
 position: 'fixed',
 top: Math.min(contextMenu.y, window.innerHeight - 180),
 left: Math.min(contextMenu.x, window.innerWidth - 160),
 background: 'white', borderRadius: 12,
 boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
 zIndex: 500, overflow: 'hidden', minWidth: 140
 }}>
 {[
 { label: '↩ Reply', action: () => handleReply() },
 { label: '📋 Copy', action: () => handleCopy() },
 { label: '🗑 Delete', action: () => setShowDeleteDialog(true), danger: true },
 ].map(item => (
 <button key={item.label} onClick={(e) => { e.stopPropagation(); item.action(); setContextMenu(null); }}
 style={{
 display: 'block', width: '100%', padding: '11px 16px',
 background: 'none', border: 'none', cursor: 'pointer',
 textAlign: 'left', fontSize: 14,
 color: item.danger ? '#E53935' : '#1A1A2E',
 borderBottom: '0.5px solid #EEEEF4'
 }}>
 {item.label}
 </button>
 ))}
 </div>
 )}
 </motion.div>
 </>
 );
 };

 if (shieldScan && !isOwn) {
 return (
 <ChatrShieldWarning scan={shieldScan}>
 {renderBubbleContent()}
 </ChatrShieldWarning>
 );
 }

 return renderBubbleContent();
};

export const MessageBubble = memo(MessageBubbleComponent);
