import React, { useEffect, useState, useContext } from 'react';
import { KernelContext } from '../../providers/KernelProvider';
import { CapabilityPack } from '../models';
import styles from './MarketplaceLayout.module.css';
import { PresentationEventBus } from '../../events/PresentationEventBus';

export const WorkspaceDashboard: React.FC = () => {
 const context = useContext(KernelContext);
 const [installedPacks, setInstalledPacks] = useState<CapabilityPack[]>([]);

 const loadInstalledPacks = () => {
 if (context) {
 context.marketplaceRepository.getCapabilityPacks().then(allPacks => {
 setInstalledPacks(allPacks.filter(p => p.status === 'Installed'));
 });
 }
 };

 useEffect(() => {
 loadInstalledPacks();

 if (context) {
 const unsub = context.eventBus.subscribe('CapabilityInstalled', () => {
 loadInstalledPacks();
 });
 return () => unsub();
 }
 }, [context]);

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <h1>My Workspace</h1>
 <p>Manage your installed capabilities and active solutions.</p>
 </header>

 <section className={styles.section}>
 <h3>Installed Solutions</h3>
 {installedPacks.length === 0 ? (
 <div className={styles.glassCard} style={{ textAlign: 'center', padding: '3rem' }}>
 <p style={{ color: '#64748b' }}>No capabilities installed yet. Head to the Marketplace to discover new solutions.</p>
 </div>
 ) : (
 <div className={styles.grid}>
 {installedPacks.map(pack => (
 <div key={pack.id} className={styles.glassCard}>
 <h4 style={{ marginBottom: '0.5rem' }}>{pack.name}</h4>
 <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>v{pack.version} • {pack.category}</p>
 <div style={{ display: 'flex', gap: '0.5rem' }}>
 <button className={styles.button} style={{ background: '#f1f5f9', color: '#0f172a' }}>Configure</button>
 <button className={styles.button} style={{ background: '#ef4444' }}>Uninstall</button>
 </div>
 </div>
 ))}
 </div>
 )}
 </section>
 </div>
 );
};
