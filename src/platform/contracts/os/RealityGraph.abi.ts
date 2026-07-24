export type EntityType = 
  | 'person' 
  | 'organization' 
  | 'team' 
  | 'device' 
  | 'file' 
  | 'app' 
  | 'calendar' 
  | 'meeting' 
  | 'invoice' 
  | 'project' 
  | 'task' 
  | 'location' 
  | 'provider' 
  | 'workflow';

export interface RealityEntity {
  id: string;
  type: EntityType;
  attributes: Record<string, any>;
  provenance: {
    sourceEventId: string;       // Link back to the immutable Event Log
    authoritativeSource: string; // e.g., 'gmail', 'user_input', 'os_inference'
    confidence: number;          // 0.0 - 1.0
    lastVerifiedAt: string;      // ISO8601
  };
  createdAt: string;
  updatedAt: string;
}

export interface RealityRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;          // e.g., 'works_for', 'assigned_to', 'depends_on'
  attributes: Record<string, any>;
  provenance: {
    sourceEventId: string;
    confidence: number;
  };
}

export interface RealityGraphABI {
  getEntity(id: string): Promise<RealityEntity | null>;
  getRelationships(entityId: string, direction?: 'in' | 'out' | 'both'): Promise<RealityRelationship[]>;
  
  // Note: Direct mutation is forbidden by Law 08. 
  // Subsystems must append to EventLog, which then applies the transaction to RealityGraph.
  query(cypherOrGraphQL: string): Promise<any>;
}
