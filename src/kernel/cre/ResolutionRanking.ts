import { ResolutionCandidate } from './ResolutionDiscovery';

export interface RankedCandidate extends ResolutionCandidate {
  score: number;
}

export class ResolutionRanking {
  /**
   * Ranks candidates based on the 9-dimensional TrustVector, health, and cost.
   */
  public rankCandidates(candidates: ResolutionCandidate[], intentPriority: number = 0.5): RankedCandidate[] {
    if (candidates.length === 0) return [];

    const ranked = candidates.map(candidate => {
      let score = 0;

      // Base trust score (average of confidence and reliability)
      const trust = candidate.trust || {};
      const confidence = trust.confidence || 0.5;
      const reliability = trust.reliability || 0.5;
      const latency = trust.latency || 0.5;
      const costEfficiency = trust.costEfficiency || 0.5;

      // Calculate score with dynamic weights
      // If priority is high, weight latency and reliability higher.
      const wLatency = intentPriority > 0.7 ? 0.4 : 0.2;
      const wReliability = 0.3;
      const wConfidence = 0.3;
      const wCost = intentPriority > 0.7 ? 0.0 : 0.2;

      score = (confidence * wConfidence) + 
              (reliability * wReliability) + 
              (latency * wLatency) + 
              (costEfficiency * wCost);

      // Penalize degraded health heavily
      if (candidate.health === 'DEGRADED') {
        score *= 0.5;
      } else if (candidate.health === 'RATE_LIMITED') {
        score *= 0.1; // extreme penalty
      }

      return { ...candidate, score };
    });

    // Sort descending
    return ranked.sort((a, b) => b.score - a.score);
  }
}

export const resolutionRanking = new ResolutionRanking();
