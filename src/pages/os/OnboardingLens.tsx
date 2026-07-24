import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Globe, Zap, Database, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingLens() {
 const navigate = useNavigate();
 const [step, setStep] = useState(1);
 const [businessDesc, setBusinessDesc] = useState('');
 const [connecting, setConnecting] = useState(false);
 
 const [connections, setConnections] = useState({
 hrms: false,
 ats: false,
 erp: false,
 gmail: false
 });

 const handleConnect = (system: keyof typeof connections) => {
 setConnections(prev => ({ ...prev, [system]: true }));
 toast.success(`Connected to ${system.toUpperCase()}`);
 };

 const handleComplete = async () => {
 setConnecting(true);
 try {
 const response = await fetch('http://127.0.0.1:8000/api/v1/workspace/init', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 description: businessDesc,
 systems: connections
 })
 });
 
 if (response.ok) {
 toast.success('Reality Graph Generated Successfully!');
 navigate('/os/command');
 } else {
 toast.error('Failed to initialize Reality Graph');
 }
 } catch (err) {
 toast.error('Could not connect to OS Backend');
 } finally {
 setConnecting(false);
 }
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-zinc-200 relative overflow-hidden p-6">
 {/* Background ambient glow */}
 <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
 
 <div className="max-w-2xl w-full bg-zinc-950/80 border border-zinc-800/60 rounded-3xl p-10 backdrop-blur-xl shadow-2xl relative z-10">
 <div className="flex items-center gap-3 mb-8">
 <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
 <Zap size={20} className="text-white" />
 </div>
 <h1 className="text-page font-bold text-white tracking-tight">CHATR OS Initialization</h1>
 </div>

 {step === 1 && (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div>
 <h2 className="text-workspace mb-2">Phase 0: Business Understanding</h2>
 <p className="text-zinc-400 text-secondary">Before CHATR can operate your business, it needs to understand it. Tell us about your organization.</p>
 </div>
 
 <textarea
 value={businessDesc}
 onChange={(e) => setBusinessDesc(e.target.value)}
 placeholder="e.g., We are an IT staffing company with 300 consultants..."
 className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-secondary text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 resize-none"
 />
 
 <div className="flex justify-end">
 <button 
 onClick={() => setStep(2)}
 disabled={businessDesc.length < 10}
 className="flex items-center gap-2 bg-indigo-600 disabled:opacity-50 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-secondary font-medium transition-colors"
 >
 Next Step
 <ArrowRight size={16} />
 </button>
 </div>
 </div>
 )}

 {step === 2 && (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div>
 <h2 className="text-workspace mb-2">Connect Systems</h2>
 <p className="text-zinc-400 text-secondary">Connect your tools to seed the Reality Graph (Structure, State, Knowledge).</p>
 </div>
 
 <div className="grid grid-cols-2 gap-4">
 <ConnectionCard 
 title="Workday (HRMS)" 
 icon={<Building size={20} />} 
 connected={connections.hrms} 
 onConnect={() => handleConnect('hrms')} 
 />
 <ConnectionCard 
 title="Greenhouse (ATS)" 
 icon={<Database size={20} />} 
 connected={connections.ats} 
 onConnect={() => handleConnect('ats')} 
 />
 <ConnectionCard 
 title="NetSuite (ERP)" 
 icon={<Globe size={20} />} 
 connected={connections.erp} 
 onConnect={() => handleConnect('erp')} 
 />
 <ConnectionCard 
 title="Google Workspace" 
 icon={<Globe size={20} />} 
 connected={connections.gmail} 
 onConnect={() => handleConnect('gmail')} 
 />
 </div>
 
 <div className="flex justify-between items-center mt-8 pt-6 border-t border-zinc-800/60">
 <button 
 onClick={() => setStep(1)}
 className="text-secondary text-zinc-400 hover:text-white transition-colors"
 >
 Back
 </button>
 <button 
 onClick={handleComplete}
 disabled={connecting || (!connections.hrms && !connections.ats && !connections.erp && !connections.gmail)}
 className="flex items-center gap-2 bg-indigo-600 disabled:opacity-50 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-button transition-colors"
 >
 {connecting ? 'Generating Reality Graph...' : 'Initialize CHATR OS'}
 {!connecting && <Zap size={16} />}
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}

function ConnectionCard({ title, icon, connected, onConnect }: { title: string, icon: React.ReactNode, connected: boolean, onConnect: () => void }) {
 return (
 <div className={`border rounded-xl p-4 flex items-center justify-between transition-colors ${connected ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}>
 <div className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400'}`}>
 {icon}
 </div>
 <span className="text-secondary font-medium text-zinc-200">{title}</span>
 </div>
 {connected ? (
 <CheckCircle2 size={18} className="text-emerald-500" />
 ) : (
 <button onClick={onConnect} className="text-button bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-md transition-colors">
 Connect
 </button>
 )}
 </div>
 );
}
