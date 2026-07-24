import React, { useState } from 'react';
import { SessionReplayService } from '../../core/product/session-replay-service';

interface PostGoalFeedbackProps {
 onDismiss: () => void;
}

/**
 * One-question feedback shown after a completed goal.
 * "Was this easier than using the app directly?"
 * Then an optional open-ended follow-up.
 */
export const PostGoalFeedback: React.FC<PostGoalFeedbackProps> = ({ onDismiss }) => {
 const [phase, setPhase] = useState<'rating' | 'comment' | 'disappeared' | 'nps' | 'done'>('rating');
 const [rating, setRating] = useState<'yes' | 'same' | 'no' | null>(null);
 const [comment, setComment] = useState('');

 const handleRating = (r: 'yes' | 'same' | 'no') => {
 setRating(r);
 SessionReplayService.markFeedback(r);
 setPhase('comment');
 };

 const handleComment = () => {
 if (rating) SessionReplayService.markFeedback(rating, comment || undefined);
 setPhase('disappeared');
 };

 const handleNPS = (score: 'definitely' | 'probably' | 'maybe' | 'no') => {
 SessionReplayService.markNPS(score);
 setPhase('done');
 setTimeout(onDismiss, 1200);
 };

 const baseStyle: React.CSSProperties = {
 position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
 background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.1)',
 borderRadius: 16, padding: '20px 24px', zIndex: 200,
 boxShadow: '0 24px 64px rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
 width: 'min(440px, calc(100vw - 32px))',
 fontFamily: 'Inter, sans-serif', color: '#f1f1f7',
 animation: 'slideUpFeedback 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
 };

 if (phase === 'done') {
 return (
 <div style={baseStyle}>
 <div style={{ textAlign: 'center', padding: '8px 0' }}>
 <div style={{ fontSize: 28, marginBottom: 8 }}>🙏</div>
 <div style={{ fontSize: 15, fontWeight: 600 }}>Thank you!</div>
 <div style={{ fontSize: 13, color: '#9898b3', marginTop: 4 }}>Your feedback shapes CHATR.</div>
 </div>
 </div>
 );
 }

 if (phase === 'nps') {
 return (
 <div style={baseStyle}>
 <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
 Would you use CHATR instead of the native app next time?
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {(['definitely', 'probably', 'maybe', 'no'] as const).map(opt => {
 const labels = { definitely: '😍 Definitely', probably: '😊 Probably', maybe: '🤔 Maybe', no: '😐 No' };
 return (
 <button
 key={opt}
 onClick={() => handleNPS(opt)}
 style={{
 background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
 borderRadius: 10, padding: '10px 14px', color: '#f1f1f7',
 fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
 textAlign: 'left', transition: 'background 0.15s, border-color 0.15s',
 }}
 onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(139,92,246,0.12)'; (e.target as HTMLElement).style.borderColor = 'rgba(139,92,246,0.4)'; }}
 onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
 >
 {labels[opt]}
 </button>
 );
 })}
 </div>
 </div>
 );
 }

 if (phase === 'disappeared') {
 return (
 <div style={baseStyle}>
 <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
 If you needed lunch tomorrow, would you open CHATR or Zomato/Swiggy first?
 </div>
 <div style={{ fontSize: 12, color: '#55556a', marginBottom: 16 }}>Be honest. No wrong answer.</div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
 {([
 { value: 'definitely', label: '⚡ CHATR first' },
 { value: 'probably', label: '🤔 Probably CHATR' },
 { value: 'maybe', label: '🔀 Depends on the day' },
 { value: 'no', label: '📱 Zomato / Swiggy first' },
 ] as const).map(({ value, label }) => (
 <button
 key={value}
 onClick={() => { SessionReplayService.markNPS(value); setPhase('nps'); }}
 style={{
 background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
 borderRadius: 10, padding: '10px 14px', color: '#f1f1f7',
 fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
 textAlign: 'left', transition: 'background 0.15s, border-color 0.15s',
 }}
 onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(139,92,246,0.12)'; (e.currentTarget).style.borderColor = 'rgba(139,92,246,0.4)'; }}
 onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.08)'; }}
 >
 {label}
 </button>
 ))}
 </div>
 </div>
 );
 }

 if (phase === 'comment') {
 return (
 <div style={baseStyle}>
 <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
 What slowed you down? <span style={{ fontWeight: 400, color: '#55556a' }}>(optional)</span>
 </div>
 <textarea
 value={comment}
 onChange={e => setComment(e.target.value)}
 placeholder="e.g. Checkout felt unclear, slow initial load..."
 autoFocus
 style={{
 width: '100%', boxSizing: 'border-box', height: 72,
 background: '#13131f', border: '1px solid rgba(255,255,255,0.08)',
 borderRadius: 10, padding: '10px 12px', color: '#f1f1f7',
 fontFamily: 'inherit', fontSize: 13, resize: 'none', outline: 'none',
 caretColor: '#8b5cf6',
 }}
 />
 <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
 <button onClick={handleComment} style={{
 flex: 1, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
 border: 'none', borderRadius: 8, padding: '9px', color: '#fff',
 fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
 }}>Next</button>
 <button onClick={() => setPhase('nps')} style={{
 background: 'none', border: '1px solid rgba(255,255,255,0.08)',
 borderRadius: 8, padding: '9px 14px', color: '#55556a',
 fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
 }}>Skip</button>
 </div>
 </div>
 );
 }

 // phase === 'rating'
 return (
 <div style={baseStyle}>
 <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
 Was this easier than using the app directly?
 </div>
 <div style={{ display: 'flex', gap: 10 }}>
 {([
 { value: 'yes' as const, emoji: '😊', label: 'Yes' },
 { value: 'same' as const, emoji: '😐', label: 'Same' },
 { value: 'no' as const, emoji: '☹️', label: 'No' },
 ]).map(({ value, emoji, label }) => (
 <button
 key={value}
 onClick={() => handleRating(value)}
 style={{
 flex: 1, background: 'rgba(255,255,255,0.04)',
 border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
 padding: '12px 8px', cursor: 'pointer', display: 'flex',
 flexDirection: 'column', alignItems: 'center', gap: 6,
 color: '#f1f1f7', fontFamily: 'inherit', transition: 'all 0.15s',
 }}
 onMouseEnter={e => { const el = e.currentTarget; el.style.background = 'rgba(139,92,246,0.12)'; el.style.borderColor = 'rgba(139,92,246,0.4)'; }}
 onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; }}
 >
 <span style={{ fontSize: 24 }}>{emoji}</span>
 <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
 </button>
 ))}
 </div>
 <button
 onClick={onDismiss}
 style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: '#55556a', cursor: 'pointer', fontSize: 16 }}
 >✕</button>
 </div>
 );
};
