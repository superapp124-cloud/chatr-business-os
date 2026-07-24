import { BaseAIProvider } from '../AIFactory';
import { GoogleGenAI } from '@google/genai';

export class GeminiProvider extends BaseAIProvider {
  providerId = 'google-gemini';

  async execute(payload: { prompt: string }, context: any): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || '' });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: payload.prompt,
      });

      return { text: response.text, provider: this.providerId };
    } catch (e: any) {
      throw new Error(`Gemini generation failed: ${e.message}`);
    }
  }
}
