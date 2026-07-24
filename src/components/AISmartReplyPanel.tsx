import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { generateSmartReplyTextsWithCloudFallback } from '@/lib/onDeviceAI';

interface AISmartReplyPanelProps {
 lastMessage: string;
 onSelectReply: (reply: string) => void;
}

export const AISmartReplyPanel = ({ lastMessage, onSelectReply }: AISmartReplyPanelProps) => {
 const [replies, setReplies] = useState<string[]>([]);
 const [loading, setLoading] = useState(false);
 const [showReplies, setShowReplies] = useState(false);

 const generateReplies = async () => {
 if (!lastMessage || loading) return;

 setLoading(true);
 setShowReplies(true);
 try {
 // Routes through on-device router: Nano first, cloud (ai-smart-reply) only as fallback.
 const result = await generateSmartReplyTextsWithCloudFallback(lastMessage);
 setReplies(result);
 } catch (error) {
 console.error('Error generating smart replies:', error);
 } finally {
 setLoading(false);
 }
 };

 if (!lastMessage) {
 return null;
 }

 return (
 <div className="px-3 pb-2 border-t bg-muted/30">
 {!showReplies ? (
 <Button
 variant="ghost"
 size="sm"
 onClick={generateReplies}
 disabled={loading}
 className="w-full h-9 flex items-center justify-center gap-2 text-label hover:bg-primary/5"
 >
 <Sparkles className="h-4 w-4 text-primary" />
 {loading ? 'Generating...' : 'Generate AI Smart Replies'}
 </Button>
 ) : (
 <>
 <div className="flex items-center gap-2 py-2">
 <Sparkles className="h-4 w-4 text-primary" />
 <span className="text-label text-muted-foreground ">AI Suggestions</span>
 </div>
 <div className="flex items-center gap-1.5 flex-wrap">
 {replies.map((reply, index) => (
 <Button
 key={index}
 variant="outline"
 size="sm"
 onClick={() => {
 onSelectReply(reply);
 setReplies([]);
 setShowReplies(false);
 }}
 className="h-8 px-3 rounded-full text-label font-normal border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all"
 >
 {reply}
 </Button>
 ))}
 </div>
 </>
 )}
 </div>
 );
};
