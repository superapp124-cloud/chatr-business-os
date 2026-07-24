import React, { useEffect, useState, useContext } from 'react';
import { 
 Server, Activity, Users, MoreVertical, Search, 
 ArrowRight, ShieldCheck, DownloadCloud, CheckCircle2 
} from 'lucide-react';
import styles from './MarketplaceLayout.module.css';
import { KernelContext } from '../../providers/KernelProvider';
import { CapabilityPack, Industry, IndustryTemplate } from '../models';

export const HomeDashboard: React.FC = () => {
 const context = useContext(KernelContext);
 const [industries, setIndustries] = useState<Industry[]>([]);
 const [packs, setPacks] = useState<CapabilityPack[]>([]);
 
 // AI State
 const [aiQuery, setAiQuery] = useState('');
 const [isAiThinking, setIsAiThinking] = useState(false);
 const [recommendation, setRecommendation] = useState<{template: IndustryTemplate, packs: CapabilityPack[]} | null>(null);

 useEffect(() => {
 if (context) {
 context.marketplaceRepository.getIndustries().then(setIndustries);
 context.marketplaceRepository.getCapabilityPacks().then(setPacks);
 }
 }, [context]);

 // Trigger Command Palette (Ctrl+K)
 const openCommandPalette = () => {
 const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
 window.dispatchEvent(event);
 };

 const handleAiQuery = async (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && aiQuery.trim() && context) {
 setIsAiThinking(true);
 setRecommendation(null);
 
 // Simulate AI intent parsing and search
 await new Promise(resolve => setTimeout(resolve, 1500));
 
 const res = await context.marketplaceRepository.search(aiQuery);
 if (res.templates.length > 0) {
 const template = res.templates[0];
 const templatePacks = template.packs.map(pid => packs.find(p => p.id === pid)).filter(Boolean) as CapabilityPack[];
 setRecommendation({ template, packs: templatePacks });
 }
 setIsAiThinking(false);
 }
 };

 return (
 <div className={styles.page}>
 {/* Hero Section */}
 <div className={styles.hero}>
 <div className={styles.heroContent}>
 <div className="text-secondary font-semibold tracking-wide text-indigo-400 mb-2 uppercase">
 Ask Executive AI
 </div>
 <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>What do you want to build?</h1>
 
 <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
 <input 
 type="text" 
 value={aiQuery}
 onChange={e => setAiQuery(e.target.value)}
 onKeyDown={handleAiQuery}
 placeholder="e.g., I need a hospital system..." 
 style={{
 width: '100%', padding: '1rem 1.5rem', paddingRight: '4rem',
 borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-focus)',
 background: 'rgba(255, 255, 255, 0.05)', color: 'white',
 fontSize: '1.1rem', outline: 'none',
 boxShadow: '0 0 20px rgba(91, 108, 255, 0.2)'
 }}
 />
 {isAiThinking && (
 <Activity className="animate-spin text-indigo-400" size={20} style={{ position: 'absolute', right: '1.5rem', top: '1.1rem' }} />
 )}
 </div>
 
 <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
 <span className="text-label text-slate-400">Or use standard search:</span>
 <div className={styles.searchTrigger} onClick={openCommandPalette} style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
 <Search size={14} />
 <span>Cmd + K</span>
 </div>
 </div>
 </div>
 
 <div className={styles.heroStats}>
 <div className={styles.statCard}>
 <div className={styles.statIcon}><Server size={24} /></div>
 <div>
 <div className={styles.statValue}>27</div>
 <div className={styles.statLabel}>Installed Packs</div>
 </div>
 </div>
 <div className={styles.statCard}>
 <div className={`${styles.statIcon} ${styles.accent}`}><Activity size={24} /></div>
 <div>
 <div className={styles.statValue}>12</div>
 <div className={styles.statLabel}>Active Executives</div>
 </div>
 </div>
 <div className={styles.statCard}>
 <div className={`${styles.statIcon} ${styles.success}`}><ShieldCheck size={24} /></div>
 <div>
 <div className={styles.statValue}>98.7%</div>
 <div className={styles.statLabel}>System Health</div>
 </div>
 </div>
 </div>
 </div>

 {/* AI Recommendation */}
 {recommendation && (
 <div className={styles.panel} style={{ background: 'linear-gradient(135deg, rgba(91, 108, 255, 0.1), rgba(124, 77, 255, 0.1))', borderColor: 'var(--border-focus)' }}>
 <div className={styles.panelHeader}>
 <div className="flex items-center gap-2">
 <Activity size={18} className="text-indigo-400" />
 <h3>AI Recommended Solution</h3>
 </div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
 <div>
 <h4 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>{recommendation.template.name}</h4>
 <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
 {recommendation.packs.map(p => (
 <span key={p.id} className={styles.pill} style={{ background: 'rgba(255, 255, 255, 0.1)' }}>{p.name}</span>
 ))}
 </div>
 </div>
 <a href={`#/enterprise/install/template/${recommendation.template.id}`} className={styles.button} style={{ background: 'var(--primary)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontWeight: 600 }}>
 Install Suite
 </a>
 </div>
 </div>
 )}

 {/* Quick Start & Featured */}
 <div className={styles.panel}>
 <div className={styles.panelHeader}>
 <div>
 <h3>Quick Start</h3>
 <span className="text-label text-slate-400">Continue building with popular industries</span>
 </div>
 <a href="#/enterprise/marketplace" className={styles.viewAll}>
 View all industries <ArrowRight size={14} />
 </a>
 </div>
 
 <div className={styles.grid}>
 {industries.slice(0, 4).map(ind => (
 <a href={`#/enterprise/marketplace/industry/${ind.id}`} key={ind.id} className={styles.industryCard}>
 <div className={styles.cardTop}>
 <div className={styles.iconBox}>{ind.icon}</div>
 <ArrowRight size={16} className="text-slate-500" />
 </div>
 <h4 className={styles.cardTitle}>{ind.name}</h4>
 <div className={styles.cardMeta}>{ind.packCount} Capability Packs</div>
 <div className={styles.cardPills}>
 <span className={styles.pill}>Core</span>
 <span className={styles.pill}>Workflows</span>
 </div>
 </a>
 ))}
 </div>
 </div>

 <div className={styles.dashboardGrid}>
 {/* Installed Solutions */}
 <div className={styles.panel}>
 <div className={styles.panelHeader}>
 <div className="flex items-center gap-2">
 <DownloadCloud size={18} className="text-indigo-400" />
 <h3>Installed Solutions</h3>
 </div>
 <a href="#/enterprise/marketplace" className={styles.viewAll}>View all <ArrowRight size={14} /></a>
 </div>
 
 <div className="flex flex-col">
 <div className={styles.tableRow}>
 <div className={styles.rowIcon}>🏥</div>
 <div className={styles.rowTitle}>
 <h4>Healthcare Suite</h4>
 </div>
 <div className={styles.rowVersion}>v2.1.0</div>
 <div className={styles.rowStatus}>
 <span className={`${styles.statusBadge} ${styles.healthy}`}>Healthy</span>
 </div>
 <div className={styles.rowTime}>Updated 2h ago</div>
 <MoreVertical size={16} className={styles.rowAction} />
 </div>
 <div className={styles.tableRow}>
 <div className={styles.rowIcon}>👥</div>
 <div className={styles.rowTitle}>
 <h4>Recruitment Suite</h4>
 </div>
 <div className={styles.rowVersion}>v1.8.3</div>
 <div className={styles.rowStatus}>
 <span className={`${styles.statusBadge} ${styles.healthy}`}>Healthy</span>
 </div>
 <div className={styles.rowTime}>Updated 5h ago</div>
 <MoreVertical size={16} className={styles.rowAction} />
 </div>
 <div className={styles.tableRow}>
 <div className={styles.rowIcon}>💻</div>
 <div className={styles.rowTitle}>
 <h4>ITSM Suite</h4>
 </div>
 <div className={styles.rowVersion}>v3.2.1</div>
 <div className={styles.rowStatus}>
 <span className={`${styles.statusBadge} ${styles.update}`}>Update Avail</span>
 </div>
 <div className={styles.rowTime}>Updated 1d ago</div>
 <MoreVertical size={16} className={styles.rowAction} />
 </div>
 </div>
 </div>

 {/* Recent Activity */}
 <div className={styles.panel}>
 <div className={styles.panelHeader}>
 <div className="flex items-center gap-2">
 <Activity size={18} className="text-emerald-400" />
 <h3>Recent Activity</h3>
 </div>
 <a href="#/enterprise/marketplace" className={styles.viewAll}>View all <ArrowRight size={14} /></a>
 </div>
 
 <div className="flex flex-col">
 <div className={styles.tableRow}>
 <div className={styles.rowIcon} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22C55E' }}>
 <CheckCircle2 size={18} />
 </div>
 <div className={styles.rowTitle}>
 <h4>CRM Superset installed</h4>
 <p>Installation completed</p>
 </div>
 <div className={styles.rowTime}>10 min ago</div>
 </div>
 <div className={styles.tableRow}>
 <div className={styles.rowIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
 <Activity size={18} />
 </div>
 <div className={styles.rowTitle}>
 <h4>Healthcare Suite updated</h4>
 <p>Version upgrade to v2.1.0</p>
 </div>
 <div className={styles.rowTime}>2 hours ago</div>
 </div>
 <div className={styles.tableRow}>
 <div className={styles.rowIcon} style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
 <Users size={18} />
 </div>
 <div className={styles.rowTitle}>
 <h4>New user added: Priya</h4>
 <p>User created in organization</p>
 </div>
 <div className={styles.rowTime}>5 hours ago</div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};
