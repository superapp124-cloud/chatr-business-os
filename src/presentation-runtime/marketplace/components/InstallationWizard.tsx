import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { KernelContext } from '../../providers/KernelProvider';
import { IndustryTemplate, CapabilityPack } from '../models';
import { InstallStatus } from '../runtime/CapabilityRuntime';
import { CheckCircle2, ChevronRight, Server, Box, Activity } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const InstallationWizard: React.FC = () => {
 const { type, id } = useParams<{ type: string; id: string }>();
 const navigate = useNavigate();
 const context = useContext(KernelContext);
 
 const [template, setTemplate] = useState<IndustryTemplate | null>(null);
 const [packs, setPacks] = useState<CapabilityPack[]>([]);
 const [isInstalling, setIsInstalling] = useState(false);
 
 // Live Telemetry State
 const [status, setStatus] = useState<InstallStatus | null>(null);

 useEffect(() => {
 if (context && type === 'template' && id) {
 context.marketplaceRepository.getTemplateById(id).then(setTemplate);
 context.marketplaceRepository.getCapabilityPacks().then(setPacks);
 
 // Subscribe to live installation telemetry
 const unsub = context.eventBus.subscribe('InstallProgressEvent', (event: any) => {
 if (event.payload.packId === id || event.payload.templateId === id) {
 setStatus(event.payload);
 }
 });
 
 return unsub;
 }
 }, [context, type, id]);

 if (!template) return <div className={styles.page}>Loading Wizard...</div>;

 const templatePacks = template.packs.map(pid => packs.find(p => p.id === pid)).filter(Boolean) as CapabilityPack[];

 const handleInstall = async () => {
 setIsInstalling(true);
 if (context && id) {
 // Trigger background installation which emits events via CapabilityRuntime
 context.marketplaceRepository.installTemplate(id).catch(console.error);
 }
 };

 return (
 <div className={styles.page}>
 <div className={styles.panel} style={{ maxWidth: '800px', margin: '2rem auto' }}>
 <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
 <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Installing {template.name}</h2>
 <p className="text-slate-400">{template.description}</p>
 </div>

 {!isInstalling ? (
 <div>
 <div style={{ marginBottom: '2rem' }}>
 <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Capabilities to be provisioned</h3>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
 {templatePacks.map(p => (
 <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-base)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
 <Box className="text-indigo-400" size={20} />
 <div style={{ flex: 1 }}>
 <div style={{ fontWeight: 600 }}>{p.name}</div>
 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.description}</div>
 </div>
 </div>
 ))}
 </div>
 </div>
 
 <button 
 onClick={handleInstall} 
 className={styles.button} 
 style={{ width: '100%', padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
 >
 Begin Installation
 </button>
 </div>
 ) : (
 <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '2rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
 <Activity className="text-indigo-400 animate-pulse" size={24} />
 <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{status?.state === 'SUCCESS' ? 'Installation Complete' : 'System Provisioning...'}</span>
 </div>
 <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>{status?.progress || 0}%</div>
 </div>
 
 {/* Progress Bar */}
 <div style={{ height: '8px', background: 'var(--bg-surface-hover)', borderRadius: '4px', overflow: 'hidden', marginBottom: '2rem' }}>
 <div style={{ height: '100%', background: 'var(--primary)', width: `${status?.progress || 0}%`, transition: 'width 0.3s ease' }} />
 </div>

 {/* Live Logs */}
 <div style={{ background: '#000', padding: '1rem', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem', color: '#10b981', height: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
 {status?.logs?.map((log, i) => (
 <div key={i} style={{ opacity: i === status.logs.length - 1 ? 1 : 0.6 }}>
 <span style={{ color: '#64748b', marginRight: '0.5rem' }}>[{new Date().toLocaleTimeString()}]</span>
 {log}
 </div>
 ))}
 {status?.state !== 'SUCCESS' && (
 <div className="animate-pulse">_</div>
 )}
 </div>

 {status?.state === 'SUCCESS' && (
 <button 
 onClick={() => navigate('/enterprise/workspace')} 
 style={{ width: '100%', padding: '1rem', background: 'var(--success)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer', marginTop: '2rem' }}
 >
 Go to Workspace IDE
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 );
};
