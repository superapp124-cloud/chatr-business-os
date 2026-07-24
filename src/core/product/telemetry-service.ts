// ─── Telemetry Service ────────────────────────────────────────────────────────
// Persists every execution trace and computes Product KPIs.
// Lives entirely in the product layer. The kernel is never touched.

export interface ExecutionTrace {
  intent: string;
  firstResult: string | null;
  userClicked: boolean;
  recommendationAccepted: boolean;
  checkoutStarted: boolean;
  checkoutCompleted: boolean;
  recoveryNeeded: boolean;
  recoveryWorked: boolean;
  userCancelled: boolean;
  totalTimeMs: number;
  confidence: number;
  realityLevel: string; // 'Live Provider' | 'Demonstration Mode'
  abVariant?: 'A' | 'B';
  // Granular latency breakdown (ms from session start)
  latency_intentToResult?: number;
  latency_resultToCheckout?: number;
  latency_checkoutToPayment?: number;
  // Time to Confidence: ms from results shown → first card click
  // This is the most important UX metric. If >5000ms, UI needs redesign.
  timeToConfidenceMs?: number;
  // Step where abandonment happened (if any)
  abandonedAt?: 'intent' | 'recommendation' | 'checkout' | 'payment';
  experienceScore?: number;
  npsScore?: 'definitely' | 'probably' | 'maybe' | 'no';
  feedbackRating?: 'yes' | 'same' | 'no';
}

export class TelemetryService {
  private static STORAGE_KEY = 'chatr_telemetry_traces';

  // ── Logging ──────────────────────────────────────────────────────────────────

  static logExecution(trace: ExecutionTrace) {
    if (!trace.experienceScore) {
      trace.experienceScore = this._computeScore(trace);
    }
    try {
      const existing = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
      existing.push({ ...trace, timestamp: Date.now() });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existing));
      console.log('[TelemetryService] Logged Execution:', trace);
    } catch (e) {
      console.error('Failed to log telemetry', e);
    }
  }

  private static _computeScore(trace: ExecutionTrace): number {
    let score = 10;
    if (trace.totalTimeMs > 1500) score -= 1;
    if (trace.totalTimeMs > 3000) score -= 2;
    if (!trace.recommendationAccepted) score -= 1;
    if (trace.recoveryNeeded) {
      score -= 1;
      if (!trace.recoveryWorked) score -= 4;
    }
    if (trace.userCancelled) score = 0;
    return Math.max(0, score);
  }

  // ── Aggregate Metrics ─────────────────────────────────────────────────────────

  static getMetrics() {
    try {
      const traces: (ExecutionTrace & { timestamp: number })[] = JSON.parse(
        localStorage.getItem(this.STORAGE_KEY) || '[]'
      );
      if (!traces.length) return null;

      const completed = traces.filter(t => t.checkoutCompleted);
      const withRecovery = traces.filter(t => t.recoveryNeeded);
      const latencies = traces.map(t => t.totalTimeMs).sort((a, b) => a - b);
      const n = latencies.length;
      const pct = (p: number) => latencies[Math.ceil(n * p) - 1] ?? 0;

      // Time to Confidence (the key UX metric)
      const confidenceTimes = traces
        .filter(t => t.timeToConfidenceMs !== undefined)
        .map(t => t.timeToConfidenceMs as number)
        .sort((a, b) => a - b);
      const avgConfidenceMs = confidenceTimes.length
        ? Math.round(confidenceTimes.reduce((a, b) => a + b, 0) / confidenceTimes.length)
        : null;
      const p90ConfidenceMs = confidenceTimes.length
        ? confidenceTimes[Math.ceil(confidenceTimes.length * 0.9) - 1]
        : null;

      // Friction heatmap — step-level abandonment rate
      const abandonedAt = (step: string) =>
        traces.filter(t => t.abandonedAt === step).length;
      const frictionHeatmap = [
        { step: 'Intent Entry', abandoned: abandonedAt('intent'), total: traces.length },
        { step: 'Recommendation', abandoned: abandonedAt('recommendation'), total: traces.length },
        { step: 'Checkout', abandoned: abandonedAt('checkout'), total: traces.length },
        { step: 'Payment', abandoned: abandonedAt('payment'), total: traces.length },
      ].map(h => ({ ...h, rate: h.total ? ((h.abandoned / h.total) * 100).toFixed(1) + '%' : '0%' }));

      // NPS breakdown
      const npsBreakdown = {
        definitely: traces.filter(t => t.npsScore === 'definitely').length,
        probably: traces.filter(t => t.npsScore === 'probably').length,
        maybe: traces.filter(t => t.npsScore === 'maybe').length,
        no: traces.filter(t => t.npsScore === 'no').length,
      };
      const npsPositiveRate = traces.length
        ? (((npsBreakdown.definitely + npsBreakdown.probably) / traces.length) * 100).toFixed(1)
        : '0';

      // Magic Score = Completion × Trust × Would-Use-Again × Recommendation-Acceptance
      // Trust proxy: % of completed sessions (users who didn't abandon)
      // Each factor is 0–1. Result is 0–100. This is the single sprint KPI.
      const completionFactor = completed.length / traces.length;
      const trustFactor = completed.length / traces.length; // same proxy — will diverge when Time to Trust is tracked
      const wouldUseAgainFactor = traces.length
        ? (npsBreakdown.definitely + npsBreakdown.probably) / traces.length
        : 0;
      const recommendationFactor = traces.length
        ? traces.filter(t => t.recommendationAccepted).length / traces.length
        : 0;
      const magicScore = Math.round(
        completionFactor * trustFactor * wouldUseAgainFactor * recommendationFactor * 100 * 100
      ) / 100; // 0 – 100

      // Today's daily report
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayTraces = traces.filter(t => t.timestamp >= todayStart.getTime());
      const todayCompleted = todayTraces.filter(t => t.checkoutCompleted);
      const todayActions = todayTraces; // proxy: avg taps not tracked per-session here

      return {
        totalExecutions: traces.length,
        averageTimeMs: traces.reduce((acc, t) => acc + t.totalTimeMs, 0) / traces.length,
        completionRate: (completed.length / traces.length) * 100,
        recoverySuccessRate: withRecovery.length
          ? (withRecovery.filter(t => t.recoveryWorked).length / withRecovery.length) * 100
          : 100,
        recommendationAcceptance: (traces.filter(t => t.recommendationAccepted).length / traces.length) * 100,
        averageExperienceScore: traces.reduce((acc, t) => acc + (t.experienceScore ?? 0), 0) / traces.length,
        // Percentile latency
        p50Ms: pct(0.5),
        p90Ms: pct(0.9),
        p95Ms: pct(0.95),
        worstMs: latencies[n - 1] ?? 0,
        bestMs: latencies[0] ?? 0,
        // Time to Confidence
        avgConfidenceMs,
        p90ConfidenceMs,
        confidenceSamples: confidenceTimes.length,
        // Friction
        frictionHeatmap,
        // NPS
        npsBreakdown,
        npsPositiveRate,
        magicScore,
        // Daily report
        daily: {
          users: todayTraces.length,
          completionRate: todayTraces.length ? ((todayCompleted.length / todayTraces.length) * 100).toFixed(0) : '0',
          avgTimeMs: todayTraces.length
            ? Math.round(todayTraces.reduce((a, t) => a + t.totalTimeMs, 0) / todayTraces.length)
            : 0,
        },
      };
    } catch (e) {
      return null;
    }
  }

  // ── Seed Demo Data (for Day 1 internal testing validation) ────────────────────

  static seedDemoData(count = 42) {
    const outcomes = [
      { checkoutCompleted: true, recommendationAccepted: true, userCancelled: false, recoveryNeeded: false, recoveryWorked: false, abandonedAt: undefined },
      { checkoutCompleted: true, recommendationAccepted: true, userCancelled: false, recoveryNeeded: true, recoveryWorked: true, abandonedAt: undefined },
      { checkoutCompleted: false, recommendationAccepted: true, userCancelled: false, recoveryNeeded: false, recoveryWorked: false, abandonedAt: 'checkout' as const },
      { checkoutCompleted: false, recommendationAccepted: false, userCancelled: true, recoveryNeeded: false, recoveryWorked: false, abandonedAt: 'recommendation' as const },
    ];
    const npsOptions = ['definitely', 'definitely', 'probably', 'probably', 'maybe', 'no'] as const;
    const feedback = ['yes', 'yes', 'yes', 'same', 'no'] as const;
    const existing = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    for (let i = 0; i < count; i++) {
      const o = outcomes[Math.floor(Math.random() * outcomes.length)];
      const latency = 300 + Math.random() * 900;
      const trace: ExecutionTrace & { timestamp: number } = {
        intent: 'Order Chicken Biryani',
        firstResult: 'Paradise',
        userClicked: true,
        totalTimeMs: latency,
        confidence: 0.9 + Math.random() * 0.1,
        realityLevel: 'Demonstration Mode',
        latency_intentToResult: 180 + Math.random() * 80,
        latency_resultToCheckout: 200 + Math.random() * 100,
        npsScore: npsOptions[Math.floor(Math.random() * npsOptions.length)],
        feedbackRating: feedback[Math.floor(Math.random() * feedback.length)],
        abVariant: Math.random() > 0.5 ? 'A' : 'B',
        timestamp: Date.now() - Math.floor(Math.random() * 86400000),
        ...o,
      };
      trace.experienceScore = this._computeScore(trace);
      existing.push(trace);
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existing));
    console.log(`[TelemetryService] Seeded ${count} demo traces`);
  }

  static clear() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
