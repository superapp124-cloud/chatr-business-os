import React, { useState } from 'react';
import {
 Brain, ChevronDown, ChevronUp, CheckCircle, AlertTriangle,
 TrendingUp, Shield, Lightbulb, FlaskConical, Clock,
 Target, Link2, GitBranch
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type KnowledgeType = 'Heuristic' | 'Fact' | 'Prediction' | 'Policy';

interface ProvenanceStep {
 step: number;
 label: string;
 detail: string;
}

interface KnowledgeItem {
 id: string;
 type: KnowledgeType;
 statement: string;
 source: string;
 confidence: number;
 evidence: string[];
 lastVerified: string;
 affectedGoals: string[];
 provenance: ProvenanceStep[];
}

// ─────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────
const KNOWLEDGE_ITEMS: KnowledgeItem[] = [
 {
 id: 'k1',
 type: 'Heuristic',
 statement: 'Java candidates respond 40% faster when contacted on Tuesday mornings.',
 source: 'Pattern extracted from 142 candidate communication events (Jan–Jun 2026)',
 confidence: 82,
 evidence: [
 '142 candidate outreach events analysed across 6 months',
 'Median response time on Tuesday 09:00–12:00: 1.4 hours',
 'Median response time on other slots: 2.4 hours',
 ],
 lastVerified: '2026-07-15 08:30',
 affectedGoals: ['Hire 10 Java Developers', 'Reduce Time-to-Offer'],
 provenance: [
 { step: 1, label: 'Event Ingestion', detail: '142 OutreachSent and CandidateReply events logged.' },
 { step: 2, label: 'Pattern Analysis', detail: 'ML heuristic engine grouped events by day/time slot.' },
 { step: 3, label: 'Statistical Test', detail: 'Mann-Whitney U test confirmed significance (p < 0.01).' },
 { step: 4, label: 'Heuristic Registered', detail: 'Knowledge Kernel stored heuristic with 82% confidence.' },
 ],
 },
 {
 id: 'k2',
 type: 'Fact',
 statement: 'Priya Mehta completed technical interview on 2026-07-10.',
 source: 'Event: InterviewCompleted — logged by Recruiter Rahul Singh at 14:35 IST',
 confidence: 100,
 evidence: [
 'Interview scheduled via CHATR Calendar on 2026-07-08',
 'Video call transcript archived (duration: 58 minutes)',
 'Interviewer feedback submitted: "Strong technical foundation; proceed to offer stage"',
 ],
 lastVerified: '2026-07-10 14:35',
 affectedGoals: ['Hire 10 Java Developers'],
 provenance: [
 { step: 1, label: 'Event Received', detail: 'InterviewCompleted event emitted by Calendar module.' },
 { step: 2, label: 'Entity Resolution', detail: 'Linked to entity: Priya Mehta (Candidate #C-4421).' },
 { step: 3, label: 'Fact Assertion', detail: 'Knowledge Kernel asserted fact with 100% confidence (direct observation).' },
 ],
 },
 {
 id: 'k3',
 type: 'Prediction',
 statement: 'Offer acceptance probability for Priya Mehta: 87%.',
 source: 'Inference engine run on 2026-07-14 after offer letter #OL-2847 was generated',
 confidence: 87,
 evidence: [
 'Candidate expressed strong interest during HR round (sentiment score: 0.91)',
 'Compensation ₹12L is within 95th percentile of candidate\'s stated expectations',
 'No competing offers detected in last 7 days based on available signals',
 ],
 lastVerified: '2026-07-14 17:10',
 affectedGoals: ['Hire 10 Java Developers', 'Close Q3 Headcount'],
 provenance: [
 { step: 1, label: 'Trigger', detail: 'OfferLetterGenerated event triggered prediction pipeline.' },
 { step: 2, label: 'Feature Extraction', detail: '14 features extracted from candidate entity and market signals.' },
 { step: 3, label: 'Model Inference', detail: 'Logistic regression model v3.1 produced p(accept) = 0.87.' },
 { step: 4, label: 'Prediction Registered', detail: 'Stored with confidence 87%, review scheduled in 48h.' },
 ],
 },
 {
 id: 'k4',
 type: 'Policy',
 statement: 'All offers exceeding ₹10,00,000 CTC require VP approval before sending.',
 source: 'Policy authored by HR Admin on 2026-01-15; enforced via PolicyEngine v2',
 confidence: 100,
 evidence: [
 'Policy formally approved by CFO and HR Director on 2026-01-15',
 'Enforced on 100% of offer letters generated since policy effective date',
 '3 offers blocked and escalated successfully under this policy in 2026',
 ],
 lastVerified: '2026-07-01 09:00',
 affectedGoals: ['Maintain Compensation Governance', 'Hire 10 Java Developers'],
 provenance: [
 { step: 1, label: 'Policy Authored', detail: 'HR Admin created policy rule in PolicyEngine UI.' },
 { step: 2, label: 'CFO Approval', detail: 'CFO digitally signed policy on 2026-01-15.' },
 { step: 3, label: 'Kernel Integration', detail: 'Policy registered in Knowledge Kernel as enforcement rule.' },
 { step: 4, label: 'Live Enforcement', detail: 'PolicyEngine evaluates on every OfferLetterPending event.' },
 ],
 },
 {
 id: 'k5',
 type: 'Heuristic',
 statement: 'Interview no-show rate drops 60% when confirmed via WhatsApp 1 hour before.',
 source: 'Pattern extracted from 67 interview events with varied confirmation channels (Apr–Jun 2026)',
 confidence: 76,
 evidence: [
 '67 scheduled interviews analysed: 34 WhatsApp-confirmed, 33 email-only',
 'No-show rate: WhatsApp 8% vs Email-only 20%',
 'Delta statistically significant at p = 0.03',
 ],
 lastVerified: '2026-07-12 10:00',
 affectedGoals: ['Reduce Time-to-Offer', 'Hire 10 Java Developers'],
 provenance: [
 { step: 1, label: 'Event Ingestion', detail: '67 InterviewScheduled + InterviewNoShow events correlated.' },
 { step: 2, label: 'Channel Attribution', detail: 'Confirmation channel extracted from OutreachSent event metadata.' },
 { step: 3, label: 'Statistical Test', detail: 'Chi-squared test confirmed channel impact (p = 0.03).' },
 { step: 4, label: 'Heuristic Registered', detail: 'Stored at confidence 76% pending replication.' },
 ],
 },
];

const FILTER_TABS = ['All', 'Facts', 'Heuristics', 'Predictions', 'Policies'] as const;
type FilterTab = typeof FILTER_TABS[number];

// ─────────────────────────────────────────────────────────────
// Config maps
// ─────────────────────────────────────────────────────────────
const knowledgeTypeConfig: Record<KnowledgeType, { color: string; bg: string; border: string; icon: React.ElementType }> = {
 Heuristic: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', icon: Lightbulb },
 Fact: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: CheckCircle },
 Prediction: { color: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30', icon: TrendingUp },
 Policy: { color: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30', icon: Shield },
};

function confidenceBarColor(conf: number): string {
 if (conf >= 90) return 'bg-emerald-500';
 if (conf >= 75) return 'bg-sky-500';
 if (conf >= 60) return 'bg-amber-500';
 return 'bg-rose-500';
}

function filterItems(tab: FilterTab): KnowledgeItem[] {
 if (tab === 'All') return KNOWLEDGE_ITEMS;
 const map: Record<FilterTab, KnowledgeType | undefined> = {
 All: undefined,
 Facts: 'Fact',
 Heuristics: 'Heuristic',
 Predictions: 'Prediction',
 Policies: 'Policy',
 };
 return KNOWLEDGE_ITEMS.filter((k) => k.type === map[tab]);
}

// ─────────────────────────────────────────────────────────────
// Provenance Chain
// ─────────────────────────────────────────────────────────────
function ProvenanceChain({ steps }: { steps: ProvenanceStep[] }) {
 return (
 <div className="mt-4 p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-3">
 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2 flex items-center gap-1.5">
 <GitBranch className="w-3 h-3" /> Full Provenance Chain
 </p>
 {steps.map((s, i) => (
 <div key={i} className="flex gap-3">
 <div className="flex flex-col items-center shrink-0">
 <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
 <span className="text-[9px] font-bold text-indigo-400">{s.step}</span>
 </div>
 {i < steps.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1 min-h-[16px]" />}
 </div>
 <div className="pb-3 flex-1">
 <p className="text-label font-semibold text-white mb-0.5">{s.label}</p>
 <p className="text-[11px] text-gray-500">{s.detail}</p>
 </div>
 </div>
 ))}
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Knowledge Card
// ─────────────────────────────────────────────────────────────
function KnowledgeCard({ item }: { item: KnowledgeItem }) {
 const [expanded, setExpanded] = useState(false);
 const cfg = knowledgeTypeConfig[item.type];
 const TypeIcon = cfg.icon;
 const barColor = confidenceBarColor(item.confidence);

 return (
 <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all">
 {/* Header */}
 <div className="flex items-start gap-3 mb-4">
 <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border shrink-0', cfg.bg, cfg.border)}>
 <TypeIcon className={cn('w-5 h-5', cfg.color)} />
 </div>
 <div className="flex-1 min-w-0">
 <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border', cfg.color, cfg.bg, cfg.border)}>
 {item.type}
 </span>
 <p className="text-secondary font-bold text-white mt-1.5 ">{item.statement}</p>
 </div>
 </div>

 {/* Source */}
 <div className="mb-4">
 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Source</p>
 <p className="text-[11px] text-gray-400">{item.source}</p>
 </div>

 {/* Confidence */}
 <div className="mb-4">
 <div className="flex items-center justify-between mb-1.5">
 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Confidence</p>
 <span className={cn('text-label font-bold', cfg.color)}>{item.confidence}%</span>
 </div>
 <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
 <div
 className={cn('h-full rounded-full transition-all', barColor)}
 style={{ width: `${item.confidence}%` }}
 />
 </div>
 </div>

 {/* Evidence */}
 <div className="mb-4">
 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">Supporting Evidence</p>
 <ul className="space-y-1.5">
 {item.evidence.map((ev, i) => (
 <li key={i} className="flex items-start gap-2 text-[11px] text-gray-400">
 <span className="w-1.5 h-1.5 rounded-full bg-gray-600 mt-1.5 shrink-0" />
 {ev}
 </li>
 ))}
 </ul>
 </div>

 {/* Meta row */}
 <div className="flex items-start gap-4 flex-wrap border-t border-gray-800/60 pt-3 mb-4">
 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Last Verified</p>
 <p className="text-[11px] text-gray-400 flex items-center gap-1">
 <Clock className="w-3 h-3" /> {item.lastVerified}
 </p>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Affected Goals</p>
 <div className="flex flex-wrap gap-1.5">
 {item.affectedGoals.map((g) => (
 <span key={g} className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
 <Target className="w-2.5 h-2.5" /> {g}
 </span>
 ))}
 </div>
 </div>
 </div>

 {/* Why? Button */}
 <button
 onClick={() => setExpanded((v) => !v)}
 className="flex items-center gap-2 text-label font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/30 hover:border-indigo-500/50 px-3 py-2 rounded-lg transition-all w-full justify-center"
 >
 <Link2 className="w-3.5 h-3.5" />
 {expanded ? 'Hide' : 'Why?'} — Show Full Provenance Chain
 {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
 </button>

 {expanded && <ProvenanceChain steps={item.provenance} />}
 </div>
 );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export const IntentOSKnowledge: React.FC = () => {
 const [activeTab, setActiveTab] = useState<FilterTab>('All');
 const items = filterItems(activeTab);

 return (
 <div className="flex flex-col h-full bg-[#0a0a0f] text-gray-200 font-sans overflow-hidden">

 {/* ── Top Bar ── */}
 <div className="px-6 py-5 border-b border-gray-800 shrink-0 bg-gray-950/80 backdrop-blur-md z-10">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
 <Brain className="w-5 h-5 text-amber-400" />
 </div>
 <div>
 <h1 className="text-section font-bold text-white tracking-tight">Knowledge Kernel</h1>
 <p className="text-[11px] text-gray-500">Understanding why the OS behaves as it does</p>
 </div>
 </div>
 {/* Summary pills */}
 <div className="flex items-center gap-2">
 {(
 [
 { label: 'Facts', count: KNOWLEDGE_ITEMS.filter(k => k.type === 'Fact').length, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
 { label: 'Heuristics', count: KNOWLEDGE_ITEMS.filter(k => k.type === 'Heuristic').length, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
 { label: 'Predictions', count: KNOWLEDGE_ITEMS.filter(k => k.type === 'Prediction').length, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
 { label: 'Policies', count: KNOWLEDGE_ITEMS.filter(k => k.type === 'Policy').length, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
 ] as { label: string; count: number; color: string }[]
 ).map(({ label, count, color }) => (
 <span key={label} className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border', color)}>
 {count} {label}
 </span>
 ))}
 </div>
 </div>

 {/* Filter tabs */}
 <div className="flex items-center gap-1 mt-4">
 {FILTER_TABS.map((tab) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={cn(
 'px-4 py-1.5 rounded-lg text-secondary font-medium transition-colors',
 activeTab === tab
 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
 : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent'
 )}
 >
 {tab}
 {tab !== 'All' && (
 <span className="ml-1.5 text-[10px] font-bold opacity-60">
 ({filterItems(tab).length})
 </span>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* ── Grid ── */}
 <div className="flex-1 overflow-y-auto p-6">
 {items.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-64 text-gray-700">
 <FlaskConical className="w-12 h-12 opacity-20 mb-3" />
 <p className="text-secondary">No {activeTab} items found.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-6xl mx-auto">
 {items.map((item) => (
 <KnowledgeCard key={item.id} item={item} />
 ))}
 </div>
 )}
 </div>
 </div>
 );
};

export default IntentOSKnowledge;
