import { IntentResult, RawSource } from "./types.js";

export class TrustScorer {
  private static HIGH_TRUST_DOMAINS = [
    "gsmarena.com", "91mobiles.com", "smartprix.com", 
    "gadgets360.com", "techradar.com", "androidauthority.com", 
    "tomsguide.com", "flipkart.com", "amazon.in"
  ];

  static calculateScore(source: RawSource, intent: IntentResult): number {
    const domain = this.extractDomain(source.url);
    const lowerUrl = source.url.toLowerCase();
    
    let score = 50; // base score

    // Domain Boost
    if (this.HIGH_TRUST_DOMAINS.some(d => domain.includes(d))) {
      score += 40; 
    } else if (domain.includes("youtube.com")) {
      if (lowerUrl.includes("/results")) {
        score -= 30; // penalize raw search pages
      } else {
        score += 20; // boost specific videos
      }
    } else if (domain.includes("reddit.com")) {
      score += 15; // Reddit has good buying insights
    }

    // Commerce Heuristics
    if (intent.commerceIntentScore > 0) {
      if (domain.includes("forum") || lowerUrl.includes("wiki")) {
        score -= 20;
      }
      if (/\b(review|vs|compare|specs|price)\b/.test(lowerUrl)) {
        score += 15;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  static extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
}
