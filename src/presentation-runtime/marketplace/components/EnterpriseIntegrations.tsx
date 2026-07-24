import React from 'react';
import { Cable, Cloud, RefreshCw, CheckCircle, AlertTriangle, Settings2, Github, Slack, Database, Mail } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const EnterpriseIntegrations: React.FC = () => {
 const INTEGRATIONS = [
 {
 id: 'github',
 name: 'GitHub Enterprise',
 icon: <Github size={24} />,
 status: 'Connected',
 lastSync: '2 minutes ago',
 version: 'v4.1',
 versionOk: true,
 health: 'Healthy'
 },
 {
 id: 'salesforce',
 name: 'Salesforce CRM',
 icon: <Cloud size={24} />,
 status: 'Connected',
 lastSync: '5 minutes ago',
 version: 'v2.8',
 versionOk: true,
 health: 'Healthy'
 },
 {
 id: 'workday',
 name: 'Workday HCM',
 icon: <Database size={24} />,
 status: 'Sync Error',
 lastSync: '2 hours ago',
 version: 'v1.1',
 versionOk: false,
 health: 'Degraded'
 },
 {
 id: 'slack',
 name: 'Slack Workspace',
 icon: <Slack size={24} />,
 status: 'Connected',
 lastSync: 'Just now',
 version: 'v3.0',
 versionOk: true,
 health: 'Healthy'
 },
 {
 id: 'exchange',
 name: 'Exchange Server',
 icon: <Mail size={24} />,
 status: 'Disconnected',
 lastSync: 'Never',
 version: '-',
 versionOk: null,
 health: 'Offline'
 }
 ];

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <Cable size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Integrations</h1>
 </div>
 <p>Monitor connection health, synchronization queues, and third-party API gateways.</p>
 </header>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', animation: 'fadeIn 0.4s ease-out' }}>
 {INTEGRATIONS.map(integration => (
 <div key={integration.id} className={styles.glassCard} style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
 <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '12px', color: '#e2e8f0' }}>
 {integration.icon}
 </div>
 <div>
 <h3 style={{ margin: '0 0 0.25rem 0' }}>{integration.name}</h3>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: integration.health === 'Healthy' ? '#10b981' : integration.health === 'Degraded' ? '#f59e0b' : '#64748b' }}>
 {integration.health === 'Healthy' && <CheckCircle size={14} />}
 {integration.health === 'Degraded' && <AlertTriangle size={14} />}
 {integration.health === 'Offline' && <Cloud size={14} />}
 {integration.status}
 </div>
 </div>
 </div>
 <button style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
 <Settings2 size={18} />
 </button>
 </div>

 <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(255,255,255,0.02)' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
 <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Last Sync</span>
 <span style={{ fontSize: '0.85rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
 <RefreshCw size={12} /> {integration.lastSync}
 </span>
 </div>
 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
 <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>API Version</span>
 <span style={{ fontSize: '0.85rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
 {integration.versionOk === true && <CheckCircle size={12} color="#10b981" />}
 {integration.versionOk === false && <AlertTriangle size={12} color="#f59e0b" />}
 {integration.version}
 </span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
};
