import React, { useEffect, useState } from 'react';
import type { UnderstandingProvenance } from '@/core/intent/types';

interface EntityTokenProps {
 label: string;
 type?: string;
 provenance?: UnderstandingProvenance;
 style?: React.CSSProperties;
}

export function EntityToken({ label, type, provenance, style }: EntityTokenProps) {
 const [showGlow, setShowGlow] = useState(false);

 useEffect(() => {
 // When a newly verified entity mounts, trigger the glow
 if (provenance?.verified) {
 setShowGlow(true);
 const timer = setTimeout(() => setShowGlow(false), 220);
 return () => clearTimeout(timer);
 }
 }, [provenance?.verified]);

 return (
 <div 
 className="group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-transparent transition-colors hover:bg-gray-50 animate-fade-rise"
 style={style}
 >
 {/* Glow Layer */}
 {showGlow && (
 <div className="absolute inset-0 rounded-md animate-glow pointer-events-none" />
 )}
 
 <span className="text-secondary font-medium text-gray-900 relative z-10">{label}</span>
 
 {/* Provenance & Living Actions Tooltip */}
 {provenance && (
 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-auto z-50">
 <div className="bg-gray-900 text-white rounded shadow-lg overflow-hidden flex flex-col">
 {/* Provenance Header */}
 <div className="px-3 py-2 text-label border-b border-gray-700/50">
 <div className="font-medium text-gray-100">
 {provenance.verified ? 'Verified from' : 'Matched from'} {provenance.resolver || provenance.source}
 </div>
 <div className="text-gray-400 mt-0.5 text-[10px]">
 {new Date(provenance.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </div>
 </div>

 {/* Living Actions */}
 {(type === 'person' || type === 'location') && (
 <div className="flex flex-col text-label ">
 {type === 'person' && (
 <>
 <button className="px-3 py-1.5 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 text-gray-200">Open Contact</button>
 <button className="px-3 py-1.5 text-left hover:bg-gray-800 transition-colors text-gray-200">Recent Meetings</button>
 </>
 )}
 {type === 'location' && (
 <button className="px-3 py-1.5 text-left hover:bg-gray-800 transition-colors text-gray-200">Check Availability</button>
 )}
 </div>
 )}
 
 {/* Arrow */}
 <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900 pointer-events-none" />
 </div>
 </div>
 )}
 </div>
 );
}
