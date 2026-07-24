import { storageEngine } from '../storage/StorageEngine';

export interface GraphNode {
  id: string; // e.g. 'person_123', 'email_456'
  type: string; // 'Person', 'Company', 'Email', 'Project'
  label: string; // 'Elon Musk', 'Tesla Contract'
  attributes: Record<string, any>;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relationship: string; // 'SENT', 'WORKS_FOR', 'BELONGS_TO'
  weight?: number;
  attributes?: Record<string, any>;
}

export class KnowledgeGraph {
  
  public async initializeSchema(): Promise<void> {
    const db = storageEngine.getAdapter();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        attributes TEXT
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS graph_edges (
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        attributes TEXT,
        PRIMARY KEY (source_id, target_id, relationship),
        FOREIGN KEY (source_id) REFERENCES graph_nodes(id),
        FOREIGN KEY (target_id) REFERENCES graph_nodes(id)
      )
    `);
  }

  public async addNode(node: GraphNode): Promise<void> {
    const db = storageEngine.getAdapter();
    // Use an upsert mechanism or simple replace (since it's SQLite, REPLACE works if we use it, 
    // or just checking existence). We will simulate an upsert.
    try {
      await db.execute(
        `INSERT OR REPLACE INTO graph_nodes (id, type, label, attributes) VALUES (?, ?, ?, ?)`,
        [node.id, node.type, node.label, JSON.stringify(node.attributes || {})]
      );
    } catch (e) {
      console.error('[KnowledgeGraph] Failed to add node', e);
    }
  }

  public async addEdge(edge: GraphEdge): Promise<void> {
    const db = storageEngine.getAdapter();
    try {
      await db.execute(
        `INSERT OR REPLACE INTO graph_edges (source_id, target_id, relationship, weight, attributes) VALUES (?, ?, ?, ?, ?)`,
        [edge.sourceId, edge.targetId, edge.relationship, edge.weight || 1.0, JSON.stringify(edge.attributes || {})]
      );
    } catch (e) {
      console.error('[KnowledgeGraph] Failed to add edge', e);
    }
  }

  public async traverse(startNodeId: string, depth: number = 1): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
    // Simplified traversal using recursive queries or manual hopping
    const db = storageEngine.getAdapter();
    
    // In a real implementation we might use recursive CTEs. Here we just fetch direct edges for depth 1
    const edgeRows = await db.query(
      `SELECT * FROM graph_edges WHERE source_id = ? OR target_id = ?`,
      [startNodeId, startNodeId]
    );

    const edges: GraphEdge[] = edgeRows.map(row => ({
      sourceId: row.source_id,
      targetId: row.target_id,
      relationship: row.relationship,
      weight: row.weight,
      attributes: row.attributes ? JSON.parse(row.attributes) : {}
    }));

    // Find all node IDs in these edges
    const nodeIds = new Set<string>();
    nodeIds.add(startNodeId);
    edges.forEach(e => {
      nodeIds.add(e.sourceId);
      nodeIds.add(e.targetId);
    });

    const placeholders = Array.from(nodeIds).map(() => '?').join(',');
    const nodeRows = await db.query(
      `SELECT * FROM graph_nodes WHERE id IN (${placeholders})`,
      Array.from(nodeIds)
    );

    const nodes: GraphNode[] = nodeRows.map(row => ({
      id: row.id,
      type: row.type,
      label: row.label,
      attributes: row.attributes ? JSON.parse(row.attributes) : {}
    }));

    return { nodes, edges };
  }
}

export const knowledgeGraph = new KnowledgeGraph();
