/**
 * CHATR Intent OS - Phase 1.5A Knowledge Graph Schemas
 * Defines the core schemas for the Intent Knowledge Graph and Provider Knowledge Graph.
 */

// ─── 12. PROVIDER KNOWLEDGE GRAPH SCHEMA ──────────────────────────────────────
export interface IGraphNode {
  nodeId: string;
  labels: string[]; // e.g., ['Provider', 'Transport']
  properties: Record<string, any>;
}

export interface IGraphEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: string; // e.g., 'HAS_CAPABILITY', 'REQUIRES_AUTH'
  properties: Record<string, any>;
}

export interface ProviderKnowledgeGraph {
  nodes: IGraphNode[];
  edges: IGraphEdge[];
  
  // Graph Queries
  findProvidersForCapability(capabilityId: string): IGraphNode[];
  findAuthRequirements(providerId: string): IGraphNode[];
  getProviderHierarchy(providerId: string): IGraphNode[];
}

// ─── 13. INTENT GRAPH SCHEMA ──────────────────────────────────────────────────
export interface IntentNode {
  intentId: string;
  rawText: string;
  confidence: number;
  semanticEntities: Record<string, any>;
}

export interface ActionPlanNode {
  actionId: string;
  capabilityRequired: string;
  dependencies: string[]; // actionIds that must complete first
  fallbackCapabilities?: string[];
}

export interface IntentKnowledgeGraph {
  intents: IntentNode[];
  actionPlans: ActionPlanNode[];
  
  // Maps an abstract user intent to a concrete directed acyclic graph of capabilities
  decompose(intent: IntentNode): ActionPlanNode[];
}
