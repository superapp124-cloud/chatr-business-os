import React, { useEffect, useState, useCallback } from 'react';
import { TelemetryService } from '../../core/product/telemetry-service';
import { ABTestingService } from '../../core/product/ab-testing-service';
import './dashboard.css';

export const ValidationDashboard: React.FC = () => {
 const [metrics, setMetrics] = useState<any>(null);
 const [abResults, setAbResults] = useState<any>(null);
 const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'friction' | 'ab' | 'nps'>('overview');

 const refresh = useCallback(() => {
 setMetrics(TelemetryService.getMetrics());
 setAbResults(ABTestingService.getResults());
 }, []);

 useEffect(() => {
 refresh();
 const interval = setInterval(refresh, 5000);
 return () => clearInterval(interval);
 }, [refresh]);

 const seedDemo = () => {
 TelemetryService.seedDemoData(42);
 refresh();
 };

 if (!metrics) {
 return (
 <div className="dash-empty">
 <div className="dash-empty-icon">📊</div>
 <div className="dash-empty-title">No telemetry yet</div>
 <div className="dash-empty-sub">Run some executions or seed demo data to view metrics.</div>
 <button className="dash-seed-btn" onClick={seedDemo}>Seed 42 Demo Sessions</button>
 </div>
 );
 }

 const pass = (val: number, target: number, invert = false) =>
 invert ? val <= target : val >= target;

 const Metric = ({ label, value, target, unit = '', invertGood = false }: {
 label: string; value: number | string; target: string; unit?: string; invertGood?: boolean;
 }) => {
 const numVal = typeof value === 'number' ? value : parseFloat(value as string);
 const targetNum = parseFloat(target.replace(/[^0-9.]/g, ''));
 const good = invertGood ? numVal <= targetNum : numVal >= targetNum;
 return (
 <div className="dash-metric-card">
 <div className="dash-metric-label">{label}</div>
 <div className="dash-metric-value" style={{ color: good ? '#34d399' : '#fbbf24' }}>
 {typeof value === 'number' ? Math.round(value) : value}{unit}
 </div>
 <div className="dash-metric-target">Target: {target}</div>
 <div className="dash-metric-status">{good ? '✓ On track' : '⚠ Below target'}</div>
 </div>
 );
 };

 const tabs = ['overview', 'performance', 'friction', 'ab', 'nps'] as const;
 const tabLabels = { overview: 'Overview', performance: 'Performance', friction: 'Friction', ab: 'A/B Test', nps: 'Satisfaction' };

 return (
 <div className="dash-root">
 {/* Header */}
 <div className="dash-header">
 <div>
 <h1 className="dash-title">Validation Dashboard</h1>
 <div className="dash-subtitle">Product Validation Sprint · Live</div>
 </div>
 <div className="dash-header-right">
 <div className="dash-live-badge">● Live</div>
 <button className="dash-seed-btn-sm" onClick={seedDemo}>+ Seed Data</button>
 </div>
 </div>

 {/* Daily Report strip */}
 <div className="dash-daily-strip">
 <div className="dash-daily-item">
 <div className="dash-daily-val">{metrics.daily.users}</div>
 <div className="dash-daily-label">Users Today</div>
 </div>
 <div className="dash-daily-item">
 <div className="dash-daily-val">{metrics.daily.completionRate}%</div>
 <div className="dash-daily-label">Completion</div>
 </div>
 <div className="dash-daily-item">
 <div className="dash-daily-val">{metrics.daily.avgTimeMs}ms</div>
 <div className="dash-daily-label">Avg Time</div>
 </div>
 <div className="dash-daily-item">
 <div className="dash-daily-val" style={{ color: '#34d399' }}>{metrics.npsPositiveRate}%</div>
 <div className="dash-daily-label">Would Reuse CHATR</div>
 </div>
 <div className="dash-daily-item">
 <div className="dash-daily-val">{metrics.totalExecutions}</div>
 <div className="dash-daily-label">Total Sessions</div>
 </div>
 </div>

 {/* Tabs */}
 <div className="dash-tabs">
 {tabs.map(t => (
 <button
 key={t}
 className={`dash-tab ${activeTab === t ? 'active' : ''}`}
 onClick={() => setActiveTab(t)}
 >
 {tabLabels[t]}
 </button>
 ))}
 </div>

 {/* \u2500\u2500 Overview \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
 {activeTab === 'overview' && (
 <div>
 {/* Magic Score — the single sprint KPI */}
 <div style={{
 background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(52,211,153,0.06))',
 border: '1px solid rgba(139,92,246,0.25)', borderRadius: 16,
 padding: '28px 28px 24px', marginBottom: 24,
 display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
 }}>
 <div>
 <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b5cf6', marginBottom: 8 }}>
 Magic Score
 </div>
 <div style={{ fontSize: 64, fontWeight: 800, color: metrics.magicScore >= 70 ? '#34d399' : metrics.magicScore >= 40 ? '#fbbf24' : '#ef4444', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
 {metrics.magicScore.toFixed(1)}
 </div>
 <div style={{ fontSize: 12, color: '#55556a', marginTop: 8 }}>
 Completion × Trust × Would-Use-Again × Recommendation
 </div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div style={{ fontSize: 13, color: '#9898b3', marginBottom: 4 }}>Sprint target</div>
 <div style={{ fontSize: 28, fontWeight: 700, color: '#55556a' }}>≥ 70</div>
 <div style={{ fontSize: 11, color: '#55556a', marginTop: 8 }}>
 {metrics.magicScore >= 70 ? '✓ On track' : '⚠ Below target'}
 </div>
 </div>
 </div>

 {/* The 5 metrics that matter during testing */}
 <div className="dash-section-title">What matters now</div>
 <div className="dash-grid">
 <Metric label="Completion Rate" value={metrics.completionRate} target="95" unit="%" />
 <Metric label="Recommendation Acc." value={metrics.recommendationAcceptance} target="85" unit="%" />
 <Metric label="Avg Experience Score" value={metrics.averageExperienceScore} target="9.0" />
 <Metric label="Would Use Again" value={parseFloat(metrics.npsPositiveRate)} target="80" unit="%" />
 <Metric label="Recovery Success" value={metrics.recoverySuccessRate} target="95" unit="%" />
 </div>
 <div className="dash-section-note">
 During testing rounds, optimize these 5 numbers and Magic Score — not latency percentiles.
 P50/P90/P95 data is available in the Performance tab when needed.
 </div>
 </div>
 )}

 {/* ── Performance ──────────────────────────────────────────────────────── */}
 {activeTab === 'performance' && (
 <div>
 {/* Time to Confidence — the #1 UX metric */}
 <div className="dash-confidence-block">
 <div className="dash-confidence-header">
 <div>
 <div className="dash-section-title" style={{ marginBottom: 4 }}>Time to Confidence</div>
 <div style={{ fontSize: 12, color: '#55556a', lineHeight: 1.5 }}>
 How long from results appearing until the user taps a card.<br/>
 If &gt;5s consistently, the recommendation UI needs redesign.
 </div>
 </div>
 <div className="dash-confidence-target">Target: &lt;5 s</div>
 </div>
 <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
 <div className="dash-metric-card" style={{ flex: 1 }}>
 <div className="dash-metric-label">Avg Confidence Time</div>
 <div className="dash-metric-value" style={{ color: metrics.avgConfidenceMs !== null && metrics.avgConfidenceMs < 5000 ? '#34d399' : '#fbbf24' }}>
 {metrics.avgConfidenceMs !== null ? (metrics.avgConfidenceMs / 1000).toFixed(1) + 's' : '—'}
 </div>
 <div className="dash-metric-target">Target: &lt;5 s</div>
 </div>
 <div className="dash-metric-card" style={{ flex: 1 }}>
 <div className="dash-metric-label">P90 Confidence Time</div>
 <div className="dash-metric-value" style={{ color: metrics.p90ConfidenceMs !== null && metrics.p90ConfidenceMs < 5000 ? '#34d399' : '#ef4444' }}>
 {metrics.p90ConfidenceMs !== null ? (metrics.p90ConfidenceMs / 1000).toFixed(1) + 's' : '—'}
 </div>
 <div className="dash-metric-target">1 in 10 users is slower than this</div>
 </div>
 <div className="dash-metric-card" style={{ flex: 1 }}>
 <div className="dash-metric-label">Samples</div>
 <div className="dash-metric-value" style={{ color: '#9898b3' }}>{metrics.confidenceSamples}</div>
 <div className="dash-metric-target">Completed sessions</div>
 </div>
 </div>
 </div>

 <div className="dash-section-title" style={{ marginTop: 28 }}>End-to-End Latency Distribution</div>
 <div className="dash-grid">
 <Metric label="P50 (Median)" value={metrics.p50Ms} target="500" unit="ms" invertGood />
 <Metric label="P90" value={metrics.p90Ms} target="800" unit="ms" invertGood />
 <Metric label="P95" value={metrics.p95Ms} target="1000" unit="ms" invertGood />
 <Metric label="Worst Run" value={metrics.worstMs} target="2000" unit="ms" invertGood />
 <Metric label="Best Run" value={metrics.bestMs} target="0" unit="ms" />
 </div>
 <div className="dash-section-note">
 One slow experience matters more than ten fast ones. P95 is the key production target.
 </div>
 </div>
 )}

 {/* ── Friction Heatmap ─────────────────────────────────────────────────── */}
 {activeTab === 'friction' && (
 <div>
 <div className="dash-section-title">Abandonment by Step</div>
 <div className="dash-friction-table">
 <div className="dash-friction-header">
 <span>Step</span>
 <span>Abandonments</span>
 <span>Rate</span>
 <span>Priority</span>
 </div>
 {(metrics.frictionHeatmap as any[]).map((row: any) => {
 const rate = parseFloat(row.rate);
 const priority = rate > 10 ? 'HIGH' : rate > 3 ? 'MEDIUM' : 'LOW';
 const color = rate > 10 ? '#ef4444' : rate > 3 ? '#fbbf24' : '#34d399';
 return (
 <div key={row.step} className="dash-friction-row">
 <span className="dash-friction-step">{row.step}</span>
 <span>{row.abandoned}</span>
 <span style={{ color, fontWeight: 700 }}>{row.rate}</span>
 <span className="dash-friction-badge" style={{ background: color + '20', color }}>
 {priority}
 </span>
 </div>
 );
 })}
 </div>
 <div className="dash-section-note">Fix the highest abandonment step first. Checkout consistently needs the most attention across user bases.</div>
 </div>
 )}

 {/* ── A/B Test ─────────────────────────────────────────────────────────── */}
 {activeTab === 'ab' && (
 <div>
 <div className="dash-section-title">Recommendation Card Variants</div>
 <div className="dash-ab-grid">
 <div className="dash-ab-card">
 <div className="dash-ab-label">Variant A</div>
 <div className="dash-ab-preview">
 <div className="ab-preview-badge">Recommended</div>
 <div className="ab-preview-name">Paradise</div>
 </div>
 {abResults?.A ? (
 <>
 <div className="dash-ab-stat">
 <span>Acceptance Rate</span>
 <span style={{ color: '#34d399', fontWeight: 700 }}>{abResults.A.acceptanceRate.toFixed(1)}%</span>
 </div>
 <div className="dash-ab-stat">
 <span>Avg Time to Select</span>
 <span>{Math.round(abResults.A.avgTimeMs)}ms</span>
 </div>
 <div className="dash-ab-count">{abResults.A.count} sessions</div>
 </>
 ) : <div className="dash-ab-empty">No data yet</div>}
 </div>
 <div className="dash-ab-card">
 <div className="dash-ab-label">Variant B</div>
 <div className="dash-ab-preview">
 <div className="ab-preview-badge">Recommended because</div>
 <div className="ab-preview-reasons">
 <div>✓ ₹40 cheaper</div>
 <div>✓ 4.7★ rating</div>
 <div>✓ Faster delivery</div>
 </div>
 </div>
 {abResults?.B ? (
 <>
 <div className="dash-ab-stat">
 <span>Acceptance Rate</span>
 <span style={{ color: '#34d399', fontWeight: 700 }}>{abResults.B.acceptanceRate.toFixed(1)}%</span>
 </div>
 <div className="dash-ab-stat">
 <span>Avg Time to Select</span>
 <span>{Math.round(abResults.B.avgTimeMs)}ms</span>
 </div>
 <div className="dash-ab-count">{abResults.B.count} sessions</div>
 </>
 ) : <div className="dash-ab-empty">No data yet</div>}
 </div>
 </div>
 </div>
 )}

 {/* ── NPS / Satisfaction ────────────────────────────────────────────────── */}
 {activeTab === 'nps' && (
 <div>
 <div className="dash-section-title">Would you use CHATR instead of the native app next time?</div>
 <div className="dash-nps-big">
 <div className="dash-nps-score">{metrics.npsPositiveRate}%</div>
 <div className="dash-nps-label">Definitely + Probably</div>
 <div className={`dash-nps-verdict ${parseFloat(metrics.npsPositiveRate) >= 80 ? 'good' : 'warn'}`}>
 {parseFloat(metrics.npsPositiveRate) >= 80 ? '✓ Target achieved' : '⚠ Target: ≥80%'}
 </div>
 </div>
 <div className="dash-nps-breakdown">
 {(['definitely', 'probably', 'maybe', 'no'] as const).map(key => {
 const n = metrics.npsBreakdown[key];
 const pct = metrics.totalExecutions ? ((n / metrics.totalExecutions) * 100).toFixed(1) : '0';
 const colors = { definitely: '#34d399', probably: '#8b5cf6', maybe: '#fbbf24', no: '#ef4444' };
 return (
 <div key={key} className="dash-nps-row">
 <span className="dash-nps-option" style={{ color: colors[key] }}>
 {key.charAt(0).toUpperCase() + key.slice(1)}
 </span>
 <div className="dash-nps-bar-wrap">
 <div className="dash-nps-bar" style={{ width: pct + '%', background: colors[key] }} />
 </div>
 <span className="dash-nps-pct">{pct}%</span>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 );
};
