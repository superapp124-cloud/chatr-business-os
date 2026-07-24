import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateSmartComposeWithFallback } from '@/lib/onDeviceAI';

interface SmartComposeProps {
 messages: any[];
 onSelectSuggestion: (text: string) => void;
}

export const SmartCompose = ({ messages, onSelectSuggestion }: SmartComposeProps) => {
 const { toast } = useToast();
 const [suggestions, setSuggestions] = useState<string[]>([]);
 const [isLoading, setIsLoading] = useState(false);

 useEffect(() => {
 if (messages.length > 0) {
 generateSuggestions();
 }
 }, [messages]);

 const generateSuggestions = async () => {
 setIsLoading(true);
 
 try {
 const nextSuggestions = await generateSmartComposeWithFallback(messages);
 setSuggestions(nextSuggestions);
 } catch (error: any) {
 console.error('Smart compose error:', error);
 
 // Only show toast for errors other than rate limits
 if (!error.message?.includes('Rate limit') && !error.message?.includes('credits')) {
 toast({
 title: 'Smart Compose Unavailable',
 description: error.message || 'Could not generate suggestions',
 variant: 'destructive',
 });
 }
 
 setSuggestions([]);
 } finally {
 setIsLoading(false);
 }
 };

 if (messages.length === 0) return null;

 return (
 <div className="p-2 bg-muted/30 border-t border-border">
 <div className="flex items-center gap-2 mb-2">
 <Sparkles className="h-4 w-4 text-primary" />
 <span className="text-label text-muted-foreground">Smart Replies</span>
 </div>
 
 {isLoading ? (
 <div className="flex items-center gap-2 text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 <span className="text-label">Generating suggestions...</span>
 </div>
 ) : suggestions.length > 0 ? (
 <div className="flex flex-wrap gap-2">
 {suggestions.map((suggestion, index) => (
 <Button
 key={index}
 variant="outline"
 size="sm"
 onClick={() => onSelectSuggestion(suggestion)}
 className="rounded-full text-label hover:bg-primary hover:text-primary-foreground transition-colors"
 >
 {suggestion}
 </Button>
 ))}
 </div>
 ) : null}
 </div>
 );
};
