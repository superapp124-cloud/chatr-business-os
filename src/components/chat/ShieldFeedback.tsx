import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ShieldAlert, Bug, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ShieldFeedbackProps {
 messageId: string;
 scanId?: string; // Optional: if a scan already exists
 onFeedbackSubmitted?: () => void;
}

export const ShieldFeedback = ({ messageId, scanId, onFeedbackSubmitted }: ShieldFeedbackProps) => {
 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleFeedback = async (action: 'safe' | 'scam' | 'phishing') => {
 setIsSubmitting(true);
 try {
 // In a real app, this would update user_trust_scores or report to a moderation queue.
 // For now, we'll just insert/update the scan record with the user feedback.
 if (scanId) {
 await supabase
 .from('message_security_scans')
 .update({ recommended_action: `User reported as: ${action}` })
 .eq('id', scanId);
 } else {
 // Create a manual scan record
 await supabase
 .from('message_security_scans')
 .insert({
 message_id: messageId,
 overall_score: action === 'safe' ? 0 : 100,
 overall_level: action === 'safe' ? 'safe' : 'dangerous',
 explanation: [`User manually reported this message as ${action}.`],
 recommended_action: `User reported as: ${action}`
 });
 }

 toast.success(`Message reported as ${action}. Thank you!`);
 if (onFeedbackSubmitted) onFeedbackSubmitted();
 } catch (error) {
 console.error("Feedback error:", error);
 toast.error("Failed to submit feedback");
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-red-500/10">
 <p className="text-label text-red-900/60 w-full mb-1">Help improve CHATR Shield:</p>
 
 <Button 
 variant="outline" 
 size="sm" 
 className="h-7 text-label bg-white/50 border-red-200 text-red-700 hover:bg-red-50"
 onClick={() => handleFeedback('scam')}
 disabled={isSubmitting}
 >
 <ShieldAlert className="w-3 h-3 mr-1.5" /> Report Scam
 </Button>
 
 <Button 
 variant="outline" 
 size="sm" 
 className="h-7 text-label bg-white/50 border-red-200 text-red-700 hover:bg-red-50"
 onClick={() => handleFeedback('phishing')}
 disabled={isSubmitting}
 >
 <Bug className="w-3 h-3 mr-1.5" /> Report Phishing
 </Button>
 
 <div className="flex-1" />
 
 <Button 
 variant="ghost" 
 size="sm" 
 className="h-7 text-label text-green-700 hover:text-green-800 hover:bg-green-50"
 onClick={() => handleFeedback('safe')}
 disabled={isSubmitting}
 >
 {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <ShieldCheck className="w-3 h-3 mr-1.5" />}
 Mark Safe
 </Button>
 </div>
 );
};
