import React from 'react';
import './calls.css';

interface DialKeyProps {
 number: string;
 letters?: string;
 onClick: (val: string) => void;
}

const DialKey: React.FC<DialKeyProps> = ({ number, letters, onClick }) => {
 return (
 <button 
 type="button" 
 className="dial-key bg-white/[0.03] border border-white/[0.05] active:bg-white/10 active:scale-95 transition-all duration-300 group" 
 onClick={() => onClick(number)}
 >
 <span className="dial-key-number text-white text-[32px] font-medium leading-none group-active:scale-110 transition-transform">{number}</span>
 {letters && <span className="dial-key-letters text-white/30 text-[10px] font-bold tracking-[0.1em] mt-1 uppercase">{letters}</span>}
 </button>
 );
};

export default DialKey;
