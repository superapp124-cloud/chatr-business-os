import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import './calls.css';

const ProtectionCard: React.FC = () => {
 return (
 <div className="protection-card pulse">
 <div className="flex justify-between items-start mb-4">
 <div className="protection-status text-white">
 <ShieldCheck size={24} />
 <span>Active Protection</span>
 </div>
 <div className="status-pill text-white flex items-center gap-1">
 <Zap size={12} fill="currentColor" />
 <span>Real-time</span>
 </div>
 </div>
 <p className="text-white/80 text-secondary mb-0">
 Chatr Shield is actively monitoring incoming calls for spam and fraud.
 </p>
 <div className="absolute -right-4 -bottom-4 opacity-10">
 <ShieldCheck size={120} />
 </div>
 </div>
 );
};

export default ProtectionCard;
