/**
 * PaymentWidget — Payment summary and method selector.
 *
 * Shows amount breakdown, selectable payment methods, and a confirm CTA.
 * Lifecycle: WAITING_USER → EXECUTING → COMPLETED.
 */

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Wallet, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetProps, PaymentWidgetPayload } from '@/core/workflow-ui';

function formatCurrency(amount: number, code = 'INR'): string {
 const symbol = code === 'INR' ? '₹' : '$';
 return `${symbol}${amount.toLocaleString('en-IN')}`;
}

const PaymentWidget = memo(function PaymentWidget({ instance, workflowId, onAction }: WidgetProps) {
 const payload = instance.payload as PaymentWidgetPayload;
 const [selectedMethod, setSelectedMethod] = useState(
 payload.selectedMethodId ?? payload.methods?.find(m => m.isDefault)?.id ?? ''
 );

 const isWaiting = instance.lifecycle === 'WAITING_USER';
 const isExecuting = instance.lifecycle === 'EXECUTING';
 const isCompleted = instance.lifecycle === 'COMPLETED';

 const handlePay = () => {
 onAction({
 widgetId: instance.id,
 workflowId,
 action: 'PAY',
 data: { methodId: selectedMethod, amount: payload.amount },
 });
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3, ease: 'easeOut' }}
 className="rounded-3xl border border-white/[0.06] bg-[#111118] overflow-hidden"
 >
 {/* Header */}
 <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/15">
 <CreditCard className="h-4 w-4 text-violet-400" />
 </div>
 <div>
 <p className="text-[13px] font-bold text-white">{payload.title ?? 'Payment'}</p>
 </div>
 <div className="ml-auto">
 <span className="text-[18px] font-black text-white">
 {formatCurrency(payload.amount, payload.currencyCode)}
 </span>
 </div>
 </div>

 {/* Breakdown */}
 {payload.breakdown && payload.breakdown.length > 0 && (
 <div className="px-4 pb-3 space-y-1">
 {payload.breakdown.map((item, i) => (
 <div
 key={i}
 className={cn(
 'flex items-center justify-between',
 item.type === 'total'
 ? 'border-t border-white/[0.06] pt-2 mt-1'
 : '',
 )}
 >
 <span className={cn(
 'text-[12px]',
 item.type === 'total' ? 'text-white font-semibold' : 'text-white/50',
 )}>
 {item.label}
 </span>
 <span className={cn(
 'text-[12px]',
 item.type === 'discount' ? 'text-emerald-400' : '',
 item.type === 'total' ? 'text-white font-bold' : 'text-white/70',
 )}>
 {item.type === 'discount' ? '-' : ''}{formatCurrency(Math.abs(item.amount), payload.currencyCode)}
 </span>
 </div>
 ))}
 </div>
 )}

 {/* Payment methods */}
 {payload.methods && payload.methods.length > 0 && !isCompleted && (
 <div className="px-4 pb-3 space-y-2">
 <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Pay via</p>
 {payload.methods.map(method => (
 <button
 key={method.id}
 onClick={() => setSelectedMethod(method.id)}
 className={cn(
 'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-all text-left',
 selectedMethod === method.id
 ? 'border-violet-500/50 bg-violet-500/10'
 : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]',
 )}
 >
 <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06]">
 <Wallet className="h-3.5 w-3.5 text-white/60" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[12px] font-semibold text-white">{method.label}</p>
 {method.balance !== undefined && (
 <p className="text-[11px] text-white/40">
 Balance: {formatCurrency(method.balance, payload.currencyCode)}
 </p>
 )}
 </div>
 {selectedMethod === method.id && (
 <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />
 )}
 </button>
 ))}
 </div>
 )}

 {/* CTA */}
 {!isCompleted && (
 <div className="px-4 pb-4">
 {payload.checkoutUrl ? (
 <a
 href={payload.checkoutUrl}
 target="_blank"
 rel="noreferrer"
 onClick={() => {
 // Also trigger handlePay so workflow knows user clicked it
 handlePay();
 }}
 className={cn(
 'w-full flex justify-center items-center py-3 rounded-2xl text-[14px] font-bold text-white transition-all',
 'bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_4px_16px_rgba(225,29,72,0.4)]',
 'hover:shadow-[0_6px_20px_rgba(225,29,72,0.5)]',
 )}
 >
 {payload.ctaLabel ?? 'Complete Payment on Provider'}
 </a>
 ) : (
 <motion.button
 whileTap={{ scale: 0.97 }}
 onClick={handlePay}
 disabled={isExecuting || (!selectedMethod && payload.methods && payload.methods.length > 0)}
 className={cn(
 'w-full py-3 rounded-2xl text-[14px] font-bold text-white transition-all',
 'bg-gradient-to-r from-violet-600 to-purple-600 shadow-[0_4px_16px_rgba(124,58,237,0.4)]',
 'hover:shadow-[0_6px_20px_rgba(124,58,237,0.5)] disabled:opacity-50',
 )}
 >
 {isExecuting ? 'Processing payment...' : (payload.ctaLabel ?? `Pay ${formatCurrency(payload.amount, payload.currencyCode)}`)}
 </motion.button>
 )}
 </div>
 )}

 {isCompleted && (
 <div className="px-4 pb-4 flex items-center gap-2">
 <CheckCircle2 className="h-4 w-4 text-emerald-400" />
 <span className="text-[12px] font-semibold text-emerald-400">Payment successful</span>
 </div>
 )}
 </motion.div>
 );
});

export default PaymentWidget;
