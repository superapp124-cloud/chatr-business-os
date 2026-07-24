import React from 'react';
import { MessageSquare, Hash, Zap, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionsProps {
 onNewChat?: () => void;
 onCreateChannel?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onNewChat, onCreateChannel }) => {
 const actions = [
 { icon: MessageSquare, title: 'New Chat', subtitle: 'Message anyone', color: 'text-blue-400', bg: 'bg-blue-500/10', onClick: onNewChat },
 { icon: Hash, title: 'Create Channel', subtitle: 'Start a channel', color: 'text-emerald-400', bg: 'bg-emerald-500/10', onClick: onCreateChannel },
 { icon: Zap, title: 'AI Insights', subtitle: 'Get intelligence', color: 'text-violet-400', bg: 'bg-violet-500/10', onClick: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })) },
 { icon: UploadCloud, title: 'Upload File', subtitle: 'Share files', color: 'text-sky-400', bg: 'bg-sky-500/10', onClick: () => document.getElementById('global-file-upload')?.click() },
 ];

 return (
 <div className="grid grid-cols-4 gap-4">
 {actions.map((action, i) => (
 <button 
 key={i} 
 onClick={action.onClick}
 className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] transition-all hover:-translate-y-0.5 group text-left"
 >
 <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center shrink-0`}>
 <action.icon className={`w-5 h-5 ${action.color}`} />
 </div>
 <div>
 <p className="text-secondary font-bold text-white/90 ">{action.title}</p>
 <p className="text-label text-white/40 mt-0.5">{action.subtitle}</p>
 </div>
 </button>
 ))}
 </div>
 );
};
