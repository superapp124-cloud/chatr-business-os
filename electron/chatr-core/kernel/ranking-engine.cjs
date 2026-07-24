'use strict';

/**
 * Ranking Engine
 * Consumes an array of normalized DiscoveryResults and ranks them based on weighted policies.
 */
class RankingEngine {
  constructor(weights = {}) {
    // Default configurable policy weights
    this.weights = {
      price: weights.price || 0.30,
      rating: weights.rating || 0.25,
      eta: weights.eta || 0.20,
      confidence: weights.confidence || 0.15,
      offers: weights.offers || 0.10
    };
  }

  /**
   * Evaluates a single DiscoveryResult and computes its score and reasons.
   */
  _evaluate(result) {
    let score = 0;
    const reasons = [];

    // Base score (0-100)
    score += (result.confidence || 0) * 100 * this.weights.confidence;

    // Rating (assuming 0-5 scale, normalized to 100)
    const ratingNorm = ((result.rating || 0) / 5) * 100;
    score += ratingNorm * this.weights.rating;

    if (result.rating >= 4.5) {
      reasons.push('Highest rating');
    }

    // ETA (lower is better, assuming max 60 mins for food)
    const eta = result.eta || 60;
    const etaNorm = Math.max(0, (60 - eta) / 60) * 100;
    score += etaNorm * this.weights.eta;

    if (eta < 30) {
      reasons.push('Fast delivery');
    }

    // Price (lower is better, heuristic normalization against average)
    // Very naive heuristic for POC
    const priceNorm = result.price < 300 ? 100 : 50; 
    score += priceNorm * this.weights.price;

    if (result.price < 300) {
      reasons.push('Great value');
    }

    // Offers/Fees
    if (result.delivery_fee === 0) {
      score += 100 * this.weights.offers;
      reasons.push('Free delivery');
    } else if (result.offers && result.offers.length > 0) {
      score += 50 * this.weights.offers;
      reasons.push(result.offers[0]);
    }

    return {
      result,
      score: Math.round(score * 10) / 10, // 1 decimal place
      reasons: reasons.slice(0, 3) // Max 3 reasons
    };
  }

  rank(discoveryResults, limit = 3) {
    if (!discoveryResults || discoveryResults.length === 0) return [];

    const evaluated = discoveryResults.map(r => this._evaluate(r));
    
    // Sort descending by score
    evaluated.sort((a, b) => b.score - a.score);

    return evaluated.slice(0, limit);
  }
}

module.exports = { RankingEngine };
