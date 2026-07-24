import { supabase } from '@/integrations/supabase/client';

export interface GraphNode {
  id: string;
  entityId: string;
  recordId: string;
  label: string;
}

export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
}

export class BusinessGraph {
  /**
   * Retrieves all related nodes for a given record by traversing the graph.
   * This is much more flexible than complex SQL joins, as it discovers 
   * unexpected or indirect relationships (e.g. Customer -> Ticket -> Employee).
   */
  static async getRelated(recordId: string, depth: number = 1): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
    // In a real graph database this would be a single traversal query.
    // In PostgreSQL with our schema, we can use a recursive CTE.
    
    const query = `
      WITH RECURSIVE graph_traversal AS (
        -- Base case: The starting node
        SELECT 
          n.id, n.entity_id, n.record_id, n.label, 
          0 as depth,
          NULL::uuid as edge_id, NULL::uuid as source_node_id, NULL::uuid as target_node_id, NULL::text as relationship_type
        FROM sys_business_graph_nodes n
        WHERE n.record_id = $1

        UNION

        -- Recursive case: Find connected edges and nodes
        SELECT 
          n.id, n.entity_id, n.record_id, n.label,
          gt.depth + 1,
          e.id, e.source_node_id, e.target_node_id, e.relationship_type
        FROM sys_business_graph_edges e
        JOIN sys_business_graph_nodes n ON n.id = CASE 
            WHEN e.source_node_id = gt.id THEN e.target_node_id
            ELSE e.source_node_id
        END
        JOIN graph_traversal gt ON gt.id = e.source_node_id OR gt.id = e.target_node_id
        WHERE gt.depth < $2
      )
      SELECT * FROM graph_traversal;
    `;

    // Note: rpc is used here assuming we create a supabase function for the CTE.
    // We mock the RPC call below.
    const { data, error } = await supabase.rpc('traverse_business_graph', { 
      start_record_id: recordId, 
      max_depth: depth 
    });

    if (error) {
      console.error('Graph traversal failed', error);
      return { nodes: [], edges: [] };
    }

    // Process data to extract unique nodes and edges
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();

    data?.forEach((row: any) => {
      if (!nodes.has(row.id)) {
        nodes.set(row.id, { id: row.id, entityId: row.entity_id, recordId: row.record_id, label: row.label });
      }
      if (row.edge_id && !edges.has(row.edge_id)) {
        edges.set(row.edge_id, { 
          id: row.edge_id, 
          sourceNodeId: row.source_node_id, 
          targetNodeId: row.target_node_id, 
          relationshipType: row.relationship_type 
        });
      }
    });

    return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) };
  }

  static async link(sourceRecordId: string, targetRecordId: string, relationshipType: string, context: any) {
    // Logic to create edges between nodes in the graph
    // 1. Ensure nodes exist (create if not)
    // 2. Create edge in sys_business_graph_edges
  }
}
