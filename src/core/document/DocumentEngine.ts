import { UnifiedDocument, DocumentProvider, DocumentMetadata } from './types';
import { documentStore } from './DocumentStore';
import { documentRegistry } from './DocumentRegistry';
import { documentClassifier } from './DocumentClassifier';
import { PDFProvider } from './providers/PDFProvider';
import { WordProvider } from './providers/WordProvider';
import { TextProvider } from './providers/TextProvider';
import { eventBus } from '../runtime/EventBus';

export class DocumentEngine {
  private providers: DocumentProvider[] = [];

  constructor() {
    this.providers.push(new PDFProvider());
    this.providers.push(new WordProvider());
    this.providers.push(new TextProvider());
  }

  async processFile(file: File, workflowId?: string): Promise<UnifiedDocument> {
    // 1. Uploading
    this.emitEvent('document_uploading', { fileName: file.name }, workflowId);
    
    // Store file and get Hash/ID
    const { id, hash } = await documentStore.storeFile(file);

    // Check if we already parsed this document
    let doc = await documentStore.getCachedDocument(hash);
    
    if (!doc) {
      // 2. Extracting
      this.emitEvent('document_extracting', { fileName: file.name }, workflowId);
      
      const metadata: DocumentMetadata = {
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: file.type || this.guessMimeType(file.name),
        createdAt: Date.now()
      };

      const provider = this.providers.find(p => p.supports(metadata.mimeType));
      
      let rawText = '';
      let pages = 1;
      
      if (provider) {
        try {
          const extracted = await provider.extract(file);
          rawText = extracted.rawText || '';
          pages = extracted.pages || 1;
        } catch (e) {
          console.error('[DocumentEngine] Extraction failed', e);
          rawText = 'Failed to extract text.';
        }
      } else {
        console.warn('[DocumentEngine] No provider found for', metadata.mimeType);
      }

      // 3. Classifying
      this.emitEvent('document_classifying', { fileName: file.name }, workflowId);
      
      const { classification, entities } = await documentClassifier.classify(rawText, file.name);

      doc = {
        id,
        hash,
        type: metadata.mimeType,
        pages,
        language: 'en', // Could be detected
        rawText,
        metadata,
        entities,
        classification,
        securityPolicy: { classification: 'Private' } // Default
      };

      // 4. Indexed
      await documentStore.cacheDocument(doc);
      documentRegistry.register(doc);
    } else {
      console.log('[DocumentEngine] Found cached document', hash);
    }

    this.emitEvent('document_ready', { documentId: doc.id, primaryType: doc.classification.primary }, workflowId);
    
    return doc;
  }

  private guessMimeType(filename: string): string {
    if (filename.endsWith('.pdf')) return 'application/pdf';
    if (filename.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (filename.endsWith('.txt')) return 'text/plain';
    if (filename.endsWith('.md')) return 'text/markdown';
    return 'application/octet-stream';
  }

  private emitEvent(type: string, payload: any, workflowId?: string) {
    if (workflowId) {
      eventBus.publish('WORKFLOW_UI_EVENT', {
        event: 'WIDGET_UPDATED',
        widgetId: `doc-extraction-${workflowId}`,
        workflowId,
        widgetType: 'extraction_progress',
        timestamp: Date.now(),
        lifecycle: 'ACTIVE',
        payload: { stage: type, ...payload }
      });
    }
  }
}

export const documentEngine = new DocumentEngine();
