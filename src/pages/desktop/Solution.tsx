import React, { useState, useEffect } from 'react';
import {
 Activity, ArrowRight, Bell, Briefcase, Building, CheckCircle2, ChevronDown, Clock,
 Code, Compass, Database, FileText, Grid, HelpCircle, Info, Layers, Link, List,
 MessageSquare, PlayCircle, Plus, Search, Send, Shield, ShieldCheck, Sparkles, Target,
 UploadCloud, User, Users, Wrench, XCircle, Zap, Server, Network, Wallet, TrendingUp
} from 'lucide-react';
import { useIntent, useWatch } from '@/hooks/useIntentOS';
import { OSGateway } from '@/core/os/gateway/OSGateway';

export default function CHATRSolution() {
 const [appState, setAppState] = useState<'ONBOARDING' | 'ANALYZING' | 'MISSION_CONTROL'>('ONBOARDING');
 
 // OSGateway Hooks
 const { submit, isSubmitting } = useIntent('SolutionWorkspace');
 const { activeExecutions } = useWatch('SolutionWorkspace');
 const activeIntent = activeExecutions && activeExecutions.length > 0 ? activeExecutions[0] : null;
 
 // Onboarding State
 const [businessDescription, setBusinessDescription] = useState('');
 const [dataConnected, setDataConnected] = useState(false);
 
 // Analysis State
 const [analysisProgress, setAnalysisProgress] = useState(0);
 const [analysisText, setAnalysisText] = useState('Initializing Business Graph...');
 
 // Mission Control State
 const [ceoCommand, setCeoCommand] = useState('');

 // Business Graph Data (from OSGateway)
 const [businessGraph, setBusinessGraph] = useState<any>(null);

 // Transition: Onboarding -> Analyzing
 const handleConnectData = () => {
 if (!businessDescription.trim()) return;
 setDataConnected(true);
 setAppState('ANALYZING');
 };

 // Simulate Analysis & Fetch from OSGateway
 useEffect(() => {
 if (appState === 'ANALYZING') {
 const timer1 = setTimeout(() => { setAnalysisProgress(30); setAnalysisText('Extracting Departments & Roles...'); }, 1500);
 const timer2 = setTimeout(() => { setAnalysisProgress(60); setAnalysisText('Mapping Systems & Workflows...'); }, 3500);
 const timer3 = setTimeout(() => { setAnalysisProgress(90); setAnalysisText('Instantiating Superintendents...'); }, 5500);
 
 const fetchDiscovery = async () => {
 const data = await OSGateway.Manage.runSuperintendentDiscovery(businessDescription);
 setBusinessGraph(data);
 };
 
 const timer4 = setTimeout(() => {
 fetchDiscovery();
 setAppState('MISSION_CONTROL');
 }, 7500);

 return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); clearTimeout(timer4); };
 }
 }, [appState]);

 // Execute Command dynamically based on input
 const handleExecute = async () => {
 if (!ceoCommand.trim() || isSubmitting) return;
 await submit({ prompt: ceoCommand });
 setCeoCommand('');
 };

 if (appState === 'ONBOARDING') {
 return (
 <div className="flex flex-col items-center justify-center min-h-full bg-[#09090b] text-white p-6 relative overflow-hidden">
 <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
 <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
 
 <div className="max-w-3xl w-full z-10 text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
 <div className="flex justify-center mb-8">
 <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
 <Zap size={32} className="text-white fill-white" />
 </div>
 </div>
 
 <h1 className="text-display md:text-display font-semibold tracking-tight">The First 10 Minutes</h1>
 <p className="text-workspace text-zinc-400 font-light">Describe your business, and CHATR will build the operating system.</p>

 <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl mt-12 text-left space-y-8">
 <div>
 <label className="block text-secondary font-semibold text-zinc-300 uppercase tracking-wider mb-3">1. Describe your business in one sentence</label>
 <textarea 
 rows={2}
 value={businessDescription}
 onChange={(e) => setBusinessDescription(e.target.value)}
 placeholder="e.g., We are a staffing company with 200 consultants across India."
 className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-section text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
 />
 </div>

 <div>
 <label className="block text-secondary font-semibold text-zinc-300 uppercase tracking-wider mb-3">2. Connect Data Sources</label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <button className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-left">
 <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400"><Link size={20}/></div>
 <div>
 <div className="font-medium text-zinc-200">Connect Systems</div>
 <div className="text-label text-zinc-500">ERP, HRMS, CRM, Email</div>
 </div>
 </button>
 <button className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 hover:border-zinc-700 transition-all text-left">
 <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400"><UploadCloud size={20}/></div>
 <div>
 <div className="font-medium text-zinc-200">Upload Files</div>
 <div className="text-label text-zinc-500">CSV, PDF, JSON, Docs</div>
 </div>
 </button>
 </div>
 </div>

 <button 
 onClick={handleConnectData}
 disabled={!businessDescription.trim()}
 className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-section"
 >
 Build Business Graph <ArrowRight size={20}/>
 </button>
 </div>
 </div>
 </div>
 );
 }

 if (appState === 'ANALYZING') {
 return (
 <div className="flex flex-col items-center justify-center min-h-full bg-[#09090b] text-white p-6 relative">
 <div className="w-full max-w-lg text-center space-y-8 z-10">
 <div className="relative w-32 h-32 mx-auto">
 <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
 <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className="text-page font-bold">{analysisProgress}%</span>
 </div>
 </div>
 <h2 className="text-page ">{analysisText}</h2>
 <p className="text-zinc-500">Analyzing inputs and constructing the Reality Graph.</p>
 </div>
 </div>
 );
 }

 // MISSION CONTROL
 return (
 <div className="flex h-full bg-[#09090b] text-zinc-300 font-sans overflow-hidden">
 
 {/* LEFT SIDEBAR (Superintendents) */}
 <div className="w-72 border-r border-zinc-800/60 bg-zinc-950/80 flex flex-col z-20 shrink-0">
 <div className="p-5 border-b border-zinc-800/60 flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
 <Zap size={16} className="text-white fill-white" />
 </div>
 <div>
 <div className="font-bold text-white tracking-tight leading-none">CHATR</div>
 <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Mission Control</div>
 </div>
 </div>
 
 <div className="p-4 flex-1 overflow-y-auto space-y-6">
 <div>
 <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2">Active Superintendents</div>
 <div className="space-y-2">
 <SuperintendentPod 
 name="HR Superintendent" 
 status={activeIntent?.activeAgent === 'HR Superintendent' ? 'Thinking...' : (activeIntent?.status !== 'COMPLETED' && activeIntent?.capabilitiesUsed?.includes('Workday') ? 'Running' : 'Healthy')} 
 statusColor={activeIntent?.activeAgent === 'HR Superintendent' ? 'text-indigo-300 bg-indigo-500/20 border-indigo-400/50' : (activeIntent?.status !== 'COMPLETED' && activeIntent?.capabilitiesUsed?.includes('Workday') ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20')} 
 icon={<Users size={16}/>} 
 active={activeIntent?.activeAgent === 'HR Superintendent'} 
 />
 <SuperintendentPod 
 name="Finance Superintendent" 
 status={activeIntent?.activeAgent === 'Finance Superintendent' ? 'Thinking...' : (activeIntent?.status !== 'COMPLETED' && activeIntent?.capabilitiesUsed?.includes('SAP') ? 'Running' : 'Waiting Approval')} 
 statusColor={activeIntent?.activeAgent === 'Finance Superintendent' ? 'text-indigo-300 bg-indigo-500/20 border-indigo-400/50' : (activeIntent?.status !== 'COMPLETED' && activeIntent?.capabilitiesUsed?.includes('SAP') ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20')} 
 icon={<Wallet size={16}/>} 
 active={activeIntent?.activeAgent === 'Finance Superintendent'}
 />
 <SuperintendentPod 
 name="Sales Superintendent" 
 status={activeIntent?.activeAgent === 'Sales Superintendent' ? 'Thinking...' : (activeIntent?.status !== 'COMPLETED' && activeIntent?.capabilitiesUsed?.includes('Salesforce') ? 'Running' : 'Idle')} 
 statusColor={activeIntent?.activeAgent === 'Sales Superintendent' ? 'text-indigo-300 bg-indigo-500/20 border-indigo-400/50' : (activeIntent?.status !== 'COMPLETED' && activeIntent?.capabilitiesUsed?.includes('Salesforce') ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-zinc-400 bg-zinc-800 border-zinc-700')} 
 icon={<TrendingUp size={16}/>} 
 active={activeIntent?.activeAgent === 'Sales Superintendent'}
 />
 <SuperintendentPod 
 name="Ops Superintendent" 
 status={activeIntent?.activeAgent === 'Operations Superintendent' ? 'Thinking...' : (activeIntent?.status !== 'COMPLETED' && activeIntent?.capabilitiesUsed?.includes('Core Operations') ? 'Running' : 'Idle')} 
 statusColor={activeIntent?.activeAgent === 'Operations Superintendent' ? 'text-indigo-300 bg-indigo-500/20 border-indigo-400/50' : (activeIntent?.status !== 'COMPLETED' && activeIntent?.capabilitiesUsed?.includes('Core Operations') ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-zinc-400 bg-zinc-800 border-zinc-700')} 
 icon={<Server size={16}/>} 
 active={activeIntent?.activeAgent === 'Operations Superintendent'}
 />
 </div>
 </div>
 </div>
 </div>

 {/* MAIN MISSION CONTROL AREA */}
 <div className="flex-1 flex flex-col min-w-0 relative">
 <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

 {/* TOP COMMAND BAR */}
 <div className="h-20 border-b border-zinc-800/60 bg-zinc-950/50 backdrop-blur-xl flex items-center px-8 z-10 sticky top-0">
 <div className="w-full max-w-4xl mx-auto flex items-center gap-4 relative">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500">
 <Sparkles size={20} />
 </div>
 <input 
 type="text"
 value={ceoCommand}
 onChange={(e) => setCeoCommand(e.target.value)}
 placeholder="CEO Command: e.g., 'Recover overdue invoices' or 'Hire 5 Java devs'"
 className="w-full bg-zinc-900/50 border border-indigo-500/30 focus:border-indigo-500 rounded-2xl py-4 pl-12 pr-32 text-section text-white placeholder-zinc-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-lg"
 disabled={isSubmitting || (activeIntent && activeIntent.status !== 'COMPLETED')}
 onKeyDown={(e) => { if(e.key === 'Enter') handleExecute(); }}
 />
 <button 
 onClick={handleExecute}
 disabled={!ceoCommand.trim() || isSubmitting || (activeIntent && activeIntent.status !== 'COMPLETED')}
 className="absolute right-2 top-1/2 -translate-y-1/2 bg-white hover:bg-zinc-200 text-black px-6 py-2 rounded-xl font-bold transition-all disabled:opacity-50"
 >
 Execute
 </button>
 </div>
 </div>

 {/* DASHBOARD CONTENT */}
 <div className="flex-1 overflow-y-auto p-8 z-0">
 <div className="max-w-6xl mx-auto space-y-8">
 
 {/* Live Business Graph Overview */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <RealityCard label={`Total ${businessGraph?.employeeLabel || 'Employees'}`} value={businessGraph?.employees || '0'} subtext={`${businessGraph?.risks || 0} missing contracts`} health={`${businessGraph?.health || 100}%`} />
 <RealityCard label="Departments" value={businessGraph?.departments.length || '0'} subtext="All systems mapped" health="100%" />
 <RealityCard label="Active Policies" value="12" subtext="2 require updates" health="85%" />
 <RealityCard label="Business Risks" value={businessGraph?.risks || '0'} subtext="High priority: 0" health="98%" />
 </div>

 {/* Execution Timeline (Powered by OSGateway) */}
 {activeIntent && (
 <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
 <h3 className="text-white font-semibold uppercase tracking-widest text-secondary">Live Execution Pipeline</h3>
 </div>
 <span className="text-label font-mono text-zinc-500">INTENT_ID: {activeIntent.id}</span>
 </div>
 
 <div className="flex items-center justify-between relative px-4">
 <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-zinc-800 -translate-y-1/2 z-0"></div>
 
 <TimelineStep icon={<MessageSquare size={16}/>} label="Understanding" state={activeIntent.progress >= 10 ? 'DONE' : 'WAITING'} />
 <TimelineStep icon={<Grid size={16}/>} label="Planning" state={
 activeIntent.progress >= 30 ? 'DONE' : (activeIntent.progress >= 10 ? 'ACTIVE' : 'WAITING')
 } />
 <TimelineStep icon={<Zap size={16}/>} label="Executing" state={
 activeIntent.progress >= 80 ? 'DONE' : (activeIntent.progress >= 30 ? 'ACTIVE' : 'WAITING')
 } />
 <TimelineStep icon={<ShieldCheck size={16}/>} label="Verifying" state={
 activeIntent.progress >= 95 ? 'DONE' : (activeIntent.progress >= 80 ? 'ACTIVE' : 'WAITING')
 } />
 <TimelineStep icon={<CheckCircle2 size={16}/>} label="Completed" state={activeIntent.status === 'COMPLETED' ? 'DONE' : 'WAITING'} />
 </div>
 
 {activeIntent.status === 'COMPLETED' && (
 <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-4 animate-in fade-in">
 <CheckCircle2 size={24} className="text-emerald-500 mt-1" />
 <div>
 <h4 className="text-emerald-400 font-bold">Execution Verified</h4>
 <p className="text-zinc-300 text-secondary mt-1">Successfully fulfilled the intent using {activeIntent.capabilitiesUsed?.join(', ')}.</p>
 <button className="mt-3 text-button bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-lg transition-colors ">View Execution Receipt</button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Business Graph Visualization (Abstract) */}
 <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 h-[400px] flex flex-col">
 <h3 className="text-white font-semibold uppercase tracking-widest text-secondary mb-4">Enterprise Reality Graph</h3>
 <div className="flex-1 border border-zinc-800/50 rounded-xl bg-zinc-950 flex items-center justify-center relative overflow-hidden group cursor-crosshair">
 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.1)_1px,transparent_1px)] bg-[length:24px_24px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
 <div className="flex flex-col items-center gap-2">
 <Network size={48} className="text-zinc-700" />
 <span className="text-zinc-500 text-secondary font-medium">Graph visualization active. 142 nodes mapped.</span>
 </div>
 </div>
 </div>

 </div>
 </div>
 </div>
 </div>
 );
}

// Sub-components
function SuperintendentPod({ name, status, statusColor, icon, active }: any) {
 return (
 <div className={`p-3 rounded-xl border transition-all cursor-pointer ${active ? 'bg-zinc-900 border-zinc-700 shadow-md' : 'bg-zinc-950 border-zinc-800/50 hover:bg-zinc-900/50 hover:border-zinc-700'}`}>
 <div className="flex items-center gap-3 mb-2">
 <div className="text-zinc-400">{icon}</div>
 <div className="font-semibold text-zinc-200 text-secondary">{name}</div>
 </div>
 <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
 {status}
 </div>
 </div>
 );
}

function RealityCard({ label, value, subtext, health }: any) {
 return (
 <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:bg-zinc-800/50 transition-colors cursor-default">
 <div className="flex justify-between items-start mb-2">
 <span className="text-label font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
 <span className="text-label font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Health {health}</span>
 </div>
 <div className="text-display text-white tracking-tight mb-2">{value}</div>
 <div className="text-label text-zinc-400">{subtext}</div>
 </div>
 );
}

function TimelineStep({ icon, label, state }: any) {
 const isDone = state === 'DONE';
 const isActive = state === 'ACTIVE';
 
 return (
 <div className="flex flex-col items-center gap-3 z-10 relative">
 <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
 isDone ? 'bg-zinc-900 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' :
 isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)]' :
 'bg-zinc-950 border-zinc-800 text-zinc-600'
 }`}>
 {isActive && <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-30"></div>}
 {icon}
 </div>
 <span className={`text-label font-bold uppercase tracking-wider ${
 isDone ? 'text-emerald-400' : isActive ? 'text-indigo-400' : 'text-zinc-600'
 }`}>{label}</span>
 </div>
 );
}
