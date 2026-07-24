import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, Sliders, Bell, Cloud, Database, Cpu, Lock, Hexagon, Store, Zap, HelpCircle, Save } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const WorkspaceSettings: React.FC = () => {
 const [activeTab, setActiveTab] = useState('General');

 const MENU_SECTIONS = [
 { label: 'Platform', items: ['General', 'Organization', 'Branding'] },
 { label: 'Access', items: ['Users', 'Security', 'Policies'] },
 { label: 'System', items: ['AI', 'Notifications', 'Marketplace', 'Capability Runtime', 'Sync'] },
 { label: 'Advanced', items: ['Developer', 'About'] }
 ];

 const getIcon = (item: string) => {
 switch(item) {
 case 'General': return <SettingsIcon size={16} />;
 case 'Organization': return <Shield size={16} />;
 case 'Security': return <Lock size={16} />;
 case 'AI': return <Cpu size={16} />;
 case 'Sync': return <Cloud size={16} />;
 case 'Developer': return <Hexagon size={16} />;
 case 'Marketplace': return <Store size={16} />;
 case 'Capability Runtime': return <Zap size={16} />;
 case 'Notifications': return <Bell size={16} />;
 default: return <Sliders size={16} />;
 }
 };

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <SettingsIcon size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Enterprise Settings</h1>
 </div>
 <p>Configure workspace behaviors, security boundaries, and ecosystem defaults.</p>
 </header>

 <div style={{ display: 'flex', gap: '2rem', minHeight: '600px' }}>
 {/* Left Sidebar Menu */}
 <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
 {MENU_SECTIONS.map(section => (
 <div key={section.label}>
 <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem', paddingLeft: '0.75rem' }}>
 {section.label}
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
 {section.items.map(item => (
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
 ))}
 </div>

 {/* Right Content Pane */}
 <div style={{ flex: 1 }}>
 <div className={styles.glassCard} style={{ padding: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
 
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
 <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
 {getIcon(activeTab)} {activeTab}
 </h2>
 <button className={styles.button} style={{ background: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
 <Save size={16} /> Save Changes
 </button>
 </div>

 {activeTab === 'General' && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
 <div>
 <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Workspace Name</label>
 <input type="text" defaultValue="Acme Healthcare Default" style={{ width: '100%', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '6px', color: 'white', outline: 'none' }} />
 </div>
 <div>
 <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Primary Domain</label>
 <input type="text" defaultValue="acmehealth.chatr.os" style={{ width: '100%', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '6px', color: 'white', outline: 'none' }} />
 </div>
 <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px' }}>
 <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0' }}>Danger Zone</h4>
 <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>Permanently delete this workspace and all localized data.</p>
 <button style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Delete Workspace</button>
 </div>
 </div>
 )}

 {activeTab !== 'General' && (
 <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
 <Sliders size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
 <h3>Configure {activeTab}</h3>
 <p>Use the metadata schema engine to render these dynamic settings.</p>
 </div>
 )}

 </div>
 </div>
 </div>
 </div>
 );
};
