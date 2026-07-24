import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { summarizeChatWithFallback } from '@/lib/onDeviceAI';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';

interface ChatSummarizerProps {
 messages: any[];
}

export const ChatSummarizer = ({ messages }: ChatSummarizerProps) => {
 const { toast } = useToast();
 const [summary, setSummary] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const [showDialog, setShowDialog] = useState(false);

 const generateSummary = async () => {
 if (messages.length < 5) {
 toast({
 title: 'Not Enough Messages',
 description: 'Need at least 5 messages to generate a summary',
 variant: 'destructive',
 });
 return;
 }

 setIsLoading(true);
 setShowDialog(true);
 
 try {
 setSummary(await summarizeChatWithFallback(messages));
 } catch (error: any) {
 console.error('Summarization error:', error);
 toast({
 title: 'Summarization Failed',
 description: error.message || 'Could not generate summary',
 variant: 'destructive',
 });
 setShowDialog(false);
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <>
 <Button
 variant="ghost"
 size="icon"
 className="rounded-full"
 onClick={generateSummary}
 disabled={messages.length < 5}
 title="Summarize conversation"
 >
 <FileText className="h-5 w-5" />
 </Button>

 <Dialog open={showDialog} onOpenChange={setShowDialog}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <FileText className="h-5 w-5 text-primary" />
 Conversation Summary
 </DialogTitle>
 <DialogDescription>
 AI-generated summary of your conversation
 </DialogDescription>
 </DialogHeader>

 {isLoading ? (
 <div className="flex items-center justify-center py-12">
 <div className="text-center">
 <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
 <p className="text-secondary text-muted-foreground">Analyzing conversation...</p>
 </div>
 </div>
 ) : (
 <div className="prose prose-sm dark:prose-invert max-w-none">
 <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap">
 {summary}
 </div>
 </div>
 )}

 <div className="flex justify-end gap-2 mt-4">
 <Button variant="outline" onClick={() => setShowDialog(false)}>
 Close
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </>
 );
};
