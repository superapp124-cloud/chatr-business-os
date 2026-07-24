import React from 'react';
import { Building2, TrendingUp, Users, Globe, ChevronRight } from 'lucide-react';
import { AccountArtifact } from '@/core/capabilities/crm/types';

export function AccountOverviewCard({ data }: { data: Partial<AccountArtifact> }) {
 return (
 <div className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">
 {/* Header */}
 <div className="p-4 border-b border-slate-700/50 bg-violet-950/30 flex items-center gap-3">
 <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
 <Building2 className="w-5 h-5 text-violet-400" />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="text-white font-semibold truncate">{data.companyName}</h3>
 <p className="text-slate-400 text-label">{data.industry}</p>
 </div>
 <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
 </div>

 {/* Stats */}
 <div className="p-4 grid grid-cols-2 gap-3">
 <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
 <div className="flex items-center gap-1.5 mb-1">
 <TrendingUp className="w-3 h-3 text-emerald-400" />
 <span className="text-[10px] text-slate-400 uppercase tracking-wider">Revenue</span>
 </div>
 <p className="text-secondary font-semibold text-white">
 ₹{((data.annualRevenue || 0) / 100000).toFixed(1)}L/yr
 </p>
 </div>
 <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
 <div className="flex items-center gap-1.5 mb-1">
 <Users className="w-3 h-3 text-blue-400" />
 <span className="text-[10px] text-slate-400 uppercase tracking-wider">Employees</span>
 </div>
 <p className="text-secondary font-semibold text-white">{data.employeeCount?.toLocaleString()}</p>
 </div>
 </div>

 {/* Contact */}
 <div className="px-4 pb-4 flex items-center justify-between">
 <div>
 <p className="text-[11px] text-slate-500 mb-0.5">Primary Contact</p>
 <p className="text-secondary text-slate-200">{data.primaryContact}</p>
 </div>
 {data.website && (
 <a href={`https://${data.website}`} target="_blank" rel="noreferrer"
 className="flex items-center gap-1 text-violet-400 hover:text-violet-300 text-label transition-colors">
 <Globe className="w-3.5 h-3.5" />
 Website
 </a>
 )}
 </div>
 </div>
 );
}
