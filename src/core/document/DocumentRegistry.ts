import { UnifiedDocument } from './types';

export class DocumentRegistry {
  private documents = new Map<string, UnifiedDocument>();

  register(doc: UnifiedDocument): void {
    this.documents.set(doc.id, doc);
  }

  get(id: string): UnifiedDocument | undefined {
    return this.documents.get(id);
  }

  getAll(): UnifiedDocument[] {
    return Array.from(this.documents.values());
  }

  update(id: string, updates: Partial<UnifiedDocument>): void {
    const doc = this.documents.get(id);
    if (doc) {
      this.documents.set(id, { ...doc, ...updates });
    }
  }

  delete(id: string): void {
    this.documents.delete(id);
  }

  findByHash(hash: string): UnifiedDocument | undefined {
    return Array.from(this.documents.values()).find(d => d.hash === hash);
  }
}

export const documentRegistry = new DocumentRegistry();
