import React, { useState, useEffect } from 'react';
import { 
 Dialog, 
 DialogContent, 
 DialogHeader, 
 DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
 Sparkles, 
 ScanText, 
 Receipt, 
 Calendar, 
 Languages,
 Send,
 Loader2,
 Share
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useVisualIntelligence } from '@/hooks/useVisualIntelligence';

interface VisualIntelligenceScannerProps {
 isOpen: boolean;
 onClose: () => void;
 imageUrl: string | null;
 onShareToChat?: (text: string) => void;
}

const QUICK_ACTIONS = [
 { label: 'Extract Text', icon: ScanText, prompt: 'Extract all the text from this image exactly as it appears. Format it nicely.' },
 { label: 'Read Receipt', icon: Receipt, prompt: 'Extract all line items, total amount, taxes, date, and merchant name from this receipt. Present as a table.' },
 { label: 'Find Events', icon: Calendar, prompt: 'Are there any dates, times, or events mentioned in this image? Extract them into an itinerary or list.' },
 { label: 'Translate', icon: Languages, prompt: 'Translate any text in this image into English.' },
];

export const VisualIntelligenceScanner = ({ 
 isOpen, 
 onClose, 
 imageUrl,
 onShareToChat
}: VisualIntelligenceScannerProps) => {
 const [prompt, setPrompt] = useState('Analyze this image and describe what you see in detail.');
 const { scanImage, isScanning, result, setResult } = useVisualIntelligence();

 // Reset when opened with new image
 useEffect(() => {
 if (isOpen) {
 setResult(null);
 setPrompt('Analyze this image and describe what you see in detail.');
 }
 }, [isOpen, imageUrl, setResult]);

 const handleScan = async (overridePrompt?: string) => {
 if (!imageUrl) return;
 const finalPrompt = overridePrompt || prompt;
 setPrompt(finalPrompt);
 await scanImage(imageUrl, finalPrompt);
 };

 const handleShare = () => {
 if (result && onShareToChat) {
 onShareToChat(`*AI Vision Analysis:*\n\n${result}`);
 onClose();
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="sm:max-w-[600px] h-[90vh] sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white/95 backdrop-blur-xl border-white/20">
 <DialogHeader className="px-6 py-4 border-b border-gray-100/50 bg-white/50 backdrop-blur-md sticky top-0 z-10">
 <DialogTitle className="flex items-center gap-2 text-section bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
 <Sparkles className="w-5 h-5 text-blue-600" />
 Visual Intelligence
 </DialogTitle>
 </DialogHeader>

 <div className="flex-1 overflow-hidden flex flex-col">
 <ScrollArea className="flex-1 p-6">
 <div className="flex flex-col gap-6">
 {/* Image Preview */}
 {imageUrl && (
 <div className="relative rounded-2xl overflow-hidden shadow-lg border border-gray-100/50 bg-gray-50/50 p-2 flex justify-center">
 <img 
 src={imageUrl} 
 alt="Scan target" 
 className="max-h-[300px] rounded-xl object-contain"
 />
 {isScanning && (
 <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
 <div className="bg-white/90 p-4 rounded-2xl shadow-xl flex flex-col items-center gap-3">
 <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
 <span className="text-secondary font-medium text-gray-700 animate-pulse">Analyzing image...</span>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Results Area */}
 {result && (
 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
 <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-white/50 prose-pre:border prose-pre:border-blue-100">
 <ReactMarkdown>{result}</ReactMarkdown>
 </div>
 
 {onShareToChat && (
 <div className="mt-4 pt-4 border-t border-blue-100/50 flex justify-end">
 <Button 
 onClick={handleShare}
 className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all"
 >
 <Share className="w-4 h-4 mr-2" />
 Share to Chat
 </Button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </ScrollArea>

 {/* Input Area */}
 <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-100">
 {/* Quick Actions (Only show if not scanning and no result yet, or if we want to allow re-scans easily) */}
 <div className="flex gap-2 overflow-x-auto pb-3 mb-1 scrollbar-hide">
 {QUICK_ACTIONS.map((action) => {
 const ActionIcon = action.icon;
 return (
 <Button
 key={action.label}
 variant="outline"
 size="sm"
 className="rounded-full bg-white whitespace-nowrap border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
 onClick={() => handleScan(action.prompt)}
 disabled={isScanning}
 >
 <ActionIcon className="w-3.5 h-3.5 mr-1.5" />
 {action.label}
 </Button>
 );
 })}
 </div>

 <form 
 onSubmit={(e) => { e.preventDefault(); handleScan(); }}
 className="flex gap-2"
 >
 <Input
 value={prompt}
 onChange={(e) => setPrompt(e.target.value)}
 placeholder="Ask something about this image..."
 className="rounded-full border-gray-200 focus-visible:ring-blue-500 bg-white"
 disabled={isScanning}
 />
 <Button 
 type="submit" 
 size="icon"
 disabled={isScanning || !prompt.trim()}
 className="rounded-full bg-gradient-to-r from-blue-600 to-violet-600 hover:opacity-90 shadow-md shrink-0"
 >
 {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
 </Button>
 </form>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
};
