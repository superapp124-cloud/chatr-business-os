import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
 Activity, AlertTriangle, CheckCircle, Clock, Cpu, Database, 
 GitBranch, Package, Play, RefreshCw, Users, Zap, XCircle, Loader2 
} from 'lucide-react';

interface OpsMetrics {
 active_runs: number;
 pending_approvals: number;
 failed_runs: number;
 queue_depth: number;
 completed_today: number;
 avg_duration_ms: number;
 error_rate: number;
}

interface ApprovalItem {
 id: string;
 run_id: string;
 routing_type: string;
 created_at: string;
 sla_deadline: string | null;
}

interface RecentRun {
 id: string;
 correlation_id: string;
 status: string;
 trigger_type: string;
 started_at: string;
 duration_ms: number | null;
}

const EMPTY_METRICS: OpsMetrics = {
 active_runs: 0,
 pending_approvals: 0,
 failed_runs: 0,
 queue_depth: 0,
 completed_today: 0,
 avg_duration_ms: 0,
 error_rate: 0,
};

function StatusBadge({ status }: { status: string }) {
 const map: Record<string, string> = {
 running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
 completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
 failed: 'bg-red-500/20 text-red-400 border-red-500/30',
 waiting_approval: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
 pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
 paused: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
 };
 return (
 <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${map[status] ?? map.pending}`}>
 {status.replace(/_/g, ' ')}
 </span>
 );
}

export default function OperationsDashboard() {
 const [metrics, setMetrics] = useState<OpsMetrics>(EMPTY_METRICS);
 const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
 const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

 useEffect(() => {
 loadAll();
 // Real-time subscription for live queue and run updates
 const runsChannel = supabase
 .channel('ops_dashboard_runs')
 .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_runs' }, loadAll)
 .on('postgres_changes', { event: '*', schema: 'public', table: 'execution_queue' }, loadAll)
 .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_approvals' }, loadAll)
 .subscribe();

 return () => { supabase.removeChannel(runsChannel); };
 }, []);

 const loadAll = async () => {
 try {
 const now = new Date();
 const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

 const [runsRes, queueRes, approvalsRes] = await Promise.all([
 supabase.from('workflow_runs').select('id, correlation_id, status, trigger_type, started_at, duration_ms').order('started_at', { ascending: false }).limit(20),
 supabase.from('execution_queue').select('id, status').eq('status', 'pending'),
 supabase.from('workflow_approvals').select('id, run_id, routing_type, created_at, sla_deadline').eq('status', 'pending'),
 ]);

 const runs = runsRes.data ?? [];
 setRecentRuns(runs as RecentRun[]);
 setPendingApprovals((approvalsRes.data ?? []) as ApprovalItem[]);

 const activeRuns = runs.filter(r => r.status === 'running').length;
 const failedRuns = runs.filter(r => r.status === 'failed').length;
 const completedToday = runs.filter(r => r.status === 'completed' && r.started_at >= todayStart).length;
 const completedWithDuration = runs.filter(r => r.status === 'completed' && r.duration_ms);
 const avgDuration = completedWithDuration.length > 0
 ? completedWithDuration.reduce((sum, r) => sum + (r.duration_ms ?? 0), 0) / completedWithDuration.length
 : 0;

 setMetrics({
 active_runs: activeRuns,
 pending_approvals: (approvalsRes.data ?? []).length,
 failed_runs: failedRuns,
 queue_depth: (queueRes.data ?? []).length,
 completed_today: completedToday,
 avg_duration_ms: Math.round(avgDuration),
 error_rate: runs.length > 0 ? Math.round((failedRuns / runs.length) * 100) : 0,
 });

 setLastRefreshed(new Date());
 } catch (err) {
 console.error('[OperationsDashboard] loadAll error:', err);
 } finally {
 setLoading(false);
 }
 };

 const statCards = [
 { label: 'Active Runs', value: metrics.active_runs, icon: Play, color: 'text-blue-400' },
 { label: 'Pending Approvals', value: metrics.pending_approvals, icon: Clock, color: 'text-amber-400' },
 { label: 'Queue Depth', value: metrics.queue_depth, icon: Database, color: 'text-purple-400' },
 { label: 'Completed Today', value: metrics.completed_today, icon: CheckCircle, color: 'text-emerald-400' },
 { label: 'Failed Runs', value: metrics.failed_runs, icon: XCircle, color: 'text-red-400' },
 { label: 'Avg Duration', value: `${metrics.avg_duration_ms}ms`, icon: Zap, color: 'text-cyan-400' },
 { label: 'Error Rate', value: `${metrics.error_rate}%`, icon: AlertTriangle, color: metrics.error_rate > 10 ? 'text-red-400' : 'text-emerald-400' },
 ];

 return (
 <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
 <div className="max-w-7xl mx-auto space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-page font-bold tracking-tight">Operations Dashboard</h1>
 <p className="text-secondary text-slate-400 mt-1">Single pane of glass — Workflow OS control center</p>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-label text-slate-500">
 Last refreshed: {lastRefreshed.toLocaleTimeString()}
 </span>
 <button
 onClick={loadAll}
 className="flex items-center gap-1.5 text-button px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
 >
 <RefreshCw className="w-3.5 h-3.5" />
 Refresh
 </button>
 </div>
 </div>

 {/* Stat Cards */}
 {loading ? (
 <div className="flex items-center justify-center h-40">
 <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
 </div>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
 {statCards.map(({ label, value, icon: Icon, color }) => (
 <Card key={label} className="bg-slate-900/60 border-slate-800">
 <CardContent className="p-4">
 <Icon className={`w-4 h-4 mb-2 ${color}`} />
 <div className="text-page font-bold tabular-nums">{value}</div>
 <div className="text-label text-slate-500 mt-0.5">{label}</div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 {/* Detail Tabs */}
 <Tabs defaultValue="runs">
 <TabsList className="bg-slate-900 border border-slate-800">
 <TabsTrigger value="runs">Recent Runs</TabsTrigger>
 <TabsTrigger value="approvals">
 Pending Approvals
 {metrics.pending_approvals > 0 && (
 <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full">
 {metrics.pending_approvals}
 </span>
 )}
 </TabsTrigger>
 </TabsList>

 <TabsContent value="runs" className="mt-4">
 <Card className="bg-slate-900/60 border-slate-800">
 <CardHeader className="pb-2">
 <CardTitle className="text-secondary font-medium text-slate-300">Live Execution Feed</CardTitle>
 </CardHeader>
 <CardContent>
 {recentRuns.length === 0 ? (
 <p className="text-secondary text-slate-500 py-4 text-center">No workflow runs yet.</p>
 ) : (
 <div className="space-y-2">
 {recentRuns.map(run => (
 <div key={run.id} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
 <div className="flex items-center gap-3">
 <StatusBadge status={run.status} />
 <div>
 <div className="text-label font-mono text-slate-300">{run.correlation_id?.slice(0, 8) ?? run.id.slice(0, 8)}</div>
 <div className="text-[11px] text-slate-500">{run.trigger_type ?? 'manual'}</div>
 </div>
 </div>
 <div className="text-right">
 {run.duration_ms && (
 <div className="text-label text-slate-400">{run.duration_ms}ms</div>
 )}
 <div className="text-[11px] text-slate-600">
 {new Date(run.started_at).toLocaleTimeString()}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="approvals" className="mt-4">
 <Card className="bg-slate-900/60 border-slate-800">
 <CardHeader className="pb-2">
 <CardTitle className="text-secondary font-medium text-slate-300">Approval Queue</CardTitle>
 </CardHeader>
 <CardContent>
 {pendingApprovals.length === 0 ? (
 <p className="text-secondary text-slate-500 py-4 text-center">No pending approvals.</p>
 ) : (
 <div className="space-y-2">
 {pendingApprovals.map(a => (
 <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
 <div>
 <div className="text-label font-mono text-slate-300">{a.run_id.slice(0, 8)}</div>
 <div className="text-[11px] text-slate-500">{a.routing_type}</div>
 </div>
 <div className="text-right">
 {a.sla_deadline && (
 <div className={`text-label ${new Date(a.sla_deadline) < new Date() ? 'text-red-400' : 'text-amber-400'}`}>
 SLA: {new Date(a.sla_deadline).toLocaleDateString()}
 </div>
 )}
 <div className="text-[11px] text-slate-600">
 Created {new Date(a.created_at).toLocaleDateString()}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 </div>
 );
}
