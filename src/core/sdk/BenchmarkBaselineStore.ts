/**
 * Benchmark Baseline Store
 *
 * Stores certified benchmark baselines so that future provider versions
 * can be compared against the last certified run rather than only fixed thresholds.
 *
 * Format: { [providerVersion]: BenchmarkBaseline }
 *
 * In a real deployment this would persist to Supabase or the StateStore.
 * For now it uses localStorage so baselines survive app restarts.
 */

export interface BenchmarkBaseline {
  provider: string;
  version: string;
  certifiedAt: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  throughputWPS: number;
}

const STORAGE_KEY = 'chatr:benchmark_baselines';

export class BenchmarkBaselineStore {

  static load(): Record<string, BenchmarkBaseline> {
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  static save(key: string, baseline: BenchmarkBaseline): void {
    try {
      const all = this.load();
      all[key] = baseline;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
      console.log(`[BenchmarkBaseline] Stored baseline for ${key}`);
    } catch (e) {
      console.warn('[BenchmarkBaseline] Could not persist baseline:', e);
    }
  }

  static get(provider: string, version: string): BenchmarkBaseline | null {
    const all = this.load();
    return all[`${provider}:${version}`] ?? null;
  }

  /**
   * Compare a new benchmark result against the last certified baseline.
   * Returns true if performance has regressed beyond a 15% tolerance.
   */
  static detectRegression(
    provider: string,
    baselineVersion: string,
    currentP95Ms: number,
    tolerancePct = 15
  ): { regressionDetected: boolean; baselineP95Ms: number | null; deltaPct: number | null } {
    const baseline = this.get(provider, baselineVersion);
    if (!baseline) return { regressionDetected: false, baselineP95Ms: null, deltaPct: null };

    const deltaPct = ((currentP95Ms - baseline.p95Ms) / baseline.p95Ms) * 100;
    const regressionDetected = deltaPct > tolerancePct;

    if (regressionDetected) {
      console.warn(
        `[BenchmarkBaseline] ⚠️ Regression detected for ${provider}: ` +
        `P95 ${baseline.p95Ms}ms → ${currentP95Ms}ms (+${deltaPct.toFixed(1)}%)`
      );
    }

    return { regressionDetected, baselineP95Ms: baseline.p95Ms, deltaPct };
  }
}
