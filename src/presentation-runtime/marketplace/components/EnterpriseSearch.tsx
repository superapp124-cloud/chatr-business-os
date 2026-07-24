import React, { useState, useContext, useEffect } from 'react';
import { KernelContext } from '../../providers/KernelProvider';
import { Search as SearchIcon, Filter, LayoutGrid, List } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const EnterpriseSearch: React.FC = () => {
 const context = useContext(KernelContext);
 const [query, setQuery] = useState('');
 const [results, setResults] = useState<any>({ industries: [], templates: [], packs: [] });
 const [loading, setLoading] = useState(false);
 const [activeFilter, setActiveFilter] = useState('All');

 const FILTERS = [
 'All', 'Industries', 'Capability Packs', 'Templates', 'Objects', 'Processes', 
 'Users', 'Audit Events', 'Documentation'
 ];

 useEffect(() => {
 if (!context || !query.trim()) {
 setResults({ industries: [], templates: [], packs: [] });
 return;
 }
 const timer = setTimeout(async () => {
 setLoading(true);
 const res = await context.marketplaceRepository.search(query);
 setResults(res);
 setLoading(false);
 }, 300);
 return () => clearTimeout(timer);
 }, [query, context]);

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <SearchIcon size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Universal Search</h1>
 </div>
 <p>Search across the entire CHATR OS ecosystem.</p>
 </header>

 <div style={{ marginBottom: '2rem' }}>
 <div className={styles.glassCard} style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
 <SearchIcon size={20} color="#64748b" style={{ margin: 'auto 1rem' }} />
 <input
 type="text"
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder="Search industries, capabilities, objects, users, and audit events..."
 style={{
 flex: 1,
 background: 'transparent',
 border: 'none',
 color: 'white',
 fontSize: '1.2rem',
 outline: 'none',
 padding: '0.5rem'
 }}
 autoFocus
 />
 </div>
 </div>

 <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
 {FILTERS.map(f => (
 <button
 key={f}
 onClick={() => setActiveFilter(f)}
 style={{
 padding: '0.5rem 1rem',
 borderRadius: '20px',
 background: activeFilter === f ? '#8b5cf6' : 'rgba(30,41,59,0.5)',
 color: activeFilter === f ? 'white' : '#94a3b8',
 border: '1px solid',
 borderColor: activeFilter === f ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
 cursor: 'pointer',
 whiteSpace: 'nowrap'
 }}
 >
 {f}
 </button>
 ))}
 </div>

 {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Searching...</div>}
 
 {!loading && !query && (
 <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
 <SearchIcon size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
 <p>Type to search across your workspace.</p>
 </div>
 )}

 {!loading && query && results.industries.length === 0 && results.templates.length === 0 && results.packs.length === 0 && (
 <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
 <p>No results found for "{query}".</p>
 </div>
 )}

 {!loading && query && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
 {results.industries.length > 0 && (activeFilter === 'All' || activeFilter === 'Industries') && (
 <div>
 <h3 style={{ marginBottom: '1rem', color: '#94a3b8' }}>Industries ({results.industries.length})</h3>
 <div className={styles.grid}>
 {results.industries.map((item: any) => (
 <div key={item.id} className={styles.glassCard}>
 <h4>{item.name}</h4>
 <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.description}</p>
 </div>
 ))}
 </div>
 </div>
 )}

 {results.templates.length > 0 && (activeFilter === 'All' || activeFilter === 'Templates') && (
 <div>
 <h3 style={{ marginBottom: '1rem', color: '#94a3b8' }}>Templates ({results.templates.length})</h3>
 <div className={styles.grid}>
 {results.templates.map((item: any) => (
 <div key={item.id} className={styles.glassCard}>
 <h4>{item.name}</h4>
 <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.description}</p>
 </div>
 ))}
 </div>
 </div>
 )}

 {results.packs.length > 0 && (activeFilter === 'All' || activeFilter === 'Capability Packs') && (
 <div>
 <h3 style={{ marginBottom: '1rem', color: '#94a3b8' }}>Capability Packs ({results.packs.length})</h3>
 <div className={styles.grid}>
 {results.packs.map((item: any) => (
 <div key={item.id} className={styles.glassCard} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div>
 <h4 style={{ margin: '0 0 0.25rem 0' }}>{item.name}</h4>
 <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{item.category}</p>
 </div>
 <span style={{ fontSize: '0.75rem', background: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>v{item.version}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
};
