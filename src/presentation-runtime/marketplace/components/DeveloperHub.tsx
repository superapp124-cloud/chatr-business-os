import React, { useState } from 'react';
import { Hexagon, Terminal, Box, SearchCode, Database, Code, Activity, Wrench, Lock } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const DeveloperHub: React.FC = () => {
 const [activeTab, setActiveTab] = useState('Overview');

 const MENU = ['Overview', 'Capability Packs', 'Templates', 'Compiler', 'Validator', 'Registry', 'SDK', 'API Explorer', 'Logs'];

 const getIcon = (item: string) => {
 switch(item) {
 case 'Capability Packs': return <Box size={16} />;
 case 'Templates': return <SearchCode size={16} />;
 case 'Compiler': return <Terminal size={16} />;
 case 'Validator': return <ShieldCheck size={16} />;
 case 'Registry': return <Database size={16} />;
 case 'SDK': return <Code size={16} />;
 case 'API Explorer': return <Activity size={16} />;
 case 'Logs': return <Wrench size={16} />;
 default: return <Hexagon size={16} />;
 }
 };
 
 // Dummy shield check component
 const ShieldCheck = ({size}: {size:number}) => (
 <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
 );

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <Hexagon size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Developer Hub</h1>
 </div>
 <p>Internal tools for building, validating, and publishing CHATR OS Capability Packs.</p>
 </header>

 <div style={{ display: 'flex', gap: '2rem', minHeight: '600px' }}>
 {/* Left Sidebar Menu */}
 <div style={{ width: '200px', flexShrink: 0 }}>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
 {MENU.map(item => (
 <button
 key={item}
 onClick={() => setActiveTab(item)}
 style={{
 display: 'flex',
 alignItems: 'center',
 gap: '0.75rem',
 width: '100%',
 background: activeTab === item ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
 border: 'none',
 color: activeTab === item ? '#c4b5fd' : '#94a3b8',
 padding: '0.6rem 0.75rem',
 borderRadius: '6px',
 cursor: 'pointer',
 textAlign: 'left',
 fontSize: '0.9rem',
 transition: 'all 0.2s',
 fontWeight: activeTab === item ? '500' : 'normal'
 }}
 onMouseOver={e => { if (activeTab !== item) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
 onMouseOut={e => { if (activeTab !== item) e.currentTarget.style.background = 'transparent' }}
 >
 {getIcon(item)} {item}
 </button>
 ))}
 </div>
 </div>

 {/* Right Content Pane */}
 <div style={{ flex: 1 }}>
 <div className={styles.glassCard} style={{ padding: '2rem', height: '100%', animation: 'fadeIn 0.3s ease-out' }}>
 <h2 style={{ margin: '0 0 2rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
 {getIcon(activeTab)} {activeTab}
 </h2>

 {activeTab === 'Overview' && (
 <div className={styles.grid}>
 <div className={styles.glassCard} style={{ background: 'rgba(15,23,42,0.4)', borderColor: 'rgba(255,255,255,0.05)' }}>
 <h3 style={{ margin: '0 0 1rem 0' }}>Build</h3>
 <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Use the local SDK to author Capability Packs. Define metadata schemas, custom UI schemas, and serverless workflows.</p>
 </div>
 <div className={styles.glassCard} style={{ background: 'rgba(15,23,42,0.4)', borderColor: 'rgba(255,255,255,0.05)' }}>
 <h3 style={{ margin: '0 0 1rem 0' }}>Validate</h3>
 <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Run the strict JSON schema validator to ensure your definitions meet the CHATR OS enterprise standard.</p>
 </div>
 <div className={styles.glassCard} style={{ background: 'rgba(15,23,42,0.4)', borderColor: 'rgba(255,255,255,0.05)' }}>
 <h3 style={{ margin: '0 0 1rem 0' }}>Publish</h3>
 <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Push your compiled packs to the global registry to make them available across all organizations.</p>
 </div>
 </div>
 )}

 {activeTab !== 'Overview' && (
 <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
 <Lock size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
 <h3>Developer Environment Required</h3>
 <p>This module requires the `chatr-cli` tools to be running locally.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};
