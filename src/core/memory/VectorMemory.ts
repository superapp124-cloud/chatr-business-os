export interface EmbeddingVector {
  id: string; // Refers to the BaseEntity ID or Document ID
  vector: number[];
  metadata: Record<string, any>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

export abstract class VectorMemoryProvider {
  /**
   * Initializes the vector database (e.g. creating HNSW tables in SQLite via vss, or loading local FAISS)
   */
  public abstract initialize(): Promise<void>;

  /**
   * Add or update an embedding for a specific ID
   */
  public abstract upsert(embedding: EmbeddingVector): Promise<void>;

  /**
   * Delete an embedding
   */
  public abstract delete(id: string): Promise<void>;

  /**
   * Perform semantic search
   */
  public abstract search(queryVector: number[], limit?: number): Promise<SearchResult[]>;
}

export class PluggableVectorMemory {
  private provider: VectorMemoryProvider | null = null;

  public setProvider(provider: VectorMemoryProvider) {
    this.provider = provider;
  }

  public async initialize(): Promise<void> {
    if (this.provider) await this.provider.initialize();
  }

  public async embedAndStore(id: string, text: string, metadata: Record<string, any>): Promise<void> {
    if (!this.provider) throw new Error('No VectorProvider configured');
    
    // In production, this would call Ollama or another local embedding model
    console.log(`[VectorMemory] Simulating embedding for text: ${text.substring(0, 20)}...`);
    const mockVector = Array(384).fill(0).map(() => Math.random());
    
    await this.provider.upsert({ id, vector: mockVector, metadata });
  }

  public async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.provider) throw new Error('No VectorProvider configured');
    
    console.log(`[VectorMemory] Simulating query embedding for: ${query}`);
    const queryVector = Array(384).fill(0).map(() => Math.random());
    
    return this.provider.search(queryVector, limit);
  }
}

export const vectorMemory = new PluggableVectorMemory();
