import React, { useState } from 'react';
import { LayoutGrid, User, Sidebar, Presentation, PictureInPicture, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LayoutMode = 'gallery' | 'speaker' | 'sidebar' | 'presenter' | 'pip';

interface LayoutSwitcherProps {
 current: LayoutMode;
 onChange: (mode: LayoutMode) => void;
 onClose: () => void;
}

const LAYOUTS: { mode: LayoutMode; icon: React.ElementType; label: string; desc: string }[] = [
 { mode: 'gallery', icon: LayoutGrid, label: 'Gallery', desc: 'See everyone in a grid' },
 { mode: 'speaker', icon: User, label: 'Speaker', desc: 'Focus on the active speaker' },
 { mode: 'sidebar', icon: Sidebar, label: 'Sidebar', desc: 'Speaker + thumbnail row' },
 { mode: 'presenter', icon: Presentation, label: 'Presenter', desc: 'Screen share focused view' },
 { mode: 'pip', icon: PictureInPicture, label: 'Picture-in-Picture', desc: 'Float video while you work' },
];

export const LayoutSwitcher: React.FC<LayoutSwitcherProps> = ({ current, onChange, onClose }) => {
 return (
 <div className="absolute bottom-full right-4 mb-3 w-72 bg-zinc-900 border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200 z-50">
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
 <h3 className="text-secondary font-bold text-white">View Layout</h3>
 <button onClick={onClose} className="w-6 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors">
 <X className="w-3.5 h-3.5 text-white/60" />
 </button>
 </div>

 <div className="p-2 space-y-1">
 {LAYOUTS.map((layout) => (
 <button
 key={layout.mode}
 onClick={() => { onChange(layout.mode); onClose(); }}
 className={cn(
 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left',
 current === layout.mode
 ? 'bg-purple-600/20 border border-purple-500/30 text-white'
 : 'hover:bg-white/[0.04] border border-transparent text-white/70'
 )}
 >
 <div className={cn(
 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
 current === layout.mode ? 'bg-purple-500/20' : 'bg-white/[0.05]'
 )}>
 <layout.icon className={cn('w-4.5 h-4.5', current === layout.mode ? 'text-purple-400' : 'text-white/50')} />
 </div>
 <div>
 <div className={cn('text-label font-semibold', current === layout.mode ? 'text-purple-300' : 'text-white/80')}>
 {layout.label}
 {current === layout.mode && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 font-bold">Active</span>}
 </div>
 <div className="text-[10px] text-white/40 mt-0.5">{layout.desc}</div>
 </div>
 </button>
 ))}
 </div>
 </div>
 );
};
