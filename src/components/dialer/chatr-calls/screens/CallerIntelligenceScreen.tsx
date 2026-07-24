import React from 'react';
import { ChevronLeft, ShieldCheck, MapPin, Globe, Share2, Info } from 'lucide-react';
import { CallerInfo } from '../mockData';
import '../calls.css';

interface CallerIntelligenceScreenProps {
 caller: CallerInfo;
 onBack: () => void;
}

const CallerIntelligenceScreen: React.FC<CallerIntelligenceScreenProps> = ({ caller, onBack }) => {
 return (
 <div className="fixed inset-0 z-[200] bg-black overflow-y-auto">
 <div className="h-64 bg-gradient-to-b from-primary/30 to-black relative">
 <button 
 className="absolute top-12 left-4 p-2 bg-black/20 rounded-full backdrop-blur-md"
 onClick={onBack}
 >
 <ChevronLeft size={24} />
 </button>
 
 <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center">
 <div className="w-24 h-24 rounded-full bg-[#2C2C2E] border-4 border-black flex items-center justify-center text-display mb-4">
 {caller.name.charAt(0)}
 </div>
 <h1 className="text-display text-center mb-1">{caller.name}</h1>
 <p className="text-gray-400 text-section mb-4">{caller.number}</p>
 
 <div className="flex gap-4">
 <button className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center"><Share2 size={20} /></button>
 <button className="w-12 h-12 rounded-full bg-[#2C2C2E] flex items-center justify-center"><Info size={20} /></button>
 </div>
 </div>
 </div>
 
 <div className="p-6">
 <div className="bg-[#1C1C1E] rounded-2xl p-6 mb-6">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-2">
 <ShieldCheck size={20} className="text-primary" />
 <span className="font-bold">Trust Analysis</span>
 </div>
 <div className="text-primary font-bold text-workspace">{caller.trustScore || 85}%</div>
 </div>
 
 <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-6">
 <div 
 className="bg-primary h-full rounded-full" 
 style={{ width: `${caller.trustScore || 85}%` }} 
 />
 </div>
 
 <div className="space-y-4">
 <div className="flex items-start gap-3">
 <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
 <ShieldCheck size={14} className="text-green-500" />
 </div>
 <p className="text-secondary text-gray-300">Verified identity via Chatr network</p>
 </div>
 <div className="flex items-start gap-3">
 <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
 <ShieldCheck size={14} className="text-green-500" />
 </div>
 <p className="text-secondary text-gray-300">No negative reports found</p>
 </div>
 </div>
 </div>
 
 <div className="grid grid-cols-2 gap-4 mb-6">
 <div className="bg-[#1C1C1E] rounded-2xl p-4">
 <MapPin size={20} className="text-gray-500 mb-2" />
 <div className="text-label text-gray-500 mb-1">Location</div>
 <div className="font-medium">{caller.location || 'Unknown'}</div>
 </div>
 <div className="bg-[#1C1C1E] rounded-2xl p-4">
 <Globe size={20} className="text-gray-500 mb-2" />
 <div className="text-label text-gray-500 mb-1">Carrier</div>
 <div className="font-medium">{caller.carrier || 'Unknown'}</div>
 </div>
 </div>
 
 <h2 className="text-workspace font-bold mb-4 px-2">AI Insights</h2>
 <div className="bg-[#1C1C1E] rounded-2xl p-4 space-y-4">
 <p className="text-secondary text-gray-400 italic">
 "This caller typically calls during business hours and has high interaction rates with users in your contact list."
 </p>
 </div>
 </div>
 </div>
 );
};

export default CallerIntelligenceScreen;
