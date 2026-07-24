import { storageEngine } from '../storage/StorageEngine';
import { knowledgeGraph, GraphNode } from '../memory/KnowledgeGraph';
import { vectorMemory } from '../memory/VectorMemory';

export interface SearchOptions {
  limit?: number;
  includeEvents?: boolean;
}

export class SearchEngine {

  public async hybridSearch(query: string, options: SearchOptions = {}): Promise<any[]> {
    console.log(`[SearchEngine] Performing hybrid search for: "${query}"`);
    const limit = options.limit || 10;
    
    // 1. Semantic Search via VectorMemory
    const semanticResults = await vectorMemory.search(query, limit);
    
    // 2. Keyword Search via SQLite FTS (Full Text Search)
    const db = storageEngine.getAdapter();
    const keywordResults = await db.query(
      `SELECT * FROM activities WHERE title LIKE ? OR preview LIKE ? LIMIT ?`, 
      [`%${query}%`, `%${query}%`, limit]
    );

    // 3. Knowledge Graph Expansion
    // Extract entities from keyword results and semantic results
    const entities = new Set<string>();
    semanticResults.forEach(r => entities.add(r.id));
    keywordResults.forEach(r => entities.add(r.id));

    const expandedNodes: GraphNode[] = [];
    for (const id of entities) {
      // Find 1-hop related nodes (e.g. the Person who sent the email)
      const graphContext = await knowledgeGraph.traverse(id, 1);
      expandedNodes.push(...graphContext.nodes);
    }

    // 4. Hybrid Ranking (simplified stub)
    // Combine results, remove duplicates, rank by score
    
    const finalResults = [
      ...semanticResults.map(r => ({ source: 'semantic', id: r.id, data: r })),
      ...keywordResults.map(r => ({ source: 'keyword', id: r.id, data: r }))
    ];

    console.log(`[SearchEngine] Found ${finalResults.length} results.`);
    return finalResults.slice(0, limit);
  }
}

export const searchEngine = new SearchEngine();
