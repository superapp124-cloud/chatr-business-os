import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Flag, Network, Plus, ArrowRight, Play, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Goal {
 id: string;
 title: string;
 status: string;
}

export const GoalNavigator: React.FC = () => {
 const [goals, setGoals] = useState<Goal[]>([]);
 const [loading, setLoading] = useState(false);
 const [newGoalTitle, setNewGoalTitle] = useState('');

 const fetchGoals = async () => {
 setLoading(true);
 try {
 const graph = await window.electronAPI?.intelligence?.getGoalGraph();
 if (graph && graph.goals) {
 setGoals(graph.goals);
 }
 } catch (error) {
 console.error('Failed to fetch goal graph:', error);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchGoals();
 }, []);

 const handleCreateGoal = async () => {
 if (!newGoalTitle.trim()) return;
 try {
 await window.electronAPI?.intelligence?.createGoal({ title: newGoalTitle });
 setNewGoalTitle('');
 fetchGoals();
 } catch (error) {
 console.error('Failed to create goal:', error);
 }
 };

 return (
 <div className="w-full h-full p-6 animate-fade-in custom-scrollbar overflow-y-auto">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-display tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">Goal Navigator</h1>
 <p className="text-muted-foreground mt-2 text-section">Your long-term aspirations mapped to daily actions.</p>
 </div>
 <Button onClick={fetchGoals} disabled={loading} variant="outline" className="gap-2 rounded-full border-primary/20 hover:bg-primary/5">
 <Network className="w-4 h-4" />
 {loading ? 'Syncing...' : 'Sync Graph'}
 </Button>
 </div>

 <div className="flex gap-4 mb-8">
 <Input 
 placeholder="What is your next big aspiration?" 
 value={newGoalTitle}
 onChange={(e) => setNewGoalTitle(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleCreateGoal()}
 className="rounded-full bg-card/50 border-primary/20 backdrop-blur-md focus-visible:ring-primary h-12 text-section px-6 shadow-sm"
 />
 <Button onClick={handleCreateGoal} className="rounded-full h-12 px-8 shadow-glow gap-2 bg-gradient-primary">
 <Plus className="w-5 h-5" /> Initialize Goal
 </Button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {goals.length === 0 && !loading && (
 <div className="col-span-full text-center p-12 bg-card rounded-3xl border border-border/50 text-muted-foreground">
 <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
 <h3 className="text-workspace font-medium text-foreground mb-2">No active goals</h3>
 <p>Define your first aspiration above to let CHATR begin orchestrating it.</p>
 </div>
 )}

 {goals.map((goal) => (
 <Card key={goal.id} className="border-0 shadow-xl bg-gradient-glass backdrop-blur-xl rounded-3xl overflow-hidden group">
 <div className={`h-1 w-full ${goal.status === 'in_progress' ? 'bg-primary' : 'bg-muted'}`} />
 <CardHeader>
 <div className="flex justify-between items-start">
 <CardTitle className="text-page pr-4">{goal.title}</CardTitle>
 <div className={`px-3 py-1 rounded-full text-label uppercase tracking-wider ${
 goal.status === 'in_progress' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
 }`}>
 {goal.status.replace('_', ' ')}
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 <div className="flex items-center justify-between text-secondary text-muted-foreground">
 <div className="flex items-center gap-1.5"><Flag className="w-4 h-4" /> 3 Milestones</div>
 <div className="flex items-center gap-1.5"><Play className="w-4 h-4" /> 12 Intents executing</div>
 </div>
 
 <div className="space-y-1.5">
 <div className="flex justify-between text-label ">
 <span>Progress to Completion</span>
 <span className="text-primary">45%</span>
 </div>
 <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-primary w-[45%] rounded-full transition-all duration-1000 ease-out" />
 </div>
 </div>

 <div className="p-3 rounded-2xl bg-warning/5 border border-warning/20 flex items-start gap-3 mt-4">
 <AlertCircle className="w-5 h-5 text-warning shrink-0" />
 <div>
 <p className="text-secondary font-medium text-warning">Trajectory Lagging</p>
 <p className="text-label text-muted-foreground mt-0.5">Future Simulator projects a 2 week delay due to bottleneck in "Setup Legal Entity".</p>
 </div>
 </div>
 </div>
 </CardContent>
 <CardFooter className="pt-0 pb-6 px-6">
 <Button variant="ghost" className="w-full justify-between hover:bg-primary/5 hover:text-primary transition-colors rounded-xl">
 Open Strategy Graph <ArrowRight className="w-4 h-4" />
 </Button>
 </CardFooter>
 </Card>
 ))}
 </div>
 </div>
 );
};
