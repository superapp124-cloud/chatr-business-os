import React, { useState, useEffect, useContext } from 'react';
import { KernelContext } from '../../providers/KernelProvider';
import { Settings, Cpu, Layers, GitMerge, FileCode, CheckCircle, AlertTriangle, Shield, Archive, HardDrive } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const CapabilityRuntimeView: React.FC = () => {
 const context = useContext(KernelContext);
 const [activeTab, setActiveTab] = useState('Installed Packs');
 const [loading, setLoading] = useState(true);
 const [installedPacks, setInstalledPacks] = useState<any[]>([]);

 const TABS = ['Installed Packs', 'Dependency Graph', 'Compiler', 'Registry', 'Updates'];

 useEffect(() => {
 if (!context) return;
 const fetchPacks = async () => {
 setLoading(true);
 // Simulate fetching installed capability packs for the runtime
 const packs = await context.marketplaceRepository.getCapabilityPacks();
 // Assume about 5 are installed for mock purposes, but we would filter by 'Installed' status
 setInstalledPacks(packs.slice(0, 5).map(p => ({ ...p, status: 'Active', health: 'Healthy', version: '1.4.2' })));
 setLoading(false);
 };
 fetchPacks();
 }, [context]);

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <Settings size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Capability Runtime</h1>
 </div>
 <p>Monitor capability compilation, dependency resolution, and active runtime states.</p>
 </header>

 {/* Overview Cards */}
 <div className={styles.grid} style={{ marginBottom: '2rem' }}>
 <div className={styles.glassCard} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
 <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '12px', color: '#10b981' }}>
 <CheckCircle size={24} />
 </div>
 <div>
 <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Runtime State</div>
 <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>Healthy</div>
 </div>
 </div>
 <div className={styles.glassCard} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
 <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '0.75rem', borderRadius: '12px', color: '#8b5cf6' }}>
 <Layers size={24} />
 </div>
 <div>
 <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Packs</div>
 <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>{installedPacks.length}</div>
 </div>
 </div>
 <div className={styles.glassCard} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
 <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '12px', color: '#3b82f6' }}>
 <GitMerge size={24} />
 </div>
 <div>
 <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dependencies</div>
 <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>Fully Resolved</div>
 </div>
 </div>
 <div className={styles.glassCard} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
 <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px', color: '#ef4444' }}>
 <AlertTriangle size={24} />
 </div>
 <div>
 <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed Installs</div>
 <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>0</div>
 </div>
 </div>
 </div>

 {/* Tabs */}
 <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', overflowX: 'auto' }}>
 {TABS.map(tab => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 style={{
 background: 'none',
 border: 'none',
 color: activeTab === tab ? '#8b5cf6' : '#94a3b8',
 padding: '0.5rem 0',
 fontSize: '1rem',
 fontWeight: activeTab === tab ? 'bold' : 'normal',
 borderBottom: activeTab === tab ? '2px solid #8b5cf6' : '2px solid transparent',
 cursor: 'pointer',
 whiteSpace: 'nowrap',
 transition: 'all 0.2s'
 }}
 >
 {tab}
 </button>
 ))}
 </div>

 {loading ? (
 <div style={{ textAlign: 'center', padding: '4rem', color: '#8b5cf6' }}>
 <Cpu size={48} className={styles.spin} style={{ margin: '0 auto 1rem' }} />
 <p>Querying Runtime Kernel...</p>
 </div>
 ) : (
 <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
 {activeTab === 'Installed Packs' && (
 <div className={styles.glassCard} style={{ padding: 0, overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
 <thead>
 <tr style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
 <th style={{ padding: '1rem' }}>Capability Pack</th>
 <th style={{ padding: '1rem' }}>Category</th>
 <th style={{ padding: '1rem', textAlign: 'center' }}>Version</th>
 <th style={{ padding: '1rem', textAlign: 'center' }}>State</th>
 <th style={{ padding: '1rem', textAlign: 'center' }}>Health</th>
 </tr>
 </thead>
 <tbody>
 {installedPacks.map(pack => (
 <tr key={pack.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
 <td style={{ padding: '1rem' }}>
 <div style={{ fontWeight: '500', color: 'white' }}>{pack.name}</div>
 <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{pack.id}</div>
 </td>
 <td style={{ padding: '1rem', color: '#e2e8f0' }}>{pack.category}</td>
 <td style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>v{pack.version}</td>
 <td style={{ padding: '1rem', textAlign: 'center' }}>
 <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}>{pack.status}</span>
 </td>
 <td style={{ padding: '1rem', textAlign: 'center', color: '#10b981' }}>
 100%
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {activeTab === 'Dependency Graph' && (
 <div className={styles.glassCard} style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
 <GitMerge size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
 <h3>Dependency Resolution Tree</h3>
 <p>Visual mapping of active dependencies across {installedPacks.length} packs.</p>
 </div>
 )}

 {activeTab === 'Compiler' && (
 <div className={styles.glassCard} style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
 <FileCode size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
 <h3>JIT Compiler Output</h3>
 <p>Logs and object allocations for the latest capability installations.</p>
 </div>
 )}

 {(activeTab === 'Registry' || activeTab === 'Updates') && (
 <div className={styles.glassCard} style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
 <Archive size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
 <h3>{activeTab}</h3>
 <p>Connecting to CHATR global capability registry...</p>
 </div>
 )}
 </div>
 )}
 </div>
 );
};
