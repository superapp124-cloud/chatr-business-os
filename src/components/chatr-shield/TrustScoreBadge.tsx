import React from 'react';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrustScoreBadgeProps {
 score: number;
 band: 'safe' | 'verify' | 'block';
 showLabel?: boolean;
 className?: string;
}

const TrustScoreBadge: React.FC<TrustScoreBadgeProps> = ({ score, band, showLabel = true, className }) => {
 const getStyles = () => {
 switch (band) {
 case 'safe':
 return {
 bg: 'bg-green-500/10',
 text: 'text-green-500',
 border: 'border-green-500/20',
 icon: ShieldCheck,
 label: 'TRUSTED'
 };
 case 'verify':
 return {
 bg: 'bg-amber-500/10',
 text: 'text-amber-500',
 border: 'border-amber-500/20',
 icon: Shield,
 label: 'VERIFY'
 };
 case 'block':
 return {
 bg: 'bg-red-500/10',
 text: 'text-red-500',
 border: 'border-red-500/20',
 icon: ShieldAlert,
 label: 'HIGH RISK'
 };
 }
 };

 const styles = getStyles();
 const Icon = styles.icon;

 return (
 <div className={cn(
 "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-tight",
 styles.bg,
 styles.text,
 styles.border,
 className
 )}>
 <Icon size={12} strokeWidth={3} />
 <span>{score}% {showLabel && styles.label}</span>
 </div>
 );
};

export default TrustScoreBadge;
