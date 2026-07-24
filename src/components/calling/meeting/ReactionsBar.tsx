import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const REACTIONS = [
 { emoji: '👍', label: 'Thumbs Up' },
 { emoji: '❤️', label: 'Love' },
 { emoji: '👏', label: 'Clap' },
 { emoji: '🎉', label: 'Celebrate' },
 { emoji: '👋', label: 'Wave' },
 { emoji: '🤔', label: 'Thinking' },
 { emoji: '😂', label: 'Laugh' },
 { emoji: '🔥', label: 'Fire' },
];

interface FloatingReaction {
 id: string;
 emoji: string;
 x: number;
}

interface ReactionsBarProps {
 onClose: () => void;
}

export const ReactionsBar: React.FC<ReactionsBarProps> = ({ onClose }) => {
 const [floating, setFloating] = useState<FloatingReaction[]>([]);

 const sendReaction = (emoji: string, label: string) => {
 const id = Math.random().toString(36).slice(2);
 const x = 40 + Math.random() * 20;
 setFloating(prev => [...prev, { id, emoji, x }]);
 setTimeout(() => setFloating(prev => prev.filter(r => r.id !== id)), 2500);
 toast.success(`Reacted with ${emoji}`, { duration: 1000 });
 };

 return (
 <>
 {/* Floating Reactions */}
 <div className="fixed bottom-28 left-1/2 -translate-x-1/2 pointer-events-none z-50 w-48 h-24 overflow-hidden">
 {floating.map(r => (
 <div
 key={r.id}
 className="absolute bottom-0 text-display animate-float-up"
 style={{ left: `${r.x}%` }}
 >
 {r.emoji}
 </div>
 ))}
 </div>

 {/* Reaction Picker */}
 <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 p-3 animate-in slide-in-from-bottom-4 fade-in duration-200 z-50">
 <div className="flex items-center gap-1">
 {REACTIONS.map((r, i) => (
 <button
 key={i}
 onClick={() => { sendReaction(r.emoji, r.label); }}
 title={r.label}
 className="w-10 h-10 rounded-xl hover:bg-white/[0.1] flex items-center justify-center text-page transition-all hover:scale-125 active:scale-95"
 >
 {r.emoji}
 </button>
 ))}
 </div>
 </div>

 <style>{`
 @keyframes float-up {
 0% { transform: translateY(0) scale(1); opacity: 1; }
 100% { transform: translateY(-80px) scale(1.5); opacity: 0; }
 }
 .animate-float-up {
 animation: float-up 2.5s ease-out forwards;
 }
 `}</style>
 </>
 );
};
