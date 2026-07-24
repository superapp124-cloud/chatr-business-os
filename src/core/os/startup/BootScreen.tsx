import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { kernelAPI } from '@/core/runtime/KernelAPI';

export const BootScreen = () => {
 const [bootingEngines, setBootingEngines] = useState<Record<string, 'INITIALIZING' | 'READY'>>({});
 
 useEffect(() => {
 const handleStart = (evt: any) => {
 const { engineId } = evt.payload || evt.detail || evt;
 if (engineId) {
 setBootingEngines(prev => ({ ...prev, [engineId]: 'INITIALIZING' }));
 }
 };
 
 const handleSuccess = (evt: any) => {
 const { engineId } = evt.payload || evt.detail || evt;
 if (engineId) {
 setBootingEngines(prev => ({ ...prev, [engineId]: 'READY' }));
 }
 };

 kernelAPI.events.subscribe('ENGINE_BOOT_START', handleStart);
 kernelAPI.events.subscribe('ENGINE_BOOT_SUCCESS', handleSuccess);

 return () => {
 kernelAPI.events.unsubscribe('ENGINE_BOOT_START', handleStart);
 kernelAPI.events.unsubscribe('ENGINE_BOOT_SUCCESS', handleSuccess);
 };
 }, []);

 const getStatusIcon = (status: 'INITIALIZING' | 'READY') => {
 if (status === 'READY') return <span className="text-green-400">✓</span>;
 return <span className="text-yellow-400 animate-pulse">○</span>;
 };

 const enginesList = Object.entries(bootingEngines);

 return (
 <motion.div 
 className="flex flex-col items-center justify-center min-h-screen w-full bg-slate-900 text-slate-200 font-mono"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 >
 <div className="w-full max-w-lg">
 <h1 className="text-display mb-2 tracking-widest text-center uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
 CHATR OS
 </h1>
 <p className="text-secondary text-slate-400 text-center mb-8">Booting Kernel v2.0...</p>

 <div className="space-y-2 mb-8">
 {enginesList.map(([engineId, status]) => (
 <motion.div 
 key={engineId}
 className={`flex justify-between items-center px-4 py-2 rounded border ${status === 'READY' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-800'}`}
 initial={{ x: -20, opacity: 0 }}
 animate={{ x: 0, opacity: 1 }}
 >
 <span className="text-secondary font-medium">{engineId}</span>
 <span>{getStatusIcon(status)}</span>
 </motion.div>
 ))}
 </div>
 </div>
 </motion.div>
 );
};
