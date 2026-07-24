import React, { useState } from 'react';
import { HiringAnalysisViewModel } from './viewmodels';
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HiringAnalysisCard({ data }: { data: HiringAnalysisViewModel }) {
 const [expandedSection, setExpandedSection] = useState<string | null>('overview');

 const toggle = (section: string) => setExpandedSection(s => s === section ? null : section);

 return (
 <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">
 
 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
 <User className="w-5 h-5 text-indigo-400" />
 </div>
 <div>
 <h3 className="text-white font-medium">{data.candidateName}</h3>
 <p className="text-slate-400 text-label">{data.contact} • {data.experienceYears}y exp</p>
 </div>
 </div>
 <div className="text-right">
 <div className="flex items-center gap-1.5 justify-end">
 <ShieldCheck className="w-4 h-4 text-emerald-400" />
 <span className="text-emerald-400 font-medium text-secondary">{Math.round(data.confidence * 100)}% Confidence</span>
 </div>
 <p className="text-slate-500 text-label mt-1">Enterprise Policy Checked</p>
 </div>
 </div>

 {/* Overview Section */}
 <div className="border-b border-slate-700/50">
 <button onClick={() => toggle('overview')} className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
 <span className="text-secondary font-medium text-slate-200">Candidate Overview</span>
 {expandedSection === 'overview' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
 </button>
 {expandedSection === 'overview' && (
 <div className="px-4 pb-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/50 flex items-center justify-between">
 <span className="text-label text-slate-400">Match Score</span>
 <span className={cn("text-section font-bold", data.matchPercentage > 80 ? "text-emerald-400" : "text-amber-400")}>
 {data.matchPercentage}%
 </span>
 </div>
 <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/50 flex items-center justify-between">
 <span className="text-label text-slate-400">Recommendation</span>
 <span className="text-label font-bold text-white bg-indigo-500 px-2 py-1 rounded-md">{data.recommendation}</span>
 </div>
 </div>
 <div className="mt-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-3">
 <p className="text-label text-indigo-200/70 mb-1">Decision Reasoning</p>
 <p className="text-secondary text-indigo-100">{data.reasoning}</p>
 </div>
 </div>
 )}
 </div>

 {/* Skills Section */}
 <div className="border-b border-slate-700/50">
 <button onClick={() => toggle('skills')} className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
 <span className="text-secondary font-medium text-slate-200">Skills & Gaps Analysis</span>
 {expandedSection === 'skills' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
 </button>
 {expandedSection === 'skills' && (
 <div className="px-4 pb-4 space-y-4">
 <div>
 <p className="text-label text-slate-400 mb-2 flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-emerald-400" /> Verified Skills</p>
 <div className="flex flex-wrap gap-1.5">
 {data.skills.map(s => (
 <span key={s} className="text-[11px] bg-slate-800 text-slate-300 px-2 py-1 rounded-md border border-slate-700">{s}</span>
 ))}
 </div>
 </div>
 <div>
 <p className="text-label text-slate-400 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-400" /> Missing / Unverified Skills</p>
 <div className="flex flex-wrap gap-1.5">
 {data.missingSkills.map(s => (
 <span key={s} className="text-[11px] bg-amber-500/10 text-amber-300 px-2 py-1 rounded-md border border-amber-500/20">{s}</span>
 ))}
 </div>
 </div>
 </div>
 )}
 </div>

 </div>
 );
}
