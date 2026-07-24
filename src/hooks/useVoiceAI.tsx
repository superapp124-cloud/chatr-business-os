import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

interface VoiceAICommand {
 command: string;
 action: () => void;
}

interface VoiceAIOptions {
 processCommands?: boolean;
}

export const useVoiceAI = ({ processCommands = false }: VoiceAIOptions = {}) => {
 const [isListening, setIsListening] = useState(false);
 const [transcript, setTranscript] = useState('');
 const [interimTranscript, setInterimTranscript] = useState('');
 const platform = Capacitor.getPlatform();

 const processVoiceCommand = async (text: string) => {
 try {
 // Call AI to process the voice command
 const { data, error } = await supabase.functions.invoke('ai-smart-reply', {
 body: { 
 message: text,
 context: ['voice_command'],
 type: 'command'
 }
 });

 if (error) throw error;

 return data;
 } catch (error) {
 console.error('Voice AI error:', error);
 return null;
 }
 };

 const startListening = async () => {
 if (!('webkitSpeechRecognition' in window)) {
 toast.error('Voice recognition not supported');
 return;
 }

 const recognition = new (window as any).webkitSpeechRecognition();
 recognition.continuous = false;
 recognition.interimResults = true;

 recognition.onstart = () => {
 setIsListening(true);
 console.log(`🎤 [VoiceAI] Listening... (${platform === 'ios' ? 'ChatGPT' : 'Gemini'} mode)`);
 };

 recognition.onresult = async (event: any) => {
 const current = event.resultIndex;
 const transcriptText = event.results[current][0].transcript.trim();
 setInterimTranscript(transcriptText);

 if (event.results[current].isFinal) {
 setTranscript(transcriptText);

 if (processCommands) {
 const result = await processVoiceCommand(transcriptText);
 if (result?.response) {
 toast.success(result.response);
 }
 }
 }
 };

 recognition.onerror = (event: any) => {
 console.error('Speech recognition error:', event.error);
 toast.error('Voice recognition error');
 setIsListening(false);
 };

 recognition.onend = () => {
 setIsListening(false);
 };

 recognition.start();
 };

 const stopListening = () => {
 setIsListening(false);
 };

 return {
 isListening,
 transcript,
 interimTranscript,
 startListening,
 stopListening,
 processVoiceCommand
 };
};
