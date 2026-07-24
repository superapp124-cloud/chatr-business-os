import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Target, Zap, Clock, CheckCircle2 } from 'lucide-react';

interface ActionPlanItem {
 action: 'automate' | 'defer' | 'recommend';
 intent?: any;
 reason?: string;
 suggestion?: string;
}

export const MissionControl: React.FC = () => {
 const [actionPlan, setActionPlan] = useState<ActionPlanItem[]>([]);
 const [loading, setLoading] = useState(false);

 const fetchActionPlan = async () => {
 setLoading(true);
 try {
 const plan = await window.electronAPI?.intelligence?.getDailyActionPlan();
 if (plan) setActionPlan(plan);
 } catch (error) {
 console.error('Failed to fetch action plan:', error);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchActionPlan();
 }, []);

 return (
 <div className="w-full h-full p-6 animate-fade-in custom-scrollbar overflow-y-auto">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-display tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">Mission Control</h1>
 <p className="text-muted-foreground mt-2 text-section">Your daily cognitive overview.</p>
 </div>
 <Button onClick={fetchActionPlan} disabled={loading} variant="outline" className="gap-2 rounded-full border-primary/20 hover:bg-primary/5">
 <Activity className="w-4 h-4" />
 {loading ? 'Analyzing...' : 'Refresh Overview'}
 </Button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
 <Card className="border-0 shadow-xl bg-gradient-glass backdrop-blur-xl">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-secondary font-medium text-muted-foreground">Active Focus</CardTitle>
 <Target className="w-4 h-4 text-primary" />
 </CardHeader>
 <CardContent>
 <div className="text-page font-bold">Deep Work</div>
 <p className="text-label text-muted-foreground mt-1">2 hours remaining</p>
 </CardContent>
 </Card>

 <Card className="border-0 shadow-xl bg-gradient-glass backdrop-blur-xl">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-secondary font-medium text-muted-foreground">Automated Today</CardTitle>
 <Zap className="w-4 h-4 text-primary" />
 </CardHeader>
 <CardContent>
 <div className="text-page font-bold">4 Tasks</div>
 <p className="text-label text-success flex items-center mt-1">
 <CheckCircle2 className="w-3 h-3 mr-1" /> +2 hours saved
 </p>
 </CardContent>
 </Card>

 <Card className="border-0 shadow-xl bg-gradient-glass backdrop-blur-xl">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-secondary font-medium text-muted-foreground">Next Routine</CardTitle>
 <Clock className="w-4 h-4 text-primary" />
 </CardHeader>
 <CardContent>
 <div className="text-page font-bold">Evening Review</div>
 <p className="text-label text-muted-foreground mt-1">Scheduled for 8:00 PM</p>
 </CardContent>
 </Card>
 </div>

 <h2 className="text-page mb-4 text-foreground flex items-center">
 <Zap className="w-5 h-5 mr-2 text-primary" /> Recommended Action Plan
 </h2>
 <div className="grid grid-cols-1 gap-4">
 {actionPlan.length === 0 && !loading && (
 <div className="text-muted-foreground text-center p-8 bg-card rounded-3xl border border-border/50">
 No actionable items for today. You are all caught up.
 </div>
 )}
 {actionPlan.map((item, index) => (
 <Card key={index} className="border border-border/50 shadow-md hover:shadow-lg transition-shadow duration-300 rounded-2xl overflow-hidden group">
 <div className={`h-1 w-full ${item.action === 'automate' ? 'bg-success' : item.action === 'defer' ? 'bg-warning' : 'bg-primary'}`} />
 <CardContent className="p-6">
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className={`text-label font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
 item.action === 'automate' ? 'bg-success/10 text-success' :
 item.action === 'defer' ? 'bg-warning/10 text-warning' :
 'bg-primary/10 text-primary'
 }`}>
 {item.action}
 </span>
 </div>
 <h3 className="text-section font-medium text-card-foreground">
 {item.intent?.action || item.suggestion || 'Review required'}
 </h3>
 <p className="text-secondary text-muted-foreground mt-2">
 {item.reason || 'Calculated by Executive Engine'}
 </p>
 </div>
 {item.action === 'automate' && (
 <Button variant="default" className="rounded-full shadow-glow">Execute Now</Button>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 );
};
