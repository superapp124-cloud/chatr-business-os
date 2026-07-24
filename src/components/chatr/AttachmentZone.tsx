import React, { useCallback, useState } from 'react';
import { Paperclip, X, File, FileText, Image as ImageIcon } from 'lucide-react';
import { attachmentEngine } from '@/core/services/AttachmentEngine';
import { Attachment } from '@/core/capabilities/types';
import { motion, AnimatePresence } from 'framer-motion';

interface AttachmentZoneProps {
 onAttachmentsChange: (attachments: Attachment[]) => void;
 attachments: Attachment[];
}

export const AttachmentZone: React.FC<AttachmentZoneProps> = ({ onAttachmentsChange, attachments }) => {
 const [isDragging, setIsDragging] = useState(false);

 const handleDragEnter = (e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(true);
 };

 const handleDragLeave = (e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(false);
 };

 const handleDrop = async (e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(false);
 
 const files = Array.from(e.dataTransfer.files);
 await processFiles(files);
 };

 const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files) {
 const files = Array.from(e.target.files);
 await processFiles(files);
 }
 };

 const processFiles = async (files: File[]) => {
 const newAttachments: Attachment[] = [];
 for (const file of files) {
 const attachment = await attachmentEngine.uploadFile(file);
 newAttachments.push(attachment);
 }
 onAttachmentsChange([...attachments, ...newAttachments]);
 };

 const removeAttachment = (id: string) => {
 onAttachmentsChange(attachments.filter(a => a.id !== id));
 };

 return (
 <div 
 className={`w-full transition-colors ${isDragging ? 'bg-indigo-500/10 border-indigo-500/50 rounded-xl border-dashed border-2 p-2' : ''}`}
 onDragEnter={handleDragEnter}
 onDragOver={(e) => e.preventDefault()}
 onDragLeave={handleDragLeave}
 onDrop={handleDrop}
 >
 <AnimatePresence>
 {attachments.length > 0 && (
 <motion.div 
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="flex flex-wrap gap-2 pb-2 px-2"
 >
 {attachments.map((att) => (
 <div key={att.id} className="flex items-center gap-2 bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-white/10 group relative">
 {att.mimeType.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-blue-400" /> : <FileText className="w-3.5 h-3.5 text-rose-400" />}
 <span className="text-label text-white/80 max-w-[120px] truncate">{att.name}</span>
 <button 
 onClick={() => removeAttachment(att.id)}
 className="w-4 h-4 rounded-full bg-zinc-700 hover:bg-rose-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 -right-1.5"
 >
 <X className="w-2.5 h-2.5 text-white" />
 </button>
 </div>
 ))}
 </motion.div>
 )}
 </AnimatePresence>

 <div className="absolute left-4 bottom-3">
 <label className="cursor-pointer text-white/40 hover:text-white transition-colors">
 <Paperclip className="w-5 h-5" />
 <input type="file" multiple className="hidden" onChange={handleFileSelect} />
 </label>
 </div>
 </div>
 );
};
