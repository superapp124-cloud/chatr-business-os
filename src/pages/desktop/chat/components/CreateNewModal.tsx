import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Hash, Users, Globe, Lock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateNewModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSelect: (id: string) => void;
}

export const CreateNewModal: React.FC<CreateNewModalProps> = React.memo(({ isOpen, onClose, onSelect }) => {
 const navigate = useNavigate();
 if (!isOpen) return null;
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
 <div className="w-full max-w-lg bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
 <div className="flex items-center justify-between p-4 border-b border-white/10">
 <h2 className="text-secondary font-bold text-white">Create New</h2>
 <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors">
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className="p-2">
 {[
 { id: 'channel', icon: Hash, title: 'Channel', desc: 'For team discussions and specific topics', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
 { id: 'group', icon: Users, title: 'Group Chat', desc: 'Private conversation with multiple people', color: 'text-blue-400', bg: 'bg-blue-500/10' },
 { id: 'community', icon: Globe, title: 'Community', desc: 'Large scale organization workspace', color: 'text-violet-400', bg: 'bg-violet-500/10' },
 ].map(item => (
 <button key={item.id} onClick={() => onSelect(item.id)} className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left group">
 <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', item.bg)}>
 <item.icon className={cn('w-5 h-5', item.color)} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-secondary font-bold text-white/90 group-hover:text-white">{item.title}</div>
 <div className="text-label text-white/50 mt-0.5">{item.desc}</div>
 </div>
 <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 mt-3" />
 </button>
 ))}
 </div>
 <div className="p-4 border-t border-white/10 bg-black/20">
 <div className="flex items-center gap-2">
 <Lock className="w-3.5 h-3.5 text-emerald-400" />
 <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">End-to-End Encrypted</span>
 </div>
 </div>
 </div>
 </div>
 );
});
