import React, { useState, useEffect } from 'react';
import {
 Activity, CheckCircle2, XCircle, Clock, Zap, Shield,
 ChevronDown, ChevronUp, Loader2, Radio, ArrowRight,
 AlertCircle, BarChart2, FileText, GitBranch, Cpu,
 RefreshCw, Eye, TrendingUp, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type StageStatus = 'done' | 'running' | 'pending' | 'failed';
type OutcomeBadge = 'Verified' | 'Rejected' | 'Inconclusive';

interface PipelineStage {
 name: string;
 status: StageStatus;
 latencyMs?: number;
 evidence?: string;
 policy?: string;
 eventId?: string;
}

interface LiveExecution {
 id: string;
 intent: string;
 domain: string;
 elapsed: string;
 currentStage: string;
 stages: PipelineStage[];
 eventLogs: string[];
}

interface CompletedExecution {
 id: string;
 intent: string;
 domain: string;
 outcome: OutcomeBadge;
 completedAt: string;
 durationMs: number;
 goalId: string;
}

// ─────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────
const LIVE_EXECUTIONS: LiveExecution[] = [
 {
 id: 'ex-001',
 intent: 'Source Java developer profiles from LinkedIn for Role #JD-2024',
 domain: 'Hiring',
 elapsed: '4m 12s',
 currentStage: 'Reality',
 stages: [
 { name: 'Intent', status: 'done', latencyMs: 12, evidence: 'Goal matched with confidence 94%', policy: 'ALLOW', eventId: 'evt-a1b2' },
 { name: 'Planner', status: 'done', latencyMs: 34, evidence: '3 capabilities selected', policy: 'ALLOW', eventId: 'evt-b2c3' },
 { name: 'LinkedIn Connector', status: 'done', latencyMs: 890, evidence: '47 profiles fetched', policy: 'ALLOW', eventId: 'evt-c3d4' },
 { name: 'Reality', status: 'running', evidence: 'Scoring profiles against JD criteria', policy: 'EVALUATING', eventId: 'evt-d4e5' },
 { name: 'Verification', status: 'pending' },
 { name: 'Goal', status: 'pending' },
 ],
 eventLogs: [
 '[04:12.001] Intent parsed — confidence 0.94',
 '[04:12.034] Planner selected 3 capabilities',
 '[04:13.024] LinkedIn connector → 47 results',
 '[04:16.211] Reality engine scoring active...',
 ],
 },
 {
 id: 'ex-002',
 intent: 'Send onboarding checklist to new hire Priya Sharma (EMP-2289)',
 domain: 'HR',
 elapsed: '1m 08s',
 currentStage: 'Verification',
 stages: [
 { name: 'Intent', status: 'done', latencyMs: 8, evidence: 'Employee record found', policy: 'ALLOW', eventId: 'evt-e1f2' },
 { name: 'Planner', status: 'done', latencyMs: 22, evidence: 'Email + HRMS capability selected', policy: 'ALLOW', eventId: 'evt-f2g3' },
 { name: 'Email Sender', status: 'done', latencyMs: 310, evidence: 'Checklist email delivered', policy: 'ALLOW', eventId: 'evt-g3h4' },
 { name: 'Reality', status: 'done', latencyMs: 55, evidence: 'HRMS status updated', policy: 'ALLOW', eventId: 'evt-h4i5' },
 { name: 'Verification', status: 'running', evidence: 'Awaiting read-receipt confirmation', policy: 'EVALUATING', eventId: 'evt-i5j6' },
 { name: 'Goal', status: 'pending' },
 ],
 eventLogs: [
 '[01:08.008] Intent matched to onboarding goal',
 '[01:08.030] Email + HRMS capabilities loaded',
 '[01:08.340] Onboarding email delivered to priya.sharma@corp.in',
 '[01:08.395] HRMS record updated — status: PENDING_ACK',
 '[01:09.012] Verification awaiting read receipt...',
 ],
 },
 {
 id: 'ex-003',
 intent: 'Escalate finance claim FC-7821 after 48h SLA breach',
 domain: 'Finance',
 elapsed: '22s',
 currentStage: 'Planner',
 stages: [
 { name: 'Intent', status: 'done', latencyMs: 15, evidence: 'SLA breach confirmed — 48h exceeded', policy: 'ALLOW', eventId: 'evt-j1k2' },
 { name: 'Planner', status: 'running', evidence: 'Selecting escalation path', policy: 'EVALUATING', eventId: 'evt-k2l3' },
 { name: 'Approval Engine', status: 'pending' },
 { name: 'Reality', status: 'pending' },
 { name: 'Verification', status: 'pending' },
 { name: 'Goal', status: 'pending' },
 ],
 eventLogs: [
 '[00:22.015] SLA breach detected on FC-7821',
 '[00:22.030] Intent classified → escalation required',
 '[00:22.101] Planner evaluating escalation matrix...',
 ],
 },
 {
 id: 'ex-004',
 intent: 'Auto-assign IT ticket INC-5502 to Tier 2 based on category',
 domain: 'IT Ops',
 elapsed: '7m 44s',
 currentStage: 'Reality',
 stages: [
 { name: 'Intent', status: 'done', latencyMs: 9, evidence: 'Ticket category: Network', policy: 'ALLOW', eventId: 'evt-l1m2' },
 { name: 'Planner', status: 'done', latencyMs: 18, evidence: 'Routing rule applied', policy: 'ALLOW', eventId: 'evt-m2n3' },
 { name: 'ITSM Connector', status: 'done', latencyMs: 450, evidence: 'Ticket re-assigned to Tier-2 queue', policy: 'ALLOW', eventId: 'evt-n3o4' },
 { name: 'Reality', status: 'running', evidence: 'Awaiting Tier-2 agent acceptance', policy: 'EVALUATING', eventId: 'evt-o4p5' },
 { name: 'Verification', status: 'pending' },
 { name: 'Goal', status: 'pending' },
 ],
 eventLogs: [
 '[07:44.009] Ticket INC-5502 opened — category: Network',
 '[07:44.027] Routing: Tier-2 queue selected',
 '[07:44.477] ITSM re-assignment confirmed',
 '[07:44.800] Awaiting agent pickup...',
 ],
 },
 {
 id: 'ex-005',
 intent: 'Re-score candidate Arjun Mehta — skills updated in CHATR profile',
 domain: 'Hiring',
 elapsed: '33s',
 currentStage: 'LinkedIn Connector',
 stages: [
 { name: 'Intent', status: 'done', latencyMs: 11, evidence: 'Profile update delta detected', policy: 'ALLOW', eventId: 'evt-p1q2' },
 { name: 'Planner', status: 'done', latencyMs: 29, evidence: 'ATS scoring capability selected', policy: 'ALLOW', eventId: 'evt-q2r3' },
 { name: 'ATS Scorer', status: 'running', evidence: 'Re-running skill-match algorithm', policy: 'EVALUATING', eventId: 'evt-r3s4' },
 { name: 'Reality', status: 'pending' },
 { name: 'Verification', status: 'pending' },
 { name: 'Goal', status: 'pending' },
 ],
 eventLogs: [
 '[00:33.011] Profile update detected for Arjun Mehta',
 '[00:33.040] ATS scorer capability loaded',
 '[00:33.250] Re-scoring skill matrix...',
 ],
 },
 {
 id: 'ex-006',
 intent: 'Generate monthly vendor spend summary for CFO dashboard',
 domain: 'Procurement',
 elapsed: '2m 55s',
 currentStage: 'Reality',
 stages: [
 { name: 'Intent', status: 'done', latencyMs: 7, evidence: 'Monthly period: June 2026', policy: 'ALLOW', eventId: 'evt-s1t2' },
 { name: 'Planner', status: 'done', latencyMs: 16, evidence: 'ERP + Report generator selected', policy: 'ALLOW', eventId: 'evt-t2u3' },
 { name: 'ERP Connector', status: 'done', latencyMs: 1240, evidence: '₹2.3Cr spend data pulled', policy: 'ALLOW', eventId: 'evt-u3v4' },
 { name: 'Reality', status: 'running', evidence: 'Generating CFO summary report', policy: 'EVALUATING', eventId: 'evt-v4w5' },
 { name: 'Verification', status: 'pending' },
 { name: 'Goal', status: 'pending' },
 ],
 eventLogs: [
 '[02:55.007] Monthly report cycle triggered',
 '[02:55.023] ERP connector fetching June data...',
 '[03:56.263] Spend data loaded — ₹2.3Cr',
 '[03:56.500] Report generation active...',
 ],
 },
];

const COMPLETED_EXECUTIONS: CompletedExecution[] = [
 { id: 'cx-001', intent: 'Send SLA warning to vendor Infosys for Contract C-1021', domain: 'Procurement', outcome: 'Verified', completedAt: '3 min ago', durationMs: 890, goalId: 'g5' },
 { id: 'cx-002', intent: 'Screen resume batch RB-2024-089 against JD-Java-Senior', domain: 'Hiring', outcome: 'Verified', completedAt: '7 min ago', durationMs: 2340, goalId: 'g1' },
 { id: 'cx-003', intent: 'Auto-reject duplicate claim FC-7788 (duplicate of FC-7766)', domain: 'Finance', outcome: 'Rejected', completedAt: '11 min ago', durationMs: 330, goalId: 'g3' },
 { id: 'cx-004', intent: 'Notify hiring manager of candidate dropout in Java pipeline', domain: 'Hiring', outcome: 'Verified', completedAt: '18 min ago', durationMs: 540, goalId: 'g1' },
 { id: 'cx-005', intent: 'Log unresolvable ticket INC-5488 for manual review', domain: 'IT Ops', outcome: 'Inconclusive', completedAt: '24 min ago', durationMs: 1100, goalId: 'g4' },
 { id: 'cx-006', intent: 'Archive completed onboarding docs for EMP-2278 batch', domain: 'HR', outcome: 'Verified', completedAt: '31 min ago', durationMs: 670, goalId: 'g2' },
 { id: 'cx-007', intent: 'Flag candidate Rajan Shah for GDPR consent re-collection', domain: 'Hiring', outcome: 'Verified', completedAt: '38 min ago', durationMs: 210, goalId: 'g6' },
 { id: 'cx-008', intent: 'Reject invoice INV-8821 — missing PO reference', domain: 'Finance', outcome: 'Rejected', completedAt: '45 min ago', durationMs: 190, goalId: 'g3' },
 { id: 'cx-009', intent: 'Update ATS status for 12 candidates from interview → offer stage', domain: 'Hiring', outcome: 'Verified', completedAt: '52 min ago', durationMs: 3200, goalId: 'g6' },
 { id: 'cx-010', intent: 'Send contract renewal reminder to vendor TechServ for Contract C-0987', domain: 'Procurement', outcome: 'Inconclusive', completedAt: '58 min ago', durationMs: 820, goalId: 'g5' },
];

// ─────────────────────────────────────────────────────────────
// Domain colors
// ─────────────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, string> = {
 Hiring: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
 HR: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
 Finance: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
 'IT Ops': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
 Procurement: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
};

const OUTCOME_CONFIG: Record<OutcomeBadge, { cls: string; icon: React.ElementType }> = {
 Verified: { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
 Rejected: { cls: 'bg-red-500/15 text-red-400 border-red-500/30', icon: XCircle },
 Inconclusive: { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: AlertCircle },
};

// ─────────────────────────────────────────────────────────────
// Stage Node Component
// ─────────────────────────────────────────────────────────────
function StageNode({
 stage, isLast, onSelect, isSelected
}: {
 stage: PipelineStage;
 isLast: boolean;
 onSelect: () => void;
 isSelected: boolean;
}) {
 const statusStyles: Record<StageStatus, { ring: string; dot: string; label: string }> = {
 done: { ring: 'border-emerald-500/40 bg-emerald-500/10', dot: 'bg-emerald-400', label: 'text-emerald-400' },
 running: { ring: 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_12px_rgba(99,102,241,0.35)]', dot: 'bg-indigo-400', label: 'text-indigo-300' },
 pending: { ring: 'border-gray-700 bg-gray-800/40', dot: 'bg-gray-600', label: 'text-gray-600' },
 failed: { ring: 'border-red-500/40 bg-red-500/10', dot: 'bg-red-400', label: 'text-red-400' },
 };
 const s = statusStyles[stage.status];

 return (
 <div className="flex items-center gap-0">
 <button
 onClick={onSelect}
 className={cn(
 'flex flex-col items-center gap-1 px-2 py-2 rounded-lg border transition-all duration-200 hover:scale-105',
 s.ring,
 isSelected && 'ring-1 ring-white/20'
 )}
 title={stage.name}
 >
 <div className="relative flex items-center justify-center w-5 h-5">
 {stage.status === 'running' ? (
 <Loader2 className={cn('w-4 h-4 animate-spin', s.label)} />
 ) : stage.status === 'done' ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-400" />
 ) : stage.status === 'failed' ? (
 <XCircle className="w-4 h-4 text-red-400" />
 ) : (
 <div className={cn('w-2 h-2 rounded-full', s.dot)} />
 )}
 {stage.status === 'running' && (
 <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
 <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
 </span>
 )}
 </div>
 <span className={cn('text-[9px] font-bold uppercase tracking-wider whitespace-nowrap', s.label)}>
 {stage.name}
 </span>
 </button>
 {!isLast && (
 <ArrowRight className={cn(
 'w-3.5 h-3.5 mx-0.5 flex-shrink-0',
 stage.status === 'done' ? 'text-emerald-500/60' : 'text-gray-700'
 )} />
 )}
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Stage Detail Panel
// ─────────────────────────────────────────────────────────────
function StageDetailPanel({ stage }: { stage: PipelineStage }) {
 return (
 <div className="mt-3 bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-2">
 <DetailRow label="Stage" value={stage.name} />
 <DetailRow label="Status" value={stage.status.toUpperCase()} valueClass={
 stage.status === 'done' ? 'text-emerald-400' :
 stage.status === 'running' ? 'text-indigo-400' :
 stage.status === 'failed' ? 'text-red-400' : 'text-gray-500'
 } />
 {stage.latencyMs !== undefined && <DetailRow label="Latency" value={`${stage.latencyMs}ms`} />}
 {stage.eventId && <DetailRow label="Event ID" value={stage.eventId} monospace />}
 {stage.policy && <DetailRow label="Policy" value={stage.policy} valueClass={
 stage.policy === 'ALLOW' ? 'text-emerald-400' :
 stage.policy === 'EVALUATING' ? 'text-amber-400' : 'text-red-400'
 } />}
 {stage.evidence && (
 <div className="col-span-2">
 <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-0.5">Evidence</span>
 <span className="text-label text-gray-300">{stage.evidence}</span>
 </div>
 )}
 </div>
 );
}

function DetailRow({ label, value, monospace, valueClass }: {
 label: string; value: string; monospace?: boolean; valueClass?: string;
}) {
 return (
 <div>
 <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-0.5">{label}</span>
 <span className={cn('text-label font-semibold', monospace && 'font-mono', valueClass ?? 'text-gray-200')}>
 {value}
 </span>
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Execution Row
// ─────────────────────────────────────────────────────────────
function ExecutionRow({ exec }: { exec: LiveExecution }) {
 const [expanded, setExpanded] = useState(false);
 const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);

 const domainClass = DOMAIN_COLORS[exec.domain] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20';

 const handleStageClick = (stage: PipelineStage) => {
 setSelectedStage(prev => prev?.name === stage.name ? null : stage);
 if (!expanded) setExpanded(true);
 };

 return (
 <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all duration-200">
 {/* Main row */}
 <div className="px-4 py-3.5">
 {/* Top line */}
 <div className="flex items-start justify-between gap-3 mb-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border', domainClass)}>
 {exec.domain}
 </span>
 <span className="text-[10px] font-mono text-gray-600">{exec.id}</span>
 </div>
 <p className="text-secondary text-white font-medium ">{exec.intent}</p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <div className="flex items-center gap-1 text-gray-500">
 <Clock className="w-3 h-3" />
 <span className="text-label font-mono">{exec.elapsed}</span>
 </div>
 <button
 onClick={() => setExpanded(!expanded)}
 className="flex items-center gap-1 text-label font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg px-2.5 py-1.5 transition-all duration-200"
 >
 {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
 Drill In
 </button>
 </div>
 </div>

 {/* Pipeline visualization */}
 <div className="flex items-center gap-0 overflow-x-auto pb-1">
 {exec.stages.map((stage, idx) => (
 <StageNode
 key={stage.name}
 stage={stage}
 isLast={idx === exec.stages.length - 1}
 onSelect={() => handleStageClick(stage)}
 isSelected={selectedStage?.name === stage.name}
 />
 ))}
 </div>

 {/* Stage detail (when clicked) */}
 {selectedStage && <StageDetailPanel stage={selectedStage} />}
 </div>

 {/* Expanded drill-in panel */}
 {expanded && (
 <div className="border-t border-gray-800/60 bg-gray-950/60 px-4 py-3">
 <div className="flex items-center gap-2 mb-2">
 <FileText className="w-3.5 h-3.5 text-gray-500" />
 <span className="text-label font-bold text-gray-400 uppercase tracking-wider">Event Log</span>
 <span className="ml-auto text-[10px] text-gray-600">{exec.eventLogs.length} events</span>
 </div>
 <div className="bg-black/40 border border-gray-800/60 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
 {exec.eventLogs.map((log, idx) => (
 <div key={idx} className="font-mono text-[10px] text-gray-400 leading-relaxed">
 {log}
 </div>
 ))}
 {exec.currentStage === 'Reality' || exec.currentStage === 'Planner' ? (
 <div className="flex items-center gap-2 font-mono text-[10px] text-indigo-400">
 <Loader2 className="w-2.5 h-2.5 animate-spin" />
 <span>Processing...</span>
 </div>
 ) : null}
 </div>

 {/* Latency breakdown */}
 <div className="mt-2.5">
 <div className="flex items-center gap-2 mb-1.5">
 <Timer className="w-3 h-3 text-gray-500" />
 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Latency Breakdown</span>
 </div>
 <div className="flex gap-1">
 {exec.stages.filter(s => s.status === 'done' && s.latencyMs).map(s => (
 <div key={s.name} className="flex-1 text-center">
 <div className="text-[9px] text-gray-600 mb-0.5">{s.name}</div>
 <div className="h-1 bg-emerald-500/30 rounded-full relative overflow-hidden">
 <div
 className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full"
 style={{ width: `${Math.min(100, ((s.latencyMs ?? 0) / 1500) * 100)}%` }}
 />
 </div>
 <div className="text-[9px] text-gray-500 mt-0.5 font-mono">{s.latencyMs}ms</div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Completed Item
// ─────────────────────────────────────────────────────────────
function CompletedItem({ exec }: { exec: CompletedExecution }) {
 const outcome = OUTCOME_CONFIG[exec.outcome];
 const OutcomeIcon = outcome.icon;
 const domainClass = DOMAIN_COLORS[exec.domain] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20';

 return (
 <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors duration-150 last:border-0">
 <OutcomeIcon className={cn('w-3.5 h-3.5 shrink-0', outcome.cls.includes('emerald') ? 'text-emerald-400' : outcome.cls.includes('red') ? 'text-red-400' : 'text-amber-400')} />
 <div className="flex-1 min-w-0">
 <p className="text-label text-gray-300 truncate">{exec.intent}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', domainClass)}>{exec.domain}</span>
 <span className="text-[10px] text-gray-600 font-mono">{exec.durationMs}ms</span>
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border', outcome.cls)}>
 {exec.outcome}
 </span>
 <span className="text-[10px] text-gray-600">{exec.completedAt}</span>
 </div>
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────────────────────
function MetricBox({
 label, value, unit, icon: Icon, accentClass
}: {
 label: string; value: string | number; unit?: string;
 icon: React.ElementType; accentClass: string;
}) {
 return (
 <div className={cn('flex-1 bg-gray-900/60 border rounded-xl p-4 flex items-center gap-3', accentClass)}>
 <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', accentClass)}>
 <Icon className="w-4 h-4" />
 </div>
 <div>
 <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
 <div className="text-workspace font-bold font-mono text-white">
 {value}
 {unit && <span className="text-label text-gray-500 font-normal ml-1">{unit}</span>}
 </div>
 </div>
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export const IntentOSLive: React.FC = () => {
 const [tick, setTick] = useState(0);
 const [eventsPerSec, setEventsPerSec] = useState(47);

 // Fetch real events/sec count from Supabase os_events table
 useEffect(() => {
   let cancelled = false;

   const fetchRealRate = async () => {
     try {
       const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
       const { count, error } = await supabase
         .from('os_events')
         .select('id', { count: 'exact', head: true })
         .gte('created_at', tenSecondsAgo);

       if (!cancelled) {
         if (!error && count !== null) {
           // Count in last 10 seconds divided by 10 = events/sec
           setEventsPerSec(Math.max(1, Math.round(count / 10)));
         } else {
           setEventsPerSec(0);
         }
       }
     } catch {
       if (!cancelled) setEventsPerSec(0);
     }
   };

   fetchRealRate();
   const interval = setInterval(() => {
     setTick(t => t + 1);
     fetchRealRate();
   }, 5000);

   return () => { cancelled = true; clearInterval(interval); };
 }, []);

 const verifiedCount = COMPLETED_EXECUTIONS.filter(e => e.outcome === 'Verified').length;
 const rejectedCount = COMPLETED_EXECUTIONS.filter(e => e.outcome === 'Rejected').length;

 return (
 <div className="flex flex-col h-full bg-[#09090f] overflow-hidden font-sans">

 {/* ── Header ── */}
 <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800/60">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="relative w-8 h-8 bg-emerald-500/15 border border-emerald-500/30 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(52,211,153,0.2)]">
 <Radio className="w-4 h-4 text-emerald-400" />
 <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
 </span>
 </div>
 <div>
 <h1 className="text-workspace font-bold text-white tracking-tight">Live Execution</h1>
 <p className="text-label text-gray-500">Intent Operating System · Activity Monitor</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-1.5 text-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
 <span className="relative flex h-1.5 w-1.5">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
 <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
 </span>
 <span className="font-semibold">LIVE</span>
 </div>
 <button className="flex items-center gap-1.5 text-button text-gray-400 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700 rounded-lg px-3 py-2 transition-all duration-200">
 <RefreshCw className="w-3.5 h-3.5" />
 Pause Feed
 </button>
 </div>
 </div>

 {/* Top metrics bar */}
 <div className="flex gap-3">
 <MetricBox
 label="Active Executions"
 value={LIVE_EXECUTIONS.length}
 icon={Activity}
 accentClass="border-indigo-500/20 text-indigo-400"
 />
 <MetricBox
 label="Events / sec"
 value={eventsPerSec}
 icon={Zap}
 accentClass="border-emerald-500/20 text-emerald-400"
 />
 <MetricBox
 label="Avg Latency"
 value={18}
 unit="ms"
 icon={Timer}
 accentClass="border-amber-500/20 text-amber-400"
 />
 <MetricBox
 label="Queue Depth"
 value={3}
 icon={GitBranch}
 accentClass="border-violet-500/20 text-violet-400"
 />
 </div>
 </div>

 {/* ── Body ── */}
 <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

 {/* Active Executions */}
 <section>
 <div className="flex items-center gap-2 mb-3">
 <Activity className="w-4 h-4 text-indigo-400" />
 <h2 className="text-secondary font-bold text-white uppercase tracking-wider">Active Executions</h2>
 <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2 py-0.5">
 <span className="relative flex h-1.5 w-1.5">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
 <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
 </span>
 {LIVE_EXECUTIONS.length} running
 </div>
 </div>
 <div className="space-y-3">
 {LIVE_EXECUTIONS.map(exec => (
 <ExecutionRow key={exec.id} exec={exec} />
 ))}
 </div>
 </section>

 {/* Completed in last 60 min */}
 <section>
 <div className="flex items-center gap-2 mb-3">
 <CheckCircle2 className="w-4 h-4 text-emerald-400" />
 <h2 className="text-secondary font-bold text-white uppercase tracking-wider">Completed in Last 60 Minutes</h2>
 <div className="ml-auto flex items-center gap-3">
 <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 font-bold">
 ✓ {verifiedCount} Verified
 </span>
 <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 font-bold">
 ✕ {rejectedCount} Rejected
 </span>
 <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 font-bold">
 ? {COMPLETED_EXECUTIONS.length - verifiedCount - rejectedCount} Inconclusive
 </span>
 </div>
 </div>
 <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
 <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-800/40">
 {COMPLETED_EXECUTIONS.map(exec => (
 <CompletedItem key={exec.id} exec={exec} />
 ))}
 </div>
 </div>
 </section>

 {/* Bottom padding */}
 <div className="h-4" />
 </div>
 </div>
 );
};

export default IntentOSLive;
