import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CommandPalette } from '@/components/CommandPalette';
import { IntentPipeline, IntentContext, TimelineEvent } from '@/core/intent/IntentPipeline';
import { Search, Compass, Inbox, Calendar, FileText, Settings, Sparkles, Clock, Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------
// Left Pane: Workspaces Nav
// ---------------------------------------------------------
function WorkspaceLeftNav({ active, onChange }: { active: string, onChange: (id: string) => void }) {
 const [workspaces, setWorkspaces] = useState<{ id: string; icon: any; label: string }[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase.from('workspaces').select('*').eq('owner_id', user.id);
          if (!error && data && data.length > 0) {
            setWorkspaces(data.map(w => ({
              id: w.id,
              icon: w.industry === 'Sales' ? Inbox : w.industry === 'HR' ? Calendar : Compass,
              label: w.name
            })));
            if (!active) onChange(data[0].id);
            return;
          }
        }
      } catch (e) {
        console.warn('[WorkspaceIDE] Workspaces fetch error:', e);
      }

      // Default fallback
      setWorkspaces([{
        id: 'local-fallback-workspace',
        icon: Compass,
        label: 'My Workspace'
      }]);
      if (!active) onChange('local-fallback-workspace');
    }
    load();
  }, [active, onChange]);

 return (
 <div className="flex flex-col h-full w-full py-4 px-3">
 <div className="flex items-center gap-2 px-2 mb-8 mt-2">
 <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">C</div>
 <span className="font-semibold tracking-tight text-section">CHATR</span>
 </div>

 <div className="text-label font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">Workspaces</div>
 <div className="space-y-1">
 {workspaces.map(w => {
 const Icon = w.icon;
 const isActive = active === w.id;
 return (
 <button
 key={w.id}
 onClick={() => onChange(w.id)}
 className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-secondary font-medium ${
 isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
 }`}
 >
 <Icon className="w-4 h-4" />
 {w.label}
 </button>
 );
 })}
 </div>

 <div className="mt-auto space-y-1">
 <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-button text-muted-foreground hover:bg-muted hover:text-foreground">
 <Settings className="w-4 h-4" />
 System Settings
 </button>
 </div>
 </div>
 );
}

// ---------------------------------------------------------
// Center Pane: Active Task
// ---------------------------------------------------------
function WorkspaceCenter({ context }: { context: IntentContext }) {
 if (context.type === 'empty') {
 return (
 <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-background to-muted/5">
 <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)] relative">
 <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl animate-pulse" />
 <Sparkles className="w-10 h-10 text-primary relative z-10" />
 </div>
 
 <h1 className="text-display tracking-tight mb-3">Welcome to your Workspace</h1>
 <p className="text-muted-foreground text-section mb-12 max-w-lg text-center ">
 The CHATR Kernel is connected to your Knowledge Graph and ready to assist.
 </p>
 
 <div className="grid grid-cols-2 gap-4 max-w-3xl w-full mb-12">
 {[
 { title: 'Search Documents', intent: 'Find my invoice', desc: 'Find invoices, contracts, or specific clauses.', icon: Search, color: 'text-blue-400', bg: 'bg-blue-400/10' },
 { title: 'Draft an Email', intent: 'Draft email to client', desc: 'Write a follow-up to a recent client meeting.', icon: Send, color: 'text-green-400', bg: 'bg-green-400/10' },
 { title: 'Summarize Status', intent: 'Summarize meeting', desc: 'Get a brief on your active project deliverables.', icon: FileText, color: 'text-orange-400', bg: 'bg-orange-400/10' },
 { title: 'Schedule Sync', intent: 'Schedule a sync with engineering', desc: 'Find time with your team for a quick alignment.', icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-400/10' }
 ].map((s, i) => (
 <button key={i} onClick={() => {
 IntentPipeline.process(s.intent);
 }} className="group flex items-start gap-4 p-5 rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/40 hover:shadow-[0_0_30px_-15px_rgba(168,85,247,0.3)] transition-all text-left">
 <div className={`p-3 rounded-xl ${s.bg} flex-shrink-0 group-hover:scale-110 transition-transform`}>
 <s.icon className={`w-5 h-5 ${s.color}`} />
 </div>
 <div>
 <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{s.title}</h3>
 <p className="text-label text-muted-foreground ">{s.desc}</p>
 </div>
 </button>
 ))}
 </div>
 
 <div className="flex items-center gap-2 text-secondary text-muted-foreground bg-muted/30 px-5 py-2.5 rounded-full border border-border/50 backdrop-blur-sm">
 <Sparkles className="w-4 h-4 text-primary animate-pulse" />
 <span>Press <kbd className="px-2 py-1 bg-background rounded-md font-mono text-label mx-1 border border-border/50 shadow-sm text-foreground">Cmd + K</kbd> to state your intent, or drop a file anywhere.</span>
 </div>
 </div>
 );
 }

 if (context.type === 'document') {
 return (
 <div className="flex-1 flex flex-col p-8">
 <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border/50">
 <FileText className="w-6 h-6 text-blue-500" />
 <h2 className="text-workspace ">{context.title}</h2>
 </div>
 <div className="max-w-4xl bg-card border border-border shadow-sm rounded-xl p-8 overflow-y-auto">
 {context.data?.vendor && (
 <div className="flex justify-between items-start mb-8 pb-4 border-b border-border/50">
 <div>
 <h1 className="text-page mb-1">Entity Details</h1>
 <p className="text-muted-foreground">{context.data.vendor}</p>
 </div>
 {context.data?.amount && (
 <div className="text-right">
 <p className="text-secondary text-muted-foreground mb-1">Amount</p>
 <p className="text-page text-primary">{context.data.amount}</p>
 </div>
 )}
 </div>
 )}
 
 {context.data?.text && (
 <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-secondary text-muted-foreground">
 {context.data.text}
 </div>
 )}
 
 {(!context.data?.text && !context.data?.vendor) && (
 <pre className="text-secondary text-muted-foreground bg-muted p-4 rounded-lg overflow-x-auto">
 {JSON.stringify(context.data, null, 2)}
 </pre>
 )}
 </div>
 </div>
 );
 }

 return (
 <div className="flex-1 flex flex-col p-8">
 <h2 className="text-workspace ">{context.title}</h2>
 </div>
 );
}

// ---------------------------------------------------------
// Right Pane: Copilot & Memory
// ---------------------------------------------------------
function WorkspaceRightCopilot() {
 const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

 useEffect(() => {
 const unsubscribe = IntentPipeline.onTimelineChange((events) => {
 setTimeline(events);
 });
 return unsubscribe;
 }, []);

 const getIconForCategory = (cat: string) => {
 switch(cat) {
 case 'intent': return <Sparkles className="w-3 h-3 text-purple-500" />;
 case 'memory': return <Search className="w-3 h-3 text-blue-500" />;
 case 'communication': return <Send className="w-3 h-3 text-green-500" />;
 case 'workflow': return <Clock className="w-3 h-3 text-orange-500" />;
 default: return <CheckCircle2 className="w-3 h-3 text-muted-foreground" />;
 }
 };

 return (
 <div className="flex flex-col h-full w-full bg-muted/20">
 <div className="p-4 border-b border-border/40">
 <h3 className="font-medium flex items-center gap-2">
 <Clock className="w-4 h-4 text-primary" />
 Intent Timeline
 </h3>
 </div>
 
 <div className="flex-1 overflow-y-auto p-4 space-y-6">
 {timeline.map((event, i) => (
 <div key={event.id} className="relative pl-6">
 {/* Timeline line */}
 {i !== timeline.length - 1 && (
 <div className="absolute left-[11px] top-6 bottom-[-24px] w-px bg-border/60" />
 )}
 
 {/* Icon node */}
 <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
 {getIconForCategory(event.category)}
 </div>

 <div className="text-secondary font-medium mb-1">{event.title}</div>
 <div className="text-label text-muted-foreground mb-1 ">
 {event.description}
 </div>
 <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
 {format(new Date(event.timestamp), 'HH:mm:ss a')}
 </div>
 </div>
 ))}
 </div>
 </div>
 );
}

// ---------------------------------------------------------
// Main Workspace IDE
// ---------------------------------------------------------
export function WorkspaceIDE() {
 const [activeWorkspace, setActiveWorkspace] = useState('');
 const [activeContext, setActiveContext] = useState<IntentContext>({ type: 'empty', title: 'Ready' });
 const [searchParams] = useSearchParams();

 useEffect(() => {
 const fileToOpen = searchParams.get('file');
 
 // If a file is directly provided via URL (e.g. from CommandPalette)
 if (fileToOpen) {
 setActiveContext({ type: 'document', title: 'Loading...', data: { text: 'Reading file contents...' } });
 
 const loadFile = async () => {
 try {
 const electron = (window as any).electronAPI;
 if (electron?.documents?.read) {
 const result = await electron.documents.read(fileToOpen);
 
 // Extract filename from path
 const filename = fileToOpen.split('\\').pop()?.split('/').pop() || fileToOpen;
 
 setActiveContext({
 type: 'document',
 title: filename,
 data: { text: result.text || result.contentPreview || 'No content could be extracted.' }
 });
 } else {
 setActiveContext({ type: 'document', title: 'Error', data: { text: 'Electron API not available.' } });
 }
 } catch (e: any) {
 setActiveContext({ type: 'document', title: 'Error', data: { text: e.message || 'Failed to read file.' } });
 }
 };
 
 loadFile();
 } else {
 // Otherwise, just listen to intent pipeline updates
 const unsubscribe = IntentPipeline.onContextChange((context) => {
 setActiveContext(context);
 });
 return unsubscribe;
 }
 }, [searchParams]);

 return (
 <div className="flex h-[calc(100vh-32px)] w-full bg-background overflow-hidden text-foreground selection:bg-primary/30 font-sans rounded-tl-xl border-t border-l border-border/40 shadow-2xl">
 <CommandPalette />

 <div className="w-[240px] h-full border-r border-border/40 bg-card/20 shrink-0 hidden md:block">
 <WorkspaceLeftNav active={activeWorkspace} onChange={setActiveWorkspace} />
 </div>

 <div className="flex-1 h-full flex flex-col relative z-10 bg-background">
 <WorkspaceCenter context={activeContext} />
 </div>

 <div className="w-[300px] h-full border-l border-border/40 bg-card/30 flex flex-col shrink-0 hidden lg:flex">
 <WorkspaceRightCopilot />
 </div>
 </div>
 );
}
