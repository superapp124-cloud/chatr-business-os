import React, { useEffect, useRef, useState } from 'react';
import {
 Activity,
 Archive,
 BarChart2,
 Bell,
 Briefcase,
 Building,
 Calendar,
 CheckCircle2,
 ChevronDown,
 Clock,
 Code,
 Compass,
 Database,
 Eye,
 FileText,
 Grid,
 HelpCircle,
 Info,
 Layers,
 Link,
 List,
 MessageSquare,
 MousePointerClick,
 Paperclip,
 Plus,
 LayoutGrid,
 Search,
 Send,
 Shield,
 ShieldCheck,
 Sliders,
 Sparkles,
 Target,
 Wrench,
 TrendingUp,
 UploadCloud,
 User,
 Users,
 Wallet,
 Zap,
 PlayCircle,
 AlertCircle,
 XCircle
} from 'lucide-react';
import { useDiscover, useHome, useImport, useIntent, useManage, useWatch } from '@/hooks/useIntentOS';
import { ExecutionTrace } from './ExecutionTrace';
import { LayoutEngine, DensityControls } from '@/components/ui/LayoutEngine';
import { Density, WorkspacePersona } from '@/hooks/useAdaptiveLayout';
import { SectionCard } from '@/components/ui/SectionCard';

export default function UniversalOS() {
 const [activeWorkspace, setActiveWorkspace] = useState('TalentXcel Services');
 const [userDensity, setUserDensity] = useState<Density | 'auto'>('auto');
 const [userPersona, setUserPersona] = useState<WorkspacePersona>('standard');
 const [selectedIntent, setSelectedIntent] = useState<any>(null);
 const [selectedCapability, setSelectedCapability] = useState<any>(null);
 const textareaRef = useRef<HTMLTextAreaElement | null>(null);
 const searchInputRef = useRef<HTMLInputElement | null>(null);
 const fileInputRef = useRef<HTMLInputElement | null>(null);

 const { metrics, recentIntents, recentActivity, insights, loading: homeLoading } = useHome(activeWorkspace);
 const { activeExecutions } = useWatch(activeWorkspace);
 const { analyze, submit, approve, analysis, isAnalyzing, isSubmitting, isApproving, reset } = useIntent(activeWorkspace);
 const {
 capabilities,
 testCapability,
 configureCapability,
 isTestingCapability,
 isConfiguringCapability
 } = useManage(activeWorkspace);
 const { activeImports, startImport } = useImport(activeWorkspace);
 const { search, results: searchResults, loading: searchLoading, reset: resetSearch } = useDiscover(activeWorkspace);
 
 const [prompt, setPrompt] = useState('');
 const [showAnalysis, setShowAnalysis] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');

 useEffect(() => {
 if (!selectedIntent) return;
 const updatedIntent = [...activeExecutions, ...recentIntents].find((intent: any) => intent.id === selectedIntent.id);
 if (updatedIntent && updatedIntent.updatedAt !== selectedIntent.updatedAt) {
 setSelectedIntent(updatedIntent);
 }
 }, [activeExecutions, recentIntents, selectedIntent]);

 useEffect(() => {
 if (!selectedCapability) return;
 const updatedCapability = capabilities.find((cap: any) => cap.id === selectedCapability.id);
 if (updatedCapability && updatedCapability.lastSync !== selectedCapability.lastSync) {
 setSelectedCapability(updatedCapability);
 }
 }, [capabilities, selectedCapability]);

 useEffect(() => {
 const handleKeyDown = (event: KeyboardEvent) => {
 if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
 event.preventDefault();
 searchInputRef.current?.focus();
 }
 if (event.key === 'Escape') {
 setSearchQuery('');
 resetSearch();
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [resetSearch]);
 
 const handleAnalyze = async () => {
 if (!prompt.trim()) return;
 await analyze(prompt);
 setShowAnalysis(true);
 };
 
 const handleSubmit = async () => {
 await submit({ prompt });
 setShowAnalysis(false);
 setPrompt('');
 reset();
 };

 const handleSuggestion = (text: string) => {
 setPrompt(text);
 setShowAnalysis(false);
 reset();
 window.setTimeout(() => textareaRef.current?.focus(), 0);
 };

 const handleNewIntent = () => {
 setPrompt('');
 setShowAnalysis(false);
 reset();
 textareaRef.current?.focus();
 };

 const handleSearchChange = async (value: string) => {
 setSearchQuery(value);
 if (value.trim().length < 2) {
 resetSearch();
 return;
 }
 await search(value);
 };

 const handleStartImport = async (source: string, totalItems = 1) => {
 await startImport({ source, totalItems });
 };

 const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(event.target.files || []);
 if (files.length === 0) return;
 await handleStartImport(`${files.length} file${files.length === 1 ? '' : 's'} uploaded`, files.length);
 event.target.value = '';
 };

 const handleCapabilityTest = async () => {
 if (!selectedCapability) return;
 const updated = await testCapability(selectedCapability.id);
 if (updated) setSelectedCapability(updated);
 };

 const handleCapabilityConfigure = async () => {
 if (!selectedCapability) return;
 const updated = await configureCapability(selectedCapability.id);
 if (updated) setSelectedCapability(updated);
 };

 const isNewWorkspace = (!recentIntents || recentIntents.length === 0) && (!activeExecutions || activeExecutions.length === 0);

 return (
 <div className="flex h-full bg-[#09090b] text-zinc-300 font-sans overflow-hidden">
 <input
 ref={fileInputRef}
 type="file"
 multiple
 className="hidden"
 onChange={handleFilesSelected}
 />
 {/* SIDEBAR */}
 <div className="w-64 border-r border-zinc-800/60 bg-zinc-950/80 flex flex-col flex-shrink-0 backdrop-blur-xl z-20">
 <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
 <div className="flex items-center gap-2 text-white font-bold tracking-tight">
 <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
 <Zap size={14} className="text-white fill-white" />
 </div>
 <span>CHATR INTENT OS</span>
 </div>
 </div>
 
 <div className="flex-1 overflow-y-auto py-4 px-3 space-y-8 scrollbar-hide">
 {/* Main Nav */}
 <div>
 <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2">Navigation</div>
 <div className="space-y-1">
 <NavItem icon={<PlayCircle size={18}/>} label="DO" desc="Make things happen" active />
 <NavItem icon={<Eye size={18}/>} label="WATCH" desc="Track everything" />
 <NavItem icon={<Compass size={18}/>} label="DISCOVER" desc="Find and understand" />
 <NavItem icon={<Sliders size={18}/>} label="MANAGE" desc="Configure and control" />
 </div>
 </div>
 
 {/* Workspaces */}
 <div>
 <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2">Workspaces</div>
 <div className="space-y-1">
 <WorkspaceItem name="TalentXcel Services" active={activeWorkspace === 'TalentXcel Services'} onClick={() => setActiveWorkspace('TalentXcel Services')} />
 <WorkspaceItem name="Sales" active={activeWorkspace === 'Sales'} onClick={() => setActiveWorkspace('Sales')} />
 <WorkspaceItem name="Finance" active={activeWorkspace === 'Finance'} onClick={() => setActiveWorkspace('Finance')} />
 <WorkspaceItem name="Procurement" active={activeWorkspace === 'Procurement'} onClick={() => setActiveWorkspace('Procurement')} />
 <WorkspaceItem name="HR" active={activeWorkspace === 'HR'} onClick={() => setActiveWorkspace('HR')} />
 <WorkspaceItem name="IT Operations" active={activeWorkspace === 'IT Operations'} onClick={() => setActiveWorkspace('IT Operations')} />
 </div>
 </div>
 
 {/* Shortcuts */}
 <div>
 <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2">Shortcuts</div>
 <div className="space-y-1">
 <ShortcutItem icon={<Plus size={16}/>} label="New Intent" onClick={handleNewIntent} />
 <ShortcutItem icon={<Database size={16}/>} label="Import Data" onClick={() => fileInputRef.current?.click()} />
 <ShortcutItem icon={<Users size={16}/>} label="Invite People" onClick={() => handleSuggestion('Invite the team to this CHATR workspace')} />
 <ShortcutItem icon={<LayoutGrid size={16}/>} label="Studio 2" onClick={() => window.location.hash = '/desktop/studio2'} />
 </div>
 </div>
 </div>
 </div>
 
 {/* MAIN CONTENT AREA */}
 <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
 {/* Background glow effects */}
 <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
 <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

 {/* TOP NAV */}
 <header className="h-16 border-b border-zinc-800/60 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-6 z-10">
 <div className="flex items-center gap-4">
 <button className="flex items-center gap-2 hover:bg-zinc-800/50 px-2 py-1.5 rounded-md transition-colors text-white text-button ">
 <Building size={16} className="text-indigo-400" />
 {activeWorkspace}
 <ChevronDown size={14} className="text-zinc-500" />
 </button>
 </div>
 
 <div className="flex-1 max-w-xl px-4">
 <div className="relative group">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
 <input 
 ref={searchInputRef}
 type="text" 
 placeholder="Search intents, knowledge, or apps..." 
 className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2 pl-10 pr-12 text-input text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all group-hover:border-zinc-700 shadow-inner"
 value={searchQuery}
 onChange={(e) => handleSearchChange(e.target.value)}
 />
 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
 <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 rounded border border-zinc-700">Ctrl</kbd>
 <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 rounded border border-zinc-700">K</kbd>
 </div>
 {(searchQuery.trim().length >= 2 || searchResults.length > 0) && (
 <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50">
 {searchLoading ? (
 <div className="px-4 py-3 text-label text-zinc-500">Searching workspace...</div>
 ) : searchResults.length > 0 ? (
 searchResults.map((result: any) => (
 <button
 key={result.id}
 onClick={() => {
 setPrompt(result.title);
 setSearchQuery('');
 resetSearch();
 textareaRef.current?.focus();
 }}
 className="w-full text-left px-4 py-3 hover:bg-zinc-900 border-b border-zinc-900 last:border-b-0 transition-colors"
 >
 <div className="text-secondary text-zinc-200 truncate">{result.title}</div>
 <div className="text-[11px] text-zinc-500 truncate">{result.snippet}</div>
 </button>
 ))
 ) : (
 <div className="px-4 py-3 text-label text-zinc-500">No matching workspace data</div>
 )}
 </div>
 )}
 </div>
 </div>
 
 <div className="flex items-center gap-3">
 <button onClick={handleNewIntent} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-full text-button transition-colors shadow-lg shadow-indigo-500/20">
 <Plus size={16} />
 <span>New</span>
 </button>
 <button onClick={() => handleSearchChange('attention')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors relative">
 <Bell size={18} />
 <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-zinc-950"></span>
 </button>
 <button onClick={() => handleSuggestion('Show runtime health and recommend the next best action')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors">
 <HelpCircle size={18} />
 </button>
 <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center text-white text-label font-bold border border-zinc-700 ml-2 shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
 AW
 </div>
 </div>
 </header>

 {/* MAIN SCROLLABLE */}
 <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-0 scrollbar-hide">
 <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-8">
 
 {/* HERO SECTION */}
 <div className="flex flex-col items-center text-center mt-4 mb-2">
 <h1 className="text-display md:text-display font-semibold text-white tracking-tight mb-3">
 Good morning, Arshid
 </h1>
 <p className="text-zinc-400 text-section mb-8 font-light">What would you like CHATR to accomplish today?</p>
 
 <div className="w-full max-w-4xl flex flex-wrap justify-center gap-2.5 mb-6">
 <SuggestionPill text="Hire 20 developers" onClick={handleSuggestion} />
 <SuggestionPill text="Approve invoices over ₹1L" onClick={handleSuggestion} />
 <SuggestionPill text="Prepare sales forecast" onClick={handleSuggestion} />
 <SuggestionPill text="Onboard new employee" onClick={handleSuggestion} />
 <SuggestionPill text="Analyze Q1 performance" onClick={handleSuggestion} />
 </div>
 
 <div className="w-full max-w-4xl relative group">
 <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 blur-xl rounded-full opacity-50 group-focus-within:opacity-100 transition-opacity duration-500"></div>
 <div className="relative bg-zinc-900/90 backdrop-blur-sm border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden focus-within:border-indigo-500/50 transition-colors">
 <textarea 
 ref={textareaRef}
 rows={3} 
 placeholder="Describe what you want to achieve in natural language..." 
 className="w-full bg-transparent resize-none p-5 pb-2 text-zinc-200 placeholder-zinc-500 focus:outline-none text-section"
 value={prompt}
 onChange={(e) => setPrompt(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleAnalyze();
 }
 }}
 />
 <div className="px-5 pb-4 pt-3 flex items-center justify-between border-t border-zinc-800/50">
 <div className="flex items-center gap-1 sm:gap-2">
 <ToolbarButton icon={<Paperclip size={16} />} label="Attach files" onClick={() => fileInputRef.current?.click()} />
 <ToolbarButton icon={<Layers size={16} />} label="Use a template" onClick={() => handleSuggestion('Create a workflow from the standard operations template')} />
 <ToolbarButton icon={<Grid size={16} />} label="Choose capability" onClick={() => handleSearchChange('connected')} />
 <ToolbarButton icon={<Info size={16} />} label="Add context" onClick={() => handleStartImport('Manual context note')} />
 </div>
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 px-2 py-1 rounded-lg transition-colors">
 <span className="text-label text-zinc-400 ">AI Copilot</span>
 <div className="w-8 h-4 bg-indigo-600 rounded-full relative">
 <div className="w-3 h-3 bg-white rounded-full absolute top-0.5 right-0.5 shadow"></div>
 </div>
 </div>
 <button 
 onClick={handleAnalyze}
 disabled={isAnalyzing || !prompt.trim()}
 className="bg-white hover:bg-zinc-200 text-black p-2.5 rounded-xl transition-all hover:scale-105 shadow-sm active:scale-95 disabled:opacity-50"
 >
 {isAnalyzing ? <div className="w-5 h-5 rounded-full border-2 border-black border-t-transparent animate-spin mx-auto" /> : <Send size={18} className="ml-0.5" />}
 </button>
 </div>
 </div>
 </div>
 </div>

 {showAnalysis && analysis && (
 <div className="w-full max-w-4xl mt-6 bg-zinc-900/80 backdrop-blur-md border border-indigo-500/30 rounded-2xl p-6 text-left animate-in fade-in slide-in-from-top-4 shadow-xl">
 <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800/80">
 <h4 className="text-indigo-400 font-semibold flex items-center gap-2 text-section">
 <Sparkles size={18} /> Mission Control Analysis
 </h4>
 <span className="text-label font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full">
 Confidence: {(analysis.confidence * 100).toFixed(0)}%
 </span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-secondary mb-6">
 <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
 <span className="text-zinc-500 block mb-2 text-label font-bold uppercase tracking-wider">Goal Detected</span>
 <span className="text-zinc-200 font-medium text-body">{analysis.goalDetected}</span>
 </div>
 <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
 <span className="text-zinc-500 block mb-2 text-label font-bold uppercase tracking-wider">Systems Required</span>
 <div className="flex flex-wrap gap-2">
 {analysis.systemsRequired.map((sys: string) => (
 <span key={sys} className="bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded-md text-zinc-300 text-label ">{sys}</span>
 ))}
 </div>
 </div>
 </div>
 <div className="flex justify-end gap-3 pt-2">
 <button 
 onClick={() => { setShowAnalysis(false); reset(); }}
 className="px-5 py-2.5 text-secondary font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
 >
 Cancel
 </button>
 <button 
 onClick={handleSubmit}
 disabled={isSubmitting}
 className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-button rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-70"
 >
 {isSubmitting ? 'Starting...' : 'Proceed'} <PlayCircle size={16} />
 </button>
 </div>
 </div>
 )}
 </div>

 {/* METRICS */}
 {isNewWorkspace ? (
 <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/80 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[120px]">
 <Activity size={24} className="text-zinc-600 mb-3" />
 <h3 className="text-zinc-300 font-medium mb-1">No completed intents yet</h3>
 <p className="text-zinc-500 text-secondary">Complete your first Intent to begin measuring impact.</p>
 </div>
 ) : (
 <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
 <MetricCard label="Active Intents" value={metrics?.activeIntents?.toString() || "0"} icon={<Zap size={18} className="text-amber-400" />} />
 <MetricCard label="Needs Attention" value={metrics?.needsAttention?.toString() || "0"} icon={<AlertCircle size={18} className="text-rose-400" />} />
 <MetricCard label="Pending Approvals" value={metrics?.pendingApprovals?.toString() || "0"} icon={<Clock size={18} className="text-blue-400" />} />
 <MetricCard label="Failed Executions" value={metrics?.failedExecutions?.toString() || "0"} icon={<XCircle size={18} className="text-rose-400" />} />
 <MetricCard label="Import Jobs" value={metrics?.importJobs?.toString() || "0"} icon={<Database size={18} className="text-purple-400" />} />
 <MetricCard label="Workspace Health" value={metrics?.health?.toString() || metrics?.workspaceHealth || "Unknown"} icon={<ShieldCheck size={18} className="text-emerald-400" />} />
 </div>
 )}

 {/* EXECUTION TWIN */}
 {activeExecutions && activeExecutions.length > 0 && (
 <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden group shadow-lg animate-in fade-in slide-in-from-bottom-4">
 <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 relative z-10 gap-4">
 <div className="flex items-center gap-3">
 <div className="relative flex items-center justify-center w-3 h-3">
 <div className="absolute w-full h-full bg-emerald-500 rounded-full animate-ping opacity-75"></div>
 <div className="relative w-2 h-2 rounded-full bg-emerald-500"></div>
 </div>
 <h3 className="text-secondary font-semibold text-white tracking-widest uppercase">Execution Twin Pipeline</h3>
 </div>
 <div className="flex items-center gap-2 text-label text-zinc-400 bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-zinc-800/80 shadow-inner">
 <Activity size={14} className="text-indigo-400" />
 <span>Tracking: <strong className="text-zinc-200 truncate max-w-[200px] inline-block align-bottom">{activeExecutions[0].prompt}</strong></span>
 </div>
 </div>
 
 <div className="flex flex-col md:flex-row md:items-start justify-between relative z-10 gap-4 md:gap-0">
 <TwinStage icon={<MessageSquare size={18}/>} label="Intent Received" done={activeExecutions[0].progress >= 10} />
 <TwinLine done={activeExecutions[0].progress >= 10} />
 <TwinStage icon={<Code size={18}/>} label="Planner Analyzing" done={activeExecutions[0].progress >= 30} active={activeExecutions[0].progress > 10 && activeExecutions[0].progress < 30} pulsing={activeExecutions[0].progress > 10 && activeExecutions[0].progress < 30} highlight={activeExecutions[0].progress > 10 && activeExecutions[0].progress < 30} />
 <div className="w-8 h-[2px] bg-indigo-500/50"></div>
 <TwinStage icon={<Wrench size={18}/>} label="Capability Selected" done={activeExecutions[0].progress >= 50} active={activeExecutions[0].progress >= 30 && activeExecutions[0].progress < 50} pulsing={activeExecutions[0].progress >= 30 && activeExecutions[0].progress < 50} highlight={activeExecutions[0].progress >= 30 && activeExecutions[0].progress < 50} />
 <div className="w-8 h-[2px] bg-indigo-500/50"></div>
 <TwinStage icon={<Search size={18}/>} label="Executing" sublabel={activeExecutions[0].activeAgent ? `${activeExecutions[0].activeAgent} thinking...` : activeExecutions[0].status} done={activeExecutions[0].progress >= 80} active={activeExecutions[0].progress >= 50 && activeExecutions[0].progress < 80} pulsing={activeExecutions[0].progress >= 50 && activeExecutions[0].progress < 80} highlight={activeExecutions[0].progress >= 50 && activeExecutions[0].progress < 80} />
 <TwinLine done={activeExecutions[0].progress >= 80} />
 <TwinStage icon={<Shield size={18}/>} label="Verifying Outcomes" done={activeExecutions[0].progress >= 90} active={activeExecutions[0].progress >= 80 && activeExecutions[0].progress < 90} />
 <TwinLine done={activeExecutions[0].progress >= 90} />
 <TwinStage icon={<Database size={18}/>} label="Knowledge Updating" done={activeExecutions[0].progress >= 100} active={activeExecutions[0].progress >= 90 && activeExecutions[0].progress < 100} />
 <TwinLine done={activeExecutions[0].progress >= 100} />
 <div className="flex flex-col items-center gap-3 min-w-[80px]">
 <div className="w-12 h-12 rounded-full border-2 border-emerald-500/40 flex items-center justify-center bg-emerald-500/10 text-emerald-400 text-secondary font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]">
 {activeExecutions[0].progress}%
 </div>
 <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider text-center">Goal Progress</span>
 </div>
 </div>
 </div>
 )}

        {/* DENSITY & PROFILE CONTROL BAR */}
        <DensityControls 
          currentDensity={userDensity} 
          onDensityChange={setUserDensity} 
          currentPersona={userPersona} 
          onPersonaChange={setUserPersona} 
        />

        {/* MIDDLE GRIDS */}
        <LayoutEngine workspaceType="dashboard" density={userDensity} persona={userPersona}>
 {/* COL 1: Workspaces & Capabilities */}
 <div className="space-y-6">
 <SectionCard title="Your Workspaces" icon={<Briefcase size={16} className="text-indigo-400"/>}>
 <div className="grid grid-cols-2 gap-3">
 <WorkspaceBox name="Sales" icon={<TrendingUp size={16}/>} color="emerald" onClick={() => setActiveWorkspace('Sales')} />
 <WorkspaceBox name="Finance" icon={<Wallet size={16}/>} color="amber" onClick={() => setActiveWorkspace('Finance')} />
 <WorkspaceBox name="Procurement" icon={<Archive size={16}/>} color="blue" onClick={() => setActiveWorkspace('Procurement')} />
 <WorkspaceBox name="HR" icon={<Users size={16}/>} color="rose" onClick={() => setActiveWorkspace('HR')} />
 <WorkspaceBox name="Personal" icon={<User size={16}/>} color="purple" onClick={() => setActiveWorkspace('Personal')} />
 </div>
 </SectionCard>
 
 <SectionCard title="Capabilities Health" icon={<Grid size={16} className="text-emerald-400"/>}>
 <div className="grid grid-cols-2 gap-3">
 {capabilities && capabilities.length > 0 ? (
 capabilities.map((cap: any) => (
 <CapBox key={cap.id} cap={cap} onClick={() => setSelectedCapability(cap)} />
 ))
 ) : (
 <div className="col-span-2 text-center py-6 text-label text-zinc-500">
 No capabilities configured
 </div>
 )}
 </div>
 </SectionCard>
 </div>
 
 {/* COL 2: Recent Intents */}
 <div className="space-y-6">
 <SectionCard title="Recent Intents" icon={<List size={16} className="text-blue-400"/>}>
 <div className="space-y-3">
 {recentIntents && recentIntents.length > 0 ? (
 recentIntents.map((intent: any) => (
 <RecentIntent key={intent.id} intent={intent} onClick={() => setSelectedIntent(intent)} />
 ))
 ) : (
 <div className="text-center py-6 text-label text-zinc-500">
 No recent intents
 </div>
 )}
 </div>
 </SectionCard>
 </div>
 
 {/* COL 3: Activity & Insights */}
 <div className="space-y-6">
 <SectionCard title="Live Activity" icon={<Activity size={16} className="text-rose-400"/>}>
 {(activeImports.length > 0 || recentActivity.length > 0) ? (
 <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-zinc-800 ml-1">
 {activeImports.map((job: any) => (
 <ActivityItem
 key={job.id}
 icon={<UploadCloud size={14} className="text-indigo-400" />}
 title={job.source}
 desc={`${job.status.replaceAll('_', ' ')} · ${job.progress}%`}
 time={new Date(job.updatedAt || job.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 />
 ))}
 {recentActivity.map((event: any) => (
 <ActivityItem
 key={event.id}
 icon={activityIcon(event.icon, event.level)}
 title={event.title}
 desc={event.desc}
 time={new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 />
 ))}
 </div>
 ) : (
 <div className="text-center py-6 text-label text-zinc-500">
 No recent activity
 </div>
 )}
 </SectionCard>
 
 <SectionCard title="AI Business Insights" icon={<Zap size={16} className="text-amber-400"/>}>
 {insights.length > 0 ? (
 <div className="space-y-3">
 {insights.map((insight: any) => (
 <InsightItem key={insight.id} text={insight.text} type={insight.type} />
 ))}
 </div>
 ) : (
 <div className="text-center py-6 text-label text-zinc-500">
 Run intents to generate insights
 </div>
 )}
 </SectionCard>
 </div>
 </LayoutEngine>

 {/* BOTTOM BANNER */}
 <div className="bg-gradient-to-br from-indigo-950/40 via-zinc-900/80 to-emerald-950/20 border border-zinc-800/80 rounded-2xl p-6 md:p-8 mt-4 mb-8 overflow-hidden relative shadow-lg">
 <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
 <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none"></div>
 
 <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-center">
 <div className="flex-1 space-y-6">
 <div>
 <h3 className="text-page text-white mb-2">Bring your business to CHATR</h3>
 <p className="text-zinc-400 text-secondary md:text-body">Show me your business and I'll understand everything. Connect your data sources to unlock intelligent automation.</p>
 </div>
 
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <ImportBox icon={<Link size={20}/>} title="Connect Applications" desc="OAuth integrations" onClick={() => handleStartImport('Connected application catalog')} />
 <ImportBox icon={<UploadCloud size={20}/>} title="Upload Files & Folders" desc="PDFs, Docs, CSVs" onClick={() => fileInputRef.current?.click()} />
 <ImportBox icon={<MousePointerClick size={20}/>} title="Drag & Drop Anything" desc="Quick upload" onClick={() => fileInputRef.current?.click()} />
 <ImportBox icon={<Database size={20}/>} title="Connect Databases" desc="SQL, NoSQL, APIs" onClick={() => handleStartImport('Database connection profile', 3)} />
 </div>
 </div>
 
 <div className="w-full lg:w-[400px] bg-zinc-950/60 backdrop-blur-md border border-zinc-800/80 rounded-xl p-6 shadow-inner">
 <h4 className="text-secondary font-semibold text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
 <Sparkles size={16} className="text-indigo-400" />
 After import, CHATR will:
 </h4>
 <ul className="space-y-3 text-secondary text-zinc-300">
 <li className="flex items-start gap-3">
 <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
 <span>Understand deep business context</span>
 </li>
 <li className="flex items-start gap-3">
 <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
 <span>Build the Enterprise Reality Graph</span>
 </li>
 <li className="flex items-start gap-3">
 <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
 <span>Populate centralized Knowledge Base</span>
 </li>
 <li className="flex items-start gap-3">
 <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
 <span>Recommend high-value capabilities</span>
 </li>
 <li className="flex items-start gap-3">
 <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
 <span>Identify automation opportunities</span>
 </li>
 </ul>
 </div>
 </div>
 </div>

 </div>
 </div>
 </div>

 {/* CAPABILITY MODAL */}
 {selectedCapability && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedCapability(null)}>
 <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
 <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between bg-zinc-900/50">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
 <Grid size={20} className="text-indigo-400" />
 </div>
 <div>
 <h3 className="text-section text-white">{selectedCapability.name}</h3>
 <p className="text-label text-zinc-400">Provider: {selectedCapability.provider}</p>
 </div>
 </div>
 <button onClick={() => setSelectedCapability(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800">
 <XCircle size={20} />
 </button>
 </div>
 <div className="p-6 space-y-6">
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
 <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">Status</span>
 <div className="flex items-center gap-2">
 <div className={`w-2 h-2 rounded-full ${selectedCapability.health === 'CONNECTED' ? 'bg-emerald-500' : (selectedCapability.health === 'DEGRADED' ? 'bg-amber-500' : 'bg-rose-500')}`}></div>
 <span className="text-secondary font-medium text-zinc-200">{selectedCapability.health}</span>
 </div>
 </div>
 <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
 <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">Latency</span>
 <div className="flex items-center gap-2">
 <Activity size={14} className="text-indigo-400" />
 <span className="text-secondary font-medium text-zinc-200">{selectedCapability.latencyMs} ms</span>
 </div>
 </div>
 <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
 <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">Version</span>
 <span className="text-secondary font-medium text-zinc-200 block mt-1">{selectedCapability.version}</span>
 </div>
 <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
 <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">Last Sync</span>
 <span className="text-secondary font-medium text-zinc-200 block mt-1">{new Date(selectedCapability.lastSync).toLocaleTimeString()}</span>
 </div>
 </div>
 
 <div className="pt-4 flex justify-end gap-3">
 <button
 onClick={handleCapabilityTest}
 disabled={isTestingCapability}
 className="px-4 py-2 text-button text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700/50 disabled:opacity-60"
 >
 {isTestingCapability ? 'Testing...' : 'Test Connection'}
 </button>
 <button
 onClick={handleCapabilityConfigure}
 disabled={isConfiguringCapability}
 className="px-4 py-2 text-button text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-60"
 >
 {isConfiguringCapability ? 'Configuring...' : 'Configure'}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* INTENT MODAL */}
 {selectedIntent && (
 <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedIntent(null)}>
 <div className="w-full max-w-lg h-full bg-zinc-950 border-l border-zinc-800/80 shadow-2xl overflow-y-auto animate-in slide-in-from-right-8 duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
 <div className="p-6 border-b border-zinc-800/60 bg-zinc-900/30 sticky top-0 z-10 backdrop-blur-md">
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
 <Target size={16} className="text-indigo-400" />
 </div>
 <span className="text-label font-mono text-zinc-500">{selectedIntent.id}</span>
 </div>
 <button onClick={() => setSelectedIntent(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-full hover:bg-zinc-800">
 <XCircle size={20} />
 </button>
 </div>
 <h2 className="text-workspace text-white mb-3">{selectedIntent.prompt}</h2>
 <div className="flex items-center gap-3">
 <span className={`px-2 py-1 rounded text-label font-semibold ${selectedIntent.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : (selectedIntent.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20')}`}>
 {selectedIntent.status}
 </span>
 <span className="text-label text-zinc-400 flex items-center gap-1"><Clock size={12}/> {new Date(selectedIntent.createdAt).toLocaleString()}</span>
 </div>
 </div>
 
 <div className="p-6 flex-1 space-y-8">
 {/* Progress Section */}
 <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800/50">
 <div className="flex items-center justify-between mb-2">
 <span className="text-secondary font-medium text-zinc-300">Execution Progress</span>
 <span className="text-secondary font-bold text-white">{selectedIntent.progress}%</span>
 </div>
 <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
 <div className={`h-full rounded-full ${selectedIntent.status === 'COMPLETED' ? 'bg-emerald-500' : (selectedIntent.status === 'FAILED' ? 'bg-rose-500' : 'bg-indigo-500')}`} style={{ width: `${selectedIntent.progress}%` }}></div>
 </div>
 <div className="text-label text-zinc-400 mt-2 flex items-center gap-2">
 <Info size={14} className="text-indigo-400"/>
 Last updated: {new Date(selectedIntent.updatedAt).toLocaleTimeString()}
 </div>
 </div>

 {/* Capabilities Used */}
 <div>
 <h4 className="text-label font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
 <Grid size={14} /> Systems Orchestrated
 </h4>
 <div className="flex flex-wrap gap-2">
 {selectedIntent.capabilitiesUsed?.map((sys: string) => (
 <div key={sys} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-secondary text-zinc-300 flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
 {sys}
 </div>
 ))}
 </div>
 </div>

 {/* Execution Trace */}
 <div>
 <h4 className="text-label font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
 <List size={14} /> Execution Trace
 </h4>
 <ExecutionTrace
 trace={selectedIntent.trace || []}
 missions={selectedIntent.missions}
 approve={approve}
 isApproving={isApproving}
 selectedIntentId={selectedIntent.id}
 onReroute={(missionId) => console.log('Reroute', missionId)}
 onAcknowledge={(missionId) => console.log('Acknowledge', missionId)}
 />
 </div>
 </div>
 
 <div className="p-6 border-t border-zinc-800/60 bg-zinc-900/30 sticky bottom-0">
 <button className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-button border border-zinc-700/50 flex items-center justify-center gap-2">
 <FileText size={16} /> View Full Logs
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

// --- SUB-COMPONENTS ---

function NavItem({ icon, label, desc, active = false }: { icon: React.ReactNode, label: string, desc: string, active?: boolean }) {
 return (
 <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${active ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'}`}>
 <div className={`${active ? 'text-indigo-400' : 'text-zinc-500'}`}>
 {icon}
 </div>
 <div>
 <div className={`text-secondary font-medium ${active ? 'text-indigo-300' : 'text-zinc-200'}`}>{label}</div>
 <div className="text-[10px] text-zinc-500">{desc}</div>
 </div>
 </button>
 );
}

function WorkspaceItem({ name, active = false, onClick }: { name: string, active?: boolean, onClick?: () => void }) {
 return (
 <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}>
 <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${active ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500'}`}>
 {name.charAt(0)}
 </div>
 <span className="text-secondary font-medium truncate">{name}</span>
 </button>
 );
}

function ShortcutItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
 return (
 <button onClick={onClick} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200">
 <div className="text-zinc-500">{icon}</div>
 <span className="text-secondary font-medium">{label}</span>
 </button>
 );
}

function SuggestionPill({ text, onClick }: { text: string, onClick?: (text: string) => void }) {
 return (
 <button onClick={() => onClick?.(text)} className="bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 text-zinc-300 px-4 py-1.5 rounded-full text-label transition-all hover:-translate-y-0.5 shadow-sm">
 {text}
 </button>
 );
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
 return (
 <button onClick={onClick} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors text-button ">
 {icon}
 <span className="hidden sm:inline">{label}</span>
 </button>
 );
}

function MetricCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
 return (
 <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:bg-zinc-800/40 transition-colors shadow-sm">
 <div className="flex items-center justify-between mb-3">
 <span className="text-label text-zinc-400">{label}</span>
 {icon}
 </div>
 <div className="text-page text-white tracking-tight">{value}</div>
 </div>
 );
}

function TwinStage({ icon, label, sublabel, active, done, pulsing, highlight }: any) {
 return (
 <div className={`flex flex-col items-center gap-3 z-10 w-24 ${active ? 'opacity-100' : (done ? 'opacity-70' : 'opacity-40')}`}>
 <div className={`relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
 highlight 
 ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' 
 : done 
 ? 'bg-zinc-800 border-emerald-500/50 text-emerald-400'
 : 'bg-zinc-900 border-zinc-700 text-zinc-500'
 }`}>
 {pulsing && (
 <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-50"></div>
 )}
 {icon}
 </div>
 <div className="text-center">
 <div className={`text-[11px] font-bold uppercase tracking-wider ${highlight ? 'text-indigo-300' : (done ? 'text-zinc-300' : 'text-zinc-500')}`}>
 {label}
 </div>
 {sublabel && (
 <div className="text-[10px] text-zinc-400 mt-1 bg-zinc-800/80 px-2 py-0.5 rounded-full inline-block border border-zinc-700/50">
 {sublabel}
 </div>
 )}
 </div>
 </div>
 );
}

function TwinLine({ done }: { done?: boolean }) {
 return (
 <div className="flex-1 h-0.5 bg-zinc-800 relative mt-6 md:mt-6 hidden md:block max-w-[80px]">
 {done && (
 <div className="absolute top-0 left-0 h-full bg-emerald-500/50 w-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
 )}
 </div>
 );
}

function SectionCard({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
 return (
 <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/80 rounded-xl p-5 shadow-sm">
 <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800/50">
 {icon}
 <h3 className="text-secondary font-semibold text-white tracking-wide">{title}</h3>
 </div>
 {children}
 </div>
 );
}

function WorkspaceBox({ name, icon, color, onClick }: { name: string, icon: React.ReactNode, color: string, onClick?: () => void }) {
 const colorMap: Record<string, string> = {
 emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
 amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
 blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
 rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20',
 purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
 };
 return (
 <button onClick={onClick} className={`flex items-center gap-2.5 p-3 rounded-lg border transition-colors cursor-pointer ${colorMap[color] || colorMap.blue}`}>
 {icon}
 <span className="text-label ">{name}</span>
 </button>
 );
}

function CapBox({ cap, onClick }: { cap: any, onClick?: () => void }) {
 const isHealthy = cap.health === 'CONNECTED';
 const isWarning = cap.health === 'DEGRADED';
 
 return (
 <button onClick={onClick} className="flex flex-col gap-1.5 p-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors text-left w-full cursor-pointer">
 <span className="text-label text-zinc-300 truncate">{cap.name}</span>
 <div className="flex items-center gap-1.5">
 <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : (isWarning ? 'bg-amber-500 animate-pulse' : 'bg-rose-500')}`}></div>
 <span className="text-[10px] text-zinc-500">{cap.health}</span>
 </div>
 </button>
 );
}

function RecentIntent({ intent, onClick }: { intent: any, onClick?: () => void }) {
 const isDone = intent.status === 'COMPLETED';
 const isFailed = intent.status === 'FAILED';
 const isReview = intent.status === 'NEEDS_APPROVAL';
 const time = new Date(intent.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 const statusColors = isDone ? 'bg-emerald-500/10 text-emerald-400' : (isFailed ? 'bg-rose-500/10 text-rose-400' : (isReview ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'));
 const progressBg = isDone ? 'bg-emerald-500' : (isFailed ? 'bg-rose-500' : (isReview ? 'bg-amber-500' : 'bg-indigo-500'));
 
 return (
 <div onClick={onClick} className="group flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 bg-zinc-950/30 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer">
 <div className="flex-1 min-w-0 pr-4">
 <div className="flex items-center gap-2 mb-1.5">
 <span className="text-secondary font-medium text-zinc-200 truncate group-hover:text-white transition-colors">{intent.prompt}</span>
 </div>
 <div className="flex items-center gap-3 text-[10px]">
 <span className={`px-1.5 py-0.5 rounded-sm font-medium ${statusColors}`}>
 {intent.status}
 </span>
 <span className="text-zinc-500 flex items-center gap-1"><Clock size={10}/> {time}</span>
 </div>
 </div>
 <div className="w-10 flex flex-col items-end gap-1">
 <span className="text-label font-semibold text-zinc-400">{intent.progress}%</span>
 <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${progressBg}`} style={{ width: `${intent.progress}%` }}></div>
 </div>
 </div>
 </div>
 );
}

function ActivityItem({ icon, title, desc, time }: { icon: React.ReactNode, title: string, desc: string, time: string }) {
 return (
 <div className="relative pl-6">
 <div className="absolute left-[-21px] top-1 w-6 h-6 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center z-10">
 <div className="scale-75">{icon}</div>
 </div>
 <div className="flex flex-col">
 <div className="flex items-baseline justify-between gap-2">
 <span className="text-label text-zinc-200">{title}</span>
 <span className="text-[10px] text-zinc-500 shrink-0">{time}</span>
 </div>
 <span className="text-[11px] text-zinc-400 mt-0.5">{desc}</span>
 </div>
 </div>
 );
}

function InsightItem({ text, type }: { text: string, type: 'savings' | 'efficiency' | 'warning' }) {
 const config = {
 savings: { icon: <TrendingUp size={14} className="text-emerald-400" />, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
 efficiency: { icon: <Zap size={14} className="text-indigo-400" />, bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
 warning: { icon: <Info size={14} className="text-amber-400" />, bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
 };
 const { icon, bg, border } = config[type];
 
 return (
 <div className={`flex items-start gap-3 p-3 rounded-lg border ${bg} ${border}`}>
 <div className="mt-0.5 shrink-0 bg-zinc-950/50 p-1.5 rounded-md shadow-sm">{icon}</div>
 <p className="text-label text-zinc-300 ">{text}</p>
 </div>
 );
}

function activityIcon(icon: 'activity' | 'intent' | 'capability' | 'import' | 'warning', level: 'info' | 'warn' | 'error') {
 if (level === 'error') return <XCircle size={14} className="text-rose-400" />;
 if (level === 'warn' || icon === 'warning') return <AlertCircle size={14} className="text-amber-400" />;
 if (icon === 'intent') return <Target size={14} className="text-indigo-400" />;
 if (icon === 'capability') return <Grid size={14} className="text-emerald-400" />;
 if (icon === 'import') return <UploadCloud size={14} className="text-blue-400" />;
 return <Activity size={14} className="text-zinc-400" />;
}

function ImportBox({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) {
 return (
 <button onClick={onClick} className="flex flex-col items-center justify-center gap-2 p-4 bg-zinc-900/50 border border-zinc-700/50 rounded-xl hover:bg-zinc-800/80 hover:border-zinc-600 transition-all group">
 <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 group-hover:scale-110 transition-all shadow-sm">
 {icon}
 </div>
 <div className="text-center">
 <div className="text-label font-semibold text-zinc-200 mb-0.5">{title}</div>
 <div className="text-[10px] text-zinc-500">{desc}</div>
 </div>
 </button>
 );
}
