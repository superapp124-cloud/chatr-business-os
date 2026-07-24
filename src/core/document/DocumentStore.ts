import { UnifiedDocument } from './types';

// Fast crypto hash for browser
async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class DocumentStore {
  private memoryCache = new Map<string, UnifiedDocument>();

  async storeFile(file: File | Blob): Promise<{ id: string; hash: string }> {
    const buffer = await file.arrayBuffer();
    const hash = await computeHash(buffer);
    const id = `doc_${hash.substring(0, 12)}`;
    // In a real app, upload to Supabase Storage or similar here.
    return { id, hash };
  }

  async cacheDocument(doc: UnifiedDocument): Promise<void> {
    this.memoryCache.set(doc.hash, doc);
  }

  async getCachedDocument(hash: string): Promise<UnifiedDocument | undefined> {
    return this.memoryCache.get(hash);
  }
}

export const documentStore = new DocumentStore();
