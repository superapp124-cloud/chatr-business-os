import React, { useState } from 'react';
import { ShieldAlert, Shield, AlertTriangle, Eye, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShieldFeedback } from './ShieldFeedback';

export interface SecurityScan {
 id: string;
 message_id: string;
 overall_score: number;
 overall_level: string;
 detections: Record<string, number>;
 explanation?: string[];
 recommended_action?: string;
}

interface ChatrShieldWarningProps {
 scan: SecurityScan;
 children: React.ReactNode;
}

export const ChatrShieldWarning = ({ scan, children }: ChatrShieldWarningProps) => {
 const [isRevealed, setIsRevealed] = useState(false);
 const score = scan.overall_score;

 // Level 1: Safe (0-39)
 if (score < 40) {
 return <>{children}</>;
 }

 // Level 2: Suspicious / Caution (40-69)
 if (score < 70) {
 return (
 <div className="relative group">
 {/* Subtle amber caution badge next to message */}
 <div className="absolute -left-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <div className="bg-amber-100 p-1 rounded-full shadow-sm" title="CHATR Shield: Suspicious content">
 <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
 </div>
 </div>
 {children}
 </div>
 );
 }

 // Level 3/4: Dangerous (70-100)
 return (
 <div className="relative rounded-2xl overflow-hidden mb-2 max-w-[85%]">
 {/* The Blurred Content Container */}
 <div className={`transition-all duration-500 ${!isRevealed ? 'blur-md opacity-40 select-none pointer-events-none' : ''}`}>
 {children}
 </div>

 {/* The Shield Overlay (Warning Card) */}
 {!isRevealed && (
 <div className="absolute inset-0 z-10 flex flex-col justify-center p-4 bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-2xl">
 <div className="flex items-start gap-3">
 <div className="p-2 bg-red-100 rounded-full shrink-0">
 <ShieldAlert className="w-5 h-5 text-red-600" />
 </div>
 <div className="flex-1">
 <h4 className="text-secondary font-semibold text-red-900 flex items-center gap-2">
 Dangerous Content
 <span className="text-[10px] font-mono bg-red-200 text-red-800 px-1.5 py-0.5 rounded">
 Score: {score}
 </span>
 </h4>
 
 {scan.explanation && scan.explanation.length > 0 && (
 <ul className="mt-2 space-y-1">
 {scan.explanation.map((bullet, idx) => (
 <li key={idx} className="text-label text-red-800 flex items-start gap-1.5">
 <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 opacity-50" />
 <span>{bullet}</span>
 </li>
 ))}
 </ul>
 )}

 <div className="mt-3 flex items-center gap-2">
 <Button 
 onClick={() => setIsRevealed(true)}
 variant="outline"
 size="sm"
 className="bg-white/80 border-red-200 text-red-700 hover:bg-red-50 h-8 text-label "
 >
 <Eye className="w-3.5 h-3.5 mr-1.5" />
 Reveal Anyway
 </Button>
 </div>

 <ShieldFeedback messageId={scan.message_id} scanId={scan.id} />
 </div>
 </div>
 </div>
 )}

 {/* Small badge if revealed */}
 {isRevealed && (
 <div className="absolute -left-6 top-2">
 <div className="bg-red-100 p-1 rounded-full shadow-sm" title="CHATR Shield: Dangerous content (Revealed)">
 <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
 </div>
 </div>
 )}
 </div>
 );
};
