import { DocumentProvider, UnifiedDocument } from '../types';
import * as mammoth from 'mammoth';

export class WordProvider implements DocumentProvider {
  supports(mimeType: string): boolean {
    return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
           mimeType === 'application/msword';
  }

  async extract(file: File | Blob): Promise<Partial<UnifiedDocument>> {
    const arrayBuffer = await file.arrayBuffer();
    
    // Mammoth parses DOCX to HTML or raw text
    const result = await mammoth.extractRawText({ arrayBuffer });
    const rawText = result.value;

    return {
      type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pages: 1, // Mammoth doesn't support pagination out of the box
      rawText: rawText.trim()
    };
  }
}
