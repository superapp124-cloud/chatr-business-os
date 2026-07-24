import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useService, usePlatformReady } from '@/platform/Infrastructure/PlatformContext';
import type { PlatformNotification } from '@/platform/Domain/Collaboration/NotificationService';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
 Bell, BellOff, CheckCheck, Archive, CornerUpRight, MessageSquare,
 CheckCircle2, Calendar, FileText, Users, Zap, Sparkles, X,
 Filter, Loader2, ArrowRight, AlertCircle
} from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifFilter = 'all' | 'unread' | 'mentions' | 'tasks' | 'meetings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const relTime = (dateStr: string): string => {
 try {
 const d = new Date(dateStr);
 if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true });
 if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
 return format(d, 'dd MMM');
 } catch { return ''; }
};

const NOTIF_ICON: Record<string, React.ElementType> = {
 mention: MessageSquare,
 task_assigned: CheckCircle2,
 meeting_reminder: Calendar,
 file_shared: FileText,
 comment: CornerUpRight,
 reaction: Sparkles,
 system: Zap,
};

const NOTIF_COLOR: Record<string, string> = {
 mention: 'text-violet-400 bg-violet-500/10',
 task_assigned: 'text-emerald-400 bg-emerald-500/10',
 meeting_reminder: 'text-blue-400 bg-blue-500/10',
 file_shared: 'text-amber-400 bg-amber-500/10',
 comment: 'text-indigo-400 bg-indigo-500/10',
 reaction: 'text-pink-400 bg-pink-500/10',
 system: 'text-zinc-400 bg-zinc-500/10',
};

// ─── Notification Card ────────────────────────────────────────────────────────

const NotificationCard: React.FC<{
 notif: PlatformNotification;
 onMarkRead: (id: string) => void;
 onArchive: (id: string) => void;
 onNavigate: (url?: string) => void;
}> = ({ notif, onMarkRead, onArchive, onNavigate }) => {
 const Icon = NOTIF_ICON[notif.type] || Zap;
 const colorClass = NOTIF_COLOR[notif.type] || NOTIF_COLOR.system;
 const [iconColor, bgColor] = colorClass.split(' ');

 return (
 <div
 className={cn(
 'group relative flex gap-3 px-4 py-3.5 border-b border-white/[0.04] cursor-pointer transition-colors',
 !notif.isRead
 ? 'bg-violet-500/[0.04] hover:bg-violet-500/[0.07]'
 : 'hover:bg-white/[0.03]'
 )}
 onClick={() => {
 if (!notif.isRead) onMarkRead(notif.id);
 if (notif.actionUrl) onNavigate(notif.actionUrl);
 }}
 >
 {/* Unread dot */}
 {!notif.isRead && (
 <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-500" />
 )}

 {/* Icon */}
 <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bgColor)}>
 <Icon className={cn('w-4 h-4', iconColor)} />
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2">
 <p className={cn('text-[13px] leading-snug', notif.isRead ? 'text-white/60' : 'text-white/85 font-medium')}>
 {notif.title}
 </p>
 <span className="text-[10px] text-white/25 shrink-0 mt-0.5">{relTime(notif.createdAt)}</span>
 </div>

 {notif.body && (
 <p className="text-[12px] text-white/40 mt-0.5 line-clamp-2">{notif.body}</p>
 )}

 {notif.actionUrl && (
 <div className="flex items-center gap-1 mt-1.5 text-[11px] text-violet-400/70 font-medium">
 <ArrowRight className="w-3 h-3" />
 <span>Open</span>
 </div>
 )}
 </div>

 {/* Hover actions */}
 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 {!notif.isRead && (
 <button
 onClick={e => { e.stopPropagation(); onMarkRead(notif.id); }}
 title="Mark as read"
 className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
 >
 <CheckCheck className="w-3.5 h-3.5" />
 </button>
 )}
 <button
 onClick={e => { e.stopPropagation(); onArchive(notif.id); }}
 title="Archive"
 className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors"
 >
 <Archive className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const DesktopNotifications: React.FC = () => {
 const isReady = usePlatformReady();
 const notificationService = useService<any>('NotificationService');

 const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
 const [filter, setFilter] = useState<NotifFilter>('all');
 const [isLoading, setIsLoading] = useState(true);
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);

 // Load user
 useEffect(() => {
 supabase.auth.getUser().then(({ data: { user } }) => {
 if (user) setCurrentUserId(user.id);
 });
 }, []);

 // Load notifications
 const loadNotifications = useCallback(async () => {
 if (!currentUserId || !notificationService) return;
 setIsLoading(true);
 try {
 const items = await notificationService.getNotifications(currentUserId, 50);
 setNotifications(items);
 } catch (err) {
 console.error('[DesktopNotifications] load failed', err);
 } finally {
 setIsLoading(false);
 }
 }, [currentUserId, notificationService]);

 useEffect(() => {
 if (isReady && currentUserId && notificationService) {
 loadNotifications();
 }
 }, [isReady, currentUserId, notificationService, loadNotifications]);

 // Subscribe to new notifications
 useEffect(() => {
 if (!notificationService) return;
 const unsub = notificationService.onNewNotification((n: PlatformNotification) => {
 setNotifications(prev => [n, ...prev]);
 });
 return () => unsub?.();
 }, [notificationService]);

 // Handlers
 const handleMarkRead = useCallback(async (id: string) => {
 await notificationService?.markAsRead(id);
 setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
 }, [notificationService]);

 const handleMarkAllRead = useCallback(async () => {
 if (!currentUserId) return;
 await notificationService?.markAllAsRead(currentUserId);
 setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
 }, [notificationService, currentUserId]);

 const handleArchive = useCallback(async (id: string) => {
 await notificationService?.archiveNotification(id);
 setNotifications(prev => prev.filter(n => n.id !== id));
 }, [notificationService]);

 const handleNavigate = useCallback((url?: string) => {
    if (url) {
      if (url.startsWith('/')) {
        window.location.href = window.location.origin + url;
      } else {
        window.location.href = url;
      }
    }
  }, []);

 // Filtered list
 const filtered = notifications.filter(n => {
 if (filter === 'unread') return !n.isRead;
 if (filter === 'mentions') return n.type === 'mention';
 if (filter === 'tasks') return n.type === 'task_assigned';
 if (filter === 'meetings') return n.type === 'meeting_reminder';
 return true;
 });

 const unreadCount = notifications.filter(n => !n.isRead).length;

 const FILTERS: Array<{ key: NotifFilter; label: string }> = [
 { key: 'all', label: 'All' },
 { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
 { key: 'mentions', label: 'Mentions' },
 { key: 'tasks', label: 'Tasks' },
 { key: 'meetings', label: 'Meetings' },
 ];

 return (
 <div className="flex flex-col h-full bg-[#0a0a12] text-white font-sans">

 {/* Header */}
 <div className="px-6 pt-6 pb-4 shrink-0 border-b border-white/[0.06]">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
 <Bell className="w-4.5 h-4.5 text-violet-400" />
 </div>
 <div>
 <h1 className="text-section font-bold text-white">Notifications</h1>
 <p className="text-label text-white/40">
 {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {unreadCount > 0 && (
 <button
 onClick={handleMarkAllRead}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-button border border-white/10 text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
 >
 <CheckCheck className="w-3.5 h-3.5" />
 Mark all read
 </button>
 )}
 </div>
 </div>

 {/* Filter tabs */}
 <div className="flex items-center gap-1">
 {FILTERS.map(f => (
 <button
 key={f.key}
 onClick={() => setFilter(f.key)}
 className={cn(
 'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
 filter === f.key
 ? 'bg-violet-600/25 text-violet-300 border border-violet-500/30'
 : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
 )}
 >
 {f.label}
 </button>
 ))}
 </div>
 </div>

 {/* Notification list */}
 <ScrollArea className="flex-1">
 {isLoading ? (
 <div className="flex items-center justify-center py-24">
 <div className="flex flex-col items-center gap-3">
 <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
 <p className="text-label text-white/30">Loading notifications…</p>
 </div>
 </div>
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-24 text-center px-8">
 <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
 {filter === 'unread' ? (
 <CheckCheck className="w-7 h-7 text-emerald-400/40" />
 ) : (
 <BellOff className="w-7 h-7 text-white/20" />
 )}
 </div>
 <p className="text-secondary font-semibold text-white/40">
 {filter === 'unread' ? "You're all caught up!" : 'No notifications'}
 </p>
 <p className="text-label text-white/25 mt-1">
 {filter === 'unread'
 ? 'All notifications have been read.'
 : 'Notifications will appear here as your team collaborates.'}
 </p>
 </div>
 ) : (
 <div>
 {filtered.map(notif => (
 <NotificationCard
 key={notif.id}
 notif={notif}
 onMarkRead={handleMarkRead}
 onArchive={handleArchive}
 onNavigate={handleNavigate}
 />
 ))}
 </div>
 )}
 </ScrollArea>

 {/* Footer hint */}
 {filtered.length > 0 && (
 <div className="px-4 py-3 border-t border-white/[0.04] text-center shrink-0">
 <p className="text-[10px] text-white/20">
 Showing {filtered.length} notification{filtered.length !== 1 ? 's' : ''} · Archived notifications are hidden
 </p>
 </div>
 )}
 </div>
 );
};

export default DesktopNotifications;
