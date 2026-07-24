import React from 'react';
import { Settings } from 'lucide-react';

const ProUpgrade: React.FC = () => {
 return (
 <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-200">
 <Settings className="w-16 h-16 text-indigo-500 mb-4" />
 <h1 className="text-display mb-2">Pro Upgrade</h1>
 <p className="text-slate-400 max-w-md">
 This page is currently under construction.
 </p>
 </div>
 );
};

export default ProUpgrade;
