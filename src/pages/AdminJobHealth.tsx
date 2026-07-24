import React from 'react';
import { Activity } from 'lucide-react';

const AdminJobHealth: React.FC = () => {
 return (
 <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-200">
 <Activity className="w-16 h-16 text-indigo-500 mb-4" />
 <h1 className="text-display mb-2">Admin Job Health</h1>
 <p className="text-slate-400 max-w-md">
 This dashboard is currently under construction.
 </p>
 </div>
 );
};

export default AdminJobHealth;
