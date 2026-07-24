import React from 'react';

/**
 * Provider Card
 *
 * Shows a ranked option with "Recommended because" reasons.
 * Not just a score — an explanation.
 * Builds user confidence and trust.
 */

export interface ProviderResult {
 id: string;
 name: string;
 sub: string; // e.g. "Biryani · 4.2km away"
 price: number;
 priceLabel: string; // e.g. "₹289"
 rating: number;
 etaMinutes: number;
 deliveryFee: number;
 offer?: string;
 reasons: string[]; // "4.6★ rating", "₹70 cheaper than average", "8 min faster"
 confidence: number; // 0–1
 isTopPick: boolean;
 providerLogoLetter: string; // e.g. "Z" for Zomato
}

interface ProviderCardProps {
 result: ProviderResult;
 index: number;
 onSelect: (result: ProviderResult) => void;
}

const StarIcon = () => (
 <svg width="12" height="12" viewBox="0 0 12 12" fill="#fbbf24">
 <path d="M6 1l1.4 2.8 3.1.5-2.2 2.1.5 3.1L6 8.1l-2.8 1.5.5-3.1L1.5 4.3l3.1-.5L6 1z"/>
 </svg>
);

const ClockIcon = () => (
 <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
 <circle cx="6" cy="6" r="5"/>
 <path d="M6 3v3l2 1.5"/>
 </svg>
);

const TruckIcon = () => (
 <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
 <path d="M1 8V4a1 1 0 011-1h6v5H1z"/>
 <path d="M8 5h1.5L11 7v1H8V5z"/>
 <circle cx="3" cy="9" r="1"/>
 <circle cx="9" cy="9" r="1"/>
 </svg>
);

export const ProviderCard: React.FC<ProviderCardProps> = ({ result, index, onSelect }) => {
 return (
 <div
 className={`provider-card ${result.isTopPick ? 'top-pick' : ''} ${result.isTopPick && result.confidence > 0.98 ? 'pulse-active' : ''}`}
 style={{ animationDelay: `${index * 80}ms` }}
 onClick={() => onSelect(result)}
 role="button"
 tabIndex={0}
 onKeyDown={e => e.key === 'Enter' && onSelect(result)}
 aria-label={`Select ${result.name}`}
 >
 {result.isTopPick && (
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
 <div className="recommended-badge">
 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}>
 <polyline points="20 6 9 17 4 12"></polyline>
 </svg>
 Recommended
 </div>
 <div className="card-confidence-pill">
 {Math.round(result.confidence * 100)}% Match
 </div>
 </div>
 )}

 {/* Top row: name + price */}
 <div className="card-top-row">
 <div className="card-name-wrap">
 <div
 style={{
 width: 36, height: 36, borderRadius: 10,
 background: 'rgba(139,92,246,0.15)',
 border: '1px solid rgba(139,92,246,0.2)',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 15, fontWeight: 700, color: '#8b5cf6',
 marginBottom: 8,
 }}
 >
 {result.providerLogoLetter}
 </div>
 <div className="card-name">{result.name}</div>
 <div className="card-sub">{result.sub}</div>
 </div>
 <div>
 <div className="card-price">{result.priceLabel}</div>
 <div className="card-price-sub">
 {result.deliveryFee === 0 ? '+ free delivery' : `+ ₹${result.deliveryFee} delivery`}
 </div>
 </div>
 </div>

 {/* Meta chips */}
 <div className="card-meta-row">
 <div className="card-chip">
 <StarIcon />
 <span>{result.rating.toFixed(1)}</span>
 </div>
 <div className="card-chip">
 <ClockIcon />
 <span>{result.etaMinutes} min</span>
 </div>
 <div className="card-chip">
 <TruckIcon />
 <span>{result.deliveryFee === 0 ? 'Free delivery' : `₹${result.deliveryFee}`}</span>
 </div>
 {result.offer && (
 <div className="card-chip" style={{ color: '#34d399' }}>
 <span>🏷 {result.offer}</span>
 </div>
 )}
 </div>

 {/* Recommendation reasons */}
 <div className="card-reasons">
 <div className="card-reasons-label">Because</div>
 {result.reasons.map((reason, i) => (
 <div key={i} className="card-reason-item">
 <span className="card-reason-check">✓</span>
 <span>{reason}</span>
 </div>
 ))}
 </div>

 {/* CTA */}
 <button
 className={`card-cta ${result.isTopPick ? '' : 'secondary'}`}
 onClick={e => { e.stopPropagation(); onSelect(result); }}
 id={`select-${result.id}`}
 >
 {result.isTopPick ? '⚡ Order Now' : 'Choose This'}
 </button>
 </div>
 );
};
