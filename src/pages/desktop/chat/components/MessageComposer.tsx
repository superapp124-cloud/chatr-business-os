import React from 'react';
import { Plus, Camera, MapPin, User, FileText, Smile, Paperclip, Mic, Type, Sparkles, MessageSquare, Loader2, Languages, ListChecks, CornerUpRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ImageIcon } from 'lucide-react';

interface MessageComposerProps {
 messageInput: string;
 setMessageInput: (v: string) => void;
 selectedRoomName: string;
 isRewriting: boolean;
 onSendMessage: () => void;
 onKeyDown: (e: React.KeyboardEvent) => void;
 onFilePicker: (accept: string) => void;
 onSmartReply: () => void;
 onRewrite: () => void;
 onExtractActions: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = React.memo(({
 messageInput,
 setMessageInput,
 selectedRoomName,
 isRewriting,
 onSendMessage,
 onKeyDown,
 onFilePicker,
 onSmartReply,
 onRewrite,
 onExtractActions
}) => {
 return (
 <div className="p-4 pr-24 bg-zinc-950/80 backdrop-blur-xl border-t border-white/[0.06] relative z-20 shrink-0">
 <div className="max-w-4xl mx-auto relative group flex flex-col gap-2 bg-zinc-900 border border-white/[0.08] rounded-2xl p-2 focus-within:border-violet-500/50 shadow-inner">
 
 <div className="flex items-center">
 <div className="pl-2 pr-1">
 <Popover>
 <PopoverTrigger asChild>
 <button className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 transition-colors outline-none focus:ring-1 focus:ring-violet-500/50">
 <Plus className="w-4 h-4" />
 </button>
 </PopoverTrigger>
 <PopoverContent align="start" side="top" className="bg-[#111] border border-white/10 p-2 w-48 shadow-2xl rounded-2xl mb-2">
 <div className="flex flex-col gap-1">
 <button onClick={() => toast.info('Camera coming soon')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <Camera className="w-4 h-4 text-pink-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Camera</p>
 <p className="text-[9px] text-white/40">Take a photo</p>
 </div>
 </button>
 <button onClick={() => onFilePicker('image/*')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <ImageIcon className="w-4 h-4 text-purple-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Gallery</p>
 <p className="text-[9px] text-white/40">Choose from gallery</p>
 </div>
 </button>
 <button onClick={() => onFilePicker('.pdf,.doc,.docx,.xls,.xlsx,.txt')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <FileText className="w-4 h-4 text-blue-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Document</p>
 <p className="text-[9px] text-white/40">Share a file</p>
 </div>
 </button>
 <button onClick={() => toast.info('Location coming soon')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <MapPin className="w-4 h-4 text-emerald-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Location</p>
 <p className="text-[9px] text-white/40">Share your location</p>
 </div>
 </button>
 <button onClick={() => toast.info('Contact coming soon')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <User className="w-4 h-4 text-orange-500" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Contact</p>
 <p className="text-[9px] text-white/40">Share a contact</p>
 </div>
 </button>
 </div>
 </PopoverContent>
 </Popover>
 </div>
 
 <input 
 value={messageInput}
 onChange={e => setMessageInput(e.target.value)}
 onKeyDown={onKeyDown}
 placeholder={`Message ${selectedRoomName}... (Type @chatr to ask AI)`}
 className="flex-1 h-10 bg-transparent text-secondary px-2 focus:outline-none placeholder:text-white/30 text-white"
 />
 <div className="pr-1">
 <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 transition-colors">
 <Smile className="w-4 h-4" />
 </button>
 </div>
 </div>

 <div className="flex items-center justify-between px-2 pt-1">
 <div className="flex items-center gap-1">
 <button onClick={() => onFilePicker('image/*, .pdf, .doc, .docx, .xls, .xlsx, .txt')} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Attach file">
 <Paperclip className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => toast.info('Voice notes coming soon')} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Voice note">
 <Mic className="w-3.5 h-3.5" />
 </button>
 <div className="w-px h-3 bg-white/10 mx-1" />
 <button onClick={() => toast.info('Rich formatting coming soon')} className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Formatting">
 <Type className="w-3.5 h-3.5" />
 </button>
 <Popover>
 <PopoverTrigger asChild>
 <button disabled={!messageInput.trim()} className="p-1.5 rounded-md hover:bg-white/10 text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1.5 disabled:opacity-50 outline-none" title="AI Features">
 <Sparkles className="w-3.5 h-3.5" />
 <span className="text-[10px] font-bold tracking-wider uppercase">CHATR AI</span>
 </button>
 </PopoverTrigger>
 <PopoverContent align="center" side="top" className="bg-[#111] border border-white/10 p-2 w-48 shadow-2xl rounded-2xl mb-2">
 <div className="flex flex-col gap-1">
 <button onClick={onSmartReply} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
 <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Smart Replies</p>
 <p className="text-[9px] text-white/40">Get AI suggestions</p>
 </div>
 </button>
 <button onClick={onRewrite} disabled={isRewriting || !messageInput.trim()} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
 {isRewriting ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-blue-400" />}
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Rewrite</p>
 <p className="text-[9px] text-white/40">Improve message</p>
 </div>
 </button>
 <button onClick={() => toast.info('Translate coming soon')} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
 <Languages className="w-3.5 h-3.5 text-emerald-400" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Translate</p>
 <p className="text-[9px] text-white/40">Auto-translate</p>
 </div>
 </button>
 <button onClick={onExtractActions} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group">
 <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
 <ListChecks className="w-3.5 h-3.5 text-orange-400" />
 </div>
 <div>
 <p className="text-label font-semibold text-white/90">Extract Actions</p>
 <p className="text-[9px] text-white/40">Find tasks & reminders</p>
 </div>
 </button>
 </div>
 </PopoverContent>
 </Popover>
 </div>
 <button onClick={onSendMessage} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 flex items-center gap-1.5 text-white shadow-lg transition-colors text-button font-bold">
 <span>Send</span>
 <CornerUpRight className="w-3 h-3" />
 </button>
 </div>
 </div>
 </div>
 );
});
