import React, { useContext, useState, useEffect } from 'react';
import { KernelContext } from '../../providers/KernelProvider';
import { BarChart2, Activity, Cpu, Database, CloudRain, Clock, Zap, AlertTriangle, Layers, BrainCircuit, Users } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';

export const EnterpriseAnalytics: React.FC = () => {
 const context = useContext(KernelContext);
 const [loading, setLoading] = useState(true);

 // Mock telemetry data for charts (in a real app, this streams from EventBus/Kernel)
 const eventData = [
 { time: '08:00', processed: 4000, failed: 24, syncQueue: 120 },
 { time: '09:00', processed: 3000, failed: 13, syncQueue: 90 },
 { time: '10:00', processed: 5000, failed: 45, syncQueue: 200 },
 { time: '11:00', processed: 2780, failed: 39, syncQueue: 150 },
 { time: '12:00', processed: 1890, failed: 48, syncQueue: 300 },
 { time: '13:00', processed: 2390, failed: 38, syncQueue: 210 },
 { time: '14:00', processed: 3490, failed: 43, syncQueue: 180 },
 ];

 const aiData = [
 { name: 'Workflow parsing', value: 400 },
 { name: 'Marketplace discovery', value: 300 },
 { name: 'Log analysis', value: 300 },
 { name: 'Intent execution', value: 200 },
 ];
 const COLORS = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b'];

 useEffect(() => {
 // Simulate loading baseline metrics
 const timer = setTimeout(() => setLoading(false), 800);
 return () => clearTimeout(timer);
 }, []);

 const MetricCard = ({ icon, title, value, subtext, alert = false }: any) => (
 <div className={styles.glassCard} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderColor: alert ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.05)', transition: 'all 0.3s ease' }}>
 <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '12px', color: alert ? '#ef4444' : '#8b5cf6' }}>
 {icon}
 </div>
 <div>
 <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{title}</div>
 <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: alert ? '#ef4444' : 'white', lineHeight: '1.2' }}>{value}</div>
 {subtext && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{subtext}</div>}
 </div>
 </div>
 );

 return (
 <div className={styles.page}>
 <header className={styles.header}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <BarChart2 size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Platform Analytics</h1>
 </div>
 <p>Real-time telemetry and health diagnostics for the CHATR OS kernel.</p>
 </header>

 {loading ? (
 <div style={{ textAlign: 'center', padding: '4rem', color: '#8b5cf6' }}>
 <Activity size={48} className={styles.spin} style={{ margin: '0 auto 1rem' }} />
 <p>Compiling telemetry streams...</p>
 </div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', animation: 'fadeIn 0.5s ease-out' }}>
 
 {/* 1. Platform Core */}
 <section>
 <h3 style={{ color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
 <Cpu size={18} color="#8b5cf6" /> Core Platform
 </h3>
 <div className={styles.grid}>
 <MetricCard icon={<Layers size={24} />} title="Installed Packs" value="17" subtext="Across 4 Templates" />
 <MetricCard icon={<Zap size={24} />} title="Events Processed" value="2.4M" subtext="Last 24 hours" />
 <MetricCard icon={<Clock size={24} />} title="Avg Command Time" value="42ms" subtext="-3ms since last build" />
 <MetricCard icon={<CloudRain size={24} />} title="Sync Queue Depth" value="0" subtext="Realtime synchronized" />
 </div>
 
 <div className={styles.glassCard} style={{ marginTop: '1rem', padding: '1.5rem', height: '350px' }}>
 <h4 style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>Event Throughput (Requests/sec)</h4>
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={eventData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
 <defs>
 <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
 <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
 <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
 <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
 <Area type="monotone" dataKey="processed" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorProcessed)" />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </section>

 {/* 2. Capability Runtime */}
 <section>
 <h3 style={{ color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
 <Layers size={18} color="#10b981" /> Capability Runtime
 </h3>
 <div className={styles.grid}>
 <MetricCard icon={<Activity size={24} />} title="Runtime State" value="Healthy" />
 <MetricCard icon={<AlertTriangle size={24} />} title="Dep Warnings" value="0" />
 <MetricCard icon={<Zap size={24} />} title="Failed Installs" value="0" />
 <MetricCard icon={<CloudRain size={24} />} title="Updates Available" value="3" subtext="Requires approval" />
 </div>
 </section>

 {/* 3. Executive AI */}
 <section>
 <h3 style={{ color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
 <BrainCircuit size={18} color="#3b82f6" /> Executive AI
 </h3>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
 <div className={styles.glassCard} style={{ padding: '1.5rem' }}>
 <h4 style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>AI Intent Distribution</h4>
 <div style={{ height: '250px' }}>
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={aiData}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={80}
 paddingAngle={5}
 dataKey="value"
 >
 {aiData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
 <Legend verticalAlign="bottom" height={36}/>
 </PieChart>
 </ResponsiveContainer>
 </div>
 </div>
 
 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
 <MetricCard icon={<BrainCircuit size={24} />} title="Total Exec Sessions" value="1,245" subtext="Last 30 days" />
 <MetricCard icon={<Zap size={24} />} title="Recs Accepted" value="84%" subtext="High confidence" />
 <MetricCard icon={<Clock size={24} />} title="Inference Latency" value="1.2s" subtext="P95 Network Roundtrip" />
 </div>
 </div>
 </section>

 {/* 4. Infrastructure */}
 <section>
 <h3 style={{ color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
 <Database size={18} color="#f59e0b" /> Infrastructure
 </h3>
 <div className={styles.grid}>
 <MetricCard icon={<Database size={24} />} title="Database Health" value="99.99%" subtext="Supabase Cluster" />
 <MetricCard icon={<CloudRain size={24} />} title="Sync Status" value="Online" subtext="WebSocket active" />
 <MetricCard icon={<Database size={24} />} title="Storage Usage" value="Unlimited" subtext="Local First Arch" />
 <MetricCard icon={<Zap size={24} />} title="API Latency" value="45ms" subtext="P95 Edge Global" />
 </div>
 </section>

 </div>
 )}
 </div>
 );
};
