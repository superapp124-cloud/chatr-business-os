import { GraphNode, Relationship, WorldState, Transaction } from './types';
import { randomUUID } from '../utils/id';
import { WorldSnapshot } from './SnapshotManager';

export class WorldModel {
  private state: WorldState = {
    version: 1,
    nodes: new Map(),
    edges: new Map()
  };

  // ─── Indexes ────────────────────────────────────────────────────────────────
  private indexByType = new Map<string, Set<string>>();
  private indexByPredicate = new Map<string, Set<string>>();
  private indexEdgeBySource = new Map<string, Set<string>>();
  private indexEdgeByTarget = new Map<string, Set<string>>();

  constructor() {}

  public getVersion(): number {
    return this.state.version;
  }

  // ─── Snapshot Recovery ──────────────────────────────────────────────────────

  public loadFromSnapshot(snapshot: WorldSnapshot): void {
    this.state.version = snapshot.worldVersion;
    
    this.state.nodes.clear();
    for (const node of snapshot.nodes) {
      this.state.nodes.set(node.id, node);
    }
    
    this.state.edges.clear();
    for (const edge of snapshot.edges) {
      this.state.edges.set(edge.id, edge);
    }

    // Rebuild indexes
    this.indexByType.clear();
    this.indexByPredicate.clear();
    this.indexEdgeBySource.clear();
    this.indexEdgeByTarget.clear();

    for (const node of this.state.nodes.values()) {
      if (!this.indexByType.has(node.type)) this.indexByType.set(node.type, new Set());
      this.indexByType.get(node.type)!.add(node.id);
    }

    for (const edge of this.state.edges.values()) {
      if (!this.indexByPredicate.has(edge.predicate)) this.indexByPredicate.set(edge.predicate, new Set());
      this.indexByPredicate.get(edge.predicate)!.add(edge.id);
      
      if (!this.indexEdgeBySource.has(edge.source)) this.indexEdgeBySource.set(edge.source, new Set());
      this.indexEdgeBySource.get(edge.source)!.add(edge.id);

      if (!this.indexEdgeByTarget.has(edge.target)) this.indexEdgeByTarget.set(edge.target, new Set());
      this.indexEdgeByTarget.get(edge.target)!.add(edge.id);
    }
  }

  public extractStateForSnapshot(): { state: WorldState; indexes: Record<string, any> } {
    return {
      state: this.state,
      indexes: {
        // High-level index counts for metadata
        nodes: this.state.nodes.size,
        edges: this.state.edges.size
      }
    };
  }

  // ─── Queries (Domain specific API) ──────────────────────────────────────────

  public getAllNodes(): GraphNode[] {
    return Array.from(this.state.nodes.values());
  }

  public getNode(id: string): GraphNode | undefined {
    return this.state.nodes.get(id);
  }

  public getNodesByType(type: GraphNode['type']): GraphNode[] {
    const ids = this.indexByType.get(type);
    if (!ids) return [];
    return Array.from(ids).map(id => this.state.nodes.get(id)!).filter(Boolean);
  }

  public getEdges(predicate?: string): Relationship[] {
    if (predicate) {
      const ids = this.indexByPredicate.get(predicate);
      if (!ids) return [];
      return Array.from(ids).map(id => this.state.edges.get(id)!).filter(Boolean);
    }
    return Array.from(this.state.edges.values());
  }

  public getEdgesFrom(sourceId: string, predicate?: string): Relationship[] {
    const ids = this.indexEdgeBySource.get(sourceId);
    if (!ids) return [];
    let edges = Array.from(ids).map(id => this.state.edges.get(id)!).filter(Boolean);
    if (predicate) {
      edges = edges.filter(e => e.predicate === predicate);
    }
    return edges;
  }

  public getEdgesTo(targetId: string, predicate?: string): Relationship[] {
    const ids = this.indexEdgeByTarget.get(targetId);
    if (!ids) return [];
    let edges = Array.from(ids).map(id => this.state.edges.get(id)!).filter(Boolean);
    if (predicate) {
      edges = edges.filter(e => e.predicate === predicate);
    }
    return edges;
  }

  // ─── Graph Traversal (Domain API) ─────────────────────────────────────────

  public findEntity(id: string): GraphNode | undefined {
    const node = this.getNode(id);
    return node?.type === 'Entity' ? node : undefined;
  }

  public findCapability(id: string): GraphNode | undefined {
    const node = this.getNode(id);
    return node?.type === 'Capability' ? node : undefined;
  }

  public traverse(startNodeId: string, predicate: string, direction: 'out' | 'in' = 'out'): GraphNode[] {
    const edges = direction === 'out' 
      ? this.getEdgesFrom(startNodeId, predicate)
      : this.getEdgesTo(startNodeId, predicate);
    
    const now = Date.now();
    const activeEdges = edges.filter(e => e.validFrom <= now && (!e.validUntil || e.validUntil > now));
    
    return activeEdges.map(e => this.getNode(direction === 'out' ? e.target : e.source)!).filter(Boolean);
  }

  /**
   * Resolves capabilities using graph traversal.
   * Matches `[Entity] -[:offers]-> [Capability]`
   */
  public resolveCapability(capabilityId: string): GraphNode[] {
    return this.traverse(capabilityId, 'offers', 'in');
  }

  // ─── Mutations (via Transaction Engine) ─────────────────────────────────────

  public applyTransaction(tx: Transaction): void {
    // Basic transactional isolation (all-or-nothing not strictly enforced in-memory yet, 
    // but this serves as the hook for persistent databases).
    
    for (const mutation of tx.mutations) {
      switch (mutation.type) {
        case 'UPSERT_NODE':
          this._upsertNode(mutation.node);
          break;
        case 'DELETE_NODE':
          this._deleteNode(mutation.nodeId);
          break;
        case 'UPSERT_EDGE':
          this._upsertEdge(mutation.edge);
          break;
        case 'DELETE_EDGE':
          this._deleteEdge(mutation.edgeId);
          break;
      }
    }

    this.state.version++;
  }

  private _upsertNode(node: GraphNode): void {
    const isNew = !this.state.nodes.has(node.id);
    this.state.nodes.set(node.id, node);
    
    if (isNew) {
      if (!this.indexByType.has(node.type)) {
        this.indexByType.set(node.type, new Set());
      }
      this.indexByType.get(node.type)!.add(node.id);
    }
  }

  private _deleteNode(nodeId: string): void {
    const node = this.state.nodes.get(nodeId);
    if (node) {
      this.indexByType.get(node.type)?.delete(nodeId);
      this.state.nodes.delete(nodeId);
      
      // Cascade delete edges
      const edgesFrom = this.indexEdgeBySource.get(nodeId) || new Set();
      const edgesTo = this.indexEdgeByTarget.get(nodeId) || new Set();
      
      for (const edgeId of edgesFrom) this._deleteEdge(edgeId);
      for (const edgeId of edgesTo) this._deleteEdge(edgeId);
    }
  }

  private _upsertEdge(edge: Relationship): void {
    const isNew = !this.state.edges.has(edge.id);
    this.state.edges.set(edge.id, edge);

    if (isNew) {
      if (!this.indexByPredicate.has(edge.predicate)) {
        this.indexByPredicate.set(edge.predicate, new Set());
      }
      this.indexByPredicate.get(edge.predicate)!.add(edge.id);

      if (!this.indexEdgeBySource.has(edge.source)) {
        this.indexEdgeBySource.set(edge.source, new Set());
      }
      this.indexEdgeBySource.get(edge.source)!.add(edge.id);

      if (!this.indexEdgeByTarget.has(edge.target)) {
        this.indexEdgeByTarget.set(edge.target, new Set());
      }
      this.indexEdgeByTarget.get(edge.target)!.add(edge.id);
    }
  }

  private _deleteEdge(edgeId: string): void {
    const edge = this.state.edges.get(edgeId);
    if (edge) {
      this.indexByPredicate.get(edge.predicate)?.delete(edgeId);
      this.indexEdgeBySource.get(edge.source)?.delete(edgeId);
      this.indexEdgeByTarget.get(edge.target)?.delete(edgeId);
      this.state.edges.delete(edgeId);
    }
  }
}

export const worldModel = new WorldModel();
