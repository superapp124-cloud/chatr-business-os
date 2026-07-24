import { IntentResult, RankedSource, RawSource } from "./types.js";
import { TrustScorer } from "./trustScorer.js";

export class RetrievalFilter {
  static filterAndRank(query: string, sources: RawSource[], intent: IntentResult): RankedSource[] {
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));
    const domainCounts = new Map<string, number>();

    const ranked = sources.map(source => {
      const snippetTokens = source.snippet.toLowerCase().split(/\s+/);
      const overlap = snippetTokens.filter(t => queryTokens.has(t)).length;
      
      const relevance = Math.min(100, (overlap / Math.max(1, queryTokens.size)) * 100);
      const trust = TrustScorer.calculateScore(source, intent);
      const freshness = source.snippet.includes("ago") || source.snippet.includes("2026") ? 90 : 50;
      const contentDepth = Math.min(100, source.snippet.length / 2);
      const commerceScore = intent.commerceIntentScore * 100;

      let compositeScore = 
        (relevance * 0.35) + 
        (trust * 0.25) + 
        (freshness * 0.10) + 
        (commerceScore * 0.20) + 
        (contentDepth * 0.10);

      // Source Diversity Penalty
      const domain = TrustScorer.extractDomain(source.url);
      const count = (domainCounts.get(domain) || 0) + 1;
      domainCounts.set(domain, count);

      if (count > 2) {
        compositeScore -= 30; // Dramatically reduce score if same domain appears > 2 times
      }

      return {
        ...source,
        trustScore: trust,
        relevanceScore: relevance,
        freshnessScore: freshness,
        contentDepthScore: contentDepth,
        compositeScore,
        isTrusted: trust > 70
      };
    });

    // Deduplication by URL
    const unique = new Map<string, RankedSource>();
    for (const source of ranked) {
      if (!unique.has(source.url) || unique.get(source.url)!.compositeScore < source.compositeScore) {
        unique.set(source.url, source);
      }
    }

    return Array.from(unique.values())
      .filter(s => s.compositeScore > 20) // Filter extremely low quality
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }
}
