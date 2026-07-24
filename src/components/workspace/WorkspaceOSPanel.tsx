/**
 * WorkspaceOSPanel — Right-side Workspace Intelligence
 *
 * Provides:
 * - Workspace templates (Sales, HR, Healthcare, Engineering, Legal, Finance)
 * - Active workspace modules
 * - AI workspace builder via natural language
 * - Task summary from GlobalIntentProvider
 * - Upcoming calendar events from OSScheduler
 */

import React, { useState } from 'react';
import {
 LayoutDashboard, Plus, Briefcase, Users, Stethoscope,
 Code2, Scale, BarChart2, Sparkles, CheckCircle2, Calendar,
 ArrowUpRight, Loader2, ChevronRight, Zap, Settings, X
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCHATROS } from '@/core/os/hooks';
import { generate } from '@/services/ai';
import { toast } from 'sonner';

interface WorkspaceTemplate {
 id: string;
 name: string;
 icon: React.ReactNode;
 color: string;
 gradient: string;
 modules: string[];
 description: string;
}

const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
 {
 id: 'sales',
 name: 'Sales',
 icon: <Briefcase className="w-4 h-4" />,
 color: 'text-blue-400',
 gradient: 'from-blue-600/20 to-cyan-600/10',
 modules: ['CRM Pipeline', 'Deal Tracker', 'Meeting Log', 'Proposals', 'Revenue'],
 description: 'Full sales pipeline with CRM, deal tracking and customer timeline',
 },
 {
 id: 'hr',
 name: 'HR & Recruitment',
 icon: <Users className="w-4 h-4" />,
 color: 'text-violet-400',
 gradient: 'from-violet-600/20 to-purple-600/10',
 modules: ['Candidate Pipeline', 'Interview Tracker', 'Onboarding', 'Leave Calendar', 'Payroll'],
 description: 'End-to-end hiring, onboarding and HR management workspace',
 },
 {
 id: 'healthcare',
 name: 'Healthcare',
 icon: <Stethoscope className="w-4 h-4" />,
 color: 'text-emerald-400',
 gradient: 'from-emerald-600/20 to-teal-600/10',
 modules: ['Patient Records', 'Appointments', 'Prescriptions', 'Lab Reports', 'Billing'],
 description: 'Patient management, appointments and clinical workflow',
 },
 {
 id: 'engineering',
 name: 'Engineering',
 icon: <Code2 className="w-4 h-4" />,
 color: 'text-orange-400',
 gradient: 'from-orange-600/20 to-amber-600/10',
 modules: ['Sprint Board', 'Bug Tracker', 'Code Review', 'Deployments', 'Docs'],
 description: 'Agile sprints, bug tracking and engineering deliverables',
 },
 {
 id: 'legal',
 name: 'Legal',
 icon: <Scale className="w-4 h-4" />,
 color: 'text-rose-400',
 gradient: 'from-rose-600/20 to-pink-600/10',
 modules: ['Cases', 'Contracts', 'Deadlines', 'Documents', 'Billing'],
 description: 'Case management, contracts and legal document workflow',
 },
 {
 id: 'finance',
 name: 'Finance',
 icon: <BarChart2 className="w-4 h-4" />,
 color: 'text-amber-400',
 gradient: 'from-amber-600/20 to-yellow-600/10',
 modules: ['Expenses', 'Invoices', 'Budget', 'Reports', 'Payables'],
 description: 'Financial management, budgeting and expense tracking',
 },
];

interface WorkspaceOSPanelProps {
 activeWorkspace?: string;
 onCreateWorkspace?: (templateId: string) => void;
}

export const WorkspaceOSPanel: React.FC<WorkspaceOSPanelProps> = ({
 activeWorkspace,
 onCreateWorkspace,
}) => {
 const [view, setView] = useState<'templates' | 'builder' | 'active'>('templates');
 const [builderInput, setBuilderInput] = useState('');
 const [aiLoading, setAiLoading] = useState(false);
 const [aiPlan, setAiPlan] = useState('');
 const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
 const { knowledge, scheduledToday, scheduledUpcoming, observeText } = useCHATROS();

 const buildWorkspaceFromAI = async () => {
 if (!builderInput.trim()) return;
 setAiLoading(true);
 observeText(builderInput);
 try {
 const prompt = `Based on this request: "${builderInput}", suggest a workspace setup with: 1) Workspace name, 2) 4-5 modules to include, 3) First 3 action items. Be brief and practical.`;
 const plan = await generate({ prompt });
 setAiPlan(plan || 'Workspace configured. Starting with Dashboard, Tasks, Calendar, and Files.');
 } catch {
 setAiPlan('Sales Workspace ready — includes Pipeline, Tasks, Calendar and Document store.');
 } finally {
 setAiLoading(false);
 }
 };

 const handleCreateWorkspace = (templateId: string) => {
 toast.success(`${WORKSPACE_TEMPLATES.find(t => t.id === templateId)?.name} workspace created`);
 onCreateWorkspace?.(templateId);
 setSelectedTemplate(templateId);
 setView('active');
 };

 const activeTemplate = WORKSPACE_TEMPLATES.find(t => t.id === (selectedTemplate || activeWorkspace));

 return (
 <div className="w-[270px] shrink-0 flex flex-col border-l border-white/[0.04] bg-zinc-950/50 backdrop-blur-xl overflow-hidden">
 {/* Header */}
 <div className="px-3 py-3 border-b border-white/[0.04] shrink-0">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-orange-500" />
 <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Workspace OS</span>
 </div>
 <div className="flex gap-1">
 {(['templates', 'builder'] as const).map(v => (
 <button
 key={v}
 onClick={() => setView(v)}
 className={cn(
 'px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-colors',
 view === v ? 'bg-white/10 text-white/80' : 'text-white/25 hover:text-white/50'
 )}
 >
 {v === 'builder' ? 'AI Build' : 'Templates'}
 </button>
 ))}
 </div>
 </div>
 </div>

 <ScrollArea className="flex-1">
 <div className="p-3 space-y-3">

 {/* AI BUILDER */}
 {view === 'builder' && (
 <>
 <div className="p-3 rounded-xl bg-orange-500/[0.07] border border-orange-500/20">
 <div className="flex items-center gap-2 mb-2">
 <Sparkles className="w-3.5 h-3.5 text-orange-400" />
 <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">AI Workspace Builder</span>
 </div>
 <p className="text-[10px] text-white/50 mb-2">Describe your workflow and I'll set it up</p>
 <textarea
 value={builderInput}
 onChange={e => setBuilderInput(e.target.value)}
 placeholder="e.g. I need a workspace for managing customer onboarding and support tickets..."
 rows={3}
 className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/40 resize-none"
 />
 <button
 onClick={buildWorkspaceFromAI}
 disabled={aiLoading || !builderInput.trim()}
 className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/20 text-orange-400 text-[11px] font-semibold disabled:opacity-40 transition-all"
 >
 {aiLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> Building...</> : <><Sparkles className="w-3 h-3" /> Build Workspace</>}
 </button>
 </div>

 {aiPlan && (
 <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
 <div className="flex items-center gap-2 mb-2">
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
 <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">AI Plan Ready</span>
 </div>
 <p className="text-[11px] text-white/60 leading-relaxed">{aiPlan}</p>
 <button
 onClick={() => { toast.success('Workspace launched!'); setView('active'); }}
 className="w-full mt-2 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[11px] font-semibold transition-colors"
 >
 Launch Workspace
 </button>
 </div>
 )}
 </>
 )}

 {/* TEMPLATES */}
 {view === 'templates' && (
 <>
 <p className="text-[10px] text-white/30 px-1">Choose a workspace template to get started instantly</p>
 <div className="space-y-2">
 {WORKSPACE_TEMPLATES.map(template => (
 <div
 key={template.id}
 className={cn(
 'p-3 rounded-xl border transition-all cursor-pointer group',
 selectedTemplate === template.id
 ? 'border-white/20 bg-white/[0.05]'
 : 'border-white/[0.05] hover:border-white/[0.12] bg-white/[0.01] hover:bg-white/[0.03]'
 )}
 onClick={() => setSelectedTemplate(template.id)}
 >
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2">
 <span className={template.color}>{template.icon}</span>
 <span className="text-[12px] font-bold text-white/90">{template.name}</span>
 </div>
 {selectedTemplate === template.id ? (
 <button
 onClick={(e) => { e.stopPropagation(); handleCreateWorkspace(template.id); }}
 className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 text-[9px] font-bold hover:bg-orange-500/30 transition-colors"
 >
 Create
 </button>
 ) : (
 <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/50 transition-colors" />
 )}
 </div>
 <p className="text-[10px] text-white/40 mb-2">{template.description}</p>
 <div className="flex flex-wrap gap-1">
 {template.modules.slice(0, 3).map(mod => (
 <span key={mod} className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-white/[0.04] text-white/40">{mod}</span>
 ))}
 {template.modules.length > 3 && (
 <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-white/[0.04] text-white/30">+{template.modules.length - 3}</span>
 )}
 </div>
 </div>
 ))}
 </div>
 </>
 )}

 {/* ACTIVE WORKSPACE */}
 {view === 'active' && activeTemplate && (
 <>
 <div className={cn('p-3 rounded-xl bg-gradient-to-br border border-white/[0.07]', activeTemplate.gradient)}>
 <div className="flex items-center gap-2 mb-1">
 <span className={activeTemplate.color}>{activeTemplate.icon}</span>
 <span className="text-[12px] font-bold text-white">{activeTemplate.name} Workspace</span>
 <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">ACTIVE</span>
 </div>
 <p className="text-[10px] text-white/50">{activeTemplate.description}</p>
 </div>

 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 px-1">Modules</p>
 <div className="space-y-1">
 {activeTemplate.modules.map((mod, i) => (
 <div key={mod} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
 <span className="text-[11px] text-white/70">{mod}</span>
 <ArrowUpRight className="w-3 h-3 text-white/15 ml-auto" />
 </div>
 ))}
 </div>
 </div>
 </>
 )}

 {/* Upcoming from OS Scheduler */}
 {(scheduledToday.length > 0 || scheduledUpcoming.length > 0) && (
 <div className="space-y-4">
 {scheduledToday.length > 0 && (
 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 px-1">Today's Schedule</p>
 <div className="space-y-1">
 {scheduledToday.slice(0, 4).map(entry => (
 <div key={entry.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-violet-500/[0.05] border border-violet-500/10">
 <Calendar className="w-3 h-3 text-violet-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-medium text-white/70 truncate">{entry.title}</p>
 <p className="text-[9px] text-white/30">
 {new Date(entry.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 {scheduledUpcoming.length > 0 && (
 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 px-1">Upcoming Schedule</p>
 <div className="space-y-1">
 {scheduledUpcoming.slice(0, 4).map(entry => (
 <div key={entry.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-blue-500/[0.05] border border-blue-500/10">
 <Calendar className="w-3 h-3 text-blue-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-medium text-white/70 truncate">{entry.title}</p>
 <p className="text-[9px] text-white/30">
 {new Date(entry.scheduledFor).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
 </p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Detected intent quick-create */}
 {knowledge.intents.length > 0 && (
 <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
 <div className="flex items-center gap-1.5 mb-1.5">
 <Zap className="w-3 h-3 text-amber-400" />
 <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Detected Intent</span>
 </div>
 <div className="flex flex-wrap gap-1">
 {knowledge.intents.map((intent, i) => (
 <button
 key={i}
 className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 hover:bg-amber-500/20 transition-colors capitalize"
 onClick={() => observeText(intent)}
 >
 + {intent}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 </ScrollArea>
 </div>
 );
};
