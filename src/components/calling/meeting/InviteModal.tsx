import React, { useState } from 'react';
import { X, Copy, Link, Mail, QrCode, MessageCircle, Phone, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InviteModalProps {
 meetingId?: string;
 meetingLink?: string;
 passcode?: string;
 onClose: () => void;
}

const CHANNELS = [
 { icon: Copy, label: 'Copy Link', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', hoverBg: 'hover:bg-purple-500/20' },
 { icon: Mail, label: 'Email', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', hoverBg: 'hover:bg-blue-500/20' },
 { icon: MessageCircle, label: 'WhatsApp', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', hoverBg: 'hover:bg-emerald-500/20' },
 { icon: Phone, label: 'SMS', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', hoverBg: 'hover:bg-orange-500/20' },
 { icon: QrCode, label: 'QR Code', color: 'text-white/60', bg: 'bg-white/[0.04]', border: 'border-white/[0.06]', hoverBg: 'hover:bg-white/[0.08]' },
];

export const InviteModal: React.FC<InviteModalProps> = ({
 meetingId = 'CHATR-8F4K-219A',
 meetingLink = 'https://meet.chatr.chat/8F4K219A',
 passcode = '349821',
 onClose,
}) => {
 const [copiedLink, setCopiedLink] = useState(false);
 const [copiedId, setCopiedId] = useState(false);

 const copy = (text: string, type: 'link' | 'id') => {
 navigator.clipboard.writeText(text).catch(() => {});
 if (type === 'link') { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
 else { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
 toast.success(type === 'link' ? 'Meeting link copied!' : 'Meeting ID copied!');
 };

 return (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

 {/* Modal */}
 <div
 className="relative w-full max-w-md bg-zinc-950 border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 fade-in duration-200"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Gradient accent */}
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

 {/* Header */}
 <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
 <div>
 <h2 className="text-body font-bold text-white">Invite to Meeting</h2>
 <p className="text-[11px] text-white/40 mt-0.5">Share your meeting details below</p>
 </div>
 <button
 onClick={onClose}
 className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
 >
 <X className="w-4 h-4 text-white/60" />
 </button>
 </div>

 <div className="p-5 space-y-4">
 {/* Meeting Link */}
 <div className="space-y-1.5">
 <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Meeting Link</label>
 <div className="flex items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
 <Link className="w-3.5 h-3.5 text-purple-400 shrink-0" />
 <span className="flex-1 text-label text-white/70 font-mono truncate">{meetingLink}</span>
 <button
 onClick={() => copy(meetingLink, 'link')}
 className={cn(
 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all',
 copiedLink
 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
 : 'bg-purple-600/80 hover:bg-purple-500 text-white border border-purple-500/30'
 )}
 >
 {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
 {copiedLink ? 'Copied!' : 'Copy'}
 </button>
 </div>
 </div>

 {/* Meeting ID & Passcode */}
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Meeting ID</label>
 <button
 onClick={() => copy(meetingId, 'id')}
 className={cn(
 'w-full p-3 bg-white/[0.03] border rounded-xl text-left transition-all group',
 copiedId ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/[0.07] hover:border-white/[0.12]'
 )}
 >
 <div className="font-mono text-secondary font-bold text-white/90">{meetingId}</div>
 <div className={cn('text-[9px] mt-1 flex items-center gap-1', copiedId ? 'text-emerald-400' : 'text-white/30 group-hover:text-white/50')}>
 {copiedId ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
 {copiedId ? 'Copied!' : 'Click to copy'}
 </div>
 </button>
 </div>
 <div className="space-y-1.5">
 <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Passcode</label>
 <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
 <div className="font-mono text-secondary font-bold text-white/90 tracking-widest">{passcode}</div>
 <div className="text-[9px] text-white/30 mt-1">6-digit PIN</div>
 </div>
 </div>
 </div>

 {/* Channels */}
 <div className="space-y-2">
 <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Share Via</label>
 <div className="grid grid-cols-5 gap-2">
 {CHANNELS.map((ch, i) => (
 <button
 key={i}
 onClick={() => toast.info(`${ch.label} — coming soon!`)}
 className={cn(
 'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all',
 ch.bg, ch.border, ch.hoverBg
 )}
 >
 <ch.icon className={cn('w-4 h-4', ch.color)} />
 <span className="text-[8px] text-white/50 font-medium">{ch.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Copy full invite */}
 <button
 onClick={() => {
 const text = `You're invited to a CHATR meeting!\n\nMeeting Link: ${meetingLink}\nMeeting ID: ${meetingId}\nPasscode: ${passcode}`;
 navigator.clipboard.writeText(text).catch(() => {});
 toast.success('Full invite copied to clipboard!');
 }}
 className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] transition-all text-label text-white/60 hover:text-white/90"
 >
 Copy Full Invite Text
 </button>
 </div>
 </div>
 </div>
 );
};
