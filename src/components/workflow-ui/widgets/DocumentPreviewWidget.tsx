import React, { memo } from 'react';
import { WidgetProps } from '../../types';
import { FileText } from 'lucide-react';
import { motion } from 'framer-motion';

export const DocumentPreviewWidget = memo(function DocumentPreviewWidget({ instance }: WidgetProps) {
 const documents = instance.payload?.documents || instance.payload?.insight?.payload?.documents || [];
 
 if (documents.length === 0) return null;

 return (
 <div className="space-y-2">
 {documents.map((doc: any, i: number) => (
 <motion.div
 key={i}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.1 }}
 className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3"
 >
 <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-500/20">
 <FileText className="w-5 h-5 text-violet-400" />
 </div>
 
 <div className="flex-1 min-w-0">
 <div className="text-secondary font-medium text-white truncate">{doc.metadata?.fileName || 'Document'}</div>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-label text-white/50 uppercase">{doc.classification?.primary || 'Unknown'}</span>
 <span className="text-white/20 text-label">•</span>
 <span className="text-label text-white/50">{doc.pages} page(s)</span>
 </div>
 </div>
 </motion.div>
 ))}
 </div>
 );
});
