export type KnowledgeType = 
  | 'fact'         // Absolute truth, immutably verified
  | 'experience'   // Historical record of a goal's success/failure
  | 'heuristic'    // Learned rule of thumb (e.g., "Email node usually fails on weekends")
  | 'prediction'   // AI-generated forecast
  | 'explanation'  // Why a decision was made
  | 'policy';      // Immutable organizational governance rule

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  content: any;
  context: {
    realityEntityIds: string[]; // Links to Reality Graph entities this knowledge applies to
    timeframe?: { start?: string; end?: string };
  };
  provenance: {
    sourceEventId: string;
    confidence: number;
  };
  createdAt: string;
}

export interface KnowledgeKernelABI {
  // Read operations available to all subsystems
  queryFacts(entityId: string): Promise<KnowledgeEntry[]>;
  getHeuristics(capabilityId: string): Promise<KnowledgeEntry[]>;
  getPolicies(scope: string): Promise<KnowledgeEntry[]>;
  
  // Write operations via Event Log transactions
  // Subsystems emit events; the Knowledge Kernel subscribes and updates these internally.
}
