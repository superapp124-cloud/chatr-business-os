import React, { useEffect, useState } from 'react';

/**
 * Execution Dashboard
 * Visualizes the inner workings of the frozen AI Subsystem pipeline.
 */
export default function ExecutionDashboard() {
 const [logs, setLogs] = useState<any[]>([]);

 useEffect(() => {
 const electron = (window as any).require ? (window as any).require('electron') : null;
 if (!electron?.ipcRenderer) return;

 const topics = [
 'AI_REQUEST_CREATED',
 'MODEL_FALLBACK',
 'MODEL_DOWNLOAD_REQUESTED',
 'AI_EXECUTION_PLAN_CREATED',
 'PROVIDER_EXECUTION_STARTED',
 'EXECUTION_COMPLETED',
 'EXECUTION_FAILED',
 'AI_POLICY_BLOCKED'
 ];

 const handles = topics.map(topic => {
 const handler = (_: any, data: any) => {
 setLogs(prev => [{ topic, data, time: new Date().toISOString() }, ...prev]);
 };
 electron.ipcRenderer.on(topic, handler);
 return { topic, handler };
 });

 return () => {
 handles.forEach(({ topic, handler }) => electron.ipcRenderer.removeListener(topic, handler));
 };
 }, []);

 return (
 <div style={{ padding: '2rem', background: '#0a0a0a', color: '#eaeaea', minHeight: '100vh', fontFamily: 'monospace' }}>
 <h1 style={{ color: '#00ffcc', marginBottom: '2rem' }}>AI Operating System Pipeline — Telemetry Stream</h1>
 
 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
 {logs.map((log, i) => (
 <div key={i} style={{ 
 padding: '1rem', 
 borderRadius: '8px', 
 background: '#1a1a1a', 
 border: '1px solid #333'
 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
 <strong style={{ color: '#ff00aa' }}>{log.topic}</strong>
 <span style={{ color: '#888', fontSize: '0.85rem' }}>{new Date(log.time).toLocaleTimeString()}</span>
 </div>
 <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.9rem', color: '#a0a0a0' }}>
 {JSON.stringify(log.data, null, 2)}
 </pre>
 </div>
 ))}
 {logs.length === 0 && (
 <div style={{ color: '#555', fontStyle: 'italic' }}>Listening for Kernel Events... Try executing a command like "Summarize invoice" in the Workspace.</div>
 )}
 </div>
 </div>
 );
}
