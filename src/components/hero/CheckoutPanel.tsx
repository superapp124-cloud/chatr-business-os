import React, { useState } from 'react';
import type { ProviderResult } from './ProviderCard';

/**
 * Checkout Panel
 *
 * Appears after the user selects a provider.
 * The session is already validated. The address is pre-filled.
 * The payment method is pre-selected.
 *
 * The user experience: "It already knew what I wanted."
 * Almost nothing left to do — just confirm.
 */

interface CheckoutPanelProps {
 result: ProviderResult;
 intent?: string;
 onBack: () => void;
 onConfirm: () => void;
}

const SESSION_STATES = [
 'Session active · Logged in',
 'Address: Home · HSR Layout',
 'UPI ready · ••••@okicici',
];

export const CheckoutPanel: React.FC<CheckoutPanelProps> = ({ result, intent, onBack, onConfirm }) => {
 const [paying, setPaying] = useState(false);

 const handlePay = async () => {
 setPaying(true);
 await new Promise(r => setTimeout(r, 1200));
 onConfirm();
 };

 const total = result.price + result.deliveryFee;

 return (
 <div className="checkout-wrap">
 <div className="checkout-header">
 <button className="checkout-back" onClick={onBack} aria-label="Go back">‹</button>
 <span className="checkout-title">Confirm Order · {result.name}</span>
 </div>

 {/* Pre-warmed session evidence */}
 <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
 {SESSION_STATES.map((s, i) => (
 <div key={i} className="checkout-session-pill">
 <span style={{ color: '#34d399' }}>✓</span>
 {s}
 </div>
 ))}
 </div>

 {/* Order summary */}
 <div className="checkout-section-label">Order</div>
 <div className="checkout-row">
 <span className="checkout-row-label">{result.sub || result.name || 'Order Item'}</span>
 <span className="checkout-row-value">{result.priceLabel}</span>
 </div>
 <div className="checkout-row">
 <span className="checkout-row-label">Delivery</span>
 <span className="checkout-row-value" style={{ color: result.deliveryFee === 0 ? '#34d399' : undefined }}>
 {result.deliveryFee === 0 ? 'Free' : `₹${result.deliveryFee}`}
 </span>
 </div>
 {result.offer && (
 <div className="checkout-row">
 <span className="checkout-row-label">Offer applied</span>
 <span className="checkout-row-value" style={{ color: '#34d399' }}>–{result.offer}</span>
 </div>
 )}

 <div className="checkout-total-row">
 <span className="checkout-total-label">Total</span>
 <span className="checkout-total-value">₹{total}</span>
 </div>

 {/* Delivery address (only if food/shopping) */}
 {(!intent || (intent.toLowerCase().match(/food|shop|order|pizza|biryani|burger|grocery/i))) && (
 <>
 <div className="checkout-section-label" style={{ marginTop: 4 }}>Delivering to</div>
 <div className="checkout-row" style={{ alignItems: 'flex-start' }}>
 <span className="checkout-row-label" style={{ color: '#f1f1f7' }}>Home - HSR Layout, Bangalore</span>
 <span className="checkout-row-value" style={{ color: '#8b5cf6', cursor: 'pointer', fontSize: 13 }}>Change</span>
 </div>
 </>
 )}

 {/* Payment */}
 <div className="checkout-section-label" style={{ marginTop: 16 }}>Payment</div>
 <div className="checkout-row">
 <span className="checkout-row-label">UPI · ••••@okicici</span>
 <span className="checkout-row-value" style={{ fontSize: 12, color: '#8b5cf6', cursor: 'pointer' }}>Change</span>
 </div>

 {/* ETA */}
 <div style={{ textAlign: 'center', color: '#9898b3', fontSize: 13, margin: '16px 0 20px' }}>
 🕐 Estimated delivery in <strong style={{ color: '#f1f1f7' }}>{result.etaMinutes} minutes</strong>
 </div>

 <button
 className="checkout-pay-btn"
 onClick={handlePay}
 disabled={paying}
 id="confirm-payment-btn"
 >
 {paying ? 'Placing order…' : `Pay ₹${total} · Place Order`}
 </button>
 </div>
 );
};
