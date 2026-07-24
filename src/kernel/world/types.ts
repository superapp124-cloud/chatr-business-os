export interface GraphNode {
  id: string;
  type: 'Entity' | 'Intent' | 'Capability' | 'Knowledge' | 'Resource' | 'Policy' | 'Plugin' | 'Transport';
  properties: Record<string, any>;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  predicate: string; // Open model e.g., 'offers', 'requires', 'trusts'
  weight?: number;
  validFrom: number;
  validUntil?: number;
  confidence: number;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface WorldState {
  version: number;
  nodes: Map<string, GraphNode>;
  edges: Map<string, Relationship>;
}

export interface Transaction {
  id: string;
  timestamp: number;
  mutations: GraphMutation[];
}

export type GraphMutation = 
  | { type: 'UPSERT_NODE'; node: GraphNode }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'UPSERT_EDGE'; edge: Relationship }
  | { type: 'DELETE_EDGE'; edgeId: string };
