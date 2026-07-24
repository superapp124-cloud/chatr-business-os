import React from 'react';
import { ChevronLeft, Shield, ShieldCheck, ShieldAlert, ShieldX, Share2, Phone, MessageSquare, FileText, Clock, Globe, Zap, Users, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScoreOutput, submitCommunityReport } from '@/lib/chatr-shield/shield-pipeline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PostCallReportProps {
 phoneNumber: string;
 score: ScoreOutput;
 callDurationSeconds: number;
 onBack: () => void;
}

const PostCallReport: React.FC<PostCallReportProps> = ({ phoneNumber, score, callDurationSeconds, onBack }) => {
 const formatDuration = (s: number) =>
 s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

 const trustColor =
 score.label === 'SAFE' ? 'text-green-500' :
 score.label === 'SUSPICIOUS' ? 'text-amber-500' :
 (score.label === 'SPAM' || score.label === 'FRAUD') ? 'text-red-500' : 'text-zinc-400';

 const ringColor =
 score.label === 'SAFE' ? '#22C55E' :
 score.label === 'SUSPICIOUS' ? '#F59E0B' :
 (score.label === 'SPAM' || score.label === 'FRAUD') ? '#EF4444' : '#6B7280';

 const LAYERS = [
 { name: 'On-Device Cache', latency: '<2ms', hit: true, icon: Zap },
 { name: 'Community Score', latency: '<40ms', hit: score.pipeline_layers_used >= 2, icon: Users },
 { name: 'Registration Metadata', latency: '<60ms', hit: score.pipeline_layers_used >= 3, icon: Globe },
 { name: 'Chatr AI Enrichment', latency: 'async', hit: score.gemini_enriched, icon: Shield },
 { name: 'Voice Biometric', latency: 'stream', hit: score.deepfake_score !== null, icon: FileText },
 ];

 return (
 <div className="fixed inset-0 z-[200] bg-zinc-950 text-white overflow-y-auto">
 {/* Header */}
 <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 px-4 py-3 flex items-center justify-between z-10"
 style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
 >
 <button onClick={onBack} className="p-2 -ml-2"><ChevronLeft size={22} className="text-zinc-400" /></button>
 <span className="font-bold text-[15px]">Post-Call Report</span>
 <button className="p-2 -mr-2"><Share2 size={18} className="text-zinc-400" /></button>
 </div>

 <div className="p-4 space-y-4 pb-12">
 {/* Trust Score Hero */}
 <div className="bg-zinc-900 rounded-[24px] p-6 text-center border border-zinc-800">
 <div className="flex justify-center mb-4">
 <div className="relative w-28 h-28">
 <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
 <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="10" />
 <circle
 cx="50" cy="50" r="42" fill="none"
 stroke={ringColor} strokeWidth="10"
 strokeLinecap="round"
 strokeDasharray={`${2 * Math.PI * 42}`}
 strokeDashoffset={`${2 * Math.PI * 42 * (1 - score.trust_score / 100)}`}
 style={{ transition: 'stroke-dashoffset 1s ease' }}
 />
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center">
 <span className="text-display font-black" style={{ color: ringColor }}>{score.trust_score}</span>
 <span className="text-[10px] text-zinc-500 font-bold">TRUST SCORE</span>
 </div>
 </div>
 </div>
 <h2 className="text-workspace font-black mb-1">{score.display_name || phoneNumber}</h2>
 <p className="text-zinc-400 text-[13px] mb-3">{phoneNumber}</p>
 <div className="flex items-center justify-center gap-3">
 <span className={cn("text-[11px] font-black tracking-widest px-3 py-1 rounded-full border", trustColor,
 score.label === 'SAFE' ? 'border-green-900 bg-green-950' :
 score.label === 'SUSPICIOUS' ? 'border-amber-900 bg-amber-950' :
 (score.label === 'SPAM' || score.label === 'FRAUD') ? 'border-red-900 bg-red-950' :
 'border-zinc-700 bg-zinc-900'
 )}>
 {score.label}
 </span>
 <span className="text-[11px] text-zinc-500 font-bold">{score.confidence} CONFIDENCE</span>
 </div>
 </div>

 {/* Call Stats */}
 <div className="grid grid-cols-3 gap-3">
 {[
 { label: 'Duration', value: formatDuration(callDurationSeconds), icon: Clock },
 { label: 'Country', value: score.country.split('/')[0], icon: Globe },
 { label: 'Pipeline', value: `${score.pipeline_layers_used}/5`, icon: Zap },
 ].map(({ label, value, icon: Icon }) => (
 <div key={label} className="bg-zinc-900 rounded-2xl p-3 border border-zinc-800 text-center">
 <Icon size={16} style={{ color: '#8B5CF6' }} className="mx-auto mb-1" />
 <p className="text-[11px] text-zinc-500 font-bold uppercase">{label}</p>
 <p className="text-[14px] font-black text-zinc-100">{value}</p>
 </div>
 ))}
 </div>

 {/* AI Summary */}
 <div className="bg-indigo-950/50 border border-indigo-900 rounded-2xl p-4">
 <div className="flex items-center gap-2 mb-2">
 <Shield size={14} style={{ color: '#8B5CF6' }} />
 <span className="text-[11px] font-black tracking-wider" style={{ color: '#c084fc' }}>CHATR AI ANALYSIS</span>
 </div>
 <p className="text-[13px] text-zinc-300 leading-relaxed">{score.aiSummary || "No significant risk signals detected during this call."}</p>
 {score.risk_flags.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-3">
 {score.risk_flags.map(flag => (
 <span key={flag} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-bold">{flag}</span>
 ))}
 </div>
 )}
 </div>

 {/* 5-Layer Pipeline Breakdown */}
 <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
 <div className="px-4 py-3 border-b border-zinc-800">
 <span className="text-[11px] font-black text-zinc-400 tracking-wider uppercase">Intelligence Pipeline</span>
 </div>
 {LAYERS.map(({ name, latency, hit, icon: Icon }, i) => (
 <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0">
 <div className="flex items-center gap-3">
 <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", hit ? "bg-green-950" : "bg-zinc-800")}>
 <Icon size={12} className={hit ? "text-green-400" : "text-zinc-600"} />
 </div>
 <div>
 <p className="text-[13px] font-bold text-zinc-200">Layer {i + 1} — {name}</p>
 <p className="text-[10px] text-zinc-500">{latency}</p>
 </div>
 </div>
 <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", hit ? "bg-green-950 text-green-400" : "bg-zinc-800 text-zinc-600")}>
 {hit ? "RAN" : "SKIPPED"}
 </span>
 </div>
 ))}
 </div>

 {/* Community Actions */}
 <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
 <h3 className="text-[13px] font-black text-zinc-300 mb-3">Help the Community</h3>
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={() => { submitCommunityReport(phoneNumber, 'SPAM'); toast.error("Marked as spam. Thank you!"); }}
 className="py-3 bg-red-950 border border-red-900 text-red-400 rounded-xl font-black text-[12px] tracking-wider active:scale-95 transition"
 >
 🚫 Mark Spam
 </button>
 <button
 onClick={() => { submitCommunityReport(phoneNumber, 'SAFE'); toast.success("Marked as safe. Thank you!"); }}
 className="py-3 bg-green-950 border border-green-900 text-green-400 rounded-xl font-black text-[12px] tracking-wider active:scale-95 transition"
 >
 ✅ Mark Safe
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

export default PostCallReport;
