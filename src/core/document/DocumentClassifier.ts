import { UnifiedDocument } from './types';
import { generate } from '@/services/ai';

export class DocumentClassifier {
  async classify(rawText: string, fileName: string): Promise<Pick<UnifiedDocument, 'classification' | 'entities'>> {
    // In a real production system, this would use embeddings or a smaller fast model.
    // Here we use the main AI engine to analyze the document text (first 2000 chars to save tokens).
    
    const textSample = rawText.substring(0, 2000);
    
    const prompt = `Analyze the following document snippet. Determine its primary type and extract key entities.
Document Name: ${fileName}
Content snippet:
${textSample}

Respond ONLY in valid JSON format:
{
  "classification": {
    "primary": "resume|invoice|contract|medical_report|purchase_order|unknown",
    "confidence": 0.0 to 1.0,
    "alternatives": ["string"]
  },
  "entities": [
    { "type": "person|skill|organization|date|email", "value": "string", "confidence": 0.0 to 1.0 }
  ]
}`;

    try {
      const response = await generate({ prompt, preferLocal: false });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          classification: parsed.classification || { primary: 'unknown', confidence: 0, alternatives: [] },
          entities: parsed.entities || []
        };
      }
    } catch (e) {
      console.error('[DocumentClassifier] Error parsing classification', e);
    }
    
    return {
      classification: { primary: 'unknown', confidence: 0, alternatives: [] },
      entities: []
    };
  }
}

export const documentClassifier = new DocumentClassifier();
