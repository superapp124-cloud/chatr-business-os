import { Attachment } from '../capabilities/types';
import { storageProvider } from '../providers/StorageProvider';

/**
 * Universal Attachment Engine
 * 
 * Handles parsing, OCR-routing, and storage integration for all capabilities.
 */
export class AttachmentEngineImpl {
  private static instance: AttachmentEngineImpl;

  private constructor() {}

  public static getInstance(): AttachmentEngineImpl {
    if (!AttachmentEngineImpl.instance) {
      AttachmentEngineImpl.instance = new AttachmentEngineImpl();
    }
    return AttachmentEngineImpl.instance;
  }

  public async uploadFile(file: File): Promise<Attachment> {
    console.log(`[AttachmentEngine] Uploading file: ${file.name}`);
    
    // In production, this streams to the StorageProvider.
    // For local mocking, we read the file as a base64 data URL so it persists in LocalStorage/IndexedDB.
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    const attachment: Attachment = {
      id: crypto.randomUUID(),
      name: file.name,
      url: url,
      mimeType: file.type,
      sizeBytes: file.size,
      source: 'upload',
      metadata: {
        uploadedAt: Date.now()
      }
    };
    
    return attachment;
  }

  public async parseUrl(url: string): Promise<Attachment> {
    console.log(`[AttachmentEngine] Parsing URL: ${url}`);
    
    // In production, this would fetch OpenGraph tags or standard metadata.
    return {
      id: crypto.randomUUID(),
      name: url,
      url: url,
      mimeType: 'text/html',
      source: 'url',
      metadata: {
        title: 'Linked Resource',
        parsedAt: Date.now()
      }
    };
  }
}

export const attachmentEngine = AttachmentEngineImpl.getInstance();
