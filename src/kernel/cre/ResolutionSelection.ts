import { RankedCandidate } from './ResolutionRanking';
import { explainabilityEngine } from '../ecosystem/ExplainabilityEngine';

export class ResolutionSelection {
  /**
   * Makes the final deterministic choice from ranked candidates and triggers explainability.
   */
  public selectCandidate(candidates: RankedCandidate[], intentId: string, processId: string): RankedCandidate | null {
    if (candidates.length === 0) return null;

    // Deterministic greedy choice (pick the highest scored)
    const selected = candidates[0];

    // Trigger explainability for transparency
    explainabilityEngine.logDecision({
      capabilityId: selected.capabilityId,
      candidates: candidates.length,
      policy: 'Maximize Trust x Reliability',
      selectedSource: {
        id: selected.entityId,
        trust: selected.trust,
        health: selected.health,
        economy: { costEstimate: selected.costEstimate }
      },
      intentId,
      processId
    }).catch(err => console.error('[ResolutionSelection] Failed to log explainability:', err));

    return selected;
  }
}

export const resolutionSelection = new ResolutionSelection();
