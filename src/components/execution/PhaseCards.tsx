import React, { useState } from 'react';
import { CreditCard, Smartphone, Building2, Loader2, CheckCircle2, XCircle, Shield, ChevronRight } from 'lucide-react';

// ─── PaymentCard ──────────────────────────────────────────────────────────────

interface PaymentCardProps {
 amount: number;
 currency: string;
 description: string;
 bookingId: string;
 onPay: (method: string) => void;
 onCancel: () => void;
 isProcessing?: boolean;
 status?: 'idle' | 'processing' | 'success' | 'failed';
 txnId?: string;
}

const PAYMENT_METHODS = [
 { id: 'upi', label: 'UPI', icon: <Smartphone className="w-4 h-4" />, hint: 'Google Pay · PhonePe · Paytm' },
 { id: 'card', label: 'Card', icon: <CreditCard className="w-4 h-4" />, hint: 'Credit · Debit · Prepaid' },
 { id: 'net', label: 'Net Banking', icon: <Building2 className="w-4 h-4" />, hint: 'All major banks' },
];

function formatPrice(amount: number, currency: string): string {
 const symbol = currency === 'INR' ? '₹' : currency;
 return `${symbol}${amount.toLocaleString('en-IN')}`;
}

export function PaymentCard({ amount, currency, description, bookingId, onPay, onCancel, isProcessing, status = 'idle', txnId }: PaymentCardProps) {
 const [selectedMethod, setSelectedMethod] = useState('upi');

 if (status === 'processing') {
 return (
 <div className="w-full p-6 rounded-2xl border border-violet-500/30 bg-violet-500/5 animate-in fade-in duration-300">
 <div className="flex flex-col items-center gap-4 py-4">
 <div className="w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
 <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
 </div>
 <div className="text-center">
 <p className="font-semibold text-foreground text-[15px]">Processing Payment...</p>
 <p className="text-secondary text-muted-foreground mt-1">{formatPrice(amount, currency)} via {selectedMethod.toUpperCase()}</p>
 </div>
 <div className="flex items-center gap-2 text-label text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full">
 <Shield className="w-3 h-3 text-emerald-500" />
 Secured by 256-bit encryption
 </div>
 </div>
 </div>
 );
 }

 if (status === 'success') {
 return (
 <div className="w-full p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 animate-in fade-in zoom-in-95 duration-400">
 <div className="flex flex-col items-center gap-3 py-2">
 <CheckCircle2 className="w-12 h-12 text-emerald-500" />
 <div className="text-center">
 <p className="font-bold text-foreground text-[16px]">Payment Successful!</p>
 <p className="text-secondary text-muted-foreground mt-1">{formatPrice(amount, currency)} paid</p>
 {txnId && <p className="text-label text-muted-foreground/70 mt-1 font-mono">Txn: {txnId}</p>}
 </div>
 </div>
 </div>
 );
 }

 if (status === 'failed') {
 return (
 <div className="w-full p-6 rounded-2xl border border-red-500/30 bg-red-500/5 animate-in fade-in duration-300">
 <div className="flex flex-col items-center gap-3 py-2">
 <XCircle className="w-10 h-10 text-red-400" />
 <div className="text-center">
 <p className="font-semibold text-foreground">Payment Failed</p>
 <p className="text-secondary text-muted-foreground mt-1">Please try again or use a different method</p>
 </div>
 <button onClick={() => onPay(selectedMethod)} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl text-secondary font-medium transition-colors">
 Try Again
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
 {/* Amount header */}
 <div className="p-5 rounded-2xl border border-border/50 bg-card/60 mb-3">
 <p className="text-label text-muted-foreground uppercase tracking-wider mb-1">Total Amount</p>
 <div className="flex items-baseline gap-2">
 <span className="text-display text-foreground">{formatPrice(amount, currency)}</span>
 <span className="text-secondary text-muted-foreground">incl. taxes</span>
 </div>
 <p className="text-label text-muted-foreground mt-2 truncate">{description}</p>
 </div>

 {/* Payment method selector */}
 <div className="space-y-2 mb-4">
 {PAYMENT_METHODS.map(m => (
 <button
 key={m.id}
 onClick={() => setSelectedMethod(m.id)}
 className={`
 w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-150
 ${selectedMethod === m.id
 ? 'border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/20'
 : 'border-border/50 bg-card/40 hover:border-border hover:bg-card/70'
 }
 `}
 >
 <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedMethod === m.id ? 'bg-violet-500/20 text-violet-400' : 'bg-muted/60 text-muted-foreground'}`}>
 {m.icon}
 </div>
 <div className="flex-1">
 <p className="text-secondary font-medium text-foreground">{m.label}</p>
 <p className="text-label text-muted-foreground">{m.hint}</p>
 </div>
 <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${selectedMethod === m.id ? 'border-violet-500' : 'border-muted-foreground/30'}`}>
 {selectedMethod === m.id && <div className="w-2 h-2 rounded-full bg-violet-500" />}
 </div>
 </button>
 ))}
 </div>

 {/* Actions */}
 <div className="flex gap-2">
 <button
 onClick={onCancel}
 className="flex-shrink-0 px-4 py-2.5 rounded-xl border border-border/60 text-muted-foreground text-button hover:bg-muted/40 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={() => onPay(selectedMethod)}
 disabled={isProcessing}
 className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-secondary font-semibold transition-all shadow-lg hover:shadow-violet-500/20 active:scale-[0.98]"
 >
 <Shield className="w-4 h-4" />
 Pay {formatPrice(amount, currency)}
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 );
}

// ─── SuccessCard ──────────────────────────────────────────────────────────────

interface SuccessCardProps {
 bookingId: string;
 pnr?: string;
 title: string;
 subtitle?: string;
 details?: Array<{ label: string; value: string }>;
 onAddCalendar?: () => void;
 onSetReminder?: () => void;
 onShare?: () => void;
}

export function SuccessCard({ bookingId, pnr, title, subtitle, details = [], onAddCalendar, onSetReminder, onShare }: SuccessCardProps) {
 return (
 <div className="w-full animate-in fade-in zoom-in-95 duration-500">
 {/* Hero */}
 <div className="p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-violet-500/5 mb-3">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
 <CheckCircle2 className="w-6 h-6 text-emerald-500" />
 </div>
 <div>
 <p className="font-bold text-foreground text-[16px]">Booking Confirmed! 🎉</p>
 <p className="text-secondary text-muted-foreground">{title}</p>
 </div>
 </div>

 {/* PNR */}
 {pnr && (
 <div className="bg-card/60 rounded-xl border border-border/40 p-3 mb-3">
 <p className="text-label text-muted-foreground uppercase tracking-wider mb-1">PNR Number</p>
 <p className="text-page font-mono font-bold text-foreground tracking-wider">{pnr}</p>
 </div>
 )}

 {/* Booking details */}
 {details.length > 0 && (
 <div className="grid grid-cols-2 gap-2">
 {details.map(d => (
 <div key={d.label} className="bg-card/40 rounded-lg p-2.5">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{d.label}</p>
 <p className="text-secondary font-medium text-foreground truncate">{d.value}</p>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Actions */}
 <div className="flex gap-2">
 {onAddCalendar && (
 <button onClick={onAddCalendar} className="flex-1 text-button py-2.5 rounded-xl border border-border/50 bg-card/40 hover:bg-card/70 text-muted-foreground hover:text-foreground transition-colors">
 📅 Calendar
 </button>
 )}
 {onSetReminder && (
 <button onClick={onSetReminder} className="flex-1 text-button py-2.5 rounded-xl border border-border/50 bg-card/40 hover:bg-card/70 text-muted-foreground hover:text-foreground transition-colors">
 🔔 Remind me
 </button>
 )}
 {onShare && (
 <button onClick={onShare} className="flex-1 text-button py-2.5 rounded-xl border border-border/50 bg-card/40 hover:bg-card/70 text-muted-foreground hover:text-foreground transition-colors">
 📤 Share
 </button>
 )}
 </div>
 </div>
 );
}
