import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Scan, Image as ImageIcon, Check, Loader2, Search, FileText, Calendar, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { analyzeImage } from '@/utils/visualIntelligence';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface VisualIntelligenceSheetProps {
 isOpen: boolean;
 onClose: () => void;
 initialImage: File | string | null;
}

const QUICK_ACTIONS = [
 { id: 'extract', label: 'Extract Text', icon: FileText, prompt: 'Extract all readable text from this image exactly as written. Preserve formatting.' },
 { id: 'identify', label: 'Identify Object', icon: Search, prompt: 'What is the main object or subject in this image? Provide details like brand, type, or origin if applicable.' },
 { id: 'event', label: 'Create Event', icon: Calendar, prompt: 'Extract any dates, times, and event details from this image and format it clearly.' },
 { id: 'describe', label: 'Describe Scene', icon: Tag, prompt: 'Provide a detailed, vivid description of everything happening in this image.' },
];

export const VisualIntelligenceSheet = ({ isOpen, onClose, initialImage }: VisualIntelligenceSheetProps) => {
 const [image, setImage] = useState<File | string | null>(null);
 const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 const [isScanning, setIsScanning] = useState(false);
 const [resultText, setResultText] = useState<string | null>(null);
 const [customPrompt, setCustomPrompt] = useState('');

 // Handle initial image
 useEffect(() => {
 if (initialImage && isOpen) {
 handleImageSelection(initialImage);
 }
 if (!isOpen) {
 // Reset state when closed
 setTimeout(() => {
 setImage(null);
 setPreviewUrl(null);
 setResultText(null);
 setCustomPrompt('');
 setIsScanning(false);
 }, 300);
 }
 }, [initialImage, isOpen]);

 const handleImageSelection = (img: File | string) => {
 setImage(img);
 if (typeof img === 'string') {
 setPreviewUrl(img);
 } else {
 const objectUrl = URL.createObjectURL(img);
 setPreviewUrl(objectUrl);
 }
 setResultText(null);
 };

 const runAnalysis = async (prompt: string) => {
 if (!image) return;
 
 setIsScanning(true);
 setResultText(null);
 
 try {
 const response = await analyzeImage(image, prompt);
 if (response.success && response.text) {
 setResultText(response.text);
 } else {
 toast.error(response.error || 'Failed to analyze image');
 }
 } catch (error: any) {
 toast.error('An error occurred during analysis');
 } finally {
 setIsScanning(false);
 }
 };

 const handleCustomPromptSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!customPrompt.trim()) return;
 runAnalysis(customPrompt);
 };

 if (!isOpen) return null;

 return (
 <AnimatePresence>
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col justify-end"
 onClick={onClose}
 >
 <motion.div 
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
 className="bg-[#FAFAFA] rounded-t-[32px] w-full max-h-[90vh] flex flex-col shadow-2xl"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="flex items-center justify-between p-5 pb-3 shrink-0">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center">
 <Sparkles className="w-4 h-4 text-white" />
 </div>
 <h2 className="text-[17px] font-semibold tracking-tight text-[#1A1A2E]">Visual Intelligence</h2>
 </div>
 <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 bg-black/5 hover:bg-black/10">
 <X className="w-4 h-4 text-[#1A1A2E]" />
 </Button>
 </div>

 <div className="flex-1 overflow-hidden flex flex-col px-5 pb-5">
 
 {/* Image Preview Area */}
 <div className="relative w-full h-[220px] shrink-0 bg-black/5 rounded-2xl overflow-hidden flex items-center justify-center mb-4">
 {previewUrl ? (
 <>
 <img src={previewUrl} alt="Selected for analysis" className="w-full h-full object-contain" />
 
 {/* Scanning Animation Overlay */}
 {isScanning && (
 <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center overflow-hidden">
 <motion.div 
 initial={{ top: '-10%' }}
 animate={{ top: '110%' }}
 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
 className="absolute left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,1)]"
 />
 <div className="flex flex-col items-center gap-2">
 <Scan className="w-8 h-8 text-white animate-pulse" />
 <span className="text-white text-secondary font-medium">Analyzing...</span>
 </div>
 </div>
 )}
 </>
 ) : (
 <div className="flex flex-col items-center gap-3 text-muted-foreground">
 <ImageIcon className="w-10 h-10 opacity-50" />
 <p className="text-secondary">No image selected</p>
 </div>
 )}
 </div>

 {/* Quick Actions (Only show if image exists and no result yet, or if we want them always available) */}
 <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 shrink-0 mb-4">
 {QUICK_ACTIONS.map((action) => {
 const Icon = action.icon;
 return (
 <button
 key={action.id}
 disabled={!image || isScanning}
 onClick={() => runAnalysis(action.prompt)}
 className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-[13px] font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Icon className="w-3.5 h-3.5" />
 {action.label}
 </button>
 );
 })}
 </div>

 {/* Results Area */}
 <ScrollArea className="flex-1 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
 {resultText ? (
 <div className="prose prose-sm prose-slate max-w-none">
 <ReactMarkdown>{resultText}</ReactMarkdown>
 </div>
 ) : isScanning ? (
 <div className="flex items-center justify-center h-full min-h-[100px] text-gray-400">
 <Loader2 className="w-5 h-5 animate-spin mr-2" />
 <span className="text-secondary">Processing image...</span>
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-gray-400 text-center">
 <Sparkles className="w-6 h-6 mb-2 opacity-50" />
 <p className="text-secondary">Ask a question or select an action<br/>to analyze this image.</p>
 </div>
 )}
 </ScrollArea>

 {/* Custom Query Input */}
 <form onSubmit={handleCustomPromptSubmit} className="flex gap-2 shrink-0">
 <Input
 value={customPrompt}
 onChange={(e) => setCustomPrompt(e.target.value)}
 placeholder="Ask anything about this image..."
 disabled={!image || isScanning}
 className="rounded-full bg-white border-gray-200 h-12 px-4 shadow-sm focus-visible:ring-violet-500"
 />
 <Button 
 type="submit" 
 disabled={!image || isScanning || !customPrompt.trim()}
 className="rounded-full h-12 w-12 shrink-0 bg-violet-600 hover:bg-violet-700 p-0"
 >
 <Search className="w-5 h-5" />
 </Button>
 </form>
 
 </div>
 </motion.div>
 </motion.div>
 </AnimatePresence>
 );
};
