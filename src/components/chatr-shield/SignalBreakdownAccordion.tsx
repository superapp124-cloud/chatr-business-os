import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Globe, Users, Database, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignalSectionProps {
 title: string;
 icon: React.ElementType;
 children: React.ReactNode;
 defaultOpen?: boolean;
}

const SignalSection: React.FC<SignalSectionProps> = ({ title, icon: Icon, children, defaultOpen = false }) => {
 const [isOpen, setIsOpen] = useState(defaultOpen);

 return (
 <div className="border-b border-zinc-800 last:border-0">
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="w-full py-4 flex items-center justify-between text-zinc-300 hover:text-white transition"
 >
 <div className="flex items-center gap-3">
 <div className="p-2 bg-zinc-900 rounded-lg text-zinc-500">
 <Icon size={18} />
 </div>
 <span className="font-bold text-secondary">{title}</span>
 </div>
 {isOpen ? <ChevronUp size={18} className="text-zinc-600" /> : <ChevronDown size={18} className="text-zinc-600" />}
 </button>
 
 {isOpen && (
 <div className="pb-6 px-1 animate-in slide-in-from-top-2 duration-200">
 {children}
 </div>
 )}
 </div>
 );
};

interface SignalBreakdownAccordionProps {
 caller: any;
}

const SignalBreakdownAccordion: React.FC<SignalBreakdownAccordionProps> = ({ caller }) => {
 return (
 <div className="bg-zinc-950 rounded-2xl p-2">
 <SignalSection title="Community Signals" icon={Users} defaultOpen={true}>
 <div className="space-y-4">
 <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
 <span className="text-label text-zinc-500">Spam Reports</span>
 <span className="font-bold text-red-500">{caller.communityReportCount}</span>
 </div>
 <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
 <span className="text-label text-zinc-500">Lookups in last 24h</span>
 <span className="font-bold text-zinc-200">{caller.communityLookupCount.toLocaleString()}</span>
 </div>
 <div className="flex flex-wrap gap-2">
 {caller.communityTags.map((tag: string) => (
 <span key={tag} className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md text-[10px] font-bold uppercase">
 {tag}
 </span>
 ))}
 </div>
 </div>
 </SignalSection>

 <SignalSection title="Web Identity" icon={Globe}>
 {caller.webIdentity ? (
 <div className="space-y-4">
 <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
 <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Business Registry</div>
 <div className="text-zinc-200 font-bold">{caller.webIdentity.businessName}</div>
 <div className="text-label text-zinc-500">{caller.webIdentity.category}</div>
 </div>
 <div className="flex justify-between items-center px-1">
 <span className="text-label text-zinc-500">TRAI DND Status</span>
 <span className={cn(
 "text-label font-bold",
 caller.webIdentity.traiDndRegistered ? "text-red-500" : "text-green-500"
 )}>
 {caller.webIdentity.traiDndRegistered ? "REGISTERED" : "CLEAN"}
 </span>
 </div>
 </div>
 ) : (
 <div className="text-label text-zinc-600 italic px-2">No public web identity found for this number.</div>
 )}
 </SignalSection>

 <SignalSection title="Carrier Intelligence" icon={Database}>
 <div className="grid grid-cols-2 gap-3">
 <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
 <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Operator</div>
 <div className="text-zinc-200 font-bold text-secondary">{caller.carrierData.operator}</div>
 </div>
 <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
 <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">State</div>
 <div className="text-zinc-200 font-bold text-secondary">{caller.carrierData.state}</div>
 </div>
 <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
 <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Type</div>
 <div className="text-zinc-200 font-bold text-secondary uppercase">{caller.carrierData.numberType}</div>
 </div>
 <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
 <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Spoof Protection</div>
 <div className={cn(
 "text-secondary font-bold",
 caller.carrierData.cliMismatch ? "text-red-500" : "text-green-500"
 )}>
 {caller.carrierData.cliMismatch ? "FAILED" : "ACTIVE"}
 </div>
 </div>
 </div>
 </SignalSection>
 </div>
 );
};

export default SignalBreakdownAccordion;
