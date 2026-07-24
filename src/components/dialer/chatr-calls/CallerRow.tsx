import React from 'react';
import { Phone, PhoneMissed, PhoneOutgoing, Info } from 'lucide-react';
import { CallerInfo } from './mockData';
import './calls.css';

interface CallerRowProps {
 caller: CallerInfo;
 onClick: (caller: CallerInfo) => void;
 onInfoClick: (caller: CallerInfo) => void;
}

const CallerRow: React.FC<CallerRowProps> = ({ caller, onClick, onInfoClick }) => {
 const getIcon = () => {
 switch (caller.status) {
 case 'missed': return <PhoneMissed size={14} className="text-red-500" />;
 case 'outgoing': return <PhoneOutgoing size={14} className="text-gray-500" />;
 default: return <Phone size={14} className="text-gray-500" />;
 }
 };

 return (
 <div className="caller-row" onClick={() => onClick(caller)}>
 <div className="caller-avatar">
 {caller.name.charAt(0)}
 </div>
 <div className="caller-info">
 <div className={`caller-name ${caller.isSpam ? 'spam' : ''}`}>
 {caller.name}
 </div>
 <div className="caller-sub flex items-center gap-1">
 {getIcon()}
 {caller.type}
 </div>
 </div>
 <div className="flex items-center gap-3">
 <span className="call-time">{caller.timestamp}</span>
 <button 
 className="p-2 text-primary"
 onClick={(e) => {
 e.stopPropagation();
 onInfoClick(caller);
 }}
 >
 <Info size={20} />
 </button>
 </div>
 </div>
 );
};

export default CallerRow;
