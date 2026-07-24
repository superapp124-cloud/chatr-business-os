import React, { useState, useRef, useEffect } from 'react';
import {
 BrainCircuit, Play, Save, GitBranch, Clock, MessageSquare, Users,
 ChevronRight, ChevronDown, Plus, Search, Sparkles, Send, X,
 CheckCircle, AlertTriangle, Zap, FileText, Bell, BarChart2,
 Settings, Eye, Edit2, MoreHorizontal, Star, ArrowDown, ArrowRight,
 Activity, Layers, Globe, Mail, Phone, Database, Cpu, RefreshCw,
 UserCheck, FormInput, Bot, FileCheck, Shield, Calendar, Hash,
 TrendingUp, TrendingDown, Package, Webhook, Code2, Upload, Download,
 Copy, Trash2, History, Lock, Unlock, ChevronUp, Filter, Layout,
 Briefcase, Share2, PlusCircle, Timer, Loader2, LayoutTemplate
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
import { CommandBus } from '@/platform/AutomationOS/CommandBus';
import { EventBus } from '@/platform/AutomationOS/EventBus';
import { OSEvent } from '@/platform/AutomationOS/Types';
import { toast } from 'sonner';
import { useService } from '@/platform/Infrastructure/PlatformContext';
import { useBusinessWorkflows, BusinessWorkflow } from '@/hooks/useBusinessWorkflows';
import { ReactFlow, Controls, Background, Handle, Position, MarkerType, useNodesState, useEdgesState, addEdge, Connection, Edge } from '@xyflow/react';
import { GraphSerializer } from '../../platform/execution/GraphSerializer';
import { VersionStore } from '../../platform/execution/VersionStore';
import { SupabaseVersionRepository } from '../../platform/execution/SupabaseVersionRepository';
import { SharedNodeRegistry } from '../../platform/execution/BrowserExecutionEngine';
import { BrowserPackageRegistry, BrowserPackageManager } from '../../platform/marketplace/BrowserPackageManager';
import '@xyflow/react/dist/style.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType =
 | 'trigger' | 'form' | 'ai_screen' | 'approval' | 'notification'
 | 'condition' | 'email' | 'ai_action' | 'integration' | 'webhook'
 | 'schedule' | 'database' | 'delay' | 'document';

type NodeStatus = 'running' | 'waiting' | 'success' | 'error' | 'idle';

interface WorkflowNode {
 id: string;
 type: NodeType;
 label: string;
 description: string;
 owner?: string;
 status: NodeStatus;
 runs?: number;
 success_rate?: number;
 avg_time?: string;
 errors?: number;
 waiting?: number;
 integration?: string;
}

interface Project {
 id: string;
 name: string;
 icon: React.ReactNode;
 color: string;
 workflows: number;
 status: 'live' | 'draft' | 'paused';
}

interface TeamMember {
 name: string;
 initials: string;
 color: string;
 role: string;
 activity?: string;
 online: boolean;
}

interface Comment {
 author: string;
 initials: string;
 color: string;
 text: string;
 time: string;
 nodeId?: string;
}

interface LogEntry {
 time: string;
 level: 'info' | 'success' | 'error' | 'warn';
 message: string;
 nodeId?: string;
}

interface Version {
 number: number;
 author: string;
 time: string;
 note: string;
 published: boolean;
}

interface Template {
 id: string;
 name: string;
 category: string;
 steps: number;
 icon: React.ReactNode;
 color: string;
 description: string;
}

interface Agent {
 id: string;
 name: string;
 role: string;
 icon: React.ReactNode;
 color: string;
 status: 'active' | 'training' | 'offline';
 memory: string;
 tools: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
 { id: 'a1', name: 'Customer Support Bot', role: 'Support Triage', icon: <MessageSquare className="w-4 h-4" />, color: '#a855f7', status: 'active', memory: 'Support Docs v3', tools: ['Zendesk', 'Jira'] },
 { id: 'a2', name: 'Sales Researcher', role: 'Lead Enrichment', icon: <TrendingUp className="w-4 h-4" />, color: '#10b981', status: 'active', memory: 'CRM Data', tools: ['Clearbit', 'LinkedIn'] },
 { id: 'a3', name: 'Code Reviewer', role: 'Engineering', icon: <Code2 className="w-4 h-4" />, color: '#6366f1', status: 'training', memory: 'Style Guide', tools: ['GitHub', 'SonarQube'] },
];

const PROJECTS: Project[] = [
 { id: 'rec', name: 'Recruitment', icon: <UserCheck className="w-4 h-4" />, color: '#6366f1', workflows: 5, status: 'live' },
 { id: 'sal', name: 'Sales Pipeline', icon: <TrendingUp className="w-4 h-4" />, color: '#10b981', workflows: 3, status: 'live' },
 { id: 'fin', name: 'Finance', icon: <BarChart2 className="w-4 h-4" />, color: '#f59e0b', workflows: 4, status: 'live' },
 { id: 'hr', name: 'HR & Onboarding', icon: <Users className="w-4 h-4" />, color: '#0ea5e9', workflows: 6, status: 'draft' },
 { id: 'cs', name: 'Customer Support', icon: <MessageSquare className="w-4 h-4" />, color: '#a855f7', workflows: 2, status: 'live' },
 { id: 'ops', name: 'Operations', icon: <Settings className="w-4 h-4" />, color: '#ef4444', workflows: 3, status: 'paused' },
];

const TEAM: TeamMember[] = [
 { name: 'Arshid', initials: 'AW', color: '#6366f1', role: 'Owner', activity: 'Editing Approval step', online: true },
 { name: 'Rahul', initials: 'RS', color: '#10b981', role: 'Editor', activity: 'Viewing Interview node', online: true },
 { name: 'Isha', initials: 'IK', color: '#f59e0b', role: 'Editor', activity: 'Added comment', online: true },
 { name: 'Finance', initials: 'FT', color: '#0ea5e9', role: 'Reviewer', online: false },
 { name: 'HR Team', initials: 'HR', color: '#a855f7', role: 'Viewer', online: false },
];

const WORKFLOW_NODES: WorkflowNode[] = [
 { id: 'n1', type: 'trigger', label: 'Candidate Applies', description: 'Triggered via job portal or form submission', status: 'running', runs: 1245, success_rate: 100, avg_time: '0.1s' },
 { id: 'n2', type: 'ai_screen', label: 'AI Resume Screening', description: 'Local Ollama scores resume against JD criteria', status: 'running', runs: 1245, success_rate: 98, avg_time: '3.2s', errors: 2 },
 { id: 'n3', type: 'approval', label: 'Recruiter Review', description: 'Recruiter validates AI score and shortlists', status: 'waiting', waiting: 23, runs: 890, success_rate: 94, avg_time: '2h' },
 { id: 'n4', type: 'approval', label: 'Manager Approval', description: 'Hiring manager approves candidate for interview', status: 'waiting', waiting: 12, runs: 845, success_rate: 96, avg_time: '18h' },
 { id: 'n5', type: 'ai_action', label: 'Interview Scheduling', description: 'AI books slot using Google Calendar + Zoom', status: 'running', runs: 720, success_rate: 99, avg_time: '8s' },
 { id: 'n6', type: 'form', label: 'Interview & Feedback', description: 'Structured feedback form for interviewers', status: 'idle', runs: 610, success_rate: 100, avg_time: '45m' },
 { id: 'n7', type: 'condition', label: 'Decision Gate', description: 'Pass / Fail based on interview score ≥ 7', status: 'idle', runs: 590 },
 { id: 'n8', type: 'document', label: 'Offer Letter Generation', description: 'AI drafts offer using template + salary data', status: 'idle', runs: 412, success_rate: 100, avg_time: '6s' },
 { id: 'n9', type: 'integration', label: 'Background Verification', description: 'Triggers via AuthBridge / SpringVerify API', status: 'idle', runs: 402, success_rate: 97, avg_time: '3 days', integration: 'AuthBridge' },
 { id: 'n10', type: 'ai_action', label: 'Employee Onboarding', description: 'Creates accounts, sends welcome kit & schedule', status: 'idle', runs: 388, success_rate: 99, avg_time: '12m' },
 { id: 'n11', type: 'integration',label: 'Payroll Setup', description: 'Syncs to Razorpay Payroll / QuickBooks', status: 'idle', runs: 385, success_rate: 100, avg_time: '2m', integration: 'Razorpay' },
 { id: 'n12', type: 'notification', label: 'Completed', description: 'Notifies all stakeholders & archives record', status: 'idle', runs: 385, success_rate: 100, avg_time: '0.5s' },
];

const COMMENTS: Comment[] = [
 { author: 'Isha', initials: 'IK', color: '#f59e0b', text: "Let's add Teams integration to Interview Scheduling.", time: '2h ago', nodeId: 'n5' },
 { author: 'Rahul', initials: 'RS', color: '#10b981', text: 'Done. Also added retry logic for calendar conflicts.', time: '1h ago', nodeId: 'n5' },
 { author: 'AI', initials: 'AI', color: '#a855f7', text: 'Detected bottleneck at Manager Approval (avg 18h). Consider adding escalation after 4h.', time: '30m ago' },
 { author: 'Arshid', initials: 'AW', color: '#6366f1', text: 'Good catch. Let me add an SLA rule.', time: '25m ago' },
];

const LOGS: LogEntry[] = [
 { time: '14:52:01', level: 'info', message: 'Run #1246 started — Candidate: Priya Mehta', nodeId: 'n1' },
 { time: '14:52:04', level: 'success', message: 'AI Resume Score: 8.4/10 — Shortlisted', nodeId: 'n2' },
 { time: '14:52:04', level: 'info', message: 'Sent to Recruiter Review queue', nodeId: 'n3' },
 { time: '14:45:12', level: 'success', message: 'Run #1245 completed in 19.3 min', nodeId: 'n12' },
 { time: '14:30:00', level: 'error', message: 'Run #1241 — AI screening timeout, retrying', nodeId: 'n2' },
 { time: '14:30:03', level: 'success', message: 'Run #1241 — Retry successful', nodeId: 'n2' },
 { time: '13:55:44', level: 'warn', message: 'Manager Approval SLA breach — escalated', nodeId: 'n4' },
 { time: '13:20:11', level: 'info', message: 'Background verification requested for Run #1238', nodeId: 'n9' },
];

const VERSIONS: Version[] = [
 { number: 12, author: 'Arshid', time: 'Today 14:30', note: 'Added SLA escalation to Manager Approval', published: true },
 { number: 11, author: 'Rahul', time: 'Yesterday', note: 'Calendar retry logic in Interview Scheduling', published: false },
 { number: 10, author: 'Isha', time: '2 days ago', note: 'Added Teams integration node', published: false },
 { number: 9, author: 'Arshid', time: '1 week ago', note: 'AI scoring threshold set to 7.0', published: false },
];

const TEMPLATES: Template[] = [
 { id: 't1', name: 'Recruitment Pipeline', category: 'HR', steps: 12, icon: <UserCheck className="w-5 h-5" />, color: '#6366f1', description: 'End-to-end hiring from application to onboarding' },
 { id: 't2', name: 'Invoice Approval', category: 'Finance', steps: 6, icon: <FileCheck className="w-5 h-5" />, color: '#f59e0b', description: 'Multi-level invoice review and payment release' },
 { id: 't3', name: 'Sales Pipeline', category: 'Sales', steps: 9, icon: <TrendingUp className="w-5 h-5" />, color: '#10b981', description: 'Lead to close with CRM and AI scoring' },
 { id: 't4', name: 'Leave Request', category: 'HR', steps: 4, icon: <Calendar className="w-5 h-5" />, color: '#0ea5e9', description: 'Employee leave with manager and HR approval' },
 { id: 't5', name: 'Customer Support', category: 'Ops', steps: 7, icon: <MessageSquare className="w-5 h-5" />, color: '#a855f7', description: 'Ticket triage, AI response, and escalation' },
 { id: 't6', name: 'Vendor Onboarding', category: 'Ops', steps: 8, icon: <Package className="w-5 h-5" />, color: '#ef4444', description: 'Vendor KYC, contract sign, and system setup' },
];

const INTEGRATIONS = [
 { name: 'Email', icon: <Mail />, color: '#0ea5e9' },
 { name: 'WhatsApp', icon: <MessageSquare />, color: '#25d366' },
 { name: 'Calendar', icon: <Calendar />, color: '#6366f1' },
 { name: 'Database', icon: <Database />, color: '#f59e0b' },
 { name: 'Ollama AI', icon: <Cpu />, color: '#a855f7' },
 { name: 'Webhook', icon: <Webhook />, color: '#ef4444' },
 { name: 'Razorpay', icon: <Hash />, color: '#3395ff' },
 { name: 'REST API', icon: <Code2 />, color: '#10b981' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nodeConfig: Record<NodeType, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
 trigger: { bg: '#0d1f17', border: '#10b981', icon: <Zap />, label: 'Trigger' },
 form: { bg: '#0c1a2e', border: '#0ea5e9', icon: <FormInput />, label: 'Form' },
 ai_screen: { bg: '#1a0f2e', border: '#a855f7', icon: <BrainCircuit />,label: 'AI Screen' },
 ai_action: { bg: '#1a0f2e', border: '#a855f7', icon: <Bot />, label: 'AI Action' },
 approval: { bg: '#1c150a', border: '#f59e0b', icon: <UserCheck />, label: 'Approval' },
 notification:{ bg: '#0f1c1a', border: '#14b8a6', icon: <Bell />, label: 'Notify' },
 condition: { bg: '#1e1b4b', border: '#6366f1', icon: <GitBranch />, label: 'Condition' },
 email: { bg: '#0c1a2e', border: '#0ea5e9', icon: <Mail />, label: 'Email' },
 integration: { bg: '#14100a', border: '#f97316', icon: <Globe />, label: 'Integration' },
 webhook: { bg: '#160a0a', border: '#ef4444', icon: <Webhook />, label: 'Webhook' },
 schedule: { bg: '#0d1f17', border: '#10b981', icon: <Timer />, label: 'Schedule' },
 database: { bg: '#1c150a', border: '#f59e0b', icon: <Database />, label: 'Database' },
 delay: { bg: '#14100a', border: '#94a3b8', icon: <Clock />, label: 'Delay' },
 document: { bg: '#0c1a2e', border: '#0ea5e9', icon: <FileText />, label: 'Document' },
};

const statusConfig: Record<NodeStatus, { color: string; label: string; pulse: boolean }> = {
 running: { color: '#22c55e', label: 'Running', pulse: true },
 waiting: { color: '#f59e0b', label: 'Waiting', pulse: true },
 success: { color: '#22c55e', label: 'Done', pulse: false },
 error: { color: '#ef4444', label: 'Error', pulse: false },
 idle: { color: '#64748b', label: 'Idle', pulse: false },
};

const logColors: Record<LogEntry['level'], string> = {
 info: '#64748b',
 success: '#22c55e',
 error: '#ef4444',
 warn: '#f59e0b',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const LiveStat: React.FC<{ label: string; value: string | number; color?: string; trend?: 'up' | 'down' }> = ({ label, value, color = '#fff', trend }) => (
 <div className="text-center">
 <div className="flex items-center justify-center gap-1">
 <span className="font-bold text-secondary" style={{ color }}>{value}</span>
 {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
 {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
 </div>
 <span className="text-[10px] text-slate-500">{label}</span>
 </div>
);

const PulseDot: React.FC<{ color: string }> = ({ color }) => (
 <span className="relative flex h-2 w-2 flex-shrink-0">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
 <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
 </span>
);

// ── Workflow Node Card ──
const NodeCard: React.FC<{
 node: WorkflowNode;
 index: number;
 isSelected: boolean;
 onClick: () => void;
 onEdit?: () => void;
}> = ({ node, index, isSelected, onClick }) => {
 const [hovered, setHovered] = useState(false);
 const cfg = nodeConfig[node.type] || nodeConfig['ai_action'];
 const sc = statusConfig[node.status] || statusConfig['idle'];

 return (
 <div className="flex flex-col items-center">
 {/* Connector from previous */}
 {index > 0 && (
 <div className="flex flex-col items-center">
 <div className="w-px h-5 bg-gradient-to-b from-slate-700 to-slate-600" />
 <ArrowDown className="w-3.5 h-3.5 text-slate-600 -mt-1" />
 <div className="w-px h-2 bg-slate-700" />
 </div>
 )}

 {/* Main Card */}
 <div
 className="w-full rounded-2xl transition-all duration-200 cursor-pointer"
 style={{
 background: cfg.bg,
 border: `1.5px solid ${isSelected ? cfg.border : hovered ? cfg.border + '77' : cfg.border + '28'}`,
 boxShadow: isSelected ? `0 0 0 3px ${cfg.border}22, 0 8px 24px ${cfg.border}18` : hovered ? `0 4px 16px ${cfg.border}15` : 'none',
 transform: hovered ? 'translateY(-1px)' : 'none',
 }}
 onMouseEnter={() => setHovered(true)}
 onMouseLeave={() => setHovered(false)}
 onClick={onClick}
 >
 <div className="flex items-start gap-3 p-4">
 {/* Step number + icon */}
 <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
 <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: cfg.border + '22' }}>
 {React.cloneElement(cfg.icon as React.ReactElement, { className: 'w-4.5 h-4.5', style: { color: cfg.border, width: 18, height: 18 } })}
 </div>
 <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: cfg.border + 'aa' }}>{cfg.label}</span>
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="text-white text-secondary font-semibold ">{node.label}</h4>
 {/* Status */}
 <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: sc.color + '18' }}>
 {sc.pulse ? <PulseDot color={sc.color} /> : <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />}
 <span className="text-[9px] font-bold" style={{ color: sc.color }}>{sc.label}</span>
 </div>
 </div>
 <p className="text-slate-400 text-label mb-2">{node.description}</p>
 {node.integration && (
 <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#f97316' + '20', color: '#f97316' }}>
 via {node.integration}
 </span>
 )}
 </div>

 {/* Live Stats */}
 {node.runs !== undefined && (
 <div className="flex gap-4 flex-shrink-0 border-l pl-3 ml-1" style={{ borderColor: '#ffffff08' }}>
 <LiveStat label="Runs" value={node.runs.toLocaleString()} />
 {node.success_rate !== undefined && (
 <LiveStat label="Success" value={`${node.success_rate}%`} color={node.success_rate >= 95 ? '#22c55e' : '#f59e0b'} />
 )}
 {node.avg_time && <LiveStat label="Avg" value={node.avg_time} />}
 {node.waiting !== undefined && node.waiting > 0 && (
 <LiveStat label="Waiting" value={node.waiting} color="#f59e0b" />
 )}
 {node.errors !== undefined && node.errors > 0 && (
 <LiveStat label="Errors" value={node.errors} color="#ef4444" />
 )}
 </div>
 )}
 </div>

 {/* Hover Action Bar */}
 {hovered && (
 <div className="flex items-center gap-1 px-4 pb-3 pt-0">
 {[
 { icon: <Edit2 className="w-3 h-3" />, label: 'Configure' },
 { icon: <MessageSquare className="w-3 h-3" />, label: 'Comment' },
 { icon: <Eye className="w-3 h-3" />, label: 'Logs' },
 { icon: <Copy className="w-3 h-3" />, label: 'Clone' },
 { icon: <Trash2 className="w-3 h-3" />, label: 'Remove' },
 ].map((a, i) => (
 <button key={i}
 className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-400 hover:text-white transition-colors"
 style={{ background: '#ffffff08' }}
 onClick={e => e.stopPropagation()}>
 {a.icon} {a.label}
 </button>
 ))}
 </div>
 )}
 </div>
 </div>
 );
};


// ── Capability Schema Registry ──
const capabilitySchemas: Partial<Record<NodeType, { id: string; label: string; type: 'string' | 'number' | 'boolean' | 'select' | 'text'; options?: string[] }[]>> = {
 ai_screen: [
 { id: 'model', label: 'AI Model', type: 'select', options: ['Ollama local model', 'GPT-4o', 'Claude 3.5 Sonnet'] },
 { id: 'prompt', label: 'System Prompt', type: 'text' },
 { id: 'threshold', label: 'Pass Threshold', type: 'number' },
 ],
 approval: [
 { id: 'sla', label: 'SLA Deadline (hours)', type: 'number' },
 { id: 'escalateTo', label: 'Escalate To', type: 'select', options: ['Manager', 'Director', 'HR', 'Finance'] },
 { id: 'requireComment', label: 'Require Comment', type: 'boolean' }
 ],
 ai_action: [
 { id: 'prompt', label: 'Instruction Prompt', type: 'text' },
 { id: 'temperature', label: 'Temperature', type: 'number' },
 { id: 'tools', label: 'Allowed Tools', type: 'select', options: ['None', 'Web Search', 'Database Query'] }
 ],
 email: [
 { id: 'recipient', label: 'Recipient', type: 'string' },
 { id: 'subject', label: 'Subject', type: 'string' },
 { id: 'template', label: 'Body Template', type: 'text' }
 ]
};

// ── Right Panel: Node Workspace ──
const NodeWorkspace: React.FC<{ node: WorkflowNode; team: TeamMember[]; comments: Comment[]; onClose: () => void; nodeRegistry?: any }> = ({ node, comments, onClose, nodeRegistry }) => {
 const [tab, setTab] = useState<'properties' | 'comments' | 'ai' | 'logs' | 'history' | 'permissions'>('properties');
 const [msg, setMsg] = useState('');
 
 // Use manifest if available, fallback to hardcoded config
 const manifest = nodeRegistry ? nodeRegistry.getManifest(`core.${node.type}`) : null;
 const definition = nodeRegistry ? nodeRegistry.get(`core.${node.type}`) : null;
 const cfg = nodeConfig[node.type as NodeType] || nodeConfig.integration;
 const sc = statusConfig[node.status];
 const nodeComments = comments.filter(c => !c.nodeId || c.nodeId === node.id);

 const tabs: { id: typeof tab; label: string; badge?: number }[] = [
 { id: 'properties', label: 'Properties' },
 { id: 'comments', label: 'Comments', badge: nodeComments.length },
 { id: 'ai', label: 'AI' },
 { id: 'logs', label: 'Logs' },
 { id: 'history', label: 'History' },
 { id: 'permissions',label: 'Perms' },
 ];

 return (
 <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0d0f1a', borderLeft: '1px solid #ffffff0d' }}>
 {/* Header */}
 <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid #ffffff0a' }}>
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-xl flex-shrink-0" style={{ background: cfg.border + '20' }}>
 {React.cloneElement(cfg.icon as React.ReactElement, { className: 'w-4 h-4', style: { color: cfg.border, width: 16, height: 16 } })}
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="text-white font-bold text-secondary truncate">{node.label}</h3>
 <div className="flex items-center gap-2 mt-1">
 <div className="flex items-center gap-1">
 {sc.pulse ? <PulseDot color={sc.color} /> : <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />}
 <span className="text-[10px] font-semibold" style={{ color: sc.color }}>{sc.label}</span>
 </div>
 <span className="text-slate-600 text-[10px]">·</span>
 <span className="text-slate-500 text-[10px]">{manifest ? manifest.label : cfg.label}</span>
 </div>
 </div>
 <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white hover:bg-opacity-10 transition-all flex-shrink-0">
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 {/* Live Stats Bar */}
 {node.runs !== undefined && (
 <div className="flex items-center justify-around px-4 py-3 flex-shrink-0" style={{ background: '#ffffff05', borderBottom: '1px solid #ffffff08' }}>
 {node.runs !== undefined && <LiveStat label="Total Runs" value={node.runs.toLocaleString()} />}
 {node.success_rate !== undefined && <LiveStat label="Success" value={`${node.success_rate}%`} color={node.success_rate >= 95 ? '#22c55e' : '#f59e0b'} trend="up" />}
 {node.avg_time && <LiveStat label="Avg Time" value={node.avg_time} />}
 {node.waiting !== undefined && <LiveStat label="Waiting" value={node.waiting} color="#f59e0b" />}
 </div>
 )}

 {/* Tabs */}
 <div className="flex gap-0.5 px-3 pt-3 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid #ffffff0a' }}>
 {tabs.map(t => (
 <button key={t.id} onClick={() => setTab(t.id)}
 className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-t-lg whitespace-nowrap transition-all flex-shrink-0"
 style={{
 color: tab === t.id ? cfg.border : '#64748b',
 borderBottom: tab === t.id ? `2px solid ${cfg.border}` : '2px solid transparent',
 }}>
 {t.label}
 {t.badge !== undefined && t.badge > 0 && (
 <span className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold"
 style={{ background: cfg.border + '33', color: cfg.border }}>
 {t.badge}
 </span>
 )}
 </button>
 ))}
 </div>

 {/* Tab Content */}
 <div className="flex-1 overflow-y-auto">
 {/* ── Properties ── */}
 {tab === 'properties' && (
 <div className="p-4 space-y-4">
 <div>
 <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Description</label>
 <p className="text-slate-300 text-label p-3 rounded-xl" style={{ background: '#ffffff06', border: '1px solid #ffffff08' }}>
 {manifest ? manifest.description : (node.description || 'No description provided.')}
 </p>
 </div>
 <div>
 <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Configuration</label>
 <div className="space-y-3">
 {definition && definition.uiContract ? (
 definition.uiContract.fields.map((f: any) => (
 <div key={f.key} className="p-3 rounded-xl" style={{ background: '#ffffff06' }}>
 <label className="text-label font-semibold text-slate-300 block mb-1">{f.label}</label>
 {f.type === 'textarea' || f.type === 'expression' ? (
 <textarea className="w-full bg-transparent border border-slate-700 rounded-lg p-2 text-label text-white" 
 placeholder={f.placeholder} rows={2} defaultValue={(node.config || {})[f.key] as string} />
 ) : f.type === 'select' ? (
 <select className="w-full bg-transparent border border-slate-700 rounded-lg p-2 text-label text-white">
 {f.options?.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
 </select>
 ) : (
 <input type="text" className="w-full bg-transparent border border-slate-700 rounded-lg p-2 text-input text-white" 
 placeholder={f.placeholder} defaultValue={(node.config || {})[f.key] as string} />
 )}
 </div>
 ))
 ) : (
 <p className="text-label text-slate-500 p-2 text-center border border-dashed border-slate-700 rounded-lg">
 Legacy node (no UI contract defined).
 </p>
 )}
 </div>
 </div>
 <div>
 <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Last Edited</label>
 <p className="text-slate-400 text-label">2 hours ago by Arshid</p>
 </div>
 <button className="w-full py-2.5 rounded-xl text-button font-semibold text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
 style={{ background: `linear-gradient(135deg, ${cfg.border}, ${cfg.border}bb)` }}>
 <Settings className="w-4 h-4" /> Open Full Config
 </button>
 </div>
 )}

 {/* ── Comments ── */}
 {tab === 'comments' && (
 <div className="flex flex-col h-full">
 <div className="flex-1 overflow-y-auto p-4 space-y-3">
 {nodeComments.map((c, i) => (
 <div key={i} className="flex gap-2.5">
 <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: c.color }}>
 {c.initials}
 </div>
 <div className="flex-1">
 <div className="flex items-baseline gap-2 mb-1">
 <span className="text-white text-label font-semibold">{c.author}</span>
 <span className="text-slate-600 text-[10px]">{c.time}</span>
 </div>
 <p className="text-slate-300 text-label p-2.5 rounded-xl" style={{ background: '#ffffff08', border: '1px solid #ffffff0a' }}>
 {c.text}
 </p>
 </div>
 </div>
 ))}
 </div>
 <div className="p-3 flex gap-2" style={{ borderTop: '1px solid #ffffff0a' }}>
 <input value={msg} onChange={e => setMsg(e.target.value)}
 className="flex-1 rounded-xl px-3 py-2 text-label text-white outline-none"
 style={{ background: '#ffffff0d', border: '1px solid #ffffff15' }}
 placeholder="Add a comment…" />
 <button className="p-2 rounded-xl" style={{ background: cfg.border + '33' }}>
 <Send className="w-3.5 h-3.5" style={{ color: cfg.border }} />
 </button>
 </div>
 </div>
 )}

 {/* ── AI Tab ── */}
 {tab === 'ai' && (
 <div className="p-4 space-y-4">
 <div className="p-3 rounded-xl" style={{ background: '#1a0f2e', border: '1px solid #a855f722' }}>
 <div className="flex items-center gap-2 mb-2">
 <BrainCircuit className="w-4 h-4 text-purple-400" />
 <span className="text-purple-300 text-[10px] font-bold uppercase tracking-wider">AI Analysis</span>
 </div>
 <p className="text-slate-300 text-label ">
 {node.type === 'approval'
 ? `This step has an average wait of 18h — 4.5× above the workflow benchmark. Consider adding an SLA escalation rule after 4h and enabling mobile push approvals for faster response.`
 : `This step is performing well at ${node.success_rate}% success. No immediate optimizations needed. Consider adding retry logic if success rate drops below 95%.`}
 </p>
 </div>
 <div>
 <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">AI Suggestions</p>
 {[
 node.type === 'approval' ? 'Add 4h SLA escalation to Senior Manager' : 'Add exponential retry on failure',
 'Send mobile push notification for faster response',
 'Log detailed rejection reason for analytics',
 ].map((s, i) => (
 <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl mb-2 cursor-pointer hover:bg-white hover:bg-opacity-5 transition-colors"
 style={{ border: '1px solid #ffffff08' }}>
 <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
 <p className="text-slate-300 text-[11px] flex-1">{s}</p>
 <button className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: '#a855f722', color: '#c084fc' }}>Apply</button>
 </div>
 ))}
 </div>
 <div className="p-3 rounded-xl" style={{ background: '#ffffff06', border: '1px solid #ffffff08' }}>
 <p className="text-slate-400 text-label mb-2">Ask AI about this step</p>
 <div className="flex gap-2">
 <input className="flex-1 px-2.5 py-1.5 rounded-lg text-input text-white outline-none" style={{ background: '#ffffff0d' }} placeholder="e.g. Why is this slow?" />
 <button className="p-1.5 rounded-lg" style={{ background: '#a855f733' }}>
 <Send className="w-3.5 h-3.5 text-purple-400" />
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Logs ── */}
 {tab === 'logs' && (
 <div className="p-4">
 <div className="space-y-1.5">
 {LOGS.filter(l => !l.nodeId || l.nodeId === node.id).map((log, i) => (
 <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg" style={{ background: '#ffffff04' }}>
 <span className="text-[10px] font-mono text-slate-600 flex-shrink-0 pt-0.5">{log.time}</span>
 <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: logColors[log.level] }} />
 <p className="text-[11px] leading-relaxed" style={{ color: log.level === 'error' ? '#fca5a5' : log.level === 'warn' ? '#fcd34d' : log.level === 'success' ? '#86efac' : '#94a3b8' }}>
 {log.message}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* ── History ── */}
 {tab === 'history' && (
 <div className="p-4 space-y-3">
 {publishedVersions.length === 0 && <p className="text-slate-500 text-label">No versions published yet.</p>}
 {publishedVersions.map((v, i) => (
 <div key={i} className="p-3 rounded-xl" style={{ background: '#ffffff06', border: '1px solid #ffffff08' }}>
 <div className="flex items-center gap-2 mb-1.5">
 <span className="text-white text-label font-bold">v{v.semver} (Build {v.versionNumber})</span>
 {v.status === 'published' && (
 <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#22c55e22', color: '#22c55e' }}>Published</span>
 )}
 <span className="text-slate-500 text-[10px] ml-auto">{new Date(v.publishedAt).toLocaleString()}</span>
 </div>
 <p className="text-slate-400 text-label mb-2">{v.changeSummary}</p>
 <div className="flex items-center gap-2">
 <span className="text-slate-600 text-[10px]">by {v.publishedBy}</span>
 <div className="flex gap-1 ml-auto">
 {[
 { label: 'Compare', icon: <GitBranch className="w-3 h-3" /> },
 { label: 'Rollback', icon: <History className="w-3 h-3" /> },
 ].map((a, j) => (
 <button key={j} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-slate-400 hover:text-white transition-colors" style={{ background: '#ffffff08' }}>
 {a.icon}{a.label}
 </button>
 ))}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* ── Permissions ── */}
 {tab === 'permissions' && (
 <div className="p-4 space-y-3">
 <div className="p-3 rounded-xl" style={{ background: '#ffffff06', border: '1px solid #ffffff08' }}>
 <div className="flex items-center gap-2 mb-3">
 <Shield className="w-4 h-4 text-indigo-400" />
 <span className="text-white text-label font-semibold">Access Control</span>
 </div>
 {TEAM.slice(0, 4).map((m, i) => (
 <div key={i} className="flex items-center gap-2.5 py-2" style={{ borderBottom: i < 3 ? '1px solid #ffffff06' : 'none' }}>
 <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: m.color }}>
 {m.initials}
 </div>
 <span className="text-slate-300 text-label flex-1">{m.name}</span>
 <select className="text-[10px] px-2 py-1 rounded-lg text-slate-300 outline-none" style={{ background: '#ffffff0d', border: '1px solid #ffffff10' }}>
 <option>{m.role}</option>
 <option>Viewer</option>
 <option>Editor</option>
 <option>Owner</option>
 </select>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

// ─── Main Component ───────────────────────────────────────────────────────────



// ── Workflow Compiler (v1.0) ──
const compileWorkflow = (rfNodes: any[], rfEdges: any[], workflowId: string, workflowName: string) => {
 // Filter out UI-only nodes like 'header', 'start', 'end'
 const executableNodes = rfNodes.filter(n => n.type === 'custom');
 
 const executionPlan = {
 schemaVersion: "1.0",
 workflowId,
 name: workflowName,
 metadata: {
 compiledAt: new Date().toISOString(),
 nodeCount: executableNodes.length,
 edgeCount: rfEdges.length
 },
 variables: [], // Support for {{candidate.name}} etc.
 permissions: [],
 nodes: executableNodes.map(n => ({
 id: n.data.node.id,
 type: n.data.node.type,
 label: n.data.node.label,
 config: n.data.config || {}, // Extracted from Property Panel
 retry: 3,
 timeout: 30000
 })),
 edges: rfEdges.filter(e => e.source !== 'start' && e.target !== 'end').map(e => ({
 id: e.id,
 source: e.source,
 target: e.target
 }))
 };

 // Validation: Check for unreachable nodes, loops, etc.
 if (executableNodes.length === 0) {
 throw new Error('Workflow has no executable steps.');
 }

 return executionPlan;
};


// ── Automation OS Shell (Command Palette) ──
const CommandPalette = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
 const [query, setQuery] = useState('');
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (isOpen) {
 setTimeout(() => inputRef.current?.focus(), 50);
 }
 }, [isOpen]);

 if (!isOpen) return null;

 const commands = [
 { id: 'run', label: 'Run Workflow', icon: <Play className="w-4 h-4 text-emerald-400" />, action: () => { CommandBus.dispatch({ type: 'RUN_WORKFLOW', payload: { workflowId: 'w1' }, timestamp: Date.now() }); onClose(); } },
 { id: 'compile', label: 'Compile to v1.0', icon: <Code2 className="w-4 h-4 text-indigo-400" />, action: () => { CommandBus.dispatch({ type: 'COMPILE_WORKFLOW', payload: {}, timestamp: Date.now() }); onClose(); } },
 { id: 'logs', label: 'Open Telemetry Console', icon: <Activity className="w-4 h-4 text-purple-400" />, action: () => { onClose(); } },
 { id: 'add-email', label: 'Add Email Capability', icon: <Mail className="w-4 h-4 text-slate-400" />, action: () => { CommandBus.dispatch({ type: 'CREATE_NODE', payload: { type: 'email' }, timestamp: Date.now() }); onClose(); } },
 { id: 'add-ai', label: 'Add AI Agent Capability', icon: <Bot className="w-4 h-4 text-slate-400" />, action: () => { CommandBus.dispatch({ type: 'CREATE_NODE', payload: { type: 'ai_action' }, timestamp: Date.now() }); onClose(); } },
 ].filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

 return (
 <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" style={{ background: '#000000aa', backdropFilter: 'blur(4px)' }} onClick={onClose}>
 <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: '#0d0f1a', border: '1px solid #ffffff15' }} onClick={e => e.stopPropagation()}>
 <div className="flex items-center px-4 py-3" style={{ borderBottom: '1px solid #ffffff10' }}>
 <Search className="w-5 h-5 text-slate-500 mr-3" />
 <input 
 ref={inputRef}
 value={query}
 onChange={e => setQuery(e.target.value)}
 onKeyDown={e => {
 if (e.key === 'Escape') onClose();
 if (e.key === 'Enter' && commands.length > 0) {
 commands[0].action();
 onClose();
 }
 }}
 placeholder="Search commands, capabilities, or variables... (Ctrl+K)" 
 className="flex-1 bg-transparent text-white text-body outline-none placeholder:text-slate-500"
 />
 <div className="flex items-center gap-1">
 <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-white bg-opacity-5 border border-white border-opacity-10">ESC</span>
 </div>
 </div>
 <div className="max-h-[60vh] overflow-y-auto p-2">
 {commands.length === 0 ? (
 <div className="py-8 text-center text-slate-500 text-secondary">No commands found.</div>
 ) : (
 commands.map((cmd, idx) => (
 <button 
 key={cmd.id} 
 onClick={() => { cmd.action(); onClose(); }}
 className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white hover:bg-opacity-5 transition-colors text-left"
 style={{ background: idx === 0 ? '#ffffff0a' : 'transparent' }}
 >
 <div className="w-8 h-8 rounded-lg bg-[#ffffff0a] flex items-center justify-center flex-shrink-0">
 {cmd.icon}
 </div>
 <span className="text-white text-secondary font-medium">{cmd.label}</span>
 {idx === 0 && <span className="ml-auto text-[10px] text-slate-500">↵ to execute</span>}
 </button>
 ))
 )}
 </div>
 <div className="px-4 py-2 bg-[#ffffff03] border-t border-[#ffffff0a] flex items-center justify-between">
 <div className="flex items-center gap-4 text-[10px] text-slate-500">
 <span className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3" /> Navigate</span>
 <span className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3" /> Execute</span>
 </div>
 <span className="text-[10px] text-slate-600 font-bold tracking-wider">AUTOMATION OS</span>
 </div>
 </div>
 </div>
 );
};

// ── React Flow Custom Nodes ──
const CustomReactFlowNode = ({ data, selected }: any) => {
 return (
 <div className="w-[500px]">
 <Handle type="target" position={Position.Top} className="opacity-0" />
 <NodeCard 
 node={data.node} 
 index={0} 
 isSelected={selected || data.isSelected} 
 onClick={data.onClick} 
 />
 <Handle type="source" position={Position.Bottom} className="opacity-0" />
 </div>
 );
};

const HeaderNode = ({ data }: any) => (
 <div className="w-[600px] pointer-events-none">
 <div className="p-5 rounded-2xl" style={{ background: '#0d0f1a', border: '1px solid #6366f128' }}>
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <h2 className="text-white font-bold text-section">{data.workflowName}</h2>
 <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#22c55e20', color: '#22c55e' }}>Live</span>
 </div>
 <p className="text-slate-400 text-secondary">End-to-end hiring pipeline with AI screening, multi-level approvals, and automated onboarding</p>
 </div>
 </div>
 <div className="flex items-center gap-5 mt-4 pt-4" style={{ borderTop: '1px solid #ffffff08' }}>
 {[
 { label: 'Owner', value: 'Arshid' },
 { label: 'Version', value: 'v12' },
 { label: 'Team', value: '5 members' },
 { label: 'Runs Today', value: '842' },
 { label: 'Avg Duration', value: '18 min' },
 ].map((m, i) => (
 <div key={i} className="text-center">
 <p className="text-white text-secondary font-bold">{m.value}</p>
 <p className="text-slate-500 text-[10px]">{m.label}</p>
 </div>
 ))}
 </div>
 </div>
 </div>
);

const StartNode = () => (
 <div className="flex justify-center">
 <div className="px-4 py-1.5 rounded-full text-label font-bold text-white shadow-lg"
 style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
 ● Workflow Start
 </div>
 <Handle type="source" position={Position.Bottom} className="opacity-0" />
 </div>
);

const EndNode = ({ data }: any) => (
 <div className="flex flex-col items-center">
 <Handle type="target" position={Position.Top} className="opacity-0" />
 <button onClick={data.onAddStep}
 className="flex items-center gap-2 px-4 py-2 rounded-xl text-button font-semibold text-slate-400 hover:text-white border border-dashed border-slate-700 hover:border-slate-500 transition-all mb-4 bg-[#0d0f1a]">
 <Plus className="w-4 h-4" /> Add Step
 </button>
 <div className="w-px h-4 bg-slate-700 mb-4" />
 <div className="px-4 py-1.5 rounded-full text-label font-bold bg-[#0d0f1a]" style={{ color: '#64748b', border: '1px solid #ffffff10' }}>
 ● Workflow End
 </div>
 </div>
);

const rfNodeTypes = { custom: CustomReactFlowNode, header: HeaderNode, start: StartNode, end: EndNode };


export const WorkflowStudio: React.FC = () => {
 const { workflows, isLoading, updateWorkflow } = useBusinessWorkflows();
 const aiPlatform = useService<any>('AIPlatform');
 const [scale, setScale] = useState(1);
 const [activeProject, setActiveProject] = useState<Project | null>(null);
 const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
 const [leftTab, setLeftTab] = useState<'blocks' | 'templates' | 'integrations' | 'projects' | 'agents' | 'marketplace'>('projects');
 const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
 const [agentTestMessages, setAgentTestMessages] = useState<{role: 'user' | 'agent', text: string}[]>([{role: 'agent', text: 'Hello! I am ready to test. Send me a message.'}]);
 const [agentTestInput, setAgentTestInput] = useState('');
 const [bottomTab, setBottomTab] = useState<'logs' | 'executions' | 'errors' | 'queue' | 'analytics'>('logs');
 const [showAIBuilder, setShowAIBuilder] = useState(false);
 const [showCommandPalette, setShowCommandPalette] = useState(false);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 e.stopPropagation();
 e.stopImmediatePropagation();
 setShowCommandPalette(true);
 }
 };
 // Use capture phase so Workflow Studio intercepts it before global listeners
 window.addEventListener('keydown', handleKeyDown, { capture: true });
 return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
 }, []);

 const [aiPrompt, setAiPrompt] = useState('');
 const [aiGenerating, setAiGenerating] = useState(false);
 const [aiGenerated, setAiGenerated] = useState(false);
 const [nodes, setNodes] = useState<WorkflowNode[]>([]);
 const [executions, setExecutions] = useState<any[]>([]); // Phase 3.3 dynamic executions
 const [workflowName, setWorkflowName] = useState('Recruitment Automation');
 const [showPublishMenu, setShowPublishMenu] = useState(false);

 const { versionStore, nodeRegistry, packageManager, packageRegistry } = React.useMemo(() => {
 if (typeof window !== 'undefined') {
 const pRegistry = new BrowserPackageRegistry();
 const nRegistry = SharedNodeRegistry;
 const pManager = new BrowserPackageManager(pRegistry, nRegistry);
 return {
 versionStore: new VersionStore(new SupabaseVersionRepository()),
 nodeRegistry: nRegistry,
 packageRegistry: pRegistry,
 packageManager: pManager
 };
 }
 return { versionStore: null, nodeRegistry: null, packageManager: null, packageRegistry: null };
 }, []);

 // Boot sequence: Re-activate installed packages on startup
 useEffect(() => {
 if (packageRegistry && packageManager) {
 const installed = packageRegistry.list().filter(p => p.status === 'active');
 for (const pkg of installed) {
 // We simulate the activator loading the nodes
 if (pkg.manifest.id === 'com.chatr.nodes.core') {
 import('../../platform/nodes/TriggerNode').then(m => nodeRegistry?.register(m.TriggerNode));
 import('../../platform/nodes/AIAgentNode').then(m => nodeRegistry?.register(m.AIAgentNode));
 import('../../platform/nodes/ConditionNode').then(m => nodeRegistry?.register(m.ConditionNode));
 }
 }
 }
 }, [packageRegistry, packageManager, nodeRegistry]);

 const [bottomExpanded, setBottomExpanded] = useState(false);
 const aiRef = useRef<HTMLInputElement>(null);

 // Sync state when workflows load
 useEffect(() => {
 if (workflows.length > 0 && !activeProject) {
 // Map first workflow to activeProject for the UI
 const first = workflows[0];
 setActiveProject({
 id: first.id,
 name: first.name,
 icon: <UserCheck className="w-4 h-4" />,
 color: '#6366f1',
 workflows: 1,
 status: first.status as any
 });
 setNodes((first.nodes as WorkflowNode[]) || []);
 setWorkflowName(first.name);
 
 // Sync to OS Kernel Store so CommandBus can access them
 CommandBus.dispatch({
 type: 'LOAD_WORKFLOW',
 payload: {
 workflowId: first.id,
 nodes: first.nodes,
 // Convert basic edges to OS format (just connecting sequential nodes for demonstration)
 edges: (first.nodes || []).map((n: any, i: number, arr: any[]) => {
 if (i < arr.length - 1) return { id: `e-${i}`, source: n.id, target: arr[i+1].id };
 return null;
 }).filter(Boolean)
 },
 timestamp: Date.now()
 });
 }
 }, [workflows, activeProject]);

 const location = useLocation();

 // Handle global autoTrigger state
 useEffect(() => {
 if (location.state?.autoTrigger === 'RUN_WORKFLOW') {
 CommandBus.dispatch({ type: 'RUN_WORKFLOW', payload: { workflowId: 'w1' }, timestamp: Date.now() });
 window.history.replaceState({}, document.title); // clear state
 } else if (location.state?.autoTrigger === 'COMPILE_WORKFLOW') {
 CommandBus.dispatch({ type: 'COMPILE_WORKFLOW', payload: {}, timestamp: Date.now() });
 window.history.replaceState({}, document.title); // clear state
 }
 }, [location]);

 // Handle Real-Time Telemetry EventBus subscription
 useEffect(() => {
 const handleEvent = (e: OSEvent) => {
 if (e.type === 'EXECUTION_STARTED') {
 setNodes(ns => ns.map(n => ({ ...n, status: 'idle' })));
 setExecutions(prev => [{
 id: `#run-${Date.now().toString().slice(-4)}`,
 workflowId: e.payload.workflowId,
 candidate: 'Test Run',
 step: 'Starting',
 duration: '0s',
 status: 'running',
 timeline: [{ time: new Date().toLocaleTimeString(), action: 'Timeline started' }]
 }, ...prev]);
 } else if (e.type === 'NODE_STARTED') {
 setNodes(ns => ns.map(n => n.id === e.payload.nodeId ? { ...n, status: 'running' } : n));
 setExecutions(prev => prev.map((ex, i) => i === 0 ? { ...ex, step: e.payload.nodeId, timeline: [...ex.timeline, { time: new Date().toLocaleTimeString(), action: `Node ${e.payload.nodeId} started` }] } : ex));
 } else if (e.type === 'NODE_COMPLETED') {
 setNodes(ns => ns.map(n => n.id === e.payload.nodeId ? { ...n, status: 'success' } : n));
 setExecutions(prev => prev.map((ex, i) => i === 0 ? { ...ex, timeline: [...ex.timeline, { time: new Date().toLocaleTimeString(), action: `Node ${e.payload.nodeId} completed` }] } : ex));
 } else if (e.type === 'NODE_FAILED') {
 setNodes(ns => ns.map(n => n.id === e.payload.nodeId ? { ...n, status: 'error' } : n));
 setExecutions(prev => prev.map((ex, i) => i === 0 ? { ...ex, status: 'error', timeline: [...ex.timeline, { time: new Date().toLocaleTimeString(), action: `Node ${e.payload.nodeId} failed` }] } : ex));
 toast.error(`Node ${e.payload.nodeId} failed: ${e.payload.error}`);
 } else if (e.type === 'EXECUTION_COMPLETED') {
 setExecutions(prev => prev.map((ex, i) => i === 0 ? { ...ex, status: 'success', step: 'Completed', timeline: [...ex.timeline, { time: new Date().toLocaleTimeString(), action: `Execution completed` }] } : ex));
 } else if (e.type === 'NODE_CREATED') {
 const newNode: WorkflowNode = {
 id: `node-${Date.now()}`,
 type: e.payload.type || 'ai_action',
 label: `New ${e.payload.type || 'Node'}`,
 status: 'idle',
 position: { x: Math.random() * 200, y: Math.random() * 200 }
 };
 setNodes(ns => [...ns, newNode]);
 } else if (e.type === 'WORKFLOW_GENERATED') {
 if (e.payload.plan && e.payload.plan.nodes) {
 const generatedNodes: WorkflowNode[] = e.payload.plan.nodes.map((step: any, i: number) => ({
 id: step.id || `ai-${Date.now()}-${i}`,
 type: (step.type as any) || 'ai_action',
 label: step.label || step.name || `Step ${i + 1}`,
 status: 'idle',
 position: { x: 0, y: i * 150 }
 }));
 setNodes(generatedNodes);
 setWorkflowName(e.payload.plan.name || 'AI Generated Workflow');
 setAiGenerating(false);
 setAiGenerated(true);
 }
 }
 };
 
 EventBus.subscribe(handleEvent);
 // Note: in a real implementation we would unsubscribe here.
 }, []);

 // Wire AI generation to real OS AutomationIntentService (Phase B)
 const handleAIGenerate = async () => {
 if (!aiPrompt.trim()) return;
 setAiGenerating(true);
 setAiGenerated(false);
 
 // Dispatch to the powerful OS Kernel instead of a mock edge function
 CommandBus.dispatch({
 type: 'GENERATE_WORKFLOW',
 payload: { intent: aiPrompt },
 timestamp: Date.now()
 });
 
 // The EventBus subscription will catch WORKFLOW_GENERATED and update the UI!
 // We clean up UI states right away
 setShowAIBuilder(false);
 setAiPrompt('');
 };

 const handleProjectSelect = (w: BusinessWorkflow) => {
 setActiveProject({
 id: w.id,
 name: w.name,
 icon: <UserCheck className="w-4 h-4" />,
 color: '#6366f1',
 workflows: 1,
 status: w.status as any
 });
 
 if (w.graph) {
 const pkg = w.graph as any; // WorkflowPackage
 const deserialized = GraphSerializer.deserialize(pkg.graph);
 setNodes(deserialized.nodes.map(rfn => ({
 id: rfn.id,
 type: rfn.type === 'core.trigger' ? 'trigger' : 
 rfn.type === 'core.ai_agent' ? 'ai_action' :
 rfn.type === 'core.email' ? 'email' : rfn.type as any,
 label: rfn.data.node?.label || rfn.id,
 description: '',
 status: 'idle',
 })));
 } else {
 setNodes((w.nodes as WorkflowNode[]) || []);
 }
 setWorkflowName(w.name);
 };

 
 const handleTestRun = () => {
 // Phase B: Use canonical graph instead of synthetic payload
 const rfNodes = nodes.map(n => ({
 id: n.id,
 type: n.type,
 position: { x: 0, y: 0 },
 data: { node: n }
 }));
 const rfEdges = nodes.slice(1).map((n, i) => ({
 id: `e-${i}`,
 source: nodes[i].id,
 target: n.id
 }));
 
 const executionGraph = GraphSerializer.serialize(
 rfNodes, 
 rfEdges, 
 activeProject?.id || 'session-1',
 workflowName,
 'studio-user'
 );

 CommandBus.dispatch({
 type: 'RUN_WORKFLOW',
 payload: {
 workflowId: activeProject?.id || 'session-1',
 graph: executionGraph
 },
 timestamp: Date.now()
 });
 };

 const handleSave = async () => {
 if (!activeProject) return;
 try {
 // Phase B: Serialize to WorkflowPackage before saving to graph column
 const rfNodes = nodes.map(n => ({
 id: n.id,
 type: n.type,
 position: { x: 0, y: 0 },
 data: { node: n }
 }));
 const rfEdges = nodes.slice(1).map((n, i) => ({
 id: `e-${i}`,
 source: nodes[i].id,
 target: n.id
 }));
 
 const graph = GraphSerializer.serialize(
 rfNodes,
 rfEdges,
 activeProject.id,
 workflowName,
 'studio-user'
 );
 const pkg = GraphSerializer.pack(graph, 'Generated by Workflow Studio');

 await updateWorkflow(activeProject.id, { nodes, graph: pkg });
 toast.success('Workflow saved');
 } catch (err: any) {
 toast.error('Failed to save workflow');
 }
 };

 const addNode = (type: NodeType) => {
 const newNode: WorkflowNode = {
 id: `new-${Date.now()}`,
 type,
 label: nodeConfig[type].label + ' Step',
 description: 'Click to configure this step.',
 status: 'idle',
 };
 setNodes(n => [...n, newNode]);
 };

 const BLOCK_TYPES: { type: NodeType; desc: string }[] = [
 { type: 'form', desc: 'Collect structured data' },
 { type: 'ai_screen', desc: 'AI-powered screening' },
 { type: 'ai_action', desc: 'AI processes or generates' },
 { type: 'approval', desc: 'Human sign-off required' },
 { type: 'condition', desc: 'Branch on logic/score' },
 { type: 'notification',desc: 'Notify team or client' },
 { type: 'email', desc: 'Send structured email' },
 { type: 'document', desc: 'Generate/attach file' },
 { type: 'integration', desc: 'External system API' },
 { type: 'webhook', desc: 'HTTP trigger/callback' },
 { type: 'delay', desc: 'Wait for time/event' },
 { type: 'database', desc: 'Read/write records' },
 ];

 const activeRuns = nodes.filter(n => n.status === 'running').length;
 const waitingCount = nodes.reduce((acc, n) => acc + (n.waiting ?? 0), 0);
 const totalRuns = nodes[0]?.runs ?? 0;

 // Real telemetry from EventBus history
 const [liveStats, setLiveStats] = React.useState({ runsToday: 0, successRate: 100, lastUpdated: '' });
 React.useEffect(() => {
 const computeStats = () => {
 const history = EventBus.getHistory ? EventBus.getHistory() : [];
 const today = new Date().toDateString();
 const todayEvents = history.filter((e: any) => new Date(e.timestamp).toDateString() === today);
 const completed = todayEvents.filter((e: any) => e.type === 'EXECUTION_COMPLETED').length;
 const failed = todayEvents.filter((e: any) => e.type === 'NODE_FAILED').length;
 const total = completed + failed;
 const rate = total > 0 ? Math.round(((total - failed) / total) * 1000) / 10 : 100;
 setLiveStats({ runsToday: completed, successRate: rate, lastUpdated: new Date().toLocaleTimeString() });
 };
 computeStats();
 const interval = setInterval(computeStats, 5000);
 return () => clearInterval(interval);
 }, []);


 return (
 <div className="flex flex-col w-full h-full overflow-hidden" style={{ background: '#080a10', fontFamily: 'Inter, system-ui, sans-serif' }}>

 {/* ══ TOP HEADER ══ */}
 <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: '#0d0f1a', borderBottom: '1px solid #ffffff0d' }}>
 {/* Logo */}
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
 <BrainCircuit className="w-4 h-4 text-white" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-slate-500 text-label">{activeProject?.name || 'No Project'}</span>
 <ChevronRight className="w-3 h-3 text-slate-600" />
 <span className="text-white font-bold text-secondary">{workflowName}</span>
 </div>
 <div className="flex items-center gap-2 mt-0.5">
 <PulseDot color="#22c55e" />
 <span className="text-[10px] text-emerald-400 font-semibold">Live</span>
 <span className="text-slate-600 text-[10px]">·</span>
 <span className="text-slate-500 text-[10px]">v12</span>
 <span className="text-slate-600 text-[10px]">·</span>
 <span className="text-slate-500 text-[10px]">Last published Today 14:30</span>
 </div>
 </div>
 </div>

 {/* Live Metrics */}
 <div className="flex items-center gap-4 px-4 py-1.5 rounded-xl mx-4" style={{ background: '#ffffff07', border: '1px solid #ffffff0a' }}>
 <LiveStat label="Runs Today" value={String(liveStats.runsToday)} trend="up" />
 <div className="w-px h-6 bg-white bg-opacity-10" />
 <LiveStat label="Active" value={activeRuns} color="#22c55e" />
 <div className="w-px h-6 bg-white bg-opacity-10" />
 <LiveStat label="Waiting" value={waitingCount} color="#f59e0b" />
 <div className="w-px h-6 bg-white bg-opacity-10" />
 <LiveStat label="Success Rate" value={`${liveStats.successRate}%`} color="#22c55e" trend="up" />
 <div className="w-px h-6 bg-white bg-opacity-10" />
 <LiveStat label="Avg Time" value="18 min" />
 </div>

 {/* Team Presence */}
 <div className="flex -space-x-1 mr-2">
 {TEAM.filter(m => m.online).map((m, i) => (
 <div key={i} title={`${m.name}: ${m.activity}`}
 className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold text-white cursor-pointer relative"
 style={{ background: m.color, borderColor: '#0d0f1a' }}>
 {m.initials}
 <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 bg-emerald-500" style={{ borderColor: '#0d0f1a' }} />
 </div>
 ))}
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2 ml-auto">
 <button
 onClick={() => setShowAIBuilder(true)}
 className="flex items-center gap-2 px-3 py-2 rounded-xl text-label font-semibold transition-all hover:opacity-90"
 style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff' }}>
 <Sparkles className="w-3.5 h-3.5" /> Build with AI
 </button>
 <button onClick={handleTestRun} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-button font-semibold text-slate-300 transition-all hover:bg-white hover:bg-opacity-10" style={{ background: '#ffffff0d', border: '1px solid #ffffff10' }}><Play className="w-3.5 h-3.5 text-emerald-400" /> Test Run</button>
 <div className="relative">
 <button
 onClick={() => setShowPublishMenu(!showPublishMenu)}
 className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-label font-semibold text-white transition-all"
 style={{ background: '#22c55e', border: '1px solid #22c55e' }}>
 <Upload className="w-3.5 h-3.5" /> Publish
 <ChevronDown className="w-3 h-3" />
 </button>
 {showPublishMenu && (
 <div className="absolute right-0 top-full mt-1 w-40 rounded-xl overflow-hidden z-50 shadow-2xl"
 style={{ background: '#1a1d2e', border: '1px solid #ffffff15' }}>
 {['Publish Now', 'Save as Draft', 'Schedule Publish', 'Export', 'Clone Workflow'].map((o, i) => (
 
 <button key={i} onClick={() => {
 setShowPublishMenu(false);
 if (o === 'Publish Now' || o === 'Export') {
 try {
 const rfNodes = nodes.map(n => ({ id: n.id, type: n.type, position: { x: 0, y: 0 }, data: { node: n } }));
 const rfEdges = nodes.slice(1).map((n, i) => ({ id: `e-${i}`, source: nodes[i].id, target: n.id }));
 const graph = GraphSerializer.serialize(rfNodes, rfEdges, activeProject?.id || 'session-1', workflowName, 'studio-user');
 
 if (versionStore && activeProject) {
 toast.loading('Publishing...', { id: 'publish' });
 versionStore.publish({
 workflowId: activeProject.id,
 graph,
 semver: '1.0.0',
 changeSummary: 'Published from Workflow Studio',
 publishedBy: 'studio-user'
 }).then(manifest => {
 toast.success(`Version ${manifest.versionNumber} published successfully!`, { id: 'publish' });
 versionStore.list(activeProject.id).then((v: any[]) => setPublishedVersions(v));
 }).catch(err => {
 toast.error('Failed to publish: ' + err.message, { id: 'publish' });
 });
 } else {
 toast.error('VersionStore not initialized');
 }
 } catch(e: any) {
 toast.error('Validation Error: ' + e.message);
 }
 }
 }}
 className="w-full text-left px-3 py-2.5 text-label text-slate-300 hover:bg-white hover:bg-opacity-10 hover:text-white transition-colors">
 {o}
 </button>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* ══ BODY ══ */}
 <div className="flex flex-1 min-h-0">

 {/* ── LEFT PANEL ── */}
 <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: 220, background: '#0d0f1a', borderRight: '1px solid #ffffff0d' }}>
 {/* Left Tab Bar */}
 <div className="flex gap-0.5 p-2 flex-shrink-0" style={{ borderBottom: '1px solid #ffffff0a' }}>
 {[
 { id: 'projects' as const, icon: <Briefcase className="w-3.5 h-3.5" /> },
 { id: 'agents' as const, icon: <Bot className="w-3.5 h-3.5" /> },
 { id: 'blocks' as const, icon: <Layout className="w-3.5 h-3.5" /> },
 { id: 'templates' as const, icon: <Star className="w-3.5 h-3.5" /> },
 { id: 'integrations' as const, icon: <Globe className="w-3.5 h-3.5" /> },
 { id: 'marketplace' as const, icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
 ].map(t => (
 <button key={t.id} onClick={() => setLeftTab(t.id)}
 title={t.id}
 className="flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all"
 style={{ background: leftTab === t.id ? '#ffffff15' : 'transparent', color: leftTab === t.id ? '#fff' : '#64748b' }}>
 {t.icon}
 </button>
 ))}
 </div>

 <div className="flex-1 overflow-y-auto p-2">
 {/* ── Projects ── */}
 {leftTab === 'projects' && (
 <div className="space-y-1">
 <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2 pb-1">Projects</p>
 {PROJECTS.map(p => (
 <button key={p.id}
 onClick={() => setActiveProject(p)}
 className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all"
 style={{
 background: activeProject?.id === p.id ? p.color + '20' : 'transparent',
 border: `1px solid ${activeProject?.id === p.id ? p.color + '44' : 'transparent'}`,
 }}>
 <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: p.color + '25', color: p.color }}>
 {p.icon}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-white text-label truncate">{p.name}</p>
 <p className="text-slate-500 text-[10px]">{p.workflows} flows</p>
 </div>
 <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
 style={{ background: p.status === 'live' ? '#22c55e' : p.status === 'paused' ? '#ef4444' : '#64748b' }} />
 </button>
 ))}
 <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-button text-slate-500 border border-dashed border-slate-700 hover:border-slate-500 hover:text-slate-300 transition-all mt-2">
 <PlusCircle className="w-3.5 h-3.5" /> New Project
 </button>
 </div>
 )}

 {/* ── Agents ── */}
 {leftTab === 'agents' && (
 <div className="space-y-1">
 <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2 pb-1">AI Agents</p>
 {AGENTS.map(a => (
 <button key={a.id}
 onClick={() => { setActiveAgent(a); setSelectedNode(null); }}
 className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all hover:bg-white/5"
 style={{
 background: activeAgent?.id === a.id ? a.color + '20' : 'transparent',
 border: `1px solid ${activeAgent?.id === a.id ? a.color + '44' : 'transparent'}`,
 }}>
 <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: a.color + '25', color: a.color }}>
 {a.icon}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-white text-label truncate">{a.name}</p>
 <p className="text-slate-500 text-[10px]">{a.role}</p>
 </div>
 <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
 style={{ background: a.status === 'active' ? '#22c55e' : a.status === 'training' ? '#f59e0b' : '#64748b' }} />
 </button>
 ))}
 <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-button text-slate-500 border border-dashed border-slate-700 hover:border-slate-500 hover:text-slate-300 transition-all mt-2">
 <PlusCircle className="w-3.5 h-3.5" /> New Agent
 </button>
 </div>
 )}

 {/* ── Blocks ── */}
 {leftTab === 'blocks' && (
 <div className="space-y-1">
 <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1 pb-1">Drag or click to add</p>
 {nodeRegistry?.manifests().map(manifest => {
 const baseType = manifest.type.replace('core.', '');
 // Fallback for UI styling mapping until Phase E migrates the UI config entirely
 const cfg = nodeConfig[baseType as NodeType] || nodeConfig.integration;
 return (
 <button key={manifest.type} onClick={() => addNode(baseType as NodeType)}
 className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all hover:-translate-y-0.5 group"
 style={{ border: `1px solid ${cfg.border}18` }}
 onMouseEnter={e => { e.currentTarget.style.background = cfg.border + '12'; }}
 onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
 <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: cfg.border + '20' }}>
 {React.cloneElement(cfg.icon as React.ReactElement, { className: 'w-3.5 h-3.5', style: { color: cfg.border, width: 14, height: 14 } })}
 </div>
 <div className="min-w-0">
 <p className="text-white text-label ">{manifest.label}</p>
 <p className="text-slate-500 text-[10px] truncate">{manifest.description}</p>
 </div>
 </button>
 );
 })}
 </div>
 )}

 {/* ── Templates ── */}
 {leftTab === 'templates' && (
 <div className="space-y-2">
 <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1 pb-1">Templates</p>
 {TEMPLATES.map(t => (
 <button key={t.id}
 className="w-full p-3 rounded-xl text-left transition-all hover:-translate-y-0.5"
 style={{ background: t.color + '12', border: `1px solid ${t.color}28` }}>
 <div className="flex items-center gap-2 mb-1.5">
 <div className="p-1 rounded-lg" style={{ background: t.color + '28', color: t.color }}>
 {t.icon}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-white text-label font-semibold truncate">{t.name}</p>
 <p className="text-slate-500 text-[9px]">{t.steps} steps · {t.category}</p>
 </div>
 </div>
 <p className="text-slate-400 text-[10px] leading-relaxed">{t.description}</p>
 </button>
 ))}
 </div>
 )}

 {/* ── Integrations ── */}
 {leftTab === 'integrations' && (
 <div>
 <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1 pb-2">Connect Services</p>
 <div className="grid grid-cols-2 gap-1.5">
 {INTEGRATIONS.map((intg, i) => (
 <button key={i}
 className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all hover:-translate-y-0.5"
 style={{ background: intg.color + '12', border: `1px solid ${intg.color}25` }}>
 <div className="p-1.5 rounded-lg" style={{ background: intg.color + '25', color: intg.color }}>
 {React.cloneElement(intg.icon as React.ReactElement, { className: 'w-4 h-4' })}
 </div>
 <span className="text-[10px] font-medium text-slate-300">{intg.name}</span>
 </button>
 ))}
 </div>
 </div>
 )}

 {/* ── Marketplace ── */}
 {leftTab === 'marketplace' && (
 <div className="space-y-2">
 <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1 pb-1">OS Marketplace</p>
 <div className="w-full p-3 rounded-xl text-left transition-all" style={{ background: '#ffffff07', border: '1px solid #ffffff12' }}>
 <div className="flex items-center gap-2 mb-1.5">
 <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
 <LayoutTemplate className="w-4 h-4" />
 </div>
 <p className="text-white text-label font-semibold">Core Nodes Pack</p>
 </div>
 <p className="text-slate-500 text-[10px] mb-2 leading-relaxed">Installs core OS capabilities: Trigger, AI, Condition.</p>
 {packageRegistry?.has('com.chatr.nodes.core') ? (
 <button 
 onClick={async () => {
 try {
 await packageManager?.uninstall('com.chatr.nodes.core');
 // Force UI refresh hack
 setLeftTab('projects'); setTimeout(() => setLeftTab('marketplace'), 10);
 } catch (e: any) {
 alert(`Uninstall failed: ${e.message}`);
 }
 }}
 className="w-full py-1.5 rounded-lg text-label bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">
 Uninstall
 </button>
 ) : (
 <button 
 onClick={async () => {
 try {
 await packageManager?.install('core-nodes');
 // Force UI refresh hack
 setLeftTab('projects'); setTimeout(() => setLeftTab('marketplace'), 10);
 } catch (e: any) {
 alert(`Install failed: ${e.message}`);
 }
 }}
 className="w-full py-1.5 rounded-lg text-label bg-indigo-500 text-white hover:bg-indigo-600 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]">
 Install Package
 </button>
 )}
 </div>
 </div>
 )}
 </div>
 </div>

 {/* ── CENTER CANVAS ── */}
 <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
 {leftTab === 'agents' && activeAgent ? (
 <div className="flex-1 overflow-y-auto px-8 py-10 bg-[#0a0c14] relative">
 <div className="max-w-3xl mx-auto space-y-8">
 {/* Agent Header */}
 <div className="flex items-start gap-4 p-6 rounded-2xl" style={{ background: '#0d0f1a', border: `1px solid ${activeAgent.color}33` }}>
 <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${activeAgent.color}, ${activeAgent.color}88)` }}>
 {React.cloneElement(activeAgent.icon as React.ReactElement, { className: 'w-8 h-8 text-white' })}
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-1">
 <h2 className="text-page font-bold text-white">{activeAgent.name}</h2>
 <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: activeAgent.status === 'active' ? '#22c55e20' : '#f59e0b20', color: activeAgent.status === 'active' ? '#22c55e' : '#f59e0b' }}>
 {activeAgent.status}
 </span>
 </div>
 <p className="text-slate-400 text-secondary">{activeAgent.role}</p>
 </div>
 <button className="px-4 py-2 rounded-xl text-button font-semibold text-white transition-all hover:opacity-90" style={{ background: activeAgent.color }}>
 Deploy Agent
 </button>
 </div>

 {/* Configuration Blocks */}
 <div className="grid grid-cols-2 gap-6">
 {/* Instructions */}
 <div className="col-span-2 space-y-3">
 <h3 className="text-white text-secondary font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Core Instructions</h3>
 <textarea 
 className="w-full h-32 rounded-xl p-4 text-secondary text-slate-300 outline-none resize-none font-mono"
 style={{ background: '#0d0f1a', border: '1px solid #ffffff10' }}
 defaultValue={`You are a helpful ${activeAgent.name}. Your primary objective is to assist users by checking the knowledge base and routing queries appropriately. Always maintain a professional tone.`}
 />
 </div>

 {/* Tools */}
 <div className="space-y-3">
 <h3 className="text-white text-secondary font-bold flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Active Tools</h3>
 <div className="p-4 rounded-xl space-y-3" style={{ background: '#0d0f1a', border: '1px solid #ffffff10' }}>
 {activeAgent.tools.map((tool, i) => (
 <div key={i} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: '#ffffff05' }}>
 <span className="text-slate-300 text-label ">{tool}</span>
 <div className="w-8 h-4 rounded-full bg-emerald-500/20 relative cursor-pointer">
 <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
 </div>
 </div>
 ))}
 <button className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-button text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
 + Connect Tool
 </button>
 </div>
 </div>

 {/* Memory */}
 <div className="space-y-3">
 <h3 className="text-white text-secondary font-bold flex items-center gap-2"><Database className="w-4 h-4 text-blue-400" /> Knowledge Base</h3>
 <div className="p-4 rounded-xl space-y-3" style={{ background: '#0d0f1a', border: '1px solid #ffffff10' }}>
 <div className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: '#ffffff05' }}>
 <FileCheck className="w-4 h-4 text-indigo-400" />
 <span className="text-slate-300 text-label ">{activeAgent.memory}</span>
 </div>
 <button className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-button text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
 + Upload Documents
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 ) : (
 
 /* Canvas Area - React Flow Integration */
 <div className="flex-1 overflow-hidden relative">
 <ReactFlow
 nodes={[
 { id: 'header', type: 'header', position: { x: -50, y: -200 }, data: { workflowName }, draggable: false, selectable: false },
 { id: 'start', type: 'start', position: { x: 200, y: 0 }, data: {}, draggable: false, selectable: false },
 ...nodes.map((node, i) => ({
 id: node.id,
 type: 'custom',
 position: { x: 25, y: i * 180 + 100 },
 data: { node, isSelected: selectedNode?.id === node.id, onClick: () => setSelectedNode(selectedNode?.id === node.id ? null : node) },
 })),
 { id: 'end', type: 'end', position: { x: 250, y: nodes.length * 180 + 100 }, data: { onAddStep: () => setLeftTab('blocks') }, draggable: false, selectable: false }
 ]}
 edges={[
 ...nodes.map((node, i) => ({
 id: i === 0 ? `e-start-${node.id}` : `e-${nodes[i-1].id}-${node.id}`,
 source: i === 0 ? 'start' : nodes[i-1].id,
 target: node.id,
 type: 'smoothstep',
 style: { stroke: '#475569', strokeWidth: 2 },
 markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
 })),
 {
 id: `e-end`,
 source: nodes.length > 0 ? nodes[nodes.length-1].id : 'start',
 target: 'end',
 type: 'smoothstep',
 style: { stroke: '#475569', strokeWidth: 2 },
 markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
 }
 ]}
 nodeTypes={rfNodeTypes}
 fitView
 fitViewOptions={{ padding: 0.2 }}
 minZoom={0.2}
 maxZoom={1.5}
 proOptions={{ hideAttribution: true }}
 >
 <Background color="#ffffff" gap={28} size={1} opacity={0.05} />
 </ReactFlow>
 </div>
 )}


 {/* ── BOTTOM PANEL ── */}
 <div className="flex-shrink-0 transition-all duration-300" style={{ background: '#0d0f1a', borderTop: '1px solid #ffffff0d', height: bottomExpanded ? 240 : 160 }}>
 {/* Bottom Tab Bar */}
 <div className="flex items-center px-4 py-2" style={{ borderBottom: '1px solid #ffffff08' }}>
 {[
 { id: 'logs' as const, label: 'Live Logs', badge: 1 },
 { id: 'executions' as const, label: 'Executions' },
 { id: 'errors' as const, label: 'Errors', badge: 2 },
 { id: 'queue' as const, label: 'Queue', badge: waitingCount },
 { id: 'analytics' as const, label: 'Analytics' },
 ].map(t => (
 <button key={t.id} onClick={() => setBottomTab(t.id)}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label transition-all mr-1"
 style={{ background: bottomTab === t.id ? '#ffffff12' : 'transparent', color: bottomTab === t.id ? '#e2e8f0' : '#64748b' }}>
 {t.label}
 {t.badge !== undefined && t.badge > 0 && (
 <span className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold"
 style={{ background: t.id === 'errors' ? '#ef444433' : '#f59e0b33', color: t.id === 'errors' ? '#fca5a5' : '#fcd34d' }}>
 {t.badge}
 </span>
 )}
 </button>
 ))}
 <button onClick={() => setBottomExpanded(e => !e)} className="ml-auto p-1.5 text-slate-500 hover:text-white transition-colors">
 {bottomExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
 </button>
 </div>

 {/* Bottom Content */}
 <div className="overflow-x-auto overflow-y-auto h-full p-3">
 {bottomTab === 'logs' && (
 <div className="flex gap-3">
 {LOGS.map((log, i) => (
 <div key={i} className="flex-shrink-0 flex items-start gap-2 px-3 py-2 rounded-xl"
 style={{ background: '#ffffff05', border: '1px solid #ffffff08', minWidth: 260 }}>
 <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: logColors[log.level] }} />
 <div>
 <p className="text-[10px] font-mono text-slate-500 mb-0.5">{log.time}</p>
 <p className="text-label " style={{ color: log.level === 'error' ? '#fca5a5' : log.level === 'warn' ? '#fcd34d' : log.level === 'success' ? '#86efac' : '#94a3b8' }}>
 {log.message}
 </p>
 </div>
 </div>
 ))}
 </div>
 )}

 {bottomTab === 'executions' && (
 <div className="flex gap-3">
 {executions.length === 0 ? (
 <div className="text-slate-500 text-secondary px-4 py-8 w-full text-center">No executions recorded yet. Run the workflow to trace timeline.</div>
 ) : executions.map((ex, i) => {
 const sc = statusConfig[ex.status as NodeStatus] || statusConfig['idle'];
 return (
 <div key={i} className="flex-shrink-0 flex flex-col px-3 py-2.5 rounded-xl" style={{ background: '#ffffff05', border: '1px solid #ffffff08', minWidth: 260 }}>
 <div className="flex items-center gap-2 mb-2">
 <span className="text-indigo-400 text-label font-mono font-bold">{ex.id}</span>
 <div className="flex items-center gap-1 ml-auto">
 {sc.pulse ? <PulseDot color={sc.color} /> : <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />}
 <span className="text-[9px] font-bold" style={{ color: sc.color }}>{sc.label}</span>
 </div>
 </div>
 <p className="text-white text-label font-semibold mb-2">{ex.candidate} - {ex.step}</p>
 
 <div className="flex-1 mt-2 space-y-1 overflow-y-auto max-h-32" style={{ borderTop: '1px solid #ffffff0a', paddingTop: '8px' }}>
 <span className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">Execution Timeline</span>
 {ex.timeline?.map((t: any, idx: number) => (
 <div key={idx} className="flex items-center gap-2 text-[10px]">
 <span className="text-slate-500 font-mono">{t.time}</span>
 <span className="text-slate-300">→ {t.action}</span>
 </div>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 )}

 {bottomTab === 'errors' && (
 <div className="flex gap-3">
 {LOGS.filter(l => l.level === 'error' || l.level === 'warn').map((log, i) => (
 <div key={i} className="flex-shrink-0 px-3 py-2.5 rounded-xl" style={{ background: log.level === 'error' ? '#ef444410' : '#f59e0b10', border: `1px solid ${log.level === 'error' ? '#ef444428' : '#f59e0b28'}`, minWidth: 260 }}>
 <div className="flex items-center gap-2 mb-1">
 <AlertTriangle className="w-3.5 h-3.5" style={{ color: log.level === 'error' ? '#ef4444' : '#f59e0b' }} />
 <span className="text-[10px] font-mono text-slate-500">{log.time}</span>
 </div>
 <p className="text-label" style={{ color: log.level === 'error' ? '#fca5a5' : '#fcd34d' }}>{log.message}</p>
 <button className="mt-1.5 text-[10px] text-slate-500 hover:text-white">View Details →</button>
 </div>
 ))}
 </div>
 )}

 {bottomTab === 'queue' && (
 <div className="flex gap-3">
 {[
 { step: 'Recruiter Review', waiting: 23, oldest: '2h 15m', sla: '4h', atRisk: false },
 { step: 'Manager Approval', waiting: 12, oldest: '17h 44m', sla: '18h', atRisk: true },
 { step: 'Background Verification', waiting: 8, oldest: '1d 2h', sla: '3d', atRisk: false },
 ].map((q, i) => (
 <div key={i} className="flex-shrink-0 px-4 py-3 rounded-xl" style={{ background: q.atRisk ? '#f59e0b10' : '#ffffff05', border: `1px solid ${q.atRisk ? '#f59e0b33' : '#ffffff08'}`, minWidth: 200 }}>
 <p className="text-white text-label font-semibold mb-1">{q.step}</p>
 <div className="flex items-center gap-3">
 <LiveStat label="Waiting" value={q.waiting} color="#f59e0b" />
 <LiveStat label="Oldest" value={q.oldest} />
 <LiveStat label="SLA" value={q.sla} color={q.atRisk ? '#ef4444' : '#22c55e'} />
 </div>
 {q.atRisk && (
 <div className="flex items-center gap-1 mt-2">
 <AlertTriangle className="w-3 h-3 text-amber-400" />
 <span className="text-[10px] text-amber-400 font-medium">SLA at risk</span>
 </div>
 )}
 </div>
 ))}
 </div>
 )}

 {bottomTab === 'analytics' && (
 <div className="flex gap-3">
 {[
 { label: 'Total Runs', value: '8,421', icon: <Activity />, color: '#6366f1', trend: 'up' as const },
 { label: 'Success Rate', value: '99.4%', icon: <CheckCircle />, color: '#22c55e', trend: 'up' as const },
 { label: 'Avg Duration', value: '18.3 min', icon: <Clock />, color: '#0ea5e9' },
 { label: 'Failures', value: '48', icon: <AlertTriangle />, color: '#ef4444', trend: 'down' as const },
 { label: 'Active Users', value: '5', icon: <Users />, color: '#a855f7' },
 { label: 'AI Tokens', value: '2.1M', icon: <Cpu />, color: '#f59e0b' },
 { label: 'Cost Today', value: '₹142', icon: <Hash />, color: '#10b981' },
 { label: 'AI Confidence', value: '97%', icon: <Sparkles />, color: '#a855f7', trend: 'up' as const },
 ].map((m, i) => (
 <div key={i} className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl"
 style={{ background: m.color + '10', border: `1px solid ${m.color}22` }}>
 <div className="p-2 rounded-lg" style={{ background: m.color + '20', color: m.color }}>
 {React.cloneElement(m.icon as React.ReactElement, { className: 'w-4 h-4' })}
 </div>
 <LiveStat label={m.label} value={m.value} color={m.color} trend={m.trend} />
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* ── RIGHT PANEL ── */}
 {leftTab === 'agents' && activeAgent ? (
 <div className="flex-shrink-0 flex flex-col" style={{ width: 320, background: '#0d0f1a', borderLeft: '1px solid #ffffff0d' }}>
 <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid #ffffff0a' }}>
 <div className="flex items-center gap-2">
 <Bot className="w-4 h-4 text-slate-400" />
 <span className="text-white text-label font-bold uppercase tracking-wider">Agent Tester</span>
 </div>
 <button className="text-[10px] text-slate-500 hover:text-white"><RefreshCw className="w-3.5 h-3.5" /></button>
 </div>
 
 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {agentTestMessages.map((msg, i) => (
 <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
 {msg.role === 'agent' && (
 <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: activeAgent.color + '33', color: activeAgent.color }}>
 {React.cloneElement(activeAgent.icon as React.ReactElement, { className: 'w-3.5 h-3.5' })}
 </div>
 )}
 <div className={`p-3 rounded-2xl max-w-[85%] text-label ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}
 style={{ borderTopRightRadius: msg.role === 'user' ? 4 : 16, borderTopLeftRadius: msg.role === 'agent' ? 4 : 16 }}>
 {msg.text}
 </div>
 </div>
 ))}
 </div>

 <div className="p-4" style={{ borderTop: '1px solid #ffffff0a' }}>
 <div className="relative">
 <input 
 type="text" 
 value={agentTestInput}
 onChange={e => setAgentTestInput(e.target.value)}
 onKeyDown={e => {
 if (e.key === 'Enter' && agentTestInput.trim()) {
 const query = agentTestInput.trim();
 setAgentTestMessages([...agentTestMessages, { role: 'user', text: query }, { role: 'agent', text: '' }]);
 setAgentTestInput('');
 
 aiPlatform.chatStream(
 query,
 (chunk: string) => {
 setAgentTestMessages(prev => {
 const copy = [...prev];
 copy[copy.length - 1].text += chunk;
 return copy;
 });
 },
 () => {},
 'workflow-studio',
 'anonymous'
 ).catch((err: any) => {
 setAgentTestMessages(prev => {
 const copy = [...prev];
 copy[copy.length - 1].text = `Error: ${err.message}`;
 return copy;
 });
 });
 }
 }}
 placeholder="Test a message..." 
 className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-label text-white outline-none focus:border-indigo-500"
 />
 <button className="absolute right-2 top-2 p-1 text-slate-400 hover:text-indigo-400">
 <Send className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 </div>
 ) : selectedNode ? (
 <div className="flex-shrink-0" style={{ width: 320 }}>
 <NodeWorkspace
 nodeRegistry={nodeRegistry}
 node={selectedNode}
 team={TEAM}
 comments={COMMENTS}
 onClose={() => setSelectedNode(null)}
 />
 </div>
 ) : (
 /* Default Right: Team + AI Overview */
 <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: 260, background: '#0d0f1a', borderLeft: '1px solid #ffffff0d' }}>
 {/* AI Optimizer */}
 <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid #ffffff0a' }}>
 <div className="flex items-center gap-2 mb-3">
 <BrainCircuit className="w-4 h-4 text-purple-400" />
 <span className="text-white font-bold text-label">AI Optimizer</span>
 <PulseDot color="#a855f7" />
 </div>
 <div className="space-y-2">
 {[
 { text: 'Manager Approval avg 18h — add 4h SLA escalation', icon: <AlertTriangle />, color: '#ef4444' },
 { text: '2 unnecessary sequential approvals — consider merging', icon: <Zap />, color: '#f59e0b' },
 { text: 'AI screening 98% accurate — model upgrade available', icon: <TrendingUp />, color: '#22c55e' },
 ].map((s, i) => (
 <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: '#ffffff06', border: `1px solid ${s.color}18` }}>
 <div style={{ color: s.color, flexShrink: 0 }}>
 {React.cloneElement(s.icon as React.ReactElement, { className: 'w-3.5 h-3.5 mt-0.5' })}
 </div>
 <p className="text-slate-300 text-[11px] leading-relaxed flex-1">{s.text}</p>
 <button className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: s.color + '20', color: s.color }}>Fix</button>
 </div>
 ))}
 </div>
 <p className="text-slate-600 text-[10px] mt-3">Estimated saving: <span className="text-emerald-400 font-semibold">3.2 hrs/day</span></p>
 </div>

 {/* Team Live */}
 <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid #ffffff0a' }}>
 <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-3">Team Live</p>
 {TEAM.map((m, i) => (
 <div key={i} className="flex items-center gap-2.5 py-2">
 <div className="relative flex-shrink-0">
 <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: m.color }}>
 {m.initials}
 </div>
 <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: '#0d0f1a', background: m.online ? '#22c55e' : '#64748b' }} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-white text-[11px] font-medium">{m.name}</p>
 <p className="text-slate-500 text-[10px] truncate">{m.activity ?? (m.online ? 'Active' : 'Offline')}</p>
 </div>
 </div>
 ))}
 </div>

 {/* Version Info */}
 <div className="p-4 flex-1 overflow-y-auto">
 <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-3">Recent Versions</p>
 {VERSIONS.slice(0, 3).map((v, i) => (
 <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: i < 2 ? '1px solid #ffffff06' : 'none' }}>
 <span className="text-indigo-400 text-[11px] font-bold w-6">v{v.number}</span>
 <div className="flex-1 min-w-0">
 <p className="text-slate-300 text-[11px] truncate">{v.note}</p>
 <p className="text-slate-600 text-[10px]">{v.time} · {v.author}</p>
 </div>
 {v.published && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

 {/* ══ AI BUILDER MODAL ══ */}
 {showAIBuilder && (
 <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: '#00000088', backdropFilter: 'blur(8px)' }}>
 <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#0d0f1a', border: '1px solid #6366f133' }}>
 <div className="p-6">
 <div className="flex items-center gap-3 mb-5">
 <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
 <Sparkles className="w-5 h-5 text-white" />
 </div>
 <div>
 <h3 className="text-white font-bold text-body">Build with AI</h3>
 <p className="text-slate-400 text-label">Describe your workflow and AI will build it</p>
 </div>
 <button onClick={() => setShowAIBuilder(false)} className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white hover:bg-opacity-10 transition-all">
 <X className="w-4 h-4" />
 </button>
 </div>

 <textarea
 ref={aiRef as unknown as React.RefObject<HTMLTextAreaElement>}
 value={aiPrompt}
 onChange={e => setAiPrompt(e.target.value)}
 placeholder="e.g. Build a recruitment workflow with AI screening, HR approval, background verification, and automated onboarding that sends welcome emails and sets up payroll..."
 rows={4}
 className="w-full rounded-2xl px-4 py-3 text-secondary text-white outline-none resize-none"
 style={{ background: '#ffffff0d', border: '1px solid #ffffff15', lineHeight: 1.6 }}
 />

 <div className="flex flex-wrap gap-2 mt-3 mb-4">
 {[
 'Recruitment pipeline with onboarding',
 'Invoice approval with 3-level sign-off',
 'Customer support with AI triage',
 'Employee leave request with HR',
 ].map((s, i) => (
 <button key={i} onClick={() => setAiPrompt(s)}
 className="text-[11px] px-3 py-1.5 rounded-full text-slate-300 hover:text-white transition-colors"
 style={{ background: '#ffffff0d', border: '1px solid #ffffff10' }}>
 {s}
 </button>
 ))}
 </div>

 <button
 onClick={handleAIGenerate}
 disabled={aiGenerating || !aiPrompt.trim()}
 className="w-full py-3 rounded-2xl font-semibold text-button text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
 style={{ background: aiGenerating ? '#6366f199' : 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
 {aiGenerating ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Generating workflow…
 </>
 ) : (
 <>
 <Sparkles className="w-4 h-4" />
 Generate Workflow
 </>
 )}
 </button>
 {aiGenerated && (
 <p className="text-emerald-400 text-label text-center mt-2">✓ Workflow generated successfully!</p>
 )}
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default WorkflowStudio;
