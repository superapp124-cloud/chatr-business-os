import React, { useEffect, useRef, useState } from 'react';

/**
 * Decision Timeline
 *
 * Shows the kernel's parallel execution pipeline as it happens.
 * Not a debug tool — a trust-building feature.
 * Users see 241ms of invisible work made visible.
 */

export interface TimelineStage {
 id: string;
 ms: number;
 label: string;
 detail?: string;
 parallel?: boolean;
 status: 'pending' | 'active' | 'done';
}

interface DecisionTimelineProps {
 stages: TimelineStage[];
 totalMs?: number;
 visible: boolean;
}

export const DecisionTimeline: React.FC<DecisionTimelineProps> = ({ stages, totalMs, visible }) => {
 const [collapsed, setCollapsed] = useState(false);

 useEffect(() => {
 if (totalMs !== undefined) {
 const t = setTimeout(() => setCollapsed(true), 800);
 return () => clearTimeout(t);
 } else {
 setCollapsed(false);
 }
 }, [totalMs]);

 if (!visible || stages.length === 0) return null;

 return (
 <div className="timeline-wrap" style={{ transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', padding: collapsed ? '16px 24px' : '22px 24px' }}>
 <div className="timeline-header" style={{ marginBottom: collapsed ? 0 : '18px', cursor: totalMs ? 'pointer' : 'default' }} onClick={() => totalMs && setCollapsed(!collapsed)}>
 <span className="timeline-title">
 {collapsed ? `Ready in ${totalMs} ms` : 'Decision Timeline'}
 {collapsed && <span style={{ marginLeft: 8, fontSize: 10, color: '#8b5cf6', textTransform: 'none' }}>▼ View execution details</span>}
 </span>
 {!collapsed && totalMs !== undefined && (
 <span className="timeline-total-badge">{totalMs}ms total</span>
 )}
 </div>

 {!collapsed && stages.map((stage, i) => (
 <div
 key={stage.id}
 className="timeline-stage"
 style={{ animationDelay: `${i * 40}ms` }}
 >
 <span className="timeline-ms">{stage.ms}ms</span>
 <span
 className={`timeline-dot ${stage.status === 'done' ? 'done' : stage.status === 'active' ? 'active' : ''}`}
 />
 <span className="timeline-label">
 <strong>{stage.label}</strong>
 {stage.detail ? ` · ${stage.detail}` : ''}
 </span>
 {stage.parallel && (
 <span className="timeline-badge-parallel">parallel</span>
 )}
 </div>
 ))}
 </div>
 );
};
