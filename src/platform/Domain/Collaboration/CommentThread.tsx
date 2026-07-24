import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
 MessageSquare, Send, CheckCircle2, Circle, CornerUpRight,
 MoreHorizontal, Smile, X, Loader2, Check
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Comment {
 id: string;
 userId: string;
 content: string;
 parentCommentId?: string;
 isResolved: boolean;
 reactions: Record<string, string[]>;
 mentions: string[];
 createdAt: string;
 // Joined from profile
 authorName: string;
 authorAvatar?: string;
 // Nested replies
 replies?: Comment[];
}

interface CommentThreadProps {
 entityType: 'task' | 'file' | 'meeting' | 'message' | 'canvas_node';
 entityId: string;
 workspaceId: string;
 className?: string;
 onClose?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const relTime = (dateStr: string): string => {
 try {
 const d = new Date(dateStr);
 if (isToday(d)) return format(d, 'HH:mm');
 if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
 return format(d, 'dd MMM, HH:mm');
 } catch { return ''; }
};

const REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏', '🔥'];

// ─── Comment Item ─────────────────────────────────────────────────────────────

const CommentItem: React.FC<{
 comment: Comment;
 currentUserId: string;
 onReply: (commentId: string, authorName: string) => void;
 onReact: (commentId: string, emoji: string) => void;
 onResolve: (commentId: string, resolved: boolean) => void;
 isReply?: boolean;
}> = ({ comment, currentUserId, onReply, onReact, onResolve, isReply = false }) => {
 const [showReactions, setShowReactions] = useState(false);

 const initials = comment.authorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
 const isOwn = comment.userId === currentUserId;
 const totalReactions = Object.values(comment.reactions || {}).flat().length;

 return (
 <div className={cn(
 'group relative flex gap-2.5',
 isReply && 'pl-8',
 comment.isResolved && 'opacity-50'
 )}>
 {/* Thread line for replies */}
 {isReply && (
 <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/10" />
 )}

 <Avatar className="w-7 h-7 shrink-0 mt-0.5">
 <AvatarImage src={comment.authorAvatar} />
 <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-500 text-white text-[10px] font-bold">
 {initials}
 </AvatarFallback>
 </Avatar>

 <div className="flex-1 min-w-0">
 {/* Header */}
 <div className="flex items-baseline gap-2 mb-0.5">
 <span className="text-label font-semibold text-white/80">{comment.authorName}</span>
 <span className="text-[10px] text-white/30">{relTime(comment.createdAt)}</span>
 {comment.isResolved && (
 <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">Resolved</span>
 )}
 </div>

 {/* Content */}
 <p className="text-[13px] text-white/75 leading-relaxed whitespace-pre-wrap break-words">
 {comment.content}
 </p>

 {/* Reactions */}
 {Object.keys(comment.reactions || {}).length > 0 && (
 <div className="flex flex-wrap gap-1 mt-1.5">
 {Object.entries(comment.reactions).map(([emoji, users]) =>
 users.length > 0 ? (
 <button
 key={emoji}
 onClick={() => onReact(comment.id, emoji)}
 className={cn(
 'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors',
 users.includes(currentUserId)
 ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
 : 'bg-white/[0.05] border-white/10 text-white/60 hover:bg-white/10'
 )}
 >
 <span>{emoji}</span>
 <span className="font-medium">{users.length}</span>
 </button>
 ) : null
 )}
 </div>
 )}

 {/* Actions (shown on hover) */}
 <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
 {/* Reply */}
 {!isReply && (
 <button
 onClick={() => onReply(comment.id, comment.authorName)}
 className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
 >
 <CornerUpRight className="w-3 h-3" />
 <span>Reply</span>
 </button>
 )}

 {/* Emoji react */}
 <div className="relative">
 <button
 onClick={() => setShowReactions(!showReactions)}
 className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
 >
 <Smile className="w-3 h-3" />
 </button>
 {showReactions && (
 <>
 <div className="fixed inset-0 z-10" onClick={() => setShowReactions(false)} />
 <div className="absolute bottom-full mb-1 left-0 z-20 flex gap-1 bg-zinc-900 border border-white/10 rounded-xl p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
 {REACTIONS.map(emoji => (
 <button
 key={emoji}
 onClick={() => { onReact(comment.id, emoji); setShowReactions(false); }}
 className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-body transition-colors"
 >
 {emoji}
 </button>
 ))}
 </div>
 </>
 )}
 </div>

 {/* Resolve (own comment or any for now) */}
 <button
 onClick={() => onResolve(comment.id, !comment.isResolved)}
 className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
 >
 {comment.isResolved ? <Circle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
 <span>{comment.isResolved ? 'Reopen' : 'Resolve'}</span>
 </button>
 </div>

 {/* Nested replies */}
 {comment.replies && comment.replies.length > 0 && (
 <div className="mt-3 space-y-3">
 {comment.replies.map(reply => (
 <CommentItem
 key={reply.id}
 comment={reply}
 currentUserId={currentUserId}
 onReply={onReply}
 onReact={onReact}
 onResolve={onResolve}
 isReply
 />
 ))}
 </div>
 )}
 </div>
 </div>
 );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const CommentThread: React.FC<CommentThreadProps> = ({
 entityType,
 entityId,
 workspaceId,
 className,
 onClose,
}) => {
 const [comments, setComments] = useState<Comment[]>([]);
 const [currentUserId, setCurrentUserId] = useState<string>('');
 const [newComment, setNewComment] = useState('');
 const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [isSending, setIsSending] = useState(false);
 const inputRef = useRef<HTMLTextAreaElement>(null);
 const realtimeChannel = useRef<any>(null);

 // ── Load user ──────────────────────────────────────────────────────────────
 useEffect(() => {
 supabase.auth.getUser().then(({ data: { user } }) => {
 if (user) setCurrentUserId(user.id);
 });
 }, []);

 // ── Load comments ──────────────────────────────────────────────────────────
 const loadComments = useCallback(async () => {
 try {
 const { data, error } = await supabase
 .from('comments')
 .select(`
 *,
 profiles:user_id (full_name, avatar_url)
 `)
 .eq('entity_type', entityType)
 .eq('entity_id', entityId)
 .is('parent_comment_id', null)
 .order('created_at', { ascending: true });

 if (error) throw error;

 // Load replies
 const topLevel = await Promise.all((data || []).map(async (row: any) => {
 const { data: replyData } = await supabase
 .from('comments')
 .select('*, profiles:user_id (full_name, avatar_url)')
 .eq('parent_comment_id', row.id)
 .order('created_at', { ascending: true });

 const mapRow = (r: any): Comment => ({
 id: r.id,
 userId: r.user_id,
 content: r.content,
 parentCommentId: r.parent_comment_id,
 isResolved: r.is_resolved || false,
 reactions: r.reactions || {},
 mentions: r.mentions || [],
 createdAt: r.created_at,
 authorName: r.profiles?.full_name || 'Unknown',
 authorAvatar: r.profiles?.avatar_url,
 });

 return { ...mapRow(row), replies: (replyData || []).map(mapRow) };
 }));

 setComments(topLevel);
 } catch (err) {
 console.error('[CommentThread] loadComments failed', err);
 } finally {
 setIsLoading(false);
 }
 }, [entityType, entityId]);

 useEffect(() => { loadComments(); }, [loadComments]);

 // ── Realtime subscription ──────────────────────────────────────────────────
 useEffect(() => {
 realtimeChannel.current = supabase
 .channel(`comments:${entityType}:${entityId}`)
 .on(
 'postgres_changes',
 { event: '*', schema: 'public', table: 'comments',
 filter: `entity_id=eq.${entityId}` },
 () => { loadComments(); }
 )
 .subscribe();

 return () => {
 if (realtimeChannel.current) supabase.removeChannel(realtimeChannel.current);
 };
 }, [entityType, entityId, loadComments]);

 // ── Send comment ───────────────────────────────────────────────────────────
 const handleSend = useCallback(async () => {
 if (!newComment.trim() || !currentUserId || isSending) return;
 setIsSending(true);
 try {
 await supabase.from('comments').insert({
 workspace_id: workspaceId,
 entity_type: entityType,
 entity_id: entityId,
 user_id: currentUserId,
 content: newComment.trim(),
 parent_comment_id: replyingTo?.id || null,
 });
 setNewComment('');
 setReplyingTo(null);
 } catch (err) {
 console.error('[CommentThread] send failed', err);
 } finally {
 setIsSending(false);
 }
 }, [newComment, currentUserId, workspaceId, entityType, entityId, replyingTo, isSending]);

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSend();
 }
 };

 // ── React to a comment ─────────────────────────────────────────────────────
 const handleReact = useCallback(async (commentId: string, emoji: string) => {
 if (!currentUserId) return;
 const comment = comments.find(c => c.id === commentId) ||
 comments.flatMap(c => c.replies || []).find(r => r.id === commentId);
 if (!comment) return;

 const reactions = { ...comment.reactions };
 const users = reactions[emoji] || [];
 if (users.includes(currentUserId)) {
 reactions[emoji] = users.filter(u => u !== currentUserId);
 } else {
 reactions[emoji] = [...users, currentUserId];
 }

 await supabase.from('comments').update({ reactions }).eq('id', commentId);
 }, [comments, currentUserId]);

 // ── Resolve a comment ──────────────────────────────────────────────────────
 const handleResolve = useCallback(async (commentId: string, resolved: boolean) => {
 await supabase.from('comments').update({
 is_resolved: resolved,
 resolved_by: resolved ? currentUserId : null,
 resolved_at: resolved ? new Date().toISOString() : null,
 }).eq('id', commentId);
 }, [currentUserId]);

 const unresolvedCount = comments.filter(c => !c.isResolved).length;

 return (
 <div className={cn(
 'flex flex-col h-full bg-zinc-900/95 border-l border-white/[0.06]',
 className
 )}>
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
 <div className="flex items-center gap-2">
 <MessageSquare className="w-4 h-4 text-violet-400" />
 <span className="text-secondary font-bold text-white/90">Comments</span>
 {unresolvedCount > 0 && (
 <span className="px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-[10px] font-bold">
 {unresolvedCount} open
 </span>
 )}
 </div>
 {onClose && (
 <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/70 transition-colors">
 <X className="w-4 h-4" />
 </button>
 )}
 </div>

 {/* Comments list */}
 <ScrollArea className="flex-1 px-4">
 <div className="py-4 space-y-5">
 {isLoading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
 </div>
 ) : comments.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
 <MessageSquare className="w-5 h-5 text-white/20" />
 </div>
 <p className="text-secondary text-white/30 font-medium">No comments yet</p>
 <p className="text-label text-white/20 mt-1">Be the first to leave a comment</p>
 </div>
 ) : (
 comments.map(comment => (
 <CommentItem
 key={comment.id}
 comment={comment}
 currentUserId={currentUserId}
 onReply={(id, name) => {
 setReplyingTo({ id, name });
 setTimeout(() => inputRef.current?.focus(), 50);
 }}
 onReact={handleReact}
 onResolve={handleResolve}
 />
 ))
 )}
 </div>
 </ScrollArea>

 {/* Input area */}
 <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] shrink-0">
 {replyingTo && (
 <div className="flex items-center justify-between mb-2 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
 <span className="text-[11px] text-violet-300 flex items-center gap-1">
 <CornerUpRight className="w-3 h-3" />
 Replying to <strong>{replyingTo.name}</strong>
 </span>
 <button onClick={() => setReplyingTo(null)} className="text-white/30 hover:text-white/60">
 <X className="w-3 h-3" />
 </button>
 </div>
 )}
 <div className="flex gap-2 items-end">
 <textarea
 ref={inputRef}
 value={newComment}
 onChange={e => setNewComment(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Add a comment… (Enter to send, Shift+Enter for new line)"
 rows={2}
 className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
 />
 <button
 onClick={handleSend}
 disabled={!newComment.trim() || isSending}
 className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-lg shadow-violet-500/20 shrink-0"
 >
 {isSending ? (
 <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
 ) : (
 <Send className="w-3.5 h-3.5 text-white" />
 )}
 </button>
 </div>
 </div>
 </div>
 );
};
