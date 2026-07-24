/**
 * CHATR Business OS v1.0 — Knowledge Graph Indexer v2.0
 *
 * Supabase-backed graph store persisting nodes and edges to `kg_nodes` / `kg_edges`.
 * Falls back to in-memory Map when Supabase is unavailable (offline / unauthenticated).
 *
 * Persistence:
 *   kg_nodes  — entities (Person, Company, Document, Meeting, Project, Invoice)
 *   kg_edges  — directional relationships between nodes
 *
 * Evidence closes gap identified in Production Evidence Report v1.0:
 *   "Knowledge Graph is in-memory only, no persistence, no event subscription."
 */

import { supabase } from '@/integrations/supabase/client';
import { runtimeObservability } from '@/core/os/telemetry/RuntimeObservability';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType = 'PERSON' | 'COMPANY' | 'DOCUMENT' | 'MEETING' | 'PROJECT' | 'INVOICE';
export type EdgeRelation = 'BELONGS_TO' | 'ATTENDED' | 'CREATED' | 'SIGNED' | 'ASSIGNED_TO';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
  weight: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTenantId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const { error } = await supabase
      .from('kg_nodes')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    clearTimeout(timeout);
    return !error;
  } catch {
    return false;
  }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

class KnowledgeGraphIndexerEngine {
  // In-memory fallback store — always kept in sync for fast reads
  private memNodes = new Map<string, GraphNode>();
  private memEdges = new Map<string, GraphEdge>(); // keyed by edge id

  constructor() {
    this._seedMemory();
    this._hydrate();  // async — loads persisted nodes from Supabase on startup
  }

  /** Seed the in-memory store with known org defaults so graph is never empty */
  private _seedMemory() {
    const now = new Date().toISOString();
    const defaults: GraphNode[] = [
      { id: 'org_chatr', type: 'COMPANY',  name: 'CHATR Organisation',         metadata: { source: 'seed' }, createdAt: now },
      { id: 'proj_bos',  type: 'PROJECT',  name: 'CHATR Business OS v1.0',      metadata: { status: 'Active', source: 'seed' }, createdAt: now },
    ];
    defaults.forEach(n => this.memNodes.set(n.id, n));
  }

  /** Pull existing nodes + edges from Supabase into memory on startup */
  private async _hydrate() {
    try {
      const tenantId = await getTenantId();
      if (!tenantId) return;

      const [{ data: nodes }, { data: edges }] = await Promise.all([
        supabase.from('kg_nodes').select('*').eq('tenant_id', tenantId),
        supabase.from('kg_edges').select('*').eq('tenant_id', tenantId),
      ]);

      (nodes ?? []).forEach(row => {
        this.memNodes.set(row.id, {
          id: row.id,
          type: row.node_type as NodeType,
          name: row.name,
          metadata: row.metadata ?? {},
          createdAt: row.created_at,
        });
      });

      (edges ?? []).forEach(row => {
        this.memEdges.set(row.id, {
          id: row.id,
          source: row.source_node_id,
          target: row.target_node_id,
          relation: row.relation as EdgeRelation,
          weight: Number(row.weight),
        });
      });

      console.info(`[KnowledgeGraph] Hydrated ${this.memNodes.size} nodes, ${this.memEdges.size} edges from Supabase`);
    } catch (e) {
      console.warn('[KnowledgeGraph] Hydration failed — running in-memory only:', e);
    }
  }

  // ── Node persistence ────────────────────────────────────────────────────────

  private async _upsertNode(node: GraphNode, sourceCapability?: string, sourceObjectId?: string): Promise<void> {
    const start = performance.now();
    // Always update in-memory first for instant reads
    this.memNodes.set(node.id, node);

    if (await isSupabaseAvailable()) {
      const tenantId = await getTenantId();
      if (!tenantId) return;
      const { error } = await supabase.from('kg_nodes').upsert({
        id: node.id,
        tenant_id: tenantId,
        node_type: node.type,
        name: node.name,
        metadata: node.metadata,
        source_capability: sourceCapability ?? null,
        source_object_id: sourceObjectId ?? null,
      }, { onConflict: 'id' });
      if (error) {
        runtimeObservability.recordCall('knowledge_graph', performance.now() - start, false);
        console.warn('[KnowledgeGraph] Node upsert error:', error.message);
      } else {
        runtimeObservability.recordCall('knowledge_graph', performance.now() - start, true);
      }
    } else {
      runtimeObservability.recordCall('knowledge_graph', performance.now() - start, true);
    }
  }

  // ── Edge persistence ────────────────────────────────────────────────────────

  private async _insertEdge(edge: GraphEdge): Promise<void> {
    this.memEdges.set(edge.id, edge);

    if (await isSupabaseAvailable()) {
      const tenantId = await getTenantId();
      if (!tenantId) return;
      const { error } = await supabase.from('kg_edges').upsert({
        id: edge.id,
        tenant_id: tenantId,
        source_node_id: edge.source,
        target_node_id: edge.target,
        relation: edge.relation,
        weight: edge.weight,
      }, { onConflict: 'id' });
      if (error) console.warn('[KnowledgeGraph] Edge upsert error:', error.message);
    }
  }

  // ── Public indexing API ─────────────────────────────────────────────────────

  public indexLead(leadId: string, name: string, company: string): void {
    const leadNodeId = `lead_${leadId}`;
    const companyNodeId = `comp_${company.toLowerCase().replace(/\s+/g, '_')}`;
    const now = new Date().toISOString();

    const leadNode: GraphNode = {
      id: leadNodeId,
      type: 'PERSON',
      name,
      metadata: { leadId, company },
      createdAt: now,
    };

    const companyNode: GraphNode = {
      id: companyNodeId,
      type: 'COMPANY',
      name: company || 'Unknown Company',
      metadata: {},
      createdAt: now,
    };

    const edge: GraphEdge = {
      id: `edge_lead_${leadId}_${Date.now()}`,
      source: leadNodeId,
      target: companyNodeId,
      relation: 'BELONGS_TO',
      weight: 1.0,
    };

    // Fire-and-forget persistence — don't block the EventBus callback
    void this._upsertNode(leadNode, 'CRM', leadId);
    if (!this.memNodes.has(companyNodeId)) {
      void this._upsertNode(companyNode, 'CRM');
    }
    void this._insertEdge(edge);
  }

  public indexDocument(documentId: string, fileName: string, uploadedBy: string): void {
    const docNodeId = `doc_${documentId}`;
    const now = new Date().toISOString();

    const docNode: GraphNode = {
      id: docNodeId,
      type: 'DOCUMENT',
      name: fileName,
      metadata: { uploadedBy, documentId },
      createdAt: now,
    };

    void this._upsertNode(docNode, 'Document', documentId);

    // Link document to uploader node if it exists
    if (this.memNodes.has(uploadedBy)) {
      const edge: GraphEdge = {
        id: `edge_doc_${documentId}_${Date.now()}`,
        source: uploadedBy,
        target: docNodeId,
        relation: 'CREATED',
        weight: 0.95,
      };
      void this._insertEdge(edge);
    }
  }

  public indexMeeting(meetingId: string, title: string, attendeeIds: string[]): void {
    const meetingNodeId = `meeting_${meetingId}`;
    const now = new Date().toISOString();

    const meetingNode: GraphNode = {
      id: meetingNodeId,
      type: 'MEETING',
      name: title,
      metadata: { meetingId, attendeeCount: attendeeIds.length },
      createdAt: now,
    };
    void this._upsertNode(meetingNode, 'Calendar', meetingId);

    attendeeIds.forEach(userId => {
      const edge: GraphEdge = {
        id: `edge_att_${meetingId}_${userId}_${Date.now()}`,
        source: userId,
        target: meetingNodeId,
        relation: 'ATTENDED',
        weight: 1.0,
      };
      void this._insertEdge(edge);
    });
  }

  // ── Query API ───────────────────────────────────────────────────────────────

  /** Fast synchronous read from in-memory cache */
  public getGraphData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: Array.from(this.memNodes.values()),
      edges: Array.from(this.memEdges.values()),
    };
  }

  public getNodeCount(): number {
    return this.memNodes.size;
  }

  public getEdgeCount(): number {
    return this.memEdges.size;
  }

  /** Full-text search across node names — runs against Supabase if available */
  public async searchNodes(query: string): Promise<GraphNode[]> {
    if (query.trim().length < 2) return [];

    if (await isSupabaseAvailable()) {
      const tenantId = await getTenantId();
      const { data, error } = await supabase
        .from('kg_nodes')
        .select('*')
        .eq('tenant_id', tenantId!)
        .textSearch('name', query, { type: 'websearch' })
        .limit(20);

      if (!error && data?.length) {
        return data.map(row => ({
          id: row.id,
          type: row.node_type as NodeType,
          name: row.name,
          metadata: row.metadata ?? {},
          createdAt: row.created_at,
        }));
      }
    }

    // Fallback: case-insensitive in-memory search
    const lower = query.toLowerCase();
    return Array.from(this.memNodes.values()).filter(n =>
      n.name.toLowerCase().includes(lower)
    );
  }

  /** Get all edges connected to a given node */
  public getNodeEdges(nodeId: string): GraphEdge[] {
    return Array.from(this.memEdges.values()).filter(
      e => e.source === nodeId || e.target === nodeId
    );
  }
}

export const knowledgeGraphIndexer = new KnowledgeGraphIndexerEngine();
