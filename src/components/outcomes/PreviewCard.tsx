import React from 'react';
import { CommitmentPreview } from '../../core/capabilities/types';
import { Check, X } from 'lucide-react';

interface PreviewCardProps {
 preview: CommitmentPreview;
 onConfirm: () => void;
 onCancel: () => void;
 isExecuting: boolean;
}

export const PreviewCard: React.FC<PreviewCardProps> = ({ preview, onConfirm, onCancel, isExecuting }) => {
 return (
 <div className="bg-zinc-800/40 rounded-lg mt-2 p-3 border border-zinc-700/50">
 <div className="flex items-center gap-2 mb-3">
 {preview.icon && <span className="text-workspace">{preview.icon}</span>}
 <h4 className="text-secondary font-semibold text-white/90">{preview.title}</h4>
 </div>

 <div className="space-y-2 mb-4 bg-zinc-900/50 p-2 rounded-md">
 {preview.lines.map((line, idx) => (
 <div key={idx} className="flex justify-between items-center text-label">
 <span className="text-white/50 font-medium">{line.label}</span>
 <span className="text-white/90 text-right">{line.value}</span>
 </div>
 ))}
 </div>

 <div className="flex gap-2 mt-2">
 <button 
 onClick={onConfirm}
 disabled={isExecuting}
 className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-button font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
 >
 {isExecuting ? 'Executing...' : preview.cta} <Check className="w-3 h-3" />
 </button>
 <button 
 onClick={onCancel}
 disabled={isExecuting}
 className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white/70 text-button font-semibold rounded-lg transition-colors"
 >
 <X className="w-3 h-3" />
 </button>
 </div>
 </div>
 );
};
