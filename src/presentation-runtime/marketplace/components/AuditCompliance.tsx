import React, { useState } from 'react';
import { Shield, Search, Filter, Calendar, User, Activity, AlertTriangle, Layers, Building, Briefcase, ChevronDown } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const AuditCompliance: React.FC = () => {
 const [searchQuery, setSearchQuery] = useState('');

 const LOGS = [
 { time: '09:25 AM', action: 'CRM Suite Activated', user: 'System', capability: 'core.crm', severity: 'Info' },
 { time: '09:19 AM', action: 'User Added to Platform Ops', user: 'Administrator', capability: 'core.identity', severity: 'Info' },
 { time: '09:17 AM', action: 'Workflow Trigger Updated', user: 'Administrator', capability: 'core.workflow', severity: 'Warning' },
 { time: '09:15 AM', action: 'Recruitment Suite Installed', user: 'Administrator', capability: 'hr.recruiting', severity: 'Info' },
 { time: '08:45 AM', action: 'Failed to resolve dependency for EHR', user: 'System', capability: 'health.ehr', severity: 'Critical' },
 { time: '08:30 AM', action: 'Workspace Backup Completed', user: 'System', capability: 'core.storage', severity: 'Info' },
 ];

 const getSeverityColor = (sev: string) => {
 switch(sev) {
 case 'Critical': return '#ef4444';
 case 'Warning': return '#f59e0b';
 default: return '#10b981';
 }
 };

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <Shield size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Audit & Compliance</h1>
 </div>
 <p>Immutable enterprise timeline for all organizational and runtime events.</p>
 </header>

 {/* Advanced Filters */}
 <div className={styles.glassCard} style={{ padding: '1.5rem', marginBottom: '2rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
 <div style={{ flex: 1, position: 'relative' }}>
 <Search size={18} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
 <input
 type="text"
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 placeholder="Search audit trails..."
 style={{
 width: '100%',
 background: 'rgba(15, 23, 42, 0.4)',
 border: '1px solid rgba(255, 255, 255, 0.1)',
 padding: '0.75rem 1rem 0.75rem 2.5rem',
 borderRadius: '8px',
 color: 'white',
 outline: 'none'
 }}
 />
 </div>
 <button className={styles.button} style={{ background: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
 Export CSV
 </button>
 </div>

 <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
 {[
 { icon: <Calendar size={14} />, label: 'Date: Last 24 Hours' },
 { icon: <User size={14} />, label: 'User: All' },
 { icon: <Layers size={14} />, label: 'Capability: All' },
 { icon: <Activity size={14} />, label: 'Action: All' },
 { icon: <AlertTriangle size={14} />, label: 'Severity: All' },
 { icon: <Building size={14} />, label: 'Organization: Acme Health' },
 { icon: <Briefcase size={14} />, label: 'Workspace: Default' },
 ].map((filter, i) => (
 <button key={i} style={{ 
 background: 'rgba(30, 41, 59, 0.5)', 
 border: '1px solid rgba(255,255,255,0.05)', 
 color: '#e2e8f0', 
 padding: '0.4rem 0.75rem', 
 borderRadius: '6px', 
 fontSize: '0.8rem',
 display: 'flex',
 alignItems: 'center',
 gap: '0.4rem',
 cursor: 'pointer'
 }}>
 {filter.icon} {filter.label} <ChevronDown size={12} style={{ opacity: 0.5, marginLeft: '0.2rem' }} />
 </button>
 ))}
 </div>
 </div>

 {/* Timeline */}
 <div className={styles.glassCard} style={{ padding: '2rem' }}>
 <h3 style={{ marginBottom: '2rem', color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline (Today)</h3>
 
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
 {LOGS.map((log, i) => (
 <div key={i} style={{ display: 'flex', gap: '1.5rem', position: 'relative', paddingBottom: i === LOGS.length - 1 ? '0' : '2rem' }}>
 {/* Timeline line */}
 {i !== LOGS.length - 1 && (
 <div style={{ position: 'absolute', left: '71px', top: '24px', bottom: '0', width: '2px', background: 'rgba(255,255,255,0.05)' }} />
 )}
 
 <div style={{ width: '60px', color: '#64748b', fontSize: '0.85rem', paddingTop: '0.2rem', textAlign: 'right' }}>
 {log.time.split(' ')[0]}
 </div>
 
 {/* Dot */}
 <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getSeverityColor(log.severity), marginTop: '0.4rem', position: 'relative', zIndex: 1, boxShadow: `0 0 0 4px rgba(15,23,42,1)` }} />
 
 <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
 <div style={{ fontWeight: '500', color: 'white' }}>{log.action}</div>
 <div style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '12px', background: `${getSeverityColor(log.severity)}22`, color: getSeverityColor(log.severity) }}>
 {log.severity}
 </div>
 </div>
 
 <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><User size={12} /> {log.user}</div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Layers size={12} /> {log.capability}</div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
};
