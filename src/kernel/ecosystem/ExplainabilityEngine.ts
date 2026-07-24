import { kernel } from '../abi';

export class ExplainabilityEngine {
  public async logDecision(payload: any): Promise<void> {
    const { capabilityId, candidates, policy, selectedSource, intentId, processId } = payload;

    if (!selectedSource) return;

    const explanation = {
      decision: `Selected provider ${selectedSource.id}`,
      reasons: [
        `Optimization Policy: ${policy}`,
        `Candidates Evaluated: ${candidates}`,
        `Trust Confidence: ${(selectedSource.trust?.confidence || 0).toFixed(2)}`,
        `Trust Reliability: ${(selectedSource.trust?.reliability || 0).toFixed(2)}`,
        `Health Status: ${selectedSource.health || 'UNKNOWN'}`
      ],
      estimatedCost: selectedSource.economy?.costEstimate || '0 USD',
      timestamp: Date.now()
    };

    // Store as a Knowledge node
    await kernel.storeKnowledge({
      type: 'evidence',
      source: 'system' as any,
      content: {
        type: 'explainability_decision',
        intentId,
        processId,
        capabilityId,
        explanation
      },
      confidence: 1.0,
      trust: {
        confidence: 1.0,
        reputation: 1.0,
        verification: 1.0,
        reliability: 1.0,
        security: 1.0,
        compliance: 1.0,
        privacy: 1.0,
        latency: 1.0,
        costEfficiency: 1.0,
        freshness: 1.0,
        userRating: 1.0,
        kernelConfidence: 1.0
      },
      lineage: []
    });
  }
}

export const explainabilityEngine = new ExplainabilityEngine();
