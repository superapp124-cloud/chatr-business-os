import React from 'react';
import { Commitment } from '@/core/capabilities/types';
import { ShieldAlert, Lock, UserCheck, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { eventBus } from '@/core/runtime/EventBus';

export const PolicyInterventionCard = ({ commitment }: { commitment: Commitment }) => {
 const isApproval = commitment.status === 'approval_required';
 const isBlocked = commitment.status === 'policy_blocked';
 const isDenied = commitment.status === 'permission_denied';

 const title = isApproval ? 'Approval Required' : isBlocked ? 'Policy Violation' : 'Permission Denied';
 const description = commitment.error || 'This action cannot be completed.';

 const handleRequestApproval = () => {
 // In a real system, this would trigger an approval workflow.
 // For the demo, we simulate a mock manager approval.
 eventBus.publish('chatr:approval-requested', { commitmentId: commitment.id });
 
 // Simulate approval granted after 2 seconds
 setTimeout(() => {
 eventBus.publish('chatr:approval-granted', { commitmentId: commitment.id, commitment });
 }, 2000);
 };

 const handleCancel = () => {
 eventBus.publish('chatr:commitment-canceled', { commitmentId: commitment.id });
 };

 return (
 <div className="bg-zinc-900/90 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-4 shadow-2xl overflow-hidden relative">
 {/* Background glow for severity */}
 <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 pointer-events-none rounded-full ${isApproval ? 'bg-amber-500' : 'bg-rose-500'}`} />

 <div className="flex items-start gap-3 relative z-10">
 <div className={`mt-1 p-2 rounded-xl ${isApproval ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
 {isApproval ? <UserCheck className="w-5 h-5" /> : isBlocked ? <ShieldAlert className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
 </div>
 
 <div className="flex-1">
 <h3 className={`text-secondary font-semibold mb-1 ${isApproval ? 'text-amber-400' : 'text-rose-400'}`}>{title}</h3>
 <p className="text-label text-white/70 mb-3">
 {description}
 </p>
 
 <div className="flex gap-2">
 {isApproval && (
 <button 
 onClick={handleRequestApproval}
 className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-button rounded-lg transition-colors border border-amber-500/20"
 >
 Request Manager Approval
 </button>
 )}
 <button 
 onClick={handleCancel}
 className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white/80 text-button rounded-lg transition-colors"
 >
 Cancel
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};
