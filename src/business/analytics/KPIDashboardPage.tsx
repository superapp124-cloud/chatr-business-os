import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, AlertCircle, Clock, Zap, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface KPIMetrics {
 success_rate: number;
 avg_duration: number;
 total_runs: number;
 ai_usage_pct: number;
}

export default function KPIDashboard() {
 const [metrics, setMetrics] = useState<KPIMetrics>({ success_rate: 0, avg_duration: 0, total_runs: 0, ai_usage_pct: 0 });
 const [chartData, setChartData] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 async function fetchKPIs() {
 try {
 const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
 
 // Fetch runs from the last 30 days
 const { data: runs, error } = await supabase
 .from('workflow_runs')
 .select('status, duration_ms, started_at, ai_inference_ms')
 .gte('started_at', thirtyDaysAgo);

 if (error) throw error;
 if (!runs) return;

 // Calculate aggregate metrics
 const completed = runs.filter(r => r.status === 'completed');
 const failed = runs.filter(r => r.status === 'failed');
 const total = completed.length + failed.length; // Exclude pending/running for success rate
 
 const successRate = total > 0 ? (completed.length / total) * 100 : 0;
 
 const avgDuration = completed.length > 0 
 ? completed.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / completed.length 
 : 0;
 
 const aiRuns = runs.filter(r => (r.ai_inference_ms || 0) > 0).length;
 const aiUsagePct = runs.length > 0 ? (aiRuns / runs.length) * 100 : 0;

 setMetrics({
 success_rate: Math.round(successRate * 10) / 10,
 avg_duration: Math.round(avgDuration),
 total_runs: runs.length,
 ai_usage_pct: Math.round(aiUsagePct)
 });

 // Prepare chart data (group by day)
 const dailyData: Record<string, { date: string, success: number, fail: number }> = {};
 
 // Initialize last 30 days with 0s
 for (let i = 29; i >= 0; i--) {
 const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
 const dateStr = d.toISOString().split('T')[0];
 dailyData[dateStr] = { date: dateStr, success: 0, fail: 0 };
 }

 runs.forEach(r => {
 if (!r.started_at) return;
 const dateStr = r.started_at.split('T')[0];
 if (dailyData[dateStr]) {
 if (r.status === 'completed') dailyData[dateStr].success++;
 if (r.status === 'failed') dailyData[dateStr].fail++;
 }
 });

 setChartData(Object.values(dailyData));
 } catch (err) {
 console.error('Error fetching KPIs:', err);
 } finally {
 setLoading(false);
 }
 }

 fetchKPIs();
 }, []);

 if (loading) {
 return <div className="flex h-screen items-center justify-center bg-[#0a0a0f]"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>;
 }

 return (
 <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
 <div className="max-w-7xl mx-auto space-y-6">
 <div>
 <h1 className="text-page font-bold tracking-tight">Business KPIs</h1>
 <p className="text-secondary text-slate-400 mt-1">Platform performance and adoption metrics over the last 30 days.</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <Card className="bg-slate-900/60 border-slate-800">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-secondary font-medium text-slate-400">Success Rate</p>
 <p className="text-display text-white mt-2">{metrics.success_rate}%</p>
 </div>
 <div className={`p-3 rounded-full ${metrics.success_rate >= 95 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
 <Target className="w-6 h-6" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="bg-slate-900/60 border-slate-800">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-secondary font-medium text-slate-400">Total Executions</p>
 <p className="text-display text-white mt-2">{metrics.total_runs.toLocaleString()}</p>
 </div>
 <div className="p-3 rounded-full bg-blue-500/20 text-blue-400">
 <TrendingUp className="w-6 h-6" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="bg-slate-900/60 border-slate-800">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-secondary font-medium text-slate-400">Avg Completion Time</p>
 <p className="text-display text-white mt-2">{metrics.avg_duration}ms</p>
 </div>
 <div className="p-3 rounded-full bg-purple-500/20 text-purple-400">
 <Clock className="w-6 h-6" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="bg-slate-900/60 border-slate-800">
 <CardContent className="p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-secondary font-medium text-slate-400">AI Workflow Adoption</p>
 <p className="text-display text-white mt-2">{metrics.ai_usage_pct}%</p>
 </div>
 <div className="p-3 rounded-full bg-cyan-500/20 text-cyan-400">
 <Zap className="w-6 h-6" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 <Card className="bg-slate-900/60 border-slate-800">
 <CardHeader>
 <CardTitle className="text-body text-slate-300">Execution Volume (30 Days)</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="h-80 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
 <defs>
 <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
 </linearGradient>
 <linearGradient id="colorFail" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
 <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
 <YAxis stroke="#64748b" fontSize={12} />
 <Tooltip 
 contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
 itemStyle={{ color: '#f8fafc' }}
 />
 <Area type="monotone" dataKey="success" stackId="1" stroke="#10b981" fill="url(#colorSuccess)" name="Successful" />
 <Area type="monotone" dataKey="fail" stackId="2" stroke="#ef4444" fill="url(#colorFail)" name="Failed" />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 );
}
