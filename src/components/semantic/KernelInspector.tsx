import React, { useEffect, useState } from 'react';
import { projectionStore } from '@/core/intent/projectionStore';

export const KernelInspector: React.FC = () => {
 const [isVisible, setIsVisible] = useState(false);
 const [projection, setProjection] = useState(projectionStore.getState());

 useEffect(() => {
 const unsubscribe = projectionStore.subscribe(state => {
 setProjection({ ...state });
 });
 return unsubscribe;
 }, []);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
 setIsVisible(v => !v);
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, []);

 if (!isVisible) return null;

 const { latencyMetrics, events, cursor } = projection;
 const total = Object.values(latencyMetrics).reduce((a, b) => a + b, 0);

 return (
 <div style={{
 position: 'fixed', bottom: 20, right: 20, 
 backgroundColor: 'rgba(0,0,0,0.95)', color: '#00FF00', 
 padding: '16px', borderRadius: '8px', fontFamily: 'monospace',
 zIndex: 9999, minWidth: '400px', maxHeight: '500px', overflowY: 'auto',
 boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
 }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '12px' }}>
 <h3 style={{ margin: 0 }}>Kernel DevTools</h3>
 <span style={{ color: '#888' }}>Events: {events.length}</span>
 </div>
 
 {/* Time Travel Controls */}
 <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
 <button onClick={() => projectionStore.stepBackward()} style={btnStyle}>◀ Step</button>
 <button onClick={() => projectionStore.stepForward()} style={btnStyle}>▶ Step</button>
 <button onClick={() => projectionStore.play()} style={btnStyle}>⏵ Play</button>
 <button onClick={() => projectionStore.stop()} style={btnStyle}>⏹ Stop</button>
 </div>

 {/* Live Event Console */}
 <div style={{ background: '#111', padding: '8px', borderRadius: '4px', minHeight: '100px' }}>
 {events.map((evt, idx) => {
 const isCursor = idx === cursor;
 const time = new Date(evt.timestamp).toISOString().split('T')[1].slice(0, 12);
 const latency = latencyMetrics[evt.stage] || 0;
 return (
 <div key={evt.id} style={{ 
 display: 'flex', justifyContent: 'space-between', margin: '4px 0',
 color: isCursor ? '#FFF' : '#00FF00',
 fontWeight: isCursor ? 'bold' : 'normal',
 borderLeft: isCursor ? '2px solid #FFF' : '2px solid transparent',
 paddingLeft: '4px'
 }}>
 <span>
 <span style={{ color: '#888', marginRight: '8px' }}>{time}</span>
 {evt.stage}
 </span>
 <span>{latency > 0 ? `${latency}ms` : ''}</span>
 </div>
 );
 })}
 </div>
 
 <div style={{ borderTop: '1px solid #333', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
 <strong>Pipeline Total Latency</strong>
 <strong>{total}ms</strong>
 </div>
 </div>
 );
};

const btnStyle = {
 background: '#333', color: '#fff', border: '1px solid #555', 
 padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', flex: 1
};
