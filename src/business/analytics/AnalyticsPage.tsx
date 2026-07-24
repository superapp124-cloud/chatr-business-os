import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
 TrendingUp, Users, MessageSquare, Clock,
 ArrowUpRight, ArrowDownRight, Loader2, BarChart3
} from 'lucide-react';

interface AnalyticsSnapshot {
 total_conversations: number;
 open_conversations: number;
 resolved_conversations: number;
 new_leads: number;
 converted_leads: number;
 total_revenue: number;
 avg_response_time_seconds: number;
 team_members_active: number;
 broadcasts_sent: number;
}

const EMPTY_SNAPSHOT: AnalyticsSnapshot = {
 total_conversations: 0,
 open_conversations: 0,
 resolved_conversations: 0,
 new_leads: 0,
 converted_leads: 0,
 total_revenue: 0,
 avg_response_time_seconds: 0,
 team_members_active: 0,
 broadcasts_sent: 0,
};

export default function BusinessAnalytics() {
 const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
 const [loading, setLoading] = useState(true);
 const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(EMPTY_SNAPSHOT);
 const [prevSnapshot, setPrevSnapshot] = useState<AnalyticsSnapshot>(EMPTY_SNAPSHOT);
 const [businessId, setBusinessId] = useState<string | null>(null);

 useEffect(() => {
 loadBusinessId();
 }, []);

 useEffect(() => {
 if (businessId) loadAnalytics();
 }, [businessId, timeRange]);

 const loadBusinessId = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data } = await supabase
 .from('business_profiles')
 .select('id')
 .eq('user_id', user.id)
 .single();
 if (data) setBusinessId(data.id);
 };

 const loadAnalytics = async () => {
 if (!businessId) return;
 setLoading(true);
 try {
 // Try to load from analytics snapshots table first
 const { data: snapshots } = await supabase
 .from('business_analytics_snapshots')
 .select('*')
 .eq('business_id', businessId)
 .eq('period', timeRange)
 .order('snapshot_date', { ascending: false })
 .limit(2);

 if (snapshots && snapshots.length > 0) {
 const current = snapshots[0];
 setSnapshot({
 total_conversations: current.total_conversations || 0,
 open_conversations: current.open_conversations || 0,
 resolved_conversations: current.resolved_conversations || 0,
 new_leads: current.new_leads || 0,
 converted_leads: current.converted_leads || 0,
 total_revenue: parseFloat(current.total_revenue) || 0,
 avg_response_time_seconds: current.avg_response_time_seconds || 0,
 team_members_active: current.team_members_active || 0,
 broadcasts_sent: current.broadcasts_sent || 0,
 });
 if (snapshots.length > 1) {
 const prev = snapshots[1];
 setPrevSnapshot({
 total_conversations: prev.total_conversations || 0,
 open_conversations: prev.open_conversations || 0,
 resolved_conversations: prev.resolved_conversations || 0,
 new_leads: prev.new_leads || 0,
 converted_leads: prev.converted_leads || 0,
 total_revenue: parseFloat(prev.total_revenue) || 0,
 avg_response_time_seconds: prev.avg_response_time_seconds || 0,
 team_members_active: prev.team_members_active || 0,
 broadcasts_sent: prev.broadcasts_sent || 0,
 });
 }
 } else {
 // Fallback: compute live from raw tables
 const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
 const days = daysMap[timeRange];
 const since = new Date(Date.now() - days * 86400000).toISOString();

 const [conversations, leads, teamMembers, broadcasts] = await Promise.all([
 supabase.from('business_conversations').select('*', { count: 'exact', head: false })
 .eq('business_id', businessId).gte('created_at', since),
 supabase.from('business_leads').select('*', { count: 'exact', head: false })
 .eq('business_id', businessId).gte('created_at', since),
 supabase.from('business_team_members').select('*', { count: 'exact', head: true })
 .eq('business_id', businessId),
 supabase.from('business_broadcasts').select('*', { count: 'exact', head: true })
 .eq('business_id', businessId).eq('status', 'sent').gte('sent_at', since),
 ]);

 const convData = conversations.data || [];
 const leadsData = leads.data || [];

 // Compute deal value
 const { data: deals } = await supabase
 .from('business_deals')
 .select('value')
 .eq('business_id', businessId)
 .eq('status', 'won')
 .gte('created_at', since);
 const totalRevenue = (deals || []).reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

 setSnapshot({
 total_conversations: convData.length,
 open_conversations: convData.filter(c => c.status === 'open').length,
 resolved_conversations: convData.filter(c => c.status === 'resolved').length,
 new_leads: leadsData.length,
 converted_leads: leadsData.filter(l => l.status === 'converted').length,
 total_revenue: totalRevenue,
 avg_response_time_seconds: 0,
 team_members_active: teamMembers.count || 0,
 broadcasts_sent: broadcasts.count || 0,
 });
 setPrevSnapshot(EMPTY_SNAPSHOT);
 }
 } catch (error) {
 console.error('Analytics error:', error);
 } finally {
 setLoading(false);
 }
 };

 const calcGrowth = (current: number, previous: number): number => {
 if (!previous) return current > 0 ? 100 : 0;
 return Math.round(((current - previous) / previous) * 100);
 };

 const formatRevenue = (v: number) =>
 v > 0 ? `₹${v.toLocaleString('en-IN')}` : '₹0';

 const formatResponseTime = (s: number) => {
 if (!s) return '—';
 const m = Math.floor(s / 60);
 return m > 0 ? `${m}m` : `${s}s`;
 };

 const conversionRate = snapshot.new_leads > 0
 ? Math.round((snapshot.converted_leads / snapshot.new_leads) * 100)
 : 0;

 return (
 <div className="min-h-screen bg-background">
 <div className="border-b glass-card relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-hero opacity-5" />
 <div className="max-w-7xl mx-auto px-4 py-6 relative">
 <div className="flex items-center justify-between">
 <div className="animate-fade-in">
 <h1 className="text-display ">Analytics</h1>
 <p className="text-muted-foreground mt-1">Track your business performance</p>
 </div>
 {loading ? (
 <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
 ) : (
 <Badge variant="outline" className="animate-fade-in">Live Data</Badge>
 )}
 </div>
 </div>
 </div>

 <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
 {/* Time Range Selector */}
 <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
 <TabsList className="glass-card">
 <TabsTrigger value="7d">Last 7 days</TabsTrigger>
 <TabsTrigger value="30d">Last 30 days</TabsTrigger>
 <TabsTrigger value="90d">Last 90 days</TabsTrigger>
 </TabsList>
 </Tabs>

 {/* Key Metrics */}
 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {[...Array(4)].map((_, i) => (
 <Card key={i} className="glass-card animate-pulse">
 <CardContent className="h-28" />
 </Card>
 ))}
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {/* Revenue */}
 <Card className="glass-card hover:shadow-glow transition-all animate-fade-in group relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-hero opacity-0 group-hover:opacity-5 transition-opacity" />
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-secondary font-medium">Total Revenue</CardTitle>
 <div className="p-2 rounded-lg bg-primary/10">
 <TrendingUp className="h-4 w-4 text-primary" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-display bg-gradient-hero bg-clip-text text-transparent">
 {formatRevenue(snapshot.total_revenue)}
 </div>
 {prevSnapshot.total_revenue > 0 && (() => {
 const g = calcGrowth(snapshot.total_revenue, prevSnapshot.total_revenue);
 return (
 <div className="flex items-center gap-1 mt-1">
 {g >= 0 ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
 <span className={`text-label ${g >= 0 ? 'text-green-500' : 'text-red-500'}`}>{g > 0 ? '+' : ''}{g}%</span>
 <span className="text-label text-muted-foreground">vs last period</span>
 </div>
 );
 })()}
 </CardContent>
 </Card>

 {/* New Leads */}
 <Card className="glass-card hover:shadow-glow transition-all animate-fade-in group relative overflow-hidden" style={{ animationDelay: '0.1s' }}>
 <div className="absolute inset-0 bg-gradient-hero opacity-0 group-hover:opacity-5 transition-opacity" />
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-secondary font-medium">New Leads</CardTitle>
 <div className="p-2 rounded-lg bg-accent/10">
 <Users className="h-4 w-4 text-accent" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-display bg-gradient-hero bg-clip-text text-transparent">
 {snapshot.new_leads}
 </div>
 <p className="text-label text-muted-foreground mt-1">{snapshot.converted_leads} converted</p>
 </CardContent>
 </Card>

 {/* Conversion Rate */}
 <Card className="glass-card hover:shadow-glow transition-all animate-fade-in group relative overflow-hidden" style={{ animationDelay: '0.2s' }}>
 <div className="absolute inset-0 bg-gradient-hero opacity-0 group-hover:opacity-5 transition-opacity" />
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-secondary font-medium">Conversion Rate</CardTitle>
 <div className="p-2 rounded-lg bg-primary/10">
 <BarChart3 className="h-4 w-4 text-primary" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-display bg-gradient-hero bg-clip-text text-transparent">
 {conversionRate}%
 </div>
 <p className="text-label text-muted-foreground mt-1">{snapshot.total_conversations} conversations</p>
 </CardContent>
 </Card>

 {/* Avg Response Time */}
 <Card className="glass-card hover:shadow-glow transition-all animate-fade-in group relative overflow-hidden" style={{ animationDelay: '0.3s' }}>
 <div className="absolute inset-0 bg-gradient-hero opacity-0 group-hover:opacity-5 transition-opacity" />
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-secondary font-medium">Avg Response Time</CardTitle>
 <div className="p-2 rounded-lg bg-accent/10">
 <Clock className="h-4 w-4 text-accent" />
 </div>
 </CardHeader>
 <CardContent>
 <div className="text-display bg-gradient-hero bg-clip-text text-transparent">
 {formatResponseTime(snapshot.avg_response_time_seconds)}
 </div>
 <p className="text-label text-muted-foreground mt-1">{snapshot.open_conversations} open conversations</p>
 </CardContent>
 </Card>
 </div>
 )}

 {/* Broadcasts & Team */}
 {!loading && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Card className="glass-card animate-fade-in" style={{ animationDelay: '0.4s' }}>
 <CardHeader>
 <CardTitle className="text-body flex items-center gap-2">
 <MessageSquare className="h-4 w-4 text-primary" />
 Broadcasts Sent
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-display bg-gradient-hero bg-clip-text text-transparent">
 {snapshot.broadcasts_sent}
 </div>
 <p className="text-secondary text-muted-foreground mt-1">in the last {timeRange}</p>
 </CardContent>
 </Card>
 <Card className="glass-card animate-fade-in" style={{ animationDelay: '0.5s' }}>
 <CardHeader>
 <CardTitle className="text-body flex items-center gap-2">
 <Users className="h-4 w-4 text-accent" />
 Active Team Members
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-display bg-gradient-hero bg-clip-text text-transparent">
 {snapshot.team_members_active}
 </div>
 <p className="text-secondary text-muted-foreground mt-1">
 {snapshot.resolved_conversations} conversations resolved
 </p>
 </CardContent>
 </Card>
 </div>
 )}
 </div>
 </div>
 );
}
