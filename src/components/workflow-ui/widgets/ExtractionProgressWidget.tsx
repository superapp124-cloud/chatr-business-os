import React, { memo } from 'react';
import { WidgetProps } from '../../types';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const ExtractionProgressWidget = memo(function ExtractionProgressWidget({ instance }: WidgetProps) {
 const isCompleted = instance.lifecycle === 'COMPLETED';
 const stage = instance.payload?.stage || 'initializing';
 const fileName = instance.payload?.fileName || 'Document';

 let stageLabel = 'Initializing...';
 if (stage === 'document_uploading') stageLabel = 'Uploading...';
 if (stage === 'document_extracting') stageLabel = 'Extracting Text & Layout...';
 if (stage === 'document_classifying') stageLabel = 'Classifying & Finding Entities...';
 if (stage === 'document_ready') stageLabel = 'Document Digested';
 
 if (isCompleted) stageLabel = 'Digested';

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className={cn(
 "bg-white/5 border rounded-xl p-4 overflow-hidden relative",
 isCompleted ? "border-white/10" : "border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
 )}
 >
 <div className="flex items-center gap-3 relative z-10">
 <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20">
 <FileText className="w-5 h-5 text-violet-400" />
 </div>
 
 <div className="flex-1 min-w-0">
 <div className="text-secondary font-medium text-white truncate">{fileName}</div>
 <div className="flex items-center gap-1.5 mt-0.5">
 {!isCompleted ? (
 <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
 ) : (
 <CheckCircle2 className="w-3 h-3 text-emerald-400" />
 )}
 <span className={cn(
 "text-label",
 isCompleted ? "text-emerald-400/80" : "text-violet-300"
 )}>
 {stageLabel}
 </span>
 </div>
 </div>
 </div>
 
 {/* Animated background gradient for active state */}
 {!isCompleted && (
 <motion.div 
 className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/5 to-transparent z-0"
 animate={{ x: ['-100%', '100%'] }}
 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
 />
 )}
 </motion.div>
 );
});
