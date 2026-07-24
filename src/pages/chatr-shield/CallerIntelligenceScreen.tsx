import React, { useState } from 'react';
import { ChevronLeft, Share2, Info, MapPin, Globe, Phone, ShieldCheck, AlertTriangle, ShieldAlert, ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CallerIntelligence } from '@/lib/chatr-shield/types';
import CallerAvatar from '@/components/chatr-shield/CallerAvatar';
import TrustScoreBadge from '@/components/chatr-shield/TrustScoreBadge';
import AIAnalysisCard from '@/components/chatr-shield/AIAnalysisCard';
import SignalBreakdownAccordion from '@/components/chatr-shield/SignalBreakdownAccordion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CallerIntelligenceScreenProps {
 caller: CallerIntelligence;
 onBack: () => void;
}

const CallerIntelligenceScreen: React.FC<CallerIntelligenceScreenProps> = ({ caller, onBack }) => {
 const [isSpam, setIsSpam] = useState(caller.trustBand === 'block');

 const toggleSpam = () => {
 setIsSpam(!isSpam);
 toast.success(isSpam ? "Number marked as safe" : "Number marked as spam");
 };

 return (
 <div className="fixed inset-0 z-[200] bg-zinc-950 overflow-y-auto text-white animate-fade">
 {/* Hero Section */}
 <div className="h-80 bg-gradient-to-b from-primary/20 to-zinc-950 relative">
 <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-10">
 <button 
 className="p-2.5 bg-black/40 rounded-full backdrop-blur-md border border-white/10"
 onClick={onBack}
 >
 <ChevronLeft size={24} />
 </button>
 <div className="flex gap-2">
 <button className="p-2.5 bg-black/40 rounded-full backdrop-blur-md border border-white/10"><Share2 size={20} /></button>
 <button className="p-2.5 bg-black/40 rounded-full backdrop-blur-md border border-white/10"><Info size={20} /></button>
 </div>
 </div>
 
 <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center">
 <CallerAvatar 
 band={isSpam ? 'block' : caller.trustBand} 
 src={caller.businessLogoUrl} 
 initials={caller.displayName?.charAt(0) || caller.businessName?.charAt(0)}
 isBusiness={caller.isBusiness}
 size="xl"
 className="mb-4"
 />
 <h1 className="text-display text-center mb-1 ">
 {caller.displayName || caller.businessName || 'Unknown Caller'}
 </h1>
 <p className="text-zinc-400 text-section mb-4">{caller.phoneNumber}</p>
 
 <div className="flex gap-4">
 <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-105 transition">
 <Phone size={18} fill="white" />
 Call Back
 </button>
 <button 
 onClick={toggleSpam}
 className={cn(
 "flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all border",
 isSpam 
 ? "bg-green-500/10 border-green-500/50 text-green-500" 
 : "bg-red-500/10 border-red-500/50 text-red-500"
 )}
 >
 {isSpam ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
 {isSpam ? "Mark as Safe" : "Mark as Spam"}
 </button>
 </div>
 </div>
 </div>
 
 <div className="p-6 space-y-6">
 {/* Trust Header */}
 <div className="flex items-center justify-between px-2">
 <div className="flex items-center gap-2">
 <ShieldCheck size={20} className="text-primary" />
 <span className="font-bold text-zinc-400 uppercase tracking-widest text-[11px]">Chatr Trust Engine</span>
 </div>
 <TrustScoreBadge score={isSpam ? 10 : caller.trustScore} band={isSpam ? 'block' : caller.trustBand} />
 </div>

 {/* AI Analysis */}
 <AIAnalysisCard 
 summary={isSpam ? "This number is manually marked as spam. All calls will be automatically flagged." : caller.aiSummary} 
 flags={isSpam ? ["Manually Flagged", "User Blocked"] : caller.aiFlags} 
 band={isSpam ? 'block' : caller.trustBand} 
 />
 
 {/* Quick Signals */}
 <div className="grid grid-cols-2 gap-4">
 <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
 <MapPin size={20} className="text-zinc-500 mb-2" />
 <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Global Origin</div>
 <div className="font-medium text-zinc-200">{caller.carrierData.state}</div>
 </div>
 <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
 <Globe size={20} className="text-zinc-500 mb-2" />
 <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Network Operator</div>
 <div className="font-medium text-zinc-200">{caller.carrierData.operator}</div>
 </div>
 </div>

 {/* Detailed Signals */}
 <div className="space-y-4">
 <h2 className="text-workspace font-bold px-2">Intelligence Layers</h2>
 <SignalBreakdownAccordion caller={caller} />
 </div>

 {/* Community Reports Footer */}
 <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-[32px] p-8 text-center backdrop-blur-xl">
 <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
 <ShieldX size={32} className="text-red-500" />
 </div>
 <h3 className="text-workspace font-bold mb-2">Crowdsource Report</h3>
 <p className="text-label text-zinc-500 mb-6 ">
 Contribute to the Chatr Trust Network. Your report will help millions of users identify this caller in real-time.
 </p>
 <div className="grid grid-cols-2 gap-3">
 <button className="py-3 bg-red-500 text-white rounded-2xl font-bold text-button shadow-lg shadow-red-500/20">
 Scam/Fraud
 </button>
 <button className="py-3 bg-zinc-800 text-white rounded-2xl font-bold text-button">
 Telemarketer
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

export default CallerIntelligenceScreen;
