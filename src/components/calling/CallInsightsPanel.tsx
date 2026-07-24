import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, FileText, CheckCircle, Brain, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
 lookupCaller,
 runPostCallAI,
 saveCallInsight,
 CallerInfo,
 PostCallSummary,
} from '@/services/callerIntelligenceService';

interface CallInsightsPanelProps {
 open: boolean;
 onClose: () => void;
 phoneNumber: string;
 durationSeconds?: number;
}

const QUICK_TAGS = ['Business', 'Personal', 'Follow-up', 'Spam', 'Appointment', 'Missed'];

export function CallInsightsPanel({
 open,
 onClose,
 phoneNumber,
 durationSeconds = 0,
}: CallInsightsPanelProps) {
 const [note, setNote] = useState('');
 const [tags, setTags] = useState<string[]>([]);
 const [suggestedAction, setSuggestedAction] = useState('');
 const [summary, setSummary] = useState('');
 const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null);
 const [aiLoading, setAiLoading] = useState(false);
 const [saving, setSaving] = useState(false);

 // Run the AI engine once panel opens
 useEffect(() => {
 if (!open || !phoneNumber) return;

 setAiLoading(true);
 lookupCaller(phoneNumber)
 .then(info => {
 setCallerInfo(info);
 const ai: PostCallSummary = runPostCallAI({
 durationSeconds,
 spamReports: info.spamReports,
 trustScore: info.trustScore,
 userNotes: note,
 userTags: info.tags,
 });
 setSuggestedAction(ai.suggestedAction);
 setSummary(ai.summary);
 setTags(prev => [...new Set([...prev, ...ai.tags])]);
 })
 .finally(() => setAiLoading(false));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [open, phoneNumber]);

 const toggleTag = (tag: string) => {
 setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
 };

 const handleSave = async () => {
 setSaving(true);
 try {
 const success = await saveCallInsight({
 number: phoneNumber,
 notes: note,
 tags,
 suggestedAction,
 });
 if (success) {
 toast.success('Call insights saved!');
 onClose();
 } else {
 toast.error('Could not save — please sign in');
 }
 } finally {
 setSaving(false);
 }
 };

 const riskColor = {
 safe: 'bg-green-100 text-green-700 border-green-200',
 suspicious: 'bg-yellow-100 text-yellow-700 border-yellow-200',
 spam: 'bg-red-100 text-red-700 border-red-200',
 };

 if (!open) return null;

 return (
 <AnimatePresence>
 <motion.div
 key="insights-backdrop"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 bg-black/40"
 onClick={onClose}
 />
 <motion.div
 key="insights-panel"
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 transition={{ type: 'spring', damping: 28, stiffness: 350 }}
 className="fixed inset-x-0 bottom-0 z-50 bg-background border-t rounded-t-3xl shadow-2xl"
 onClick={e => e.stopPropagation()}
 >
 {/* Drag handle */}
 <div className="flex justify-center pt-3 pb-1">
 <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
 </div>

 <div className="px-6 pb-8 space-y-5 max-h-[85vh] overflow-y-auto">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Brain className="h-5 w-5 text-primary" />
 <h2 className="text-section font-bold">ChatrAI Call Insights</h2>
 </div>
 <Button variant="ghost" size="icon" onClick={onClose}>
 <X className="h-5 w-5" />
 </Button>
 </div>

 {/* Caller info strip */}
 <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50">
 <div className="flex-1">
 <p className="font-semibold text-secondary">{callerInfo?.name ?? 'Looking up...'}</p>
 <p className="text-label text-muted-foreground">{phoneNumber}</p>
 </div>
 {callerInfo && (
 <span className={`text-label font-semibold px-2 py-1 rounded-full border capitalize ${riskColor[callerInfo.riskLevel]}`}>
 {callerInfo.riskLevel}
 </span>
 )}
 </div>

 {/* AI Summary */}
 {aiLoading ? (
 <div className="flex items-center gap-2 text-secondary text-muted-foreground animate-pulse">
 <Sparkles className="h-4 w-4" />
 Running ChatrAI analysis...
 </div>
 ) : summary ? (
 <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
 <div className="flex items-center gap-2 mb-1">
 <Sparkles className="h-4 w-4 text-primary" />
 <p className="text-label font-semibold text-primary uppercase tracking-wide">ChatrAI Summary</p>
 </div>
 <p className="text-secondary text-foreground">{summary}</p>
 {suggestedAction && (
 <div className="mt-2 flex items-center gap-2">
 <CheckCircle className="h-4 w-4 text-green-600" />
 <p className="text-secondary font-medium text-green-700">{suggestedAction}</p>
 </div>
 )}
 </div>
 ) : null}

 {/* Quick Tags */}
 <div>
 <label className="flex items-center gap-2 text-secondary font-semibold mb-2">
 <Tag className="h-4 w-4" /> Quick Tags
 </label>
 <div className="flex flex-wrap gap-2">
 {QUICK_TAGS.map(t => (
 <button
 key={t}
 onClick={() => toggleTag(t)}
 className={`px-3 py-1 rounded-full text-label border transition-all ${
 tags.includes(t)
 ? 'bg-primary text-primary-foreground border-primary'
 : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
 }`}
 >
 {t}
 </button>
 ))}
 </div>
 </div>

 {/* Notes */}
 <div>
 <label className="flex items-center gap-2 text-secondary font-semibold mb-2">
 <FileText className="h-4 w-4" /> Notes
 </label>
 <textarea
 className="w-full rounded-xl border bg-background p-3 text-secondary placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
 rows={3}
 placeholder="What was this call about? (meeting, quote, appointment...)"
 value={note}
 onChange={e => setNote(e.target.value)}
 />
 </div>

 {/* Suggested Action */}
 <div>
 <label className="flex items-center gap-2 text-secondary font-semibold mb-2">
 <CheckCircle className="h-4 w-4" /> Action
 </label>
 <select
 className="w-full rounded-xl border bg-background p-3 text-secondary"
 value={suggestedAction}
 onChange={e => setSuggestedAction(e.target.value)}
 >
 <option value="">None</option>
 <option value="Call back later">Call back later</option>
 <option value="Schedule follow-up">Schedule follow-up</option>
 <option value="Send quote or invoice">Send quote or invoice</option>
 <option value="Block this number">Block this number</option>
 <option value="Mark as solved">Mark as solved</option>
 </select>
 </div>

 {/* Save */}
 <Button className="w-full rounded-xl h-12 text-secondary font-semibold" onClick={handleSave} disabled={saving}>
 {saving ? 'Saving...' : '💾 Save Insights'}
 </Button>
 </div>
 </motion.div>
 </AnimatePresence>
 );
}
