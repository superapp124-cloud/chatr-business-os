import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './hero.css';
import { WorkflowRenderer } from '../../components/workflow-ui/WorkflowRenderer';
import { triggerCabBooking } from '@/core/capabilities/travel/CabBookingWorkflow';
import { triggerCalendarMeeting } from '@/core/capabilities/calendar/CalendarMeetingWorkflow';
import { triggerFoodOrdering } from '@/core/capabilities/commerce/FoodOrderingWorkflow';
import { triggerFlightBooking } from '@/core/capabilities/travel/FlightBookingWorkflow';
import { workflowUIRuntime } from '@/core/workflow-ui/WorkflowUIRuntime';
import type { WorkflowUISession } from '@/core/workflow-ui/types';
import { intentParser } from '@/core/kernel/intent/RegexIntentParser';
import { capabilityResolver } from '@/core/kernel/capability-registry/CapabilityResolver';

function useWorkflowSessions(): WorkflowUISession[] {
 const [sessions, setSessions] = useState<WorkflowUISession[]>([]);

 useEffect(() => {
 const update = () => setSessions(workflowUIRuntime.getAllSessions());
 
 update(); // Initial load
 return workflowUIRuntime.subscribeGlobal(update); // Subscribe to changes
 }, []);

 return sessions;
}

export const IntentHeroExperience: React.FC = () => {
 const navigate = useNavigate();
 const [intent, setIntent] = useState('');
 const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
 const inputRef = useRef<HTMLInputElement>(null);

 // Load all sessions from runtime
 const sessions = useWorkflowSessions().sort((a, b) => b.updatedAt - a.updatedAt);

 // Automatic redirect to Location Consent if not completed
 useEffect(() => {
 const hasConsented = localStorage.getItem('chatr_location_consent');
 if (!hasConsented) {
 navigate('/desktop/location-consent');
 }
 }, [navigate]);

 const handleIntentSubmit = useCallback(async (text: string) => {
 if (!text.trim()) return;
 const userMsg = text.trim();
 setIntent('');

 const conversationId = `conv-${Date.now()}`;
 
 // ─── Intent OS Execution Pipeline ─────────────────────────────────────────
 
 // 1. Parse Intent (No Regex in UI layer)
 const parsedIntent = await intentParser.parse(userMsg);
 
 // 2. Resolve Capability
 const resolution = await capabilityResolver.resolve(parsedIntent, conversationId);
 
 if (resolution && resolution.workflowId) {
 setActiveWorkflowId(resolution.workflowId);
 } else {
 alert('Intent not recognized. Try "book a flight to Mumbai", "order biryani", or "schedule a meeting".');
 }
 }, []);

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter') handleIntentSubmit(intent);
 };

 useEffect(() => { 
 inputRef.current?.focus(); 
 const handleGlobalKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 inputRef.current?.focus();
 setActiveWorkflowId(null); // Reset view
 }
 };
 window.addEventListener('keydown', handleGlobalKeyDown);
 return () => window.removeEventListener('keydown', handleGlobalKeyDown);
 }, []);

 return (
 <div className="hero-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
 {/* Escape Hatch */}
 <button 
 onClick={() => navigate('/desktop/workspace-ide')}
 style={{
 position: 'absolute', top: 20, left: 24, zIndex: 100,
 background: 'transparent', border: 'none', color: '#55556a',
 fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
 }}
 >
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
 Exit to OS
 </button>

 <div style={{ padding: '24px', textAlign: 'center', opacity: 0.5, letterSpacing: '0.1em', fontSize: '11px', fontWeight: 600, color: '#9898b3', marginTop: '16px' }}>
 CHATR · INTENT OS
 </div>

 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: activeWorkflowId ? '40px' : '15vh', width: '100%', maxWidth: '800px', margin: '0 auto', transition: 'padding 0.3s ease' }}>
 
 {!activeWorkflowId && (
 <div style={{ marginBottom: '40px', textAlign: 'center', animation: 'fadeIn 1s ease-out' }}>
 <h2 style={{ fontSize: '24px', fontWeight: 400, color: '#e2e2e9', margin: '0 0 16px 0' }}>
 Good Afternoon, Arshid
 </h2>
 <div style={{ display: 'flex', gap: '24px', color: '#9898b3', fontSize: '13px', justifyContent: 'center' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6' }} />
 {sessions.filter(s => s.status === 'ACTIVE').length} active workflows
 </div>
 </div>
 </div>
 )}

 {/* ── Intent Input ── */}
 <div className="hero-input-wrap" style={{ width: '100%' }}>
 <input
 ref={inputRef}
 className="hero-input"
 value={intent}
 onChange={e => setIntent(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Describe anything you want to accomplish..."
 id="hero-intent-input"
 autoComplete="off"
 style={{ 
 background: 'rgba(20,20,30,0.6)', 
 backdropFilter: 'blur(12px)',
 border: activeWorkflowId ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)' 
 }}
 />
 <div className="hero-input-icon">
 <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
 <circle cx="8" cy="8" r="5"/><path d="M13 13l3 3"/>
 </svg>
 </div>
 </div>

 {/* ── Active Workflow Execution ── */}
 {activeWorkflowId && (
 <div style={{ marginTop: '40px', width: '100%', animation: 'slideUp 0.3s ease-out' }}>
 <WorkflowRenderer workflowId={activeWorkflowId} />
 </div>
 )}

 {/* ── Idle State: Live Sessions ── */}
 {!activeWorkflowId && (
 <>
 <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px', marginBottom: '40px', color: '#6e6e88', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
 <span>Search</span> · <span>Automate</span> · <span>Book</span> · <span>Pay</span> · <span>Schedule</span>
 </div>

 <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
 {sessions.slice(0, 3).map(session => (
 <div 
 key={session.workflowId}
 onClick={() => setActiveWorkflowId(session.workflowId)}
 style={{ 
 background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
 borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', 
 transition: 'background 0.2s', cursor: 'pointer'
 }}
 onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
 onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
 >
 <div style={{ fontSize: '11px', color: session.status === 'COMPLETED' ? '#34d399' : '#8b5cf6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
 {session.status}
 </div>
 <div style={{ fontSize: '14px', color: '#f1f1f7', fontWeight: 500 }}>
 {session.manifest?.name || 'Workflow'}
 </div>
 <div style={{ fontSize: '12px', color: '#9898b3', marginTop: '4px' }}>
 {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </div>
 </div>
 ))}
 {sessions.length === 0 && (
 <div style={{ gridColumn: 'span 3', textAlign: 'center', color: '#55556a', fontSize: '14px', marginTop: '40px' }}>
 No active workflows. Type above to start.
 </div>
 )}
 </div>
 </>
 )}

 </div>
 </div>
 );
};
