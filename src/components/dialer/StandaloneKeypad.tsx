import React, { useState, useCallback } from 'react';
import { Phone, Delete, UserPlus, MessageCircle } from 'lucide-react';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { cn } from '@/lib/utils';
import { useCall } from '@/contexts/CallContext';

const keys = [
 { num: '1', letters: '' },
 { num: '2', letters: 'ABC' },
 { num: '3', letters: 'DEF' },
 { num: '4', letters: 'GHI' },
 { num: '5', letters: 'JKL' },
 { num: '6', letters: 'MNO' },
 { num: '7', letters: 'PQRS' },
 { num: '8', letters: 'TUV' },
 { num: '9', letters: 'WXYZ' },
 { num: '*', letters: '' },
 { num: '0', letters: '+' },
 { num: '#', letters: '' },
];

export const StandaloneKeypad = () => {
 const [number, setNumber] = useState('');
 const haptics = useNativeHaptics();
 const { initiateCall } = useCall();

 const handleKeyPress = (val: string) => {
 haptics.light();
 if (number.length < 15) {
 setNumber(prev => prev + val);
 }
 };

 const handleBackspace = () => {
 haptics.selection();
 setNumber(prev => prev.slice(0, -1));
 };

 const handleCall = () => {
 if (!number) return;
 haptics.success();
 initiateCall(number);
 };

 return (
 <div className="flex flex-col items-center justify-between min-h-[70vh] pb-24 px-8 smooth-mount">
 {/* Number Display */}
 <div className="flex flex-col items-center justify-center h-32 w-full">
 <div className="text-display tracking-widest text-white mb-2 h-12">
 {number}
 </div>
 {number && (
 <button className="text-primary text-button font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-2">
 Add Contact
 </button>
 )}
 </div>

 {/* T9 Grid */}
 <div className="grid grid-cols-3 gap-x-8 gap-y-6">
 {keys.map((key) => (
 <button
 key={key.num}
 onClick={() => handleKeyPress(key.num)}
 className="w-20 h-20 rounded-full bg-white/5 border border-white/5 active:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center group"
 >
 <span className="text-display font-medium group-active:text-primary transition-colors">{key.num}</span>
 <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase">
 {key.letters || '\u00A0'}
 </span>
 </button>
 ))}
 </div>

 {/* Action Row */}
 <div className="flex items-center justify-between w-full max-w-[280px] mt-8">
 <div className="w-16 h-16 flex items-center justify-center">
 {number && (
 <button onClick={() => {}} className="text-white/40 hover:text-white transition-colors">
 <UserPlus className="w-7 h-7" />
 </button>
 )}
 </div>
 
 <button
 onClick={handleCall}
 disabled={!number}
 className={cn(
 "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-glow",
 number ? "bg-primary scale-110" : "bg-white/10 opacity-50"
 )}
 >
 <Phone className="w-10 h-10 text-white fill-current" />
 </button>

 <div className="w-16 h-16 flex items-center justify-center">
 {number && (
 <button
 onClick={handleBackspace}
 onContextMenu={(e) => { e.preventDefault(); setNumber(''); }}
 className="text-white/40 hover:text-white transition-colors"
 >
 <Delete className="w-8 h-8" />
 </button>
 )}
 </div>
 </div>
 </div>
 );
};
