// ─── AB Testing Service ───────────────────────────────────────────────────────
// Manages variant assignment and result tracking.
// The kernel never sees this. The UI picks a variant per session.

export type ABVariant = 'A' | 'B';

export interface ABResult {
  variant: ABVariant;
  recommendationAccepted: boolean;
  timeToSelectMs: number;
  sessionId: string;
  timestamp: number;
}

const AB_STORE_KEY = 'chatr_ab_results';

export class ABTestingService {
  /** Randomly assign a variant, weighted 50/50 */
  static assignVariant(): ABVariant {
    return Math.random() < 0.5 ? 'A' : 'B';
  }

  /** Record the outcome of an A/B session */
  static recordResult(result: ABResult) {
    try {
      const stored: ABResult[] = JSON.parse(localStorage.getItem(AB_STORE_KEY) || '[]');
      stored.push(result);
      localStorage.setItem(AB_STORE_KEY, JSON.stringify(stored));
    } catch (e) {
      console.error('[ABTestingService] Failed to save result:', e);
    }
  }

  /** Compute acceptance rates by variant */
  static getResults() {
    try {
      const results: ABResult[] = JSON.parse(localStorage.getItem(AB_STORE_KEY) || '[]');
      const byVariant = (v: ABVariant) => results.filter(r => r.variant === v);
      const acceptance = (v: ABVariant) => {
        const group = byVariant(v);
        if (!group.length) return null;
        const rate = (group.filter(r => r.recommendationAccepted).length / group.length) * 100;
        const avgTime = group.reduce((acc, r) => acc + r.timeToSelectMs, 0) / group.length;
        return { count: group.length, acceptanceRate: rate, avgTimeMs: avgTime };
      };
      return { A: acceptance('A'), B: acceptance('B') };
    } catch {
      return { A: null, B: null };
    }
  }

  static clear() {
    localStorage.removeItem(AB_STORE_KEY);
  }
}
