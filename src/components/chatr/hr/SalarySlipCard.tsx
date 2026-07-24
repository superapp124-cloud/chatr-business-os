import React from 'react';
import { IndianRupee, Download } from 'lucide-react';

export function SalarySlipCard({ data }: any) {
 return (
 <div className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl mb-4 font-sans">
 <div className="p-4 border-b border-slate-700/50 bg-emerald-950/30 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
 <IndianRupee className="w-5 h-5 text-emerald-400" />
 </div>
 <div>
 <h3 className="text-white font-medium">Salary Slip</h3>
 <p className="text-slate-400 text-label">{data.month} {data.year}</p>
 </div>
 </div>
 </div>
 <div className="p-4 space-y-3 border-b border-slate-700/50">
 <div className="flex justify-between items-center text-secondary">
 <span className="text-slate-400">Base Salary</span>
 <span className="text-slate-200">₹{data.baseSalary.toLocaleString()}</span>
 </div>
 <div className="flex justify-between items-center text-secondary">
 <span className="text-slate-400">Allowances</span>
 <span className="text-slate-200">₹{data.allowances.toLocaleString()}</span>
 </div>
 <div className="flex justify-between items-center text-secondary">
 <span className="text-slate-400">Deductions</span>
 <span className="text-rose-400">-₹{data.deductions.toLocaleString()}</span>
 </div>
 </div>
 <div className="p-4 bg-slate-950/50 flex justify-between items-center">
 <span className="text-secondary font-bold text-slate-300 uppercase tracking-wider">Net Pay</span>
 <span className="text-workspace font-bold text-emerald-400">₹{data.netPay.toLocaleString()}</span>
 </div>
 <div className="p-3 bg-slate-950/50 border-t border-slate-800">
 <button className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-button rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700">
 <Download className="w-4 h-4" /> Download PDF
 </button>
 </div>
 </div>
 );
}
