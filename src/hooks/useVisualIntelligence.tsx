import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useVisualIntelligence = () => {
 const [isScanning, setIsScanning] = useState(false);
 const [result, setResult] = useState<string | null>(null);
 const { toast } = useToast();

 const scanImage = useCallback(async (imageUrl: string, prompt: string) => {
 setIsScanning(true);
 setResult(null);

 try {
 // 1. Fetch the image and convert to base64
 const response = await fetch(imageUrl);
 const blob = await response.blob();
 
 const base64Promise = new Promise<string>((resolve, reject) => {
 const reader = new FileReader();
 reader.onloadend = () => {
 const result = reader.result as string;
 // Extract just the base64 part, discarding the data URI prefix
 const base64 = result.split(',')[1];
 if (base64) resolve(base64);
 else reject(new Error('Failed to extract base64'));
 };
 reader.onerror = reject;
 reader.readAsDataURL(blob);
 });

 const imageBase64 = await base64Promise;

 // 2. Call Edge Function
 const { data, error } = await supabase.functions.invoke('visual-intelligence', {
 body: {
 imageBase64,
 prompt
 }
 });

 if (error) {
 throw new Error(error.message || 'Failed to analyze image');
 }

 if (data && data.success) {
 setResult(data.text);
 return data.text;
 } else {
 throw new Error(data?.error || 'Unknown error from visual intelligence');
 }

 } catch (error: any) {
 console.error('Visual Intelligence Error:', error);
 toast.error(error.message || 'Failed to analyze image. Please try again.');
 return null;
 } finally {
 setIsScanning(false);
 }
 }, [toast]);

 return {
 scanImage,
 isScanning,
 result,
 setResult
 };
};
