import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { reportSpam } from '@/services/callerIntelligenceService';

interface SpamReportModalProps {
 open: boolean;
 onClose: () => void;
 phoneNumber: string;
}

const REPORT_TYPES = [
 { value: 'spam', label: 'Spam / Robocall', emoji: '🤖' },
 { value: 'fraud', label: 'Fraud / Scam', emoji: '⚠️' },
 { value: 'business_promotion', label: 'Unwanted Promotion', emoji: '📢' },
 { value: 'other', label: 'Other', emoji: '❓' },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]['value'];

export function SpamReportModal({ open, onClose, phoneNumber }: SpamReportModalProps) {
 const [reportType, setReportType] = useState<ReportType>('spam');
 const [loading, setLoading] = useState(false);
 const [submitted, setSubmitted] = useState(false);

 const handleSubmit = async () => {
 setLoading(true);
 try {
 const success = await reportSpam(phoneNumber, reportType);
 if (success) {
 setSubmitted(true);
 setTimeout(() => {
 setSubmitted(false);
 onClose();
 }, 1800);
 } else {
 toast.error('Failed to submit report. Please try again.');
 }
 } finally {
 setLoading(false);
 }
 };

 const handleClose = () => {
 setSubmitted(false);
 onClose();
 };

 if (!open) return null;

 return (
 <AnimatePresence>
 <motion.div
 key="spam-backdrop"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
 onClick={handleClose}
 >
 <motion.div
 key="spam-modal"
 initial={{ y: 60, opacity: 0, scale: 0.97 }}
 animate={{ y: 0, opacity: 1, scale: 1 }}
 exit={{ y: 60, opacity: 0, scale: 0.97 }}
 transition={{ type: 'spring', damping: 28, stiffness: 350 }}
 className="bg-background rounded-3xl shadow-2xl w-full max-w-sm p-6 relative"
 onClick={e => e.stopPropagation()}
 >
 <Button
 variant="ghost"
 size="icon"
 className="absolute right-4 top-4"
 onClick={handleClose}
 >
 <X className="h-5 w-5" />
 </Button>

 {submitted ? (
 <div className="flex flex-col items-center py-6 gap-3">
 <motion.div
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ type: 'spring', stiffness: 400 }}
 className="bg-green-100 rounded-full p-4"
 >
 <CheckCircle className="h-10 w-10 text-green-600" />
 </motion.div>
 <p className="font-bold text-section">Report Submitted!</p>
 <p className="text-secondary text-muted-foreground text-center">
 Thank you for keeping the community safe.
 </p>
 </div>
 ) : (
 <>
 {/* Header */}
 <div className="flex flex-col items-center mb-6">
 <div className="bg-destructive/10 p-4 rounded-full mb-3">
 <ShieldAlert className="h-8 w-8 text-destructive" />
 </div>
 <h2 className="text-workspace font-bold">Report Number</h2>
 <p className="text-secondary text-muted-foreground mt-1 font-mono">{phoneNumber}</p>
 </div>

 {/* Report types */}
 <div className="space-y-2 mb-6">
 {REPORT_TYPES.map(({ value, label, emoji }) => (
 <label
 key={value}
 className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
 reportType === value
 ? 'border-destructive bg-destructive/5'
 : 'border-border hover:bg-muted'
 }`}
 >
 <input
 type="radio"
 name="spamType"
 value={value}
 checked={reportType === value}
 onChange={() => setReportType(value)}
 className="accent-destructive"
 />
 <span className="text-section">{emoji}</span>
 <span className="text-secondary font-medium">{label}</span>
 </label>
 ))}
 </div>

 <Button
 variant="destructive"
 className="w-full rounded-xl h-12 font-semibold"
 onClick={handleSubmit}
 disabled={loading}
 >
 {loading ? 'Submitting...' : '🚨 Submit Report'}
 </Button>

 <p className="text-label text-center text-muted-foreground mt-3">
 Reports are anonymous and help protect the community
 </p>
 </>
 )}
 </motion.div>
 </motion.div>
 </AnimatePresence>
 );
}
