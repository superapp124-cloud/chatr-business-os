import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, Search, Database, Network, Cloud, ChevronRight, Activity, 
  FolderGit2, CalendarClock, Zap, CheckCircle2, FileText, BrainCircuit,
  MessageSquare, User, Linkedin, Facebook, Building, Layout, Box, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { kernelClient } from '@/core/ipc/KernelClient';
import { toast } from 'sonner';

interface ConnectedProvider {
  id: string;
  name: string;
  status: string;
  accounts: number;
  icon: React.ComponentType<{ className?: string }>;
  loginUrl: string;
}

const providerLoginUrls: Record<string, string> = {
  google: 'https://accounts.google.com/',
  microsoft: 'https://login.microsoftonline.com/',
  slack: 'https://slack.com/signin',
  github: 'https://github.com/login',
  linkedin: 'https://www.linkedin.com/login',
  facebook: 'https://www.facebook.com/login/',
  notion: 'https://www.notion.so/login',
  jira: 'https://id.atlassian.com/login',
  dropbox: 'https://www.dropbox.com/login',
  salesforce: 'https://login.salesforce.com/',
};

const DEFAULT_TIMELINE = [
  { id: '1', title: 'Rajesh (Acme Corp) sent follow-up query', time: '10 min ago', detail: 'Email & DM', category: 'Customer Care', icon: 'mail' },
  { id: '2', title: 'Payroll Approval requested by HR', time: '45 min ago', detail: 'High Priority', category: 'Finance', icon: 'calendar' },
  { id: '3', title: 'AI Candidate Screener completed 14 profiles', time: '2 hours ago', detail: 'Recruitment', category: 'HR Automation', icon: 'message-square' },
  { id: '4', title: 'Srinagar Flight Fare Drop detected (-₹4,500)', time: '3 hours ago', detail: 'Travel Intelligence', category: 'Cost Optimization', icon: 'calendar' },
];

const DEFAULT_INTENTS = [
  { id: '1', text: 'Screen Senior React Candidates', progress: 85, category: 'Recruitment' },
  { id: '2', text: 'Sync Q3 Revenue & Payroll Models', progress: 60, category: 'Finance' },
  { id: '3', text: 'Deploy Voice AI Calling Bridge', progress: 40, category: 'Engineering' },
];

const DEFAULT_MEMORY = [
  { id: '1', title: 'Acme Corp Proposal v3.pdf', type: 'Document', time: 'Yesterday 4:30 PM' },
  { id: '2', title: 'Rajesh Kumar (CTO Acme)', type: 'Person', time: '2 days ago' },
  { id: '3', title: 'Q3 Product Roadmap Sync', type: 'Meeting', time: '3 days ago' },
];

const openProviderLogin = async (provider: ConnectedProvider) => {
  const electronAPI = (window as any).electronAPI;

  if (electronAPI?.smartInbox?.connectProvider) {
    return electronAPI.smartInbox.connectProvider(provider.id);
  } else if (electronAPI?.auth?.openProviderLogin) {
    return electronAPI.auth.openProviderLogin(provider.id);
  }

  window.open(provider.loginUrl, '_blank', 'noopener,noreferrer');
  return { ok: true, url: provider.loginUrl };
};

export default function Workspace() {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('Good afternoon');
  const [userName, setUserName] = useState('Arshid');

  const [connectedProviders, setConnectedProviders] = useState<ConnectedProvider[]>([]);
  const [activeIntents, setActiveIntents] = useState<any[]>(DEFAULT_INTENTS);
  const [intentFeed, setIntentFeed] = useState<any[]>(DEFAULT_TIMELINE);
  const [recentMemory, setRecentMemory] = useState<any[]>(DEFAULT_MEMORY);
  const [openingProvider, setOpeningProvider] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [intelligenceBrief, setIntelligenceBrief] = useState<any>({
    metrics: { emails: 12, contracts: 3, invoices: 1, meetings: 4 },
    actions: [{ label: 'Review Contracts' }, { label: 'Clear Inbox' }]
  });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        try {
          const res = await kernelClient.dispatchIntent({ intent: 'dashboard.search', payload: { query: searchQuery } });
          if (res.success && res.data) {
            setSearchResults(res.data);
          }
        } catch (err) {
          console.error('Search failed', err);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Timeline
        const timelineRes = await kernelClient.dispatchIntent({ intent: 'dashboard.get_timeline' });
        if (timelineRes.success && timelineRes.data && timelineRes.data.length > 0) {
          setIntentFeed(timelineRes.data);
        }

        // Fetch Intents
        const intentsRes = await kernelClient.dispatchIntent({ intent: 'dashboard.get_active_intents' });
        if (intentsRes.success && intentsRes.data && intentsRes.data.length > 0) {
          setActiveIntents(intentsRes.data);
        }

        // Fetch Memory
        const memoryRes = await kernelClient.dispatchIntent({ intent: 'dashboard.get_recent_memory' });
        if (memoryRes.success && memoryRes.data && memoryRes.data.length > 0) {
          setRecentMemory(memoryRes.data);
        }

        // Fetch Intelligence Brief
        const briefRes = await kernelClient.dispatchIntent({ intent: 'dashboard.get_intelligence_brief' });
        if (briefRes.success && briefRes.data && briefRes.data.metrics) {
          setIntelligenceBrief(briefRes.data);
        }
        
        // Fetch Smart Inbox State
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.smartInbox?.getState) {
          const state = await electronAPI.smartInbox.getState();
          const icons: Record<string, any> = {
            google: Cloud,
            microsoft: Cloud,
            slack: MessageSquare,
            github: FolderGit2,
            linkedin: Linkedin,
            facebook: Facebook,
            notion: Layout,
            jira: Building,
            dropbox: Box,
            salesforce: Cloud
          };
          setConnectedProviders(state.providers.map((p: any) => ({
            id: p.id,
            name: p.name,
            status: p.status === 'authentication_started' ? 'Syncing' : (p.status === 'not_connected' ? 'Offline' : 'Healthy'),
            accounts: p.accounts || 0,
            icon: icons[p.id] || Cloud,
            loginUrl: providerLoginUrls[p.id] || ''
          })));
        } else {
          // Fallback for web mode
          setConnectedProviders([
            { id: 'google', name: 'Google Workspace', status: 'Healthy', accounts: 1, icon: Cloud, loginUrl: providerLoginUrls.google },
            { id: 'microsoft', name: 'Microsoft 365', status: 'Healthy', accounts: 1, icon: Cloud, loginUrl: providerLoginUrls.microsoft },
            { id: 'slack', name: 'Slack', status: 'Healthy', accounts: 2, icon: MessageSquare, loginUrl: providerLoginUrls.slack },
            { id: 'github', name: 'GitHub', status: 'Healthy', accounts: 1, icon: FolderGit2, loginUrl: providerLoginUrls.github },
            { id: 'linkedin', name: 'LinkedIn', status: 'Healthy', accounts: 1, icon: Linkedin, loginUrl: providerLoginUrls.linkedin },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch real data', err);
      }
    }
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'mail': return FileText;
      case 'calendar': return CalendarClock;
      case 'message-square': return MessageSquare;
      default: return Activity;
    }
  }

  const getMemoryIcon = (type: string) => {
    switch(type) {
      case 'Person': return User;
      case 'Meeting': return CalendarClock;
      case 'Company': return Database;
      default: return FileText;
    }
  }

  const startProviderLogin = async (provider: ConnectedProvider) => {
    setOpeningProvider(provider.id);
    toast.info(`Connecting to ${provider.name}...`);
    try {
      await openProviderLogin(provider);
    } catch (err) {
      console.error(`Failed to open ${provider.name} login`, err);
    } finally {
      setOpeningProvider(null);
    }
  };

  const handleBriefAction = (actLabel: string) => {
    if (actLabel.includes('Review')) {
      toast.success('Navigating to Contract & Document Reviews...');
      navigate('/desktop/tickets');
    } else if (actLabel.includes('Clear')) {
      toast.success('Inbox triage complete. 12 emails archived.');
      setIntelligenceBrief((prev: any) => ({
        ...prev,
        metrics: { ...prev.metrics, emails: 0 }
      }));
    } else {
      toast.info(`Executing: ${actLabel}`);
    }
  };

  return (
    <div className="flex-1 bg-[#0a0a0c] h-full overflow-y-auto font-sans custom-scrollbar">
      <div className="w-full max-w-[1600px] mx-auto p-5 md:p-6 space-y-5">

        {/* ── 1. Compact Header & Omni-Search Row ─────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-indigo-500/40 shadow-md shadow-indigo-500/20 shrink-0">
              <img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight leading-tight">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">{userName}</span> 👋
              </h1>
              <p className="text-[11px] text-indigo-300/80 font-medium uppercase tracking-wider">
                AI Processed {intentFeed.length} events today
              </p>
            </div>
          </div>

          {/* Omni Search bar */}
          <div className="w-full md:w-[460px] relative group">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search everything (People, Projects, Emails) or type an intent..."
              className="w-full h-10 bg-black/40 border border-white/15 rounded-xl pl-10 pr-12 text-xs font-medium text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner"
            />
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono text-slate-300 border border-white/10">⌘K</kbd>
            </div>
          </div>
        </div>

        {/* ── 2. Compact AI Intelligence Brief Banner (Horizontal 12-col) ── */}
        <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/25 to-black/60 rounded-2xl border border-indigo-500/30 p-4 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Metrics Inline Group */}
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto custom-scrollbar pb-1 lg:pb-0">
            <div className="flex items-center gap-2.5 mr-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              </div>
              <span className="text-[11px] font-black text-white/90 uppercase tracking-widest shrink-0">AI Brief</span>
            </div>

            {/* Metric Chips */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="text-lg font-black text-white">{intelligenceBrief.metrics.emails}</span>
                <span className="text-[11px] font-medium text-slate-300">Emails</span>
              </div>
              <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="text-lg font-black text-rose-400">{intelligenceBrief.metrics.contracts}</span>
                <span className="text-[11px] font-bold text-rose-300">Contracts</span>
              </div>
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="text-lg font-black text-amber-400">{intelligenceBrief.metrics.invoices}</span>
                <span className="text-[11px] font-bold text-amber-300">Overdue Invoices</span>
              </div>
              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="text-lg font-black text-emerald-400">{intelligenceBrief.metrics.meetings}</span>
                <span className="text-[11px] font-bold text-emerald-300">Meetings</span>
              </div>
            </div>
          </div>

          {/* Actions & Connected Apps Row */}
          <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2">
              {intelligenceBrief.actions.map((act: any, i: number) => (
                <button
                  key={i}
                  onClick={() => handleBriefAction(act.label)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
                    i === 0
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/30"
                      : "bg-white/10 hover:bg-white/15 text-white border border-white/15"
                  )}
                >
                  {act.label} {i === 0 && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>

            {/* Connected App Pills */}
            <div className="hidden xl:flex items-center gap-1.5 pl-3 border-l border-white/10">
              {connectedProviders.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => startProviderLogin(p)}
                  className="p-1.5 rounded-lg bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] transition-colors cursor-pointer"
                  title={`Connect ${p.name}`}
                >
                  <p.icon className="w-3.5 h-3.5 text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3. Main Content Row: Timeline, Active Intents, Recent Memory ──── */}
        <div className="grid grid-cols-12 gap-5">
          
          {/* Panel: Unified Timeline (6 Cols) */}
          <div className="col-span-12 lg:col-span-6 bg-[#111116] rounded-2xl border border-white/10 p-5 flex flex-col gap-4 min-h-[420px] shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <h2 className="text-xs font-black text-white/90 uppercase tracking-[0.18em]">{searchQuery ? 'Search Results' : 'Intent Timeline'}</h2>
              </div>
              <button onClick={() => navigate('/desktop/chat')} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">View All</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-2.5">
              {searchQuery && searchResults.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-10">No results found for "{searchQuery}"</div>
              ) : (!searchQuery && intentFeed.length === 0) ? (
                <div className="text-center text-slate-400 text-xs py-10">No events yet... waiting for OS Kernel sync.</div>
              ) : (searchQuery ? searchResults : intentFeed).map((event: any, idx: number, arr: any[]) => {
                const IconComponent = getIcon(event.icon);
                return (
                  <div key={event.id || idx} className="flex gap-3.5 relative group p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all cursor-pointer" onClick={() => navigate('/desktop/chat')}>
                    {idx !== arr.length - 1 && (
                      <div className="absolute left-[21px] top-9 bottom-[-14px] w-[2px] bg-white/10 group-hover:bg-white/20 transition-colors"></div>
                    )}
                    <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 z-10 group-hover:border-indigo-500/40 transition-colors">
                      <IconComponent className="w-3.5 h-3.5 text-indigo-300" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-baseline justify-between mb-1">
                        <p className="text-xs font-bold text-white truncate">{event.title}</p>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">{event.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{event.detail}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                        <span className="text-[11px] text-slate-400">{event.category}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel: Active Intents (3 Cols) */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#111116] rounded-2xl border border-white/10 p-5 flex flex-col gap-4 min-h-[420px] shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <h2 className="text-xs font-black text-white/90 uppercase tracking-[0.18em]">Active Intents</h2>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {activeIntents.map(intent => (
                <div key={intent.id} className="group cursor-pointer p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] transition-all" onClick={() => navigate('/desktop/studio')}>
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors leading-tight">{intent.text}</p>
                    <span className="text-[10px] font-mono font-bold text-indigo-400 shrink-0 ml-2">{intent.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                      style={{ width: `${intent.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel: Recent Memory (3 Cols) */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-[#111116] rounded-2xl border border-white/10 p-5 flex flex-col gap-4 min-h-[420px] shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                <Database className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <h2 className="text-xs font-black text-white/90 uppercase tracking-[0.18em]">Recent Memory</h2>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {recentMemory.map(mem => {
                const MemIcon = getMemoryIcon(mem.type);
                return (
                  <div key={mem.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3 hover:bg-white/[0.07] hover:border-violet-500/30 cursor-pointer transition-all" onClick={() => navigate('/desktop/canvas')}>
                    <div className="w-7.5 h-7.5 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                      <MemIcon className="w-3.5 h-3.5 text-violet-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{mem.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{mem.type} · {mem.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
