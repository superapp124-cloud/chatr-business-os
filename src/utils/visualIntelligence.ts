import { supabase } from '@/integrations/supabase/client';

export interface VisualIntelligenceResponse {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Resizes an image file and converts it to a base64 string
 * suitable for sending to the AI vision model.
 */
export async function imageToBase64Compressed(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Target max dimensions to keep payload small but legible for OCR
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Export to JPEG with 0.8 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Strip the data prefix (e.g. "data:image/jpeg;base64,")
        const base64Str = dataUrl.split(',')[1];
        resolve(base64Str);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Calls the Supabase Edge Function to analyze the image.
 */
export async function analyzeImage(imageSource: File | string, prompt: string): Promise<VisualIntelligenceResponse> {
  try {
    let base64 = '';
    
    if (typeof imageSource === 'string') {
      // If it's a data URL, strip the prefix
      if (imageSource.startsWith('data:')) {
        base64 = imageSource.split(',')[1];
      } else {
        base64 = imageSource;
      }
    } else {
      // If it's a File, compress and convert
      base64 = await imageToBase64Compressed(imageSource);
    }
    
    // Invoke the edge function
    const { data, error } = await supabase.functions.invoke('visual-intelligence', {
      body: { imageBase64: base64, prompt }
    });
    
    if (error) {
      console.error('Edge function error:', error);
      
      // Fallback message if function isn't deployed yet
      if (error.message.includes('not found') || error.message.includes('Failed to send a request')) {
        return { 
          success: false, 
          error: "Edge Function not deployed. Please run: supabase functions deploy visual-intelligence" 
        };
      }
      
      return { success: false, error: error.message };
    }
    
    if (!data?.success) {
      return { success: false, error: data?.error || 'Unknown error from AI model' };
    }
    
    return { success: true, text: data.text };
    
  } catch (err: any) {
    console.error('Visual intelligence API error:', err);
    return { success: false, error: err.message || 'Failed to analyze image' };
  }
}
