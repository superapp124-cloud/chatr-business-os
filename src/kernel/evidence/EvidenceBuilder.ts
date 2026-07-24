import { QueryEngine } from '../query/QueryEngine';

export interface EvidencePackage {
  question: string;
  facts: string[];
  timeline: any[];
  relationships: any[];
  supportingDocuments: any[];
  confidence: number;
}

/**
 * The Evidence Builder
 * 
 * This is where CHATR OS becomes genuinely AI-native.
 * Instead of an LLM deciding what context to retrieve, it consumes a curated
 * Evidence Package built deterministically from the Kernel.
 */
export class EvidenceBuilder {
  constructor(private queryEngine: QueryEngine) {}

  /**
   * Assembles an Evidence Package based on a target aggregate and a specific question.
   * In a full implementation, this uses semantic resolution to figure out which 
   * aggregates answer the question.
   */
  async buildPackage(
    question: string,
    targetType: string, 
    targetId: string, 
    actorId: string
  ): Promise<EvidencePackage> {
    
    // 1. Fetch deterministic current state via Query Engine (Enforces Permissions)
    const currentState = await this.queryEngine.get({
      actorId,
      aggregateType: targetType,
      aggregateId: targetId
    });

    if (!currentState) {
      throw new Error(`Evidence cannot be built. Target ${targetType} ${targetId} not found or access denied.`);
    }

    // 2. Fetch Relationships
    const relationships = await this.queryEngine.getRelated({
      actorId,
      aggregateType: targetType,
      aggregateId: targetId
    });

    // 3. Assemble Facts
    // A simple fact extractor. In reality, it translates object state into English predicates.
    const facts: string[] = [];
    facts.push(`${targetType} status = ${currentState._lifecycleState || 'Active'}`);
    
    for (const [key, value] of Object.entries(currentState)) {
      if (!key.startsWith('_') && typeof value !== 'object') {
        facts.push(`${key} = ${value}`);
      }
    }

    // 4. Extract Policies (Simulated here)
    // If we had a Policy Engine hooked up, we'd include active constraints.
    // e.g. facts.push("Policy OfferRequiresBackgroundCheck = true");

    // 5. Build Evidence Package
    return {
      question,
      facts,
      timeline: [], // Would query TimelineProjection
      relationships: relationships.map(r => `${r.edge.predicate} -> ${r.targetState.__type}`),
      supportingDocuments: [], // Would query KnowledgeService
      confidence: 1.0
    };
  }
}
