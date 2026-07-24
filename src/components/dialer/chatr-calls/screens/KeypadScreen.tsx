import React, { useState, useEffect } from 'react';
import { Phone, Delete, ShieldCheck, Loader2, Globe, Users, Database } from 'lucide-react';
import DialKey from '../DialKey';
import { performDeepIntelligenceLookup } from '@/lib/chatr-shield/intelligence-service';
import { CallerIntelligence } from '@/lib/chatr-shield/types';
import '../calls.css';

interface KeypadScreenProps {
 onCall: (number: string) => void;
 themeColor: string;
}

const KeypadScreen: React.FC<KeypadScreenProps> = ({ onCall, themeColor }) => {
 const [number, setNumber] = useState('');
 const [aiData, setAiData] = useState<CallerIntelligence | null>(null);
 const [isScanning, setIsScanning] = useState(false);
 const [scanningPhase, setScanningPhase] = useState(0);

 const phases = ["Searching Phone Book...", "Checking Social Media...", "Scanning Google Identity...", "Analyzing Crowd Reports..."];

 useEffect(() => {
 let interval: any;
 const triggerLookup = async () => {
 const rawNumber = number.replace(/\D/g, '');
 const isValidLength = rawNumber.length === 10 || (rawNumber.length === 12 && rawNumber.startsWith('91'));
 
 if (isValidLength) {
 setIsScanning(true);
 setScanningPhase(0);
 
 interval = setInterval(() => {
 setScanningPhase(prev => (prev + 1) % phases.length);
 }, 200);

 try {
 const data = await performDeepIntelligenceLookup(number);
 setAiData(data);
 } catch (err) {
 console.error('Intelligence lookup failed', err);
 } finally {
 setIsScanning(false);
 clearInterval(interval);
 }
 } else {
 setAiData(null);
 setIsScanning(false);
 clearInterval(interval);
 }
 };

 const timer = setTimeout(triggerLookup, 400); 
 return () => {
 clearTimeout(timer);
 clearInterval(interval);
 };
 }, [number]);

 const handleKeyClick = (val: string) => {
 setNumber(prev => prev + val);
 };

 const handleDelete = () => {
 setNumber(prev => prev.slice(0, -1));
 };

 const keys = [
 { n: '1', l: '' }, { n: '2', l: 'ABC' }, { n: '3', l: 'DEF' },
 { n: '4', l: 'GHI' }, { n: '5', l: 'JKL' }, { n: '6', l: 'MNO' },
 { n: '7', l: 'PQRS' }, { n: '8', l: 'TUV' }, { n: '9', l: 'WXYZ' },
 { n: '*', l: '' }, { n: '0', l: '+' }, { n: '#', l: '' },
 ];

 return (
 <div className="screen-container flex flex-col items-center pb-24 bg-[#09090B] text-white">
 <div className="mt-8 mb-4 min-h-[80px] flex flex-col items-center justify-center">
 <div className="text-display font-light tracking-[0.15em] mb-2 overflow-hidden whitespace-nowrap px-4 text-center w-full tabular-nums">
 {number || ' '}
 </div>
 {number && (
 <button className="text-[12px] font-bold uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-all duration-500 active:scale-95" style={{ color: themeColor }}>
 Add Number
 </button>
 )}
 </div>

 <div className="min-h-[44px] w-full mb-4 px-6 flex items-center justify-center">
 {isScanning ? (
 <div className="flex flex-col items-center justify-center gap-2 py-3 w-full max-w-[300px] rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-md animate-in fade-in zoom-in duration-300">
 <div className="flex gap-2">
 <Users size={14} className="transition-colors duration-300" style={{ color: scanningPhase === 0 ? themeColor : 'rgba(255,255,255,0.2)' }} />
 <Globe size={14} className="transition-colors duration-300" style={{ color: (scanningPhase === 1 || scanningPhase === 2) ? themeColor : 'rgba(255,255,255,0.2)' }} />
 <Database size={14} className="transition-colors duration-300" style={{ color: scanningPhase === 3 ? themeColor : 'rgba(255,255,255,0.2)' }} />
 </div>
 <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: themeColor }}>
 {phases[scanningPhase]}
 </span>
 </div>
 ) : aiData ? (
 <div className="ai-preview-strip w-full max-w-[300px] animate-in fade-in slide-in-from-top-2 duration-500 flex flex-col gap-1 py-3 px-5 border border-white/10 rounded-[24px] bg-white/[0.03] backdrop-blur-md">
 <div className="flex items-center gap-3">
 <div className="p-1.5 rounded-full bg-white/5" style={{ color: themeColor }}>
 <ShieldCheck size={16} />
 </div>
 <div className="text-[15px] font-bold text-white leading-none truncate">
 {aiData.displayName || 'Analyzing Number...'}
 </div>
 </div>
 <div className="text-[11px] text-white/40 font-medium leading-tight truncate pl-9">
 {aiData.displayName ? "Verified Identity • Chatr Shield Active" : "Scanning global registries..."}
 </div>
 </div>
 ) : null}
 </div>

 <div className="dial-pad scale-[0.90] sm:scale-95 origin-top mt-[-10px]">
 {keys.map(k => (
 <DialKey key={k.n} number={k.n} letters={k.l} onClick={handleKeyClick} />
 ))}
 <div />
 <button 
 type="button" 
 className="call-button shadow-2xl active:scale-95 transition-all duration-300 touch-manipulation hover:brightness-110" 
 style={{ 
 backgroundColor: themeColor, 
 boxShadow: `0 12px 40px ${themeColor}4D` 
 }} 
 onClick={() => onCall(number)}
 >
 <Phone size={32} fill="white" stroke="none" />
 </button>
 {number && (
 <div className="flex items-center justify-center cursor-pointer active:scale-90 transition-all duration-300 p-4 group" onClick={handleDelete}>
 <Delete size={26} className="text-white/20 group-hover:text-white transition-colors" />
 </div>
 )}
 </div>
 </div>
 );
};

export default KeypadScreen;
