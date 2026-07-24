import React, { useState, useContext } from 'react';
import { KernelContext } from '../../providers/KernelProvider';
import { BrainCircuit, Search, HeartPulse, ShieldAlert, Cpu, Check, Activity, Zap, ServerCrash } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';
import { CapabilityPack } from '../models';

export const ExecutiveAI: React.FC = () => {
 const context = useContext(KernelContext);
 const [query, setQuery] = useState('');
 const [loading, setLoading] = useState(false);
 const [response, setResponse] = useState<any | null>(null);

 const SUGGESTIONS = [
 { icon: <HeartPulse size={16} />, text: 'Build a Hospital Platform' },
 { icon: <Zap size={16} />, text: 'Install CRM' },
 { icon: <Activity size={16} />, text: 'Show Workspace Health' },
 { icon: <Search size={16} />, text: 'Find inactive users' },
 { icon: <Cpu size={16} />, text: 'Upgrade Recruitment Suite' },
 { icon: <Check size={16} />, text: 'Explain this capability' },
 { icon: <ServerCrash size={16} />, text: 'Why did installation fail?' },
 { icon: <ShieldAlert size={16} />, text: 'Show workflow bottlenecks' }
 ];

 const handleQuery = async (text: string) => {
 setQuery(text);
 if (!text.trim() || !context) return;
 
 setLoading(true);
 setResponse(null);

 try {
 const prompt = `You are the Executive AI for CHATR OS.
The user is asking: "${text}"

You must respond ONLY with a valid JSON object matching one of these structures, and nothing else. No markdown, no explanations.

Option 1 (For finding, installing, or recommending software/suites):
{
 "type": "SUITE_RECOMMENDATION",
 "title": "Short title describing the recommendation",
 "search_keyword": "A single keyword to search the marketplace (e.g. 'health', 'crm', 'hr')"
}

Option 2 (For checking health, system status, or runtime):
{
 "type": "WORKSPACE_HEALTH",
 "title": "System Health Status",
 "metrics": [
 { "label": "Metric Name", "value": "Metric Value" }
 ]
}

Option 3 (For anything else, or general answers):
{
 "type": "TEXT",
 "title": "Command Acknowledged",
 "content": "Your operational response here."
}`;

 const res = await fetch('http://localhost:11434/api/generate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 model: 'llama3',
 prompt: prompt,
 stream: false,
 format: 'json'
 })
 });

 if (!res.ok) throw new Error('Ollama connection failed');
 const data = await res.json();
 const parsed = JSON.parse(data.response);

 // If it's a suite recommendation, we need to hydrate it with real marketplace data
 if (parsed.type === 'SUITE_RECOMMENDATION' && parsed.search_keyword) {
 const searchRes = await context.marketplaceRepository.search(parsed.search_keyword);
 parsed.packs = searchRes.packs.slice(0, 5);
 }

 setResponse(parsed);
 } catch (error) {
 console.error(error);
 setResponse({
 type: 'TEXT',
 title: 'AI Connectivity Error',
 content: 'Failed to connect to local Ollama instance on port 11434. Please ensure Ollama is running and the "llama3" model is installed.'
 });
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <BrainCircuit size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Executive AI</h1>
 </div>
 <p>Your operational assistant for managing the CHATR OS ecosystem.</p>
 </header>

 <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
 <div className={styles.glassCard} style={{ marginBottom: '2rem', padding: '1rem' }}>
 <div style={{ position: 'relative' }}>
 <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
 <input
 type="text"
 value={query}
 onChange={e => setQuery(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleQuery(query)}
 placeholder="What would you like to accomplish?"
 style={{
 width: '100%',
 background: 'rgba(15, 23, 42, 0.4)',
 border: '1px solid rgba(255, 255, 255, 0.1)',
 padding: '1.25rem 1rem 1.25rem 3rem',
 borderRadius: '8px',
 color: 'white',
 fontSize: '1.1rem',
 outline: 'none',
 boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
 }}
 />
 </div>
 </div>

 {!response && !loading && (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
 {SUGGESTIONS.map((s, i) => (
 <button
 key={i}
 onClick={() => handleQuery(s.text)}
 style={{
 display: 'flex',
 alignItems: 'center',
 gap: '0.75rem',
 background: 'rgba(30, 41, 59, 0.5)',
 border: '1px solid rgba(255,255,255,0.05)',
 padding: '1rem',
 borderRadius: '8px',
 color: '#e2e8f0',
 textAlign: 'left',
 cursor: 'pointer',
 transition: 'all 0.2s'
 }}
 onMouseOver={e => e.currentTarget.style.background = 'rgba(45, 55, 72, 0.8)'}
 onMouseOut={e => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)'}
 >
 <div style={{ color: '#8b5cf6' }}>{s.icon}</div>
 <span style={{ fontSize: '0.9rem' }}>{s.text}</span>
 </button>
 ))}
 </div>
 )}

 {loading && (
 <div style={{ textAlign: 'center', padding: '3rem', color: '#8b5cf6' }}>
 <BrainCircuit size={48} className={styles.spin} style={{ margin: '0 auto 1rem' }} />
 <p>Processing executive intent...</p>
 </div>
 )}

 {response && !loading && (
 <div className={styles.glassCard} style={{ animation: 'fadeIn 0.3s ease-out' }}>
 <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
 <BrainCircuit size={20} color="#8b5cf6" /> {response.title}
 </h3>

 {response.type === 'SUITE_RECOMMENDATION' && (
 <div>
 <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0' }}>
 {response.packs.map((pack: CapabilityPack) => (
 <li key={pack.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
 <Check size={16} color="#10b981" />
 <div>
 <div style={{ fontWeight: '500' }}>{pack.name}</div>
 <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{pack.category}</div>
 </div>
 </li>
 ))}
 </ul>
 <button 
 className={styles.button} 
 style={{ width: '100%', padding: '1rem', background: '#8b5cf6', color: 'white', fontWeight: 'bold' }}
 >
 Install Suite
 </button>
 </div>
 )}

 {response.type === 'WORKSPACE_HEALTH' && (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
 {response.metrics.map((m: any, i: number) => (
 <div key={i} style={{ background: 'rgba(15,23,42,0.5)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
 <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>{m.value}</div>
 <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
 </div>
 ))}
 </div>
 )}

 {response.type === 'TEXT' && (
 <p style={{ color: '#e2e8f0', lineHeight: 1.6 }}>{response.content}</p>
 )}

 <button 
 onClick={() => { setResponse(null); setQuery(''); }}
 style={{ marginTop: '2rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
 >
 Start New Query
 </button>
 </div>
 )}
 </div>
 </div>
 );
};
