import React from 'react';
import { Shield, AlertTriangle, CheckCircle, Settings, BarChart3 } from 'lucide-react';
import ProtectionCard from '../ProtectionCard';
import '../calls.css';

const ChatrShieldScreen: React.FC = () => {
 const stats = [
 { label: 'Spam Blocked', value: '124', icon: Shield, color: 'text-primary' },
 { label: 'Scam Alerts', value: '12', icon: AlertTriangle, color: 'text-orange-500' },
 { label: 'Verified Calls', value: '1,042', icon: CheckCircle, color: 'text-green-500' },
 ];

 return (
 <div className="screen-container">
 <h1 className="large-title mt-10">Chatr Shield</h1>
 
 <ProtectionCard />
 
 <div className="grid grid-cols-1 gap-4 mb-8">
 {stats.map((stat, i) => (
 <div key={i} className="bg-[#1C1C1E] p-4 rounded-xl flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className={`p-3 bg-[#2C2C2E] rounded-lg ${stat.color}`}>
 <stat.icon size={24} />
 </div>
 <div>
 <div className="text-gray-400 text-secondary">{stat.label}</div>
 <div className="text-page font-bold">{stat.value}</div>
 </div>
 </div>
 <BarChart3 size={20} className="text-gray-600" />
 </div>
 ))}
 </div>
 
 <h2 className="text-workspace font-bold mb-4">Protection Settings</h2>
 <div className="bg-[#1C1C1E] rounded-xl overflow-hidden">
 <div className="p-4 flex items-center justify-between border-b border-gray-800">
 <div className="flex items-center gap-3">
 <Shield size={20} className="text-primary" />
 <span>Block Known Spammers</span>
 </div>
 <div className="w-12 h-6 bg-primary rounded-full relative">
 <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
 </div>
 </div>
 <div className="p-4 flex items-center justify-between border-b border-gray-800">
 <div className="flex items-center gap-3">
 <AlertTriangle size={20} className="text-orange-500" />
 <span>High Risk Warning</span>
 </div>
 <div className="w-12 h-6 bg-primary rounded-full relative">
 <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
 </div>
 </div>
 <div className="p-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Settings size={20} className="text-gray-400" />
 <span>AI Sensitivity</span>
 </div>
 <span className="text-primary font-medium">Standard</span>
 </div>
 </div>
 </div>
 );
};

export default ChatrShieldScreen;
