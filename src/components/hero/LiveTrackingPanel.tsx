import React, { useEffect, useState } from 'react';

/**
 * Live Tracking Panel
 *
 * Post-order continuous assistance.
 * Not "order placed, goodbye."
 * CHATR stays with the user until the biryani arrives.
 *
 * Demonstrates: intent platform vs. ordering app.
 */

interface TrackingStep {
 id: string;
 label: string;
 time?: string;
 status: 'done' | 'active' | 'pending';
 emoji: string;
}

interface LiveTrackingPanelProps {
 providerName: string;
 itemName: string;
 etaMinutes: number;
 orderId: string;
 intent?: string;
}

export const LiveTrackingPanel: React.FC<LiveTrackingPanelProps> = ({
 providerName,
 itemName,
 etaMinutes,
 orderId,
 intent,
}) => {
 const [etaRemaining, setEtaRemaining] = useState(etaMinutes);
 const [currentStep, setCurrentStep] = useState(0);

 // Simulate live progression
 useEffect(() => {
 const etaTimer = setInterval(() => {
 setEtaRemaining(prev => Math.max(0, prev - 1));
 }, 8000); // Fast-forward for demo

 const stepTimer = setInterval(() => {
 setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
 }, 5000);

 return () => { clearInterval(etaTimer); clearInterval(stepTimer); };
 }, []);

 let rawSteps: Omit<TrackingStep, 'status'>[] = [];
 const intentStr = (intent || '').toLowerCase();
 
 if (intentStr.match(/train|flight|cab|bus|transport|ticket|ride/i)) {
 rawSteps = [
 { id: 'placed', label: 'Booking confirmed', time: 'Just now', emoji: '✓' },
 { id: 'accepted', label: 'Generating PNR', time: '< 1 min ago', emoji: '🎫' },
 { id: 'prep', label: 'Seat confirmed', time: currentStep >= 2 ? 'Done' : undefined, emoji: '💺' },
 { id: 'pickup', label: 'Chart prepared', emoji: '📋' },
 { id: 'delivery', label: 'Ticket issued', emoji: '✅' },
 { id: 'arrived', label: 'Have a safe journey!', emoji: '🚆' },
 ];
 } else if (intentStr.match(/hotel|stay|resort|accommodation/i)) {
 rawSteps = [
 { id: 'placed', label: 'Booking confirmed', time: 'Just now', emoji: '✓' },
 { id: 'accepted', label: 'Contacting property', time: '< 1 min ago', emoji: '📞' },
 { id: 'prep', label: 'Room secured', time: currentStep >= 2 ? 'Done' : undefined, emoji: '🛏️' },
 { id: 'pickup', label: 'Payment verified', emoji: '💳' },
 { id: 'delivery', label: 'Check-in details sent', emoji: '📧' },
 { id: 'arrived', label: 'Enjoy your stay!', emoji: '🏨' },
 ];
 } else if (intentStr.match(/bill|electricity|water|recharge|passport|renew|government/i)) {
 rawSteps = [
 { id: 'placed', label: 'Payment initiated', time: 'Just now', emoji: '✓' },
 { id: 'accepted', label: 'Processing request', time: '< 1 min ago', emoji: '⚙️' },
 { id: 'prep', label: 'Contacting provider', time: currentStep >= 2 ? 'Done' : undefined, emoji: '📡' },
 { id: 'pickup', label: 'Payment successful', emoji: '💸' },
 { id: 'delivery', label: 'Receipt generated', emoji: '🧾' },
 { id: 'arrived', label: 'Transaction complete!', emoji: '✅' },
 ];
 } else {
 rawSteps = [
 { id: 'placed', label: 'Order confirmed', time: 'Just now', emoji: '✓' },
 { id: 'accepted', label: 'Restaurant accepted', time: '< 1 min ago', emoji: '✓' },
 { id: 'prep', label: `Preparing your ${itemName || 'order'}`, time: currentStep >= 2 ? 'In progress' : undefined, emoji: '🍳' },
 { id: 'pickup', label: 'Rider picks up', emoji: '🛵' },
 { id: 'delivery', label: 'Out for delivery', emoji: '📍' },
 { id: 'arrived', label: 'Delivered!', emoji: '🎉' },
 ];
 }

 const STEPS: TrackingStep[] = rawSteps.map((s, i) => ({
 ...s,
 status: i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending',
 })) as TrackingStep[];

 const currentLabel = STEPS[currentStep]?.label ?? 'Complete';

 return (
 <div className="tracking-wrap">
 {/* Status hero card */}
 <div className="tracking-header-card">
 <span className="tracking-status-emoji">
 {STEPS[currentStep]?.emoji ?? '🛵'}
 </span>
 <div className="tracking-status-text">{currentLabel}</div>
 <div className="tracking-sub">
 {providerName} · Order #{orderId.slice(-6).toUpperCase()}
 </div>
 {etaRemaining > 0 && (
 <div className="tracking-eta-badge">
 <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
 <circle cx="7" cy="7" r="6"/>
 <path d="M7 4v3l2 1.5"/>
 </svg>
 Arriving in {etaRemaining} min
 </div>
 )}
 {etaRemaining === 0 && (
 <div className="tracking-eta-badge" style={{ color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.1)' }}>
 🎉 {intentStr.match(/train|flight|cab|bus|transport|ticket|ride|hotel|stay|resort/i) ? 'Booking confirmed!' : intentStr.match(/bill|electricity|water|recharge|passport|renew|government/i) ? 'Transaction successful!' : 'Your order has arrived!'}
 </div>
 )}
 </div>

 {/* Step-by-step progress */}
 <div className="tracking-steps">
 {STEPS.map(step => (
 <div key={step.id} className="tracking-step">
 <div className={`tracking-step-icon ${step.status}`}>
 {step.status === 'done' ? '✓' : step.status === 'active' ? '●' : '○'}
 </div>
 <div className="tracking-step-content">
 <div className={`tracking-step-label ${step.status === 'active' ? 'active-label' : ''}`}>
 {step.label}
 </div>
 {step.time && <div className="tracking-step-time">{step.time}</div>}
 </div>
 </div>
 ))}
 </div>

 {/* CHATR continuous assistance note */}
 <div style={{
 textAlign: 'center',
 fontSize: 12,
 color: '#55556a',
 marginTop: 16,
 padding: '12px 0',
 }}>
 CHATR is monitoring your order · You'll be notified of any delays
 </div>
 </div>
 );
};
