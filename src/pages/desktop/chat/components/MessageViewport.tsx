import React, { useEffect, useRef } from 'react';
import { BrainCircuit, Loader2, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { format, isToday, isYesterday } from 'date-fns';
import type { Message } from '../types';

interface MessageViewportProps {
 messages: Message[];
 currentUserId: string | null;
 isUploading: boolean;
 isAiLoading: boolean;
 typingUsers: Record<string, NodeJS.Timeout>;
 onFullscreenImage: (url: string) => void;
 onReact: (msg: Message) => void;
 onReply: (msg: Message) => void;
 onForward: (msg: Message) => void;
 onAskAI: (msg: Message) => void;
}

export const MessageViewport: React.FC<MessageViewportProps> = React.memo(({
 messages,
 currentUserId,
 isUploading,
 isAiLoading,
 typingUsers,
 onFullscreenImage,
 onReact,
 onReply,
 onForward,
 onAskAI
}) => {
 const messagesEndRef = useRef<HTMLDivElement>(null);

 // Auto-scroll on new messages
 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [messages.length, isUploading, isAiLoading, Object.keys(typingUsers).length]);

 return (
 <ScrollArea className="flex-1 relative z-10">
 <div className="p-5 space-y-6">
 {messages.map((msg) => {
 const isOwn = msg.senderId === currentUserId;
 const dateObj = new Date(msg.createdAt);
 const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 const displayTime = isToday(dateObj) ? time : (isYesterday(dateObj) ? `Yesterday ${time}` : `${dateObj.toLocaleDateString()} ${time}`);
 
 // Map AI system messages to proper UI
 const isAI = Boolean(msg.isAi || msg.senderId === 'chatr-ai' || msg.senderName === 'CHATR AI' || msg.senderId === '11111111-1111-1111-1111-111111111111' || msg.actorId === '11111111-1111-1111-1111-111111111111');
 const avatar = isAI ? 'AI' : (msg.senderName ? msg.senderName.substring(0, 2).toUpperCase() : 'U');
 const senderName = isAI ? 'CHATR AI' : (msg.senderName || 'Unknown User');

 return (
 <div key={msg.id} className={cn("flex gap-3 group relative animate-in fade-in slide-in-from-bottom-2", isOwn ? "flex-row-reverse" : "flex-row")}>
 
 {/* Avatar (only for others) */}
 {!isOwn && (
 <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-1 overflow-hidden",
 isAI ? 'bg-transparent border border-violet-500/30 shadow-md shadow-violet-500/20' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
 )}>
 {isAI ? <img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-full h-full object-cover rounded-[8px]" /> : (msg.senderAvatar ? <img src={msg.senderAvatar} className="w-full h-full rounded-[8px] object-cover" /> : avatar)}
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

 <MessageBubble
 msg={msg}
 isOwn={isOwn}
 isAI={isAI}
 displayTime={displayTime}
 onFullscreenImage={onFullscreenImage}
 onReact={() => onReact(msg)}
 onReply={() => onReply(msg)}
 onForward={() => onForward(msg)}
 onAskAI={() => onAskAI(msg)}
 />
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
 );
});
