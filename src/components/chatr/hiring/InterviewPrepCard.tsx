import React, { useState } from 'react';
import { InterviewPrepViewModel } from './viewmodels';
import { ChevronDown, ChevronRight, FileQuestion, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export function InterviewPrepCard({ data }: { data: InterviewPrepViewModel }) {
 const [expandedSection, setExpandedSection] = useState<number | null>(0);

 const toggle = (index: number) => setExpandedSection(s => s === index ? null : index);

 return (
 <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">
 
 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-slate-800/50">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
 <FileQuestion className="w-5 h-5 text-emerald-400" />
 </div>
 <div>
 <h3 className="text-white font-medium">Interview Plan: {data.candidateName}</h3>
 <p className="text-slate-400 text-label">AI Generated based on Skill Gaps</p>
 </div>
 </div>
 <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
 <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
 <p className="text-secondary text-slate-300">{data.reasoning}</p>
 </div>
 </div>

 {/* Sections */}
 <div>
 {data.sections.map((section, idx) => (
 <div key={idx} className="border-b border-slate-700/50 last:border-0">
 <button onClick={() => toggle(idx)} className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
 <div className="flex flex-col items-start">
 <span className="text-secondary font-medium text-slate-200">{section.type} Interview</span>
 <span className="text-label text-slate-400 mt-0.5">Focus: {section.focus}</span>
 </div>
 {expandedSection === idx ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
 </button>
 {expandedSection === idx && (
 <div className="px-4 pb-4 space-y-2">
 {section.questions.map((q, qIdx) => (
 <div key={qIdx} className="bg-slate-950/50 rounded-lg p-3 text-secondary text-slate-300 flex gap-3">
 <span className="text-slate-500 font-mono">{qIdx + 1}.</span>
 <p>{q}</p>
 </div>
 ))}
 </div>
 )}
 </div>
 ))}
 </div>

 </div>
 );
}
