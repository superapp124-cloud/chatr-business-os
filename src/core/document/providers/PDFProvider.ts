import { DocumentProvider, UnifiedDocument } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
// Normally we'd configure the worker correctly, but for this OS environment, 
// using the legacy build or setting GlobalWorkerOptions is required.
// We will rely on Vite handling the worker or just use the text layer natively.

// Rely on fake worker or local build
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.js'; // This will intentionally fail fast if not present and fallback to fake worker, or we can just not set it.
// Actually, setting it to a fake string might still hang if it retries. Let's just set it to the standard local path.

export class PDFProvider implements DocumentProvider {
  supports(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  async extract(file: File | Blob): Promise<Partial<UnifiedDocument>> {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
    const pdf = await loadingTask.promise;
    
    let rawText = '';
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      rawText += pageText + '\n\n';
    }

    return {
      type: 'application/pdf',
      pages: numPages,
      rawText: rawText.trim()
    };
  }
}
