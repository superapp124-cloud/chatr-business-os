import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { KernelContext } from '../../providers/KernelProvider';
import { Industry, IndustryTemplate, CapabilityPack } from '../models';
import styles from './MarketplaceLayout.module.css';

export const IndustryDetailView: React.FC = () => {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const context = useContext(KernelContext);
 
 const [industry, setIndustry] = useState<Industry | null>(null);
 const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
 const [packs, setPacks] = useState<CapabilityPack[]>([]);

 useEffect(() => {
 if (context && id) {
 context.marketplaceRepository.getIndustryById(id).then(setIndustry);
 context.marketplaceRepository.getTemplatesByIndustry(id).then(setTemplates);
 context.marketplaceRepository.getCapabilityPacks().then(setPacks);
 }
 }, [context, id]);

 if (!industry) return <div>Loading...</div>;

 const startInstall = (templateId: string) => {
 navigate(`/enterprise/install/template/${templateId}`);
 };

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
 <span className={styles.iconLg}>{industry.icon}</span>
 <div>
 <h1>{industry.name}</h1>
 <p>{industry.description}</p>
 </div>
 </div>
 </header>

 {templates.length > 0 && (
 <section className={styles.section}>
 <h3>Industry Templates</h3>
 <div className={styles.grid}>
 {templates.map(tpl => (
 <div key={tpl.id} className={styles.glassCard}>
 <div className={styles.cardHeader}>
 <span className={styles.icon}>{tpl.icon}</span>
 <div>
 <h4>{tpl.name}</h4>
 <p>{tpl.packs.length} Included Packs</p>
 </div>
 </div>
 <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>{tpl.description}</p>
 
 <div style={{ marginBottom: '1.5rem' }}>
 <h5 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem' }}>Capabilities</h5>
 <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem' }}>
 {tpl.packs.map(packId => {
 const pack = packs.find(p => p.id === packId);
 return <li key={packId} style={{ marginBottom: '0.25rem' }}>✓ {pack ? pack.name : packId}</li>;
 })}
 </ul>
 </div>

 <button onClick={() => startInstall(tpl.id)} className={styles.button}>
 Install Template
 </button>
 </div>
 ))}
 </div>
 </section>
 )}
 </div>
 );
};
