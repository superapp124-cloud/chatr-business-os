import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Zap, CheckCircle2, AlertCircle, Clock, RefreshCw,
 ChevronDown, ChevronUp, Terminal, Plus,
 Briefcase, Mail, CalendarDays, Database,
 Shield, XCircle, Loader2, ArrowRight
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type IntentStatus = 'Running' | 'Completed' | 'Needs Review' | 'Verified' | 'Inconclusive';

interface TimelineStep {
 label: string;
 detail?: string;
 status: 'done' | 'running' | 'pending';
}

interface MockIntent {
 id: string;
 text: string;
 status: IntentStatus;
 progress: number;
 confidence: number;
 capabilities: string[];
 timeline: TimelineStep[];
}

type ExecutionState = 'idle' | 'analyzing' | 'planning' | 'executing' | 'done';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_INTENTS: MockIntent[] = [
 {
 id: 'int-001',
 text: 'Hire 10 Java Developers',
 status: 'Running',
 progress: 60,
 confidence: 94,
 capabilities: ['LinkedIn', 'ATS', 'Gmail'],
 timeline: [
 { label: 'Intent Received', status: 'done' },
 { label: 'Planner', detail: '2.1s', status: 'done' },
 { label: 'LinkedIn Search', detail: '847 profiles found ✓', status: 'done' },
 { label: 'ATS Updated', detail: '34 candidates added ✓', status: 'done' },
 { label: 'Outcome Verification', detail: 'Running...', status: 'running' },
 { label: 'Goal Progress', detail: '60% (6/10 hired)', status: 'running' },
 ],
 },
 {
 id: 'int-002',
 text: 'Schedule Q3 Interviews',
 status: 'Completed',
 progress: 100,
 confidence: 99,
 capabilities: ['Calendar', 'Gmail'],
 timeline: [
 { label: 'Intent Received', status: 'done' },
 { label: 'Planner', detail: '1.4s', status: 'done' },
 { label: 'Calendar Blocked', detail: '24 slots created ✓', status: 'done' },
 { label: 'Invites Sent via Gmail', detail: '24/24 delivered ✓', status: 'done' },
 { label: 'Outcome Verification', detail: 'Verified ✓', status: 'done' },
 { label: 'Goal Progress', detail: '100% complete', status: 'done' },
 ],
 },
 {
 id: 'int-003',
 text: 'Onboard Priya Mehta',
 status: 'Needs Review',
 progress: 40,
 confidence: 72,
 capabilities: ['Gmail', 'ATS'],
 timeline: [
 { label: 'Intent Received', status: 'done' },
 { label: 'Planner', detail: '3.2s', status: 'done' },
 { label: 'Welcome Email Sent', detail: 'Delivered ✓', status: 'done' },
 { label: 'ATS Profile Created', detail: 'Partial data — needs review ⚠', status: 'running' },
 { label: 'Outcome Verification', detail: 'Inconclusive', status: 'pending' },
 { label: 'Goal Progress', detail: '40% — operator review needed', status: 'pending' },
 ],
 },
 {
 id: 'int-004',
 text: 'Send offer letters to shortlisted candidates',
 status: 'Verified',
 progress: 100,
 confidence: 100,
 capabilities: ['Gmail', 'ATS'],
 timeline: [
 { label: 'Intent Received', status: 'done' },
 { label: 'Planner', detail: '0.9s', status: 'done' },
 { label: 'Offer PDFs Generated', detail: '12 documents ✓', status: 'done' },
 { label: 'Gmail Delivery', detail: '12/12 delivered ✓', status: 'done' },
 { label: 'Outcome Verification', detail: 'Cryptographically verified ✓', status: 'done' },
 { label: 'Goal Progress', detail: '100% — verified & signed', status: 'done' },
 ],
 },
 {
 id: 'int-005',
 text: 'Identify at-risk job openings',
 status: 'Inconclusive',
 progress: 20,
 confidence: 48,
 capabilities: ['ATS', 'LinkedIn'],
 timeline: [
 { label: 'Intent Received', status: 'done' },
 { label: 'Planner', detail: '4.1s — low confidence', status: 'done' },
 { label: 'ATS Query', detail: 'Partial results — 3/15 positions matched', status: 'done' },
 { label: 'LinkedIn Cross-check', detail: 'Timeout — inconclusive', status: 'running' },
 { label: 'Outcome Verification', detail: 'Cannot verify', status: 'pending' },
 { label: 'Goal Progress', detail: '20% — insufficient data', status: 'pending' },
 ],
 },
];

// ─── Status Config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IntentStatus, { color: string; bgColor: string; borderColor: string; icon: React.ElementType; label: string }> = {
 Running: { color: '#60a5fa', bgColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', icon: Loader2, label: 'Running' },
 Completed: { color: '#34d399', bgColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)', icon: CheckCircle2, label: 'Completed' },
 'Needs Review': { color: '#fbbf24', bgColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)', icon: AlertCircle, label: 'Needs Review' },
 Verified: { color: '#a78bfa', bgColor: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.3)', icon: Shield, label: 'Verified' },
 Inconclusive: { color: '#fb7185', bgColor: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.3)', icon: XCircle, label: 'Inconclusive' },
};

// ─── Capability Icon Pills ───────────────────────────────────────────────────

const CAPABILITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
 LinkedIn: { icon: Briefcase, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
 Gmail: { icon: Mail, color: '#fb7185', bg: 'rgba(251,113,133,0.12)' },
 Calendar: { icon: CalendarDays, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
 ATS: { icon: Database, color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
};

const CapabilityPill: React.FC<{ name: string }> = ({ name }) => {
 const cfg = CAPABILITY_CONFIG[name] || { icon: Database, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' };
 const Icon = cfg.icon;
 return (
 <div style={{
 display: 'flex', alignItems: 'center', gap: 5,
 padding: '3px 10px', borderRadius: 20,
 backgroundColor: cfg.bg,
 border: `1px solid ${cfg.color}33`,
 }}>
 <Icon size={11} color={cfg.color} />
 <span style={{ color: cfg.color, fontSize: 11, fontWeight: 600 }}>{name}</span>
 </div>
 );
};

// ─── Timeline ────────────────────────────────────────────────────────────────

const ExecutionTimeline: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => {
 const stepColor = (s: TimelineStep['status']) => {
 if (s === 'done') return '#34d399';
 if (s === 'running') return '#fbbf24';
 return '#374151';
 };

 return (
 <div style={{ padding: '16px 0 4px 0', borderTop: '1px solid #1f2937', marginTop: 16 }}>
 <p style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>
 Execution Timeline
 </p>
 <div style={{ position: 'relative', paddingLeft: 28 }}>
 <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 1, backgroundColor: '#1f2937' }} />
 {steps.map((step, idx) => (
 <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16, position: 'relative' }}>
 <div style={{
 position: 'absolute', left: -21, top: 4,
 width: 10, height: 10, borderRadius: '50%',
 backgroundColor: stepColor(step.status),
 boxShadow: step.status !== 'pending' ? `0 0 8px ${stepColor(step.status)}` : 'none',
 animation: step.status === 'running' ? 'blink 1.2s ease-in-out infinite' : 'none',
 }} />
 <p style={{ color: step.status === 'pending' ? '#4b5563' : '#e5e7eb', fontSize: 13, fontWeight: step.status !== 'pending' ? 600 : 400 }}>
 {step.label}
 </p>
 {step.detail && (
 <p style={{ color: stepColor(step.status), fontSize: 12, fontFamily: 'monospace', opacity: step.status === 'pending' ? 0.5 : 1 }}>
 {step.detail}
 </p>
 )}
 </div>
 ))}
 </div>
 </div>
 );
};

// ─── Intent Card ─────────────────────────────────────────────────────────────

const IntentCard: React.FC<{ intent: MockIntent }> = ({ intent }) => {
 const [expanded, setExpanded] = useState(false);
 const cfg = STATUS_CONFIG[intent.status];
 const StatusIcon = cfg.icon;

 return (
 <div
 style={{
 backgroundColor: '#0f0f1a',
 border: `1px solid ${expanded ? cfg.borderColor : '#1f2937'}`,
 borderRadius: 16,
 overflow: 'hidden',
 transition: 'all 0.25s',
 boxShadow: expanded ? `0 0 20px ${cfg.borderColor.replace('0.3', '0.1')}` : 'none',
 }}
 >
 {/* Card Header */}
 <button
 onClick={() => setExpanded(v => !v)}
 style={{
 width: '100%', textAlign: 'left', cursor: 'pointer',
 background: 'none', border: 'none', padding: '18px 22px',
 display: 'flex', alignItems: 'flex-start', gap: 16, color: '#fff',
 }}
 >
 {/* Status icon */}
 <div style={{
 width: 36, height: 36, borderRadius: 10,
 backgroundColor: cfg.bgColor,
 border: `1px solid ${cfg.borderColor}`,
 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
 }}>
 <StatusIcon
 size={16}
 color={cfg.color}
 style={{ animation: intent.status === 'Running' ? 'spin 2s linear infinite' : 'none' }}
 />
 </div>

 <div style={{ flex: 1, minWidth: 0 }}>
 {/* Top row */}
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
 <p style={{ color: '#f3f4f6', fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0 }}>{intent.text}</p>
 <span style={{
 fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
 color: cfg.color, backgroundColor: cfg.bgColor,
 border: `1px solid ${cfg.borderColor}`, borderRadius: 20,
 padding: '3px 10px', whiteSpace: 'nowrap',
 }}>{cfg.label}</span>
 </div>

 {/* Progress Bar */}
 <div style={{ marginBottom: 12 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
 <span style={{ color: '#6b7280', fontSize: 11 }}>Goal Progress</span>
 <span style={{ color: cfg.color, fontSize: 11, fontWeight: 700 }}>{intent.progress}%</span>
 </div>
 <div style={{ height: 5, backgroundColor: '#1f2937', borderRadius: 99, overflow: 'hidden' }}>
 <div style={{
 height: '100%', borderRadius: 99,
 width: `${intent.progress}%`,
 backgroundColor: cfg.color,
 boxShadow: `0 0 8px ${cfg.color}`,
 transition: 'width 0.8s ease',
 }} />
 </div>
 </div>

 {/* Bottom row */}
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
 {intent.capabilities.map(cap => <CapabilityPill key={cap} name={cap} />)}
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
 <span style={{ color: '#6b7280', fontSize: 11 }}>Confidence</span>
 <span style={{
 color: intent.confidence >= 90 ? '#34d399' : intent.confidence >= 70 ? '#fbbf24' : '#fb7185',
 fontSize: 12, fontWeight: 700,
 }}>{intent.confidence}%</span>
 <div style={{ color: '#374151', display: 'flex', alignItems: 'center', marginLeft: 4 }}>
 {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
 </div>
 </div>
 </div>
 </div>
 </button>

 {/* Expanded Timeline */}
 {expanded && (
 <div style={{ padding: '0 22px 20px 22px' }}>
 <ExecutionTimeline steps={intent.timeline} />
 </div>
 )}
 </div>
 );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const IntentOSIntents: React.FC = () => {
 const navigate = useNavigate();
 const [intent, setIntent] = useState('');
 const [execState, setExecState] = useState<ExecutionState>('idle');
 const [showNewIntentModal, setShowNewIntentModal] = useState(false);

 useEffect(() => {
 const styleId = 'chatr-os-intents-keyframes';
 if (!document.getElementById(styleId)) {
 const style = document.createElement('style');
 style.id = styleId;
 style.textContent = `
 @keyframes blink {
 0%, 100% { opacity: 1; }
 50% { opacity: 0.3; }
 }
 @keyframes spin {
 from { transform: rotate(0deg); }
 to { transform: rotate(360deg); }
 }
 @keyframes slideUp {
 from { opacity: 0; transform: translateY(10px); }
 to { opacity: 1; transform: translateY(0); }
 }
 @keyframes pulseIndigo {
 0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.15); }
 50% { box-shadow: 0 0 50px rgba(99,102,241,0.5), 0 0 100px rgba(99,102,241,0.18); }
 }
 @keyframes fadeIn {
 from { opacity: 0; }
 to { opacity: 1; }
 }
 `;
 document.head.appendChild(style);
 }
 return () => { document.getElementById(styleId)?.remove(); };
 }, []);

 const handleExecute = () => {
 if (!intent.trim() || execState !== 'idle') return;
 setExecState('analyzing');
 setTimeout(() => setExecState('planning'), 1800);
 setTimeout(() => setExecState('executing'), 3400);
 setTimeout(() => setExecState('done'), 5200);
 setTimeout(() => { setExecState('idle'); }, 7500);
 };

 const execMeta: Record<ExecutionState, { text: string; color: string }> = {
 idle: { text: '', color: '#6b7280' },
 analyzing: { text: 'Analyzing intent...', color: '#a78bfa' },
 planning: { text: 'Building execution plan...', color: '#60a5fa' },
 executing: { text: 'Executing across capabilities...', color: '#34d399' },
 done: { text: '✓ Intent executed successfully', color: '#34d399' },
 };
 const em = execMeta[execState];

 return (
 <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', overflowY: 'auto' }}>

 {/* ── Header ── */}
 <div style={{
 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 padding: '16px 32px', borderBottom: '1px solid #111827',
 backgroundColor: 'rgba(10,10,15,0.96)', backdropFilter: 'blur(16px)',
 position: 'sticky', top: 0, zIndex: 10,
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <button
 onClick={() => navigate('/desktop/os-home')}
 style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
 >
 <Zap size={14} />
 CHATR Intent OS
 </button>
 <span style={{ color: '#374151' }}>/</span>
 <p style={{ fontSize: 16, fontWeight: 700, color: '#f3f4f6' }}>Intents</p>
 </div>

 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid #1f2937' }}>
 <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#34d399', animation: 'blink 2s ease-in-out infinite' }} />
 <span style={{ color: '#9ca3af', fontSize: 12 }}>5 active · 143 today</span>
 </div>
 <button
 onClick={() => setShowNewIntentModal(true)}
 style={{
 padding: '9px 18px', borderRadius: 10, border: 'none',
 background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
 color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
 display: 'flex', alignItems: 'center', gap: 6,
 boxShadow: '0 0 20px rgba(99,102,241,0.4)',
 }}
 >
 <Plus size={14} />
 New Intent
 </button>
 </div>
 </div>

 {/* ── Page Body ── */}
 <div style={{ padding: '32px 32px 56px', maxWidth: 960, margin: '0 auto' }}>

 {/* Intent Console */}
 <div style={{
 backgroundColor: 'rgba(15,15,26,0.97)',
 border: `1px solid ${execState !== 'idle' ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.22)'}`,
 borderRadius: 20, padding: '24px 28px', backdropFilter: 'blur(20px)',
 animation: execState !== 'idle' ? 'pulseIndigo 2s ease-in-out infinite' : 'none',
 marginBottom: 36, transition: 'border-color 0.3s',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
 <Terminal size={16} color="#818cf8" />
 <p style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 15 }}>Intent Console</p>
 <span style={{
 fontSize: 10, color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.1)',
 border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20,
 padding: '2px 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1,
 }}>Ready</span>
 </div>

 <textarea
 value={intent}
 onChange={e => setIntent(e.target.value)}
 placeholder="What do you want to accomplish? e.g. 'Hire 5 React developers for the platform team by August'"
 rows={4}
 disabled={execState !== 'idle'}
 style={{
 width: '100%', boxSizing: 'border-box',
 backgroundColor: 'rgba(0,0,0,0.45)', border: '1px solid #1f2937',
 borderRadius: 12, padding: '14px 16px',
 color: '#e5e7eb', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif',
 resize: 'none', outline: 'none', lineHeight: 1.75,
 opacity: execState !== 'idle' ? 0.7 : 1,
 }}
 onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
 onBlur={e => { e.target.style.borderColor = '#1f2937'; }}
 onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleExecute(); }}
 />

 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
 {execState !== 'idle' ? (
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'slideUp 0.3s ease' }}>
 <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: em.color, animation: 'blink 1s ease-in-out infinite' }} />
 <span style={{ color: em.color, fontSize: 13, fontWeight: 500 }}>{em.text}</span>
 </div>
 ) : (
 <span style={{ color: '#4b5563', fontSize: 12 }}>⌘ + Enter to execute</span>
 )}
 </div>
 <button
 onClick={handleExecute}
 disabled={execState !== 'idle' || !intent.trim()}
 style={{
 padding: '10px 26px', borderRadius: 12, border: 'none',
 background: execState !== 'idle' || !intent.trim()
 ? 'rgba(99,102,241,0.22)'
 : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
 color: execState !== 'idle' || !intent.trim() ? 'rgba(255,255,255,0.35)' : '#fff',
 fontSize: 14, fontWeight: 700,
 cursor: execState !== 'idle' || !intent.trim() ? 'not-allowed' : 'pointer',
 display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
 boxShadow: execState === 'idle' && intent.trim() ? '0 0 24px rgba(99,102,241,0.55)' : 'none',
 }}
 >
 <Zap size={15} />
 Execute Intent
 </button>
 </div>
 </div>

 {/* Recent Intents */}
 <div>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
 <p style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 700 }}>Recent Intents</p>
 <div style={{ display: 'flex', gap: 8 }}>
 {(['All', 'Running', 'Needs Review', 'Completed'] as const).map(filter => (
 <button
 key={filter}
 style={{
 padding: '5px 14px', borderRadius: 20,
 border: '1px solid #1f2937', backgroundColor: 'rgba(255,255,255,0.03)',
 color: '#6b7280', fontSize: 12, fontWeight: 500, cursor: 'pointer',
 transition: 'all 0.15s',
 }}
 onMouseEnter={e => {
 (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151';
 (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db';
 }}
 onMouseLeave={e => {
 (e.currentTarget as HTMLButtonElement).style.borderColor = '#1f2937';
 (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
 }}
 >
 {filter}
 </button>
 ))}
 </div>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
 {MOCK_INTENTS.map(intentItem => (
 <IntentCard key={intentItem.id} intent={intentItem} />
 ))}
 </div>
 </div>
 </div>

 {/* ── New Intent Quick-Open Modal ── */}
 {showNewIntentModal && (
 <div
 onClick={() => setShowNewIntentModal(false)}
 style={{
 position: 'fixed', inset: 0, zIndex: 50,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
 animation: 'fadeIn 0.2s ease',
 }}
 >
 <div
 onClick={e => e.stopPropagation()}
 style={{
 backgroundColor: '#0f0f1a', border: '1px solid rgba(99,102,241,0.4)',
 borderRadius: 20, padding: 32, width: 560, maxWidth: '90vw',
 boxShadow: '0 0 60px rgba(99,102,241,0.3)',
 animation: 'slideUp 0.3s ease',
 }}
 >
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
 <div style={{
 width: 36, height: 36, borderRadius: 10,
 background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 boxShadow: '0 0 16px rgba(99,102,241,0.5)',
 }}>
 <Zap size={16} color="#fff" />
 </div>
 <div>
 <p style={{ color: '#f3f4f6', fontWeight: 700, fontSize: 16 }}>New Intent</p>
 <p style={{ color: '#6b7280', fontSize: 12 }}>Describe what you want to accomplish</p>
 </div>
 </div>
 <button
 onClick={() => setShowNewIntentModal(false)}
 style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4 }}
 >
 ✕
 </button>
 </div>

 <textarea
 autoFocus
 placeholder="e.g. 'Hire 5 React developers', 'Schedule Q4 board meetings', 'Send NDA to all new joiners'..."
 rows={5}
 style={{
 width: '100%', boxSizing: 'border-box',
 backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(99,102,241,0.3)',
 borderRadius: 12, padding: '14px 16px',
 color: '#e5e7eb', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif',
 resize: 'none', outline: 'none', lineHeight: 1.75,
 }}
 onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.7)'; }}
 onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.3)'; }}
 />

 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
 <button
 onClick={() => setShowNewIntentModal(false)}
 style={{
 padding: '10px 20px', borderRadius: 10,
 border: '1px solid #374151', backgroundColor: 'transparent',
 color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer',
 }}
 >
 Cancel
 </button>
 <button
 onClick={() => setShowNewIntentModal(false)}
 style={{
 padding: '10px 24px', borderRadius: 10, border: 'none',
 background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
 color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
 display: 'flex', alignItems: 'center', gap: 6,
 boxShadow: '0 0 20px rgba(99,102,241,0.5)',
 }}
 >
 <ArrowRight size={14} />
 Execute
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default IntentOSIntents;
