import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Zap, Target, CheckCircle2, Clock, TrendingUp, Brain,
 GitBranch, Shield, AlertCircle, Star,
 Activity, Eye, Database,
 Sparkles, Terminal, X, Layers
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PipelineStage {
 id: string;
 label: string;
 icon: React.ElementType;
 hexColor: string;
 glowRgba: string;
 latency: string;
 evidence: string;
 logs: string[];
}

type ExecutionState = 'idle' | 'analyzing' | 'planning' | 'executing' | 'done';

// ─── Pipeline Stage Data ─────────────────────────────────────────────────────

const PIPELINE_STAGES: PipelineStage[] = [
 {
 id: 'intent',
 label: 'Intent',
 icon: Terminal,
 hexColor: '#a78bfa',
 glowRgba: 'rgba(139,92,246,0.4)',
 latency: '0ms',
 evidence: 'NLP parse complete. Entities: role=developer, count=10, tech=Java.',
 logs: ['[00:00.000] Intent received', '[00:00.012] NLP tokenization started', '[00:00.031] Entity extraction complete'],
 },
 {
 id: 'planner',
 label: 'Planner',
 icon: Brain,
 hexColor: '#818cf8',
 glowRgba: 'rgba(99,102,241,0.4)',
 latency: '142ms',
 evidence: 'Goal decomposed into 4 sub-tasks. Assigned LinkedIn, ATS, Gmail capabilities.',
 logs: ['[00:00.142] Goal decomposition started', '[00:00.189] Sub-tasks generated: 4', '[00:00.210] Capability assignment complete'],
 },
 {
 id: 'capability',
 label: 'Capability',
 icon: GitBranch,
 hexColor: '#60a5fa',
 glowRgba: 'rgba(59,130,246,0.4)',
 latency: '2.1s',
 evidence: 'LinkedIn search: 847 results. ATS filters applied. 34 shortlisted.',
 logs: ['[00:02.100] LinkedIn API called', '[00:02.340] 847 profiles fetched', '[00:02.890] ATS filter applied: 34 remaining'],
 },
 {
 id: 'reality',
 label: 'Reality',
 icon: Eye,
 hexColor: '#22d3ee',
 glowRgba: 'rgba(34,211,238,0.4)',
 latency: '3.4s',
 evidence: 'World state snapshot taken. 34 candidates in pipeline. 6 interviews scheduled.',
 logs: ['[00:03.400] Reality snapshot initiated', '[00:03.412] State: 34 candidates active', '[00:03.450] 6 interviews confirmed in calendar'],
 },
 {
 id: 'verification',
 label: 'Verification',
 icon: Shield,
 hexColor: '#34d399',
 glowRgba: 'rgba(52,211,153,0.4)',
 latency: '4.1s',
 evidence: 'Accuracy 99.8%. Outcome matches goal criteria. Trust score: 91%.',
 logs: ['[00:04.100] Verification engine started', '[00:04.156] Accuracy check: 99.8%', '[00:04.210] Operator trust validated: 91%'],
 },
 {
 id: 'knowledge',
 label: 'Knowledge',
 icon: Database,
 hexColor: '#fbbf24',
 glowRgba: 'rgba(251,191,36,0.4)',
 latency: '4.3s',
 evidence: 'Learnings committed to org knowledge graph. Pattern updated.',
 logs: ['[00:04.300] Knowledge graph update', '[00:04.345] New pattern: Java hiring pipeline', '[00:04.390] Memory committed'],
 },
 {
 id: 'goal',
 label: 'Goal',
 icon: Target,
 hexColor: '#fb7185',
 glowRgba: 'rgba(251,113,133,0.4)',
 latency: '4.5s',
 evidence: 'Goal progress: 60%. 6/10 developers hired. 4 remaining in pipeline.',
 logs: ['[00:04.500] Goal evaluation complete', '[00:04.512] Progress: 60% (6/10)', '[00:04.530] 4 candidates in active pipeline'],
 },
];

// ─── Flowing Dots ────────────────────────────────────────────────────────────

const FlowingDots: React.FC = () => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: 40, justifyContent: 'center', flexShrink: 0 }}>
 {[0, 1, 2].map((i) => (
 <div
 key={i}
 style={{
 width: 4,
 height: 4,
 borderRadius: '50%',
 backgroundColor: '#6366f1',
 animation: `flowDot 1.2s ease-in-out ${i * 0.2}s infinite`,
 }}
 />
 ))}
 </div>
);

// ─── Stage Tooltip Modal ─────────────────────────────────────────────────────

const StageTooltip: React.FC<{ stage: PipelineStage; onClose: () => void }> = ({ stage, onClose }) => {
 const Icon = stage.icon;
 return (
 <div
 onClick={onClose}
 style={{
 position: 'fixed', inset: 0, zIndex: 50,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
 }}
 >
 <div
 onClick={(e) => e.stopPropagation()}
 style={{
 backgroundColor: '#0f0f1a',
 border: `1px solid ${stage.glowRgba.replace('0.4', '0.5')}`,
 borderRadius: 18,
 padding: 28,
 width: 480,
 maxWidth: '90vw',
 boxShadow: `0 0 60px ${stage.glowRgba}, 0 0 120px ${stage.glowRgba.replace('0.4', '0.15')}`,
 }}
 >
 {/* Header */}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <div style={{
 width: 42, height: 42, borderRadius: 12,
 backgroundColor: stage.glowRgba.replace('0.4', '0.15'),
 border: `1px solid ${stage.glowRgba.replace('0.4', '0.4')}`,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 }}>
 <Icon size={20} color={stage.hexColor} />
 </div>
 <div>
 <p style={{ color: '#f9fafb', fontWeight: 700, fontSize: 17, lineHeight: 1 }}>{stage.label} Stage</p>
 <p style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
 Latency: <span style={{ color: stage.hexColor, fontWeight: 600 }}>{stage.latency}</span>
 </p>
 </div>
 </div>
 <button
 onClick={onClose}
 style={{ color: '#6b7280', cursor: 'pointer', background: 'none', border: 'none', padding: 4, lineHeight: 1 }}
 >
 <X size={18} />
 </button>
 </div>

 {/* Evidence */}
 <div style={{
 backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: '14px 16px',
 marginBottom: 14, border: '1px solid #1f2937',
 }}>
 <p style={{ color: '#6b7280', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>Evidence</p>
 <p style={{ color: '#e5e7eb', fontSize: 13, lineHeight: 1.7 }}>{stage.evidence}</p>
 </div>

 {/* Logs */}
 <div style={{
 backgroundColor: '#000', borderRadius: 12, padding: '14px 16px', border: '1px solid #111827',
 }}>
 <p style={{ color: '#6b7280', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>Execution Logs</p>
 {stage.logs.map((log, i) => (
 <p key={i} style={{ color: '#34d399', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8 }}>{log}</p>
 ))}
 </div>
 </div>
 </div>
 );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
 title: string; value: string; icon: React.ElementType;
 hexColor: string; glowRgba: string;
}> = ({ title, value, icon: Icon, hexColor, glowRgba }) => (
 <div style={{
 flex: 1,
 backgroundColor: '#0f0f1a',
 border: `1px solid ${glowRgba.replace('0.4', '0.35')}`,
 borderRadius: 16,
 padding: '20px 24px',
 boxShadow: `0 0 20px ${glowRgba.replace('0.4', '0.12')}`,
 display: 'flex', flexDirection: 'column', gap: 12,
 minWidth: 0,
 }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
 <p style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{title}</p>
 <div style={{
 width: 32, height: 32, borderRadius: 8,
 backgroundColor: glowRgba.replace('0.4', '0.12'),
 display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
 }}>
 <Icon size={15} color={hexColor} />
 </div>
 </div>
 <p style={{ color: hexColor, fontSize: 34, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1 }}>{value}</p>
 </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export const IntentOSHome: React.FC = () => {
 const navigate = useNavigate();
 const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
 const [intent, setIntent] = useState('');
 const [execState, setExecState] = useState<ExecutionState>('idle');

 useEffect(() => {
 const styleId = 'chatr-os-home-keyframes';
 if (!document.getElementById(styleId)) {
 const style = document.createElement('style');
 style.id = styleId;
 style.textContent = `
 @keyframes flowDot {
 0%, 100% { opacity: 0.25; transform: scale(0.75); }
 50% { opacity: 1; transform: scale(1.4); }
 }
 @keyframes pulseEmerald {
 0%, 100% { box-shadow: 0 0 20px rgba(52,211,153,0.15); }
 50% { box-shadow: 0 0 50px rgba(52,211,153,0.45), 0 0 100px rgba(52,211,153,0.15); }
 }
 @keyframes pulseIndigo {
 0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.15); }
 50% { box-shadow: 0 0 50px rgba(99,102,241,0.55), 0 0 100px rgba(99,102,241,0.2); }
 }
 @keyframes blink {
 0%, 100% { opacity: 1; }
 50% { opacity: 0.3; }
 }
 @keyframes slideUp {
 from { opacity: 0; transform: translateY(10px); }
 to { opacity: 1; transform: translateY(0); }
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
 setTimeout(() => { setExecState('idle'); }, 7000);
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
 <div style={{
 width: 38, height: 38, borderRadius: 10,
 background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 boxShadow: '0 0 20px rgba(99,102,241,0.5)',
 }}>
 <Zap size={18} color="#fff" />
 </div>
 <div>
 <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1 }}>CHATR Intent OS</p>
 <p style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>v2.4.0 · All systems operational</p>
 </div>
 </div>

 <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#34d399', animation: 'blink 2s ease-in-out infinite' }} />
 <p style={{ color: '#9ca3af', fontSize: 13 }}>Good morning, <span style={{ color: '#f3f4f6', fontWeight: 600 }}>Arshid</span></p>
 </div>
 <button
 onClick={() => navigate('/desktop/studio')}
 style={{
 padding: '8px 18px', borderRadius: 10,
 border: '1px solid #374151', backgroundColor: 'rgba(255,255,255,0.04)',
 color: '#d1d5db', fontSize: 13, fontWeight: 600, cursor: 'pointer',
 display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
 }}
 onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLButtonElement).style.color = '#a5b4fc'; }}
 onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#374151'; (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
 >
 <Layers size={14} />
 Studio Mode
 </button>
 </div>
 </div>

 {/* ── Page Body ── */}
 <div style={{ padding: '32px 32px 56px', maxWidth: 1440, margin: '0 auto' }}>

 {/* KPI Row */}
 <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
 <KpiCard title="Goals Running" value="18" icon={Activity} hexColor="#818cf8" glowRgba="rgba(99,102,241,0.4)" />
 <KpiCard title="Needs Review" value="3" icon={AlertCircle} hexColor="#fbbf24" glowRgba="rgba(251,191,36,0.4)" />
 <KpiCard title="Completed Today" value="143" icon={CheckCircle2} hexColor="#34d399" glowRgba="rgba(52,211,153,0.4)" />
 <KpiCard title="Time Saved" value="31.2 hrs" icon={Clock} hexColor="#c084fc" glowRgba="rgba(192,132,252,0.4)" />
 </div>

 {/* Business Value Banner */}
 <div style={{
 backgroundColor: '#040d08',
 border: '1px solid rgba(52,211,153,0.3)',
 borderRadius: 20, padding: '28px 36px', marginBottom: 24,
 display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 animation: 'pulseEmerald 3.5s ease-in-out infinite',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
 <div style={{
 width: 56, height: 56, borderRadius: 16,
 background: 'linear-gradient(135deg, rgba(52,211,153,0.2) 0%, rgba(16,185,129,0.3) 100%)',
 border: '1px solid rgba(52,211,153,0.4)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 }}>
 <TrendingUp size={26} color="#34d399" />
 </div>
 <div>
 <p style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6, fontWeight: 600 }}>Business Value Generated</p>
 <p style={{ color: '#34d399', fontSize: 46, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
 ₹84,000 <span style={{ fontSize: 18, fontWeight: 500, color: '#6ee7b7' }}>today</span>
 </p>
 </div>
 </div>
 <div style={{ display: 'flex', gap: 40 }}>
 <div style={{ textAlign: 'center' }}>
 <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>Verification Accuracy</p>
 <p style={{ color: '#a7f3d0', fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>99.8%</p>
 <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 6 }}>
 <Shield size={11} color="#34d399" />
 <span style={{ color: '#34d399', fontSize: 11 }}>Cryptographically verified</span>
 </div>
 </div>
 <div style={{ width: 1, backgroundColor: 'rgba(52,211,153,0.15)' }} />
 <div style={{ textAlign: 'center' }}>
 <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>Operator Trust</p>
 <p style={{ color: '#a7f3d0', fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>91%</p>
 <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 6 }}>
 <Star size={11} color="#34d399" />
 <span style={{ color: '#34d399', fontSize: 11 }}>↑ 3% this week</span>
 </div>
 </div>
 </div>
 </div>

 {/* Execution Twin */}
 <div style={{
 backgroundColor: '#0f0f1a', border: '1px solid #1f2937',
 borderRadius: 20, padding: '24px 28px', marginBottom: 24,
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
 <Sparkles size={16} color="#818cf8" />
 <p style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 15 }}>Execution Twin</p>
 <span style={{
 fontSize: 10, color: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)',
 border: '1px solid rgba(52,211,153,0.3)', borderRadius: 20,
 padding: '2px 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1,
 }}>Live</span>
 </div>

 <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 4, gap: 0 }}>
 {PIPELINE_STAGES.map((stage, idx) => {
 const Icon = stage.icon;
 return (
 <React.Fragment key={stage.id}>
 <button
 onClick={() => setActiveStage(stage)}
 style={{
 display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
 padding: '14px 20px', borderRadius: 14, flexShrink: 0,
 border: `1px solid ${stage.glowRgba.replace('0.4', '0.3')}`,
 backgroundColor: stage.glowRgba.replace('0.4', '0.07'),
 cursor: 'pointer', transition: 'all 0.2s',
 boxShadow: `0 0 14px ${stage.glowRgba.replace('0.4', '0.12')}`,
 }}
 onMouseEnter={e => {
 (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 28px ${stage.glowRgba.replace('0.4', '0.45')}`;
 (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
 }}
 onMouseLeave={e => {
 (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 14px ${stage.glowRgba.replace('0.4', '0.12')}`;
 (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
 }}
 >
 <Icon size={18} color={stage.hexColor} />
 <span style={{ color: stage.hexColor, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
 {stage.label}
 </span>
 <span style={{ color: '#4b5563', fontSize: 10, fontFamily: 'monospace' }}>{stage.latency}</span>
 </button>
 {idx < PIPELINE_STAGES.length - 1 && <FlowingDots />}
 </React.Fragment>
 );
 })}
 </div>
 <p style={{ color: '#374151', fontSize: 11, marginTop: 14 }}>
 ↑ Click any stage to inspect latency, evidence, and execution logs
 </p>
 </div>

 {/* Intent Console */}
 <div style={{
 backgroundColor: 'rgba(15,15,26,0.97)',
 border: `1px solid ${execState !== 'idle' ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)'}`,
 borderRadius: 20, padding: '24px 28px', backdropFilter: 'blur(20px)',
 animation: execState !== 'idle' ? 'pulseIndigo 2s ease-in-out infinite' : 'none',
 boxShadow: '0 0 24px rgba(99,102,241,0.08)',
 transition: 'border-color 0.3s',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
 <Terminal size={16} color="#818cf8" />
 <p style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 15 }}>Intent Console</p>
 </div>

 <textarea
 value={intent}
 onChange={e => setIntent(e.target.value)}
 placeholder="What do you want to accomplish? e.g. 'Hire 10 Java developers in Bangalore by Q3'"
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
 onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.55)'; }}
 onBlur={e => { e.target.style.borderColor = '#1f2937'; }}
 onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleExecute(); }}
 />

 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
 <div style={{ minHeight: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
 {execState !== 'idle' ? (
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, animation: 'slideUp 0.3s ease' }}>
 <div style={{
 width: 8, height: 8, borderRadius: '50%',
 backgroundColor: em.color, animation: 'blink 1s ease-in-out infinite',
 }} />
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
 ? 'rgba(99,102,241,0.25)'
 : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
 color: execState !== 'idle' || !intent.trim() ? 'rgba(255,255,255,0.4)' : '#fff',
 fontSize: 14, fontWeight: 700, cursor: execState !== 'idle' || !intent.trim() ? 'not-allowed' : 'pointer',
 display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
 boxShadow: execState === 'idle' && intent.trim() ? '0 0 24px rgba(99,102,241,0.55)' : 'none',
 }}
 >
 <Zap size={15} />
 Execute Intent
 </button>
 </div>
 </div>
 </div>

 {activeStage && <StageTooltip stage={activeStage} onClose={() => setActiveStage(null)} />}
 </div>
 );
};

export default IntentOSHome;
