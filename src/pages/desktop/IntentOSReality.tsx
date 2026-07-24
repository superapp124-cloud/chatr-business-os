import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Database, UserCheck, ShieldCheck, Cpu } from 'lucide-react';

interface WorldModelSnapshot {
 places?: any[];
 preferences?: Record<string, any>;
 accounts?: any[];
 executions?: any[];
 people?: any[];
 companies?: any[];
}

export const IntentOSReality: React.FC = () => {
 const [snapshot, setSnapshot] = useState<WorldModelSnapshot>({});
 const [loading, setLoading] = useState(false);

 const fetchSnapshot = async () => {
 setLoading(true);
 try {
 const data = await window.electronAPI?.kernel?.invoke('worldModel:getSnapshot', undefined);
 if (data) setSnapshot(data);
 } catch (error) {
 console.error('Failed to fetch World Model snapshot:', error);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchSnapshot();
 }, []);

 return (
 <div className="w-full h-full p-6 animate-fade-in custom-scrollbar overflow-y-auto">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-display tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-glow">Personal Twin</h1>
 <p className="text-muted-foreground mt-2 text-section">The World Model's representation of you, securely contained.</p>
 </div>
 <Button onClick={fetchSnapshot} disabled={loading} variant="outline" className="gap-2 rounded-full border-primary/20 hover:bg-primary/5">
 <BrainCircuit className="w-4 h-4" />
 {loading ? 'Reading...' : 'Refresh Model'}
 </Button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
 <Card className="border-0 shadow-lg bg-card/60 backdrop-blur-md rounded-3xl">
 <CardHeader className="pb-2">
 <CardTitle className="text-secondary font-medium text-muted-foreground flex items-center gap-2">
 <Database className="w-4 h-4 text-primary" /> Learned Preferences
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-display ">{Object.keys(snapshot.preferences || {}).length}</div>
 <p className="text-label text-muted-foreground mt-1">Semantic dimensions mapped</p>
 </CardContent>
 </Card>
 
 <Card className="border-0 shadow-lg bg-card/60 backdrop-blur-md rounded-3xl">
 <CardHeader className="pb-2">
 <CardTitle className="text-secondary font-medium text-muted-foreground flex items-center gap-2">
 <UserCheck className="w-4 h-4 text-primary" /> Connected Identities
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-display ">{snapshot.accounts?.length || 0}</div>
 <p className="text-label text-muted-foreground mt-1">Zero trust connections</p>
 </CardContent>
 </Card>

 <Card className="border-0 shadow-lg bg-card/60 backdrop-blur-md rounded-3xl">
 <CardHeader className="pb-2">
 <CardTitle className="text-secondary font-medium text-muted-foreground flex items-center gap-2">
 <Cpu className="w-4 h-4 text-primary" /> Historical Context
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-display ">{snapshot.executions?.length || 0}</div>
 <p className="text-label text-muted-foreground mt-1">Executions codified as memory</p>
 </CardContent>
 </Card>

 <Card className="border-0 shadow-lg bg-gradient-glass backdrop-blur-xl rounded-3xl overflow-hidden relative">
 <div className="absolute top-0 right-0 p-4">
 <ShieldCheck className="w-8 h-8 text-success opacity-20" />
 </div>
 <CardHeader className="pb-2 relative z-10">
 <CardTitle className="text-secondary font-medium text-success flex items-center gap-2">
 Data Sovereignty
 </CardTitle>
 </CardHeader>
 <CardContent className="relative z-10">
 <div className="text-workspace font-bold text-foreground">100% Local</div>
 <p className="text-label text-success mt-1">Never leaves your device.</p>
 </CardContent>
 </Card>
 </div>

 <h2 className="text-page mb-4 text-foreground">Neural Graph Inspector</h2>
 
 <div className="bg-card rounded-3xl border border-border/50 shadow-md p-1 overflow-hidden h-[400px]">
 {/* Placeholder for actual node-based visualization (e.g., using vis-network or react-flow) */}
 <div className="w-full h-full bg-muted/20 rounded-[22px] flex items-center justify-center relative overflow-hidden">
 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary-glow)_0%,transparent_70%)] opacity-5" />
 <div className="text-center z-10">
 <BrainCircuit className="w-16 h-16 text-primary/40 mx-auto mb-4 animate-pulse" />
 <h3 className="text-section font-medium text-foreground">Semantic Network Active</h3>
 <p className="text-secondary text-muted-foreground max-w-sm mt-2">
 The World Model is continuously synthesizing {snapshot.executions?.length || 0} interactions into contextual understanding.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
};

export default IntentOSReality;
