import { DocumentProvider, UnifiedDocument } from '../types';

export class TextProvider implements DocumentProvider {
  supports(mimeType: string): boolean {
    return mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv';
  }

  async extract(file: File | Blob): Promise<Partial<UnifiedDocument>> {
    const text = await file.text();

    return {
      type: file.type || 'text/plain',
      pages: 1,
      rawText: text.trim()
    };
  }
}
