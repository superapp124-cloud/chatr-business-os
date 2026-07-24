import React, { memo } from 'react';
import { WidgetProps } from '../../types';
import { FileText, CheckCircle2, AlertTriangle, ListChecks, Target, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export const ATSResultWidget = memo(function ATSResultWidget({ instance }: WidgetProps) {
 const insight = instance.payload?.insight;
 if (!insight) return null;

 const atsResult = insight.payload?.atsResult;
 if (!atsResult) return null;

 const score = atsResult.score || 0;
 
 // Determine color based on score
 let colorClass = 'text-emerald-400';
 let bgClass = 'bg-emerald-400/10';
 let borderClass = 'border-emerald-500/20';
 let ringClass = 'border-emerald-500';
 
 if (score < 50) {
 colorClass = 'text-red-400';
 bgClass = 'bg-red-400/10';
 borderClass = 'border-red-500/20';
 ringClass = 'border-red-500';
 } else if (score < 75) {
 colorClass = 'text-amber-400';
 bgClass = 'bg-amber-400/10';
 borderClass = 'border-amber-500/20';
 ringClass = 'border-amber-500';
 }

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-[#11111a] border border-white/10 rounded-xl overflow-hidden"
 >
 <div className="p-4 border-b border-white/5 flex items-start gap-4">
 {/* Score Ring */}
 <div className={`relative w-16 h-16 rounded-full border-4 ${borderClass} flex items-center justify-center shrink-0`}>
 <div className={`absolute inset-0 rounded-full border-4 ${ringClass} border-l-transparent border-b-transparent transform rotate-45`}></div>
 <span className={`text-workspace font-bold ${colorClass}`}>{score}</span>
 </div>
 
 <div className="flex-1">
 <div className="text-white font-semibold text-section">{insight.title}</div>
 <div className="text-white/60 text-secondary mt-1">{insight.summary}</div>
 <div className="mt-2 text-label bg-white/5 p-2 rounded-lg text-white/70 border border-white/5">
 <span className="font-semibold text-white/90">AI Note: </span>
 {insight.explanation}
 </div>
 </div>
 </div>

 <div className="p-4 space-y-4">
 {/* Missing Skills */}
 {atsResult.missingSkills && atsResult.missingSkills.length > 0 && (
 <div>
 <div className="flex items-center gap-2 mb-2">
 <XCircle className="w-4 h-4 text-red-400" />
 <span className="text-secondary font-medium text-white/90">Missing Core Skills</span>
 </div>
 <div className="flex flex-wrap gap-2">
 {atsResult.missingSkills.map((skill: string, i: number) => (
 <span key={i} className="px-2 py-1 rounded border border-red-500/20 bg-red-500/10 text-red-300 text-label ">
 {skill}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Strengths */}
 {atsResult.strengths && atsResult.strengths.length > 0 && (
 <div>
 <div className="flex items-center gap-2 mb-2">
 <CheckCircle2 className="w-4 h-4 text-emerald-400" />
 <span className="text-secondary font-medium text-white/90">Key Strengths</span>
 </div>
 <div className="flex flex-wrap gap-2">
 {atsResult.strengths.map((skill: string, i: number) => (
 <span key={i} className="px-2 py-1 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-label ">
 {skill}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Suggested Questions */}
 {atsResult.interviewQuestions && atsResult.interviewQuestions.length > 0 && (
 <div className="pt-2 border-t border-white/5">
 <div className="flex items-center gap-2 mb-3">
 <ListChecks className="w-4 h-4 text-violet-400" />
 <span className="text-secondary font-medium text-white/90">Recommended Interview Questions</span>
 </div>
 <ul className="space-y-2">
 {atsResult.interviewQuestions.map((q: string, i: number) => (
 <li key={i} className="flex gap-2 text-secondary text-white/70 bg-white/5 p-2 rounded-lg border border-white/5">
 <span className="text-violet-400 font-bold shrink-0">Q.</span>
 <span>{q}</span>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 </motion.div>
 );
});
