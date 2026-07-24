import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
 MessageCircle, 
 Calendar, 
 Wallet, 
 Heart,
 ChevronRight,
 Bell,
 Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useInstantCache } from '@/hooks/useInstantCache';
import { formatCoinBalanceLabel } from '@/core/platformParity/sharedBalanceFormatter';

interface WidgetData {
 unreadChats: number;
 upcomingAppointments: number;
 walletBalance: number;
 healthAlerts: number;
 pendingNotifications: number;
}

const defaultData: WidgetData = {
 unreadChats: 0,
 upcomingAppointments: 0,
 walletBalance: 0,
 healthAlerts: 0,
 pendingNotifications: 0
};

const fetchWidgetData = async (): Promise<WidgetData> => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return defaultData;

 // All 4 queries run in PARALLEL
 const [unreadRes, notifRes, apptRes, walletRes] = await Promise.all([
 (async () => { 
 try { 
 const { count } = await supabase
 .from('chat_messages')
 .select('*', { count: 'exact', head: true })
 .neq('sender_id', user.id)
 .eq('is_read', false); 
 return count || 0; 
 } catch { return 0; } 
 })(),
 (async () => { try { const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false); return count || 0; } catch { return 0; } })(),
 (async () => { try { const { count } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('patient_id', user.id).gte('appointment_date', new Date().toISOString()); return count || 0; } catch { return 0; } })(),
 (async () => { try { const { data } = await supabase.from('chatr_coin_balances').select('total_coins').eq('user_id', user.id).maybeSingle(); return data?.total_coins || 0; } catch { return 0; } })(),
 ]);

 return {
 unreadChats: unreadRes,
 upcomingAppointments: apptRes,
 walletBalance: walletRes,
 healthAlerts: 0,
 pendingNotifications: notifRes
 };
};

export const ActivityWidgets = () => {
 const navigate = useNavigate();
 const { data, loading } = useInstantCache<WidgetData>('activity-widgets', fetchWidgetData, { 
 ttl: 30 * 1000, // 30 seconds
 pollingInterval: 60 * 1000 // Refresh every minute
 });
 
 const widgetData = data || defaultData;

 const widgets = [
 {
 icon: MessageCircle,
 label: 'Chats',
 value: widgetData.unreadChats > 0 ? `${widgetData.unreadChats} active` : 'No active chats',
 color: 'text-green-500',
 bgColor: 'bg-green-500/5',
 actionText: 'Continue',
 route: '/chat'
 },
 {
 icon: Calendar,
 label: 'Appointments',
 value: widgetData.upcomingAppointments > 0 ? `${widgetData.upcomingAppointments} upcoming` : '0 upcoming',
 color: 'text-blue-500',
 bgColor: 'bg-blue-500/5',
 actionText: 'View all',
 route: '/care'
 },
 {
 icon: Wallet,
 label: 'Points',
 value: formatCoinBalanceLabel(widgetData.walletBalance),
 color: 'text-orange-500',
 bgColor: 'bg-orange-500/5',
 actionText: 'Redeem',
 route: '/chatr-wallet'
 }
 ];

 if (loading) {
 return (
 <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
 {[1, 2, 3].map(i => (
 <div key={i} className="min-w-[160px] h-40 rounded-3xl bg-muted/50 animate-pulse" />
 ))}
 </div>
 );
 }

 return (
 <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
 {widgets.map((widget) => (
 <div
 key={widget.label}
 className={cn(
 "min-w-[160px] flex flex-col p-5 rounded-[2rem] border transition-all",
 "bg-white shadow-sm border-border/40"
 )}
 >
 <div className={cn(
 "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
 widget.bgColor
 )}>
 <widget.icon className={cn("w-6 h-6", widget.color)} strokeWidth={2} />
 </div>
 
 <div className="flex-1 mb-4">
 <p className="text-secondary font-bold text-foreground">{widget.label}</p>
 <p className="text-[13px] text-muted-foreground font-medium">
 {widget.value}
 </p>
 </div>
 
 <button
 onClick={() => navigate(widget.route)}
 className={cn(
 "flex items-center gap-1 text-[13px] font-bold transition-colors w-fit",
 "text-indigo-600 hover:text-indigo-700"
 )}
 >
 {widget.actionText}
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 ))}
 </div>
 );
};
