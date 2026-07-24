/**
 * Provider Certification Scorecard — v1.1A+
 *
 * Two-tier certification system:
 *
 * Tier 1: MANDATORY checks — any failure immediately blocks certification,
 *         regardless of the overall score.
 *         - Contract Compliance
 *         - Security
 *         - Reliability
 *
 * Tier 2: SCORED categories — weighted, must reach ≥ 80% to certify.
 *         - Performance (40%)
 *         - Observability (35%)
 *         - Documentation (25%)
 *
 * Every certification run produces a structured JSON artifact.
 */

export interface MandatoryChecks {
  contractCompliance: boolean;  // Implements full IAIProvider/IProvider interface
  apiCompatibility: boolean;    // No breaking change vs prior certified version
  security: boolean;            // Passes sandboxing, prompt boundary, token checks
  reliability: boolean;         // Survives fault injection: timeouts, 500s, disconnects
}

export interface ScoredChecks {
  performance: boolean;         // Meets P50/P95/P99 latency thresholds vs baseline
  observability: boolean;       // Emits standard telemetry events
  documentation: boolean;       // Fully documented capability surface
}

export interface BenchmarkSummary {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  baselineP95Ms: number | null;   // null if no prior baseline exists
  regressionDetected: boolean;
}

export interface CertificationArtifact {
  provider: string;
  version: string;
  certificationDate: string;
  verdict: 'CERTIFIED' | 'NOT_CERTIFIED' | 'CONDITIONAL';
  mandatoryChecks: MandatoryChecks;
  scoredResults: ScoredChecks & { overallScore: number };
  benchmarkSummary: BenchmarkSummary | null;
  aiQualityResults?: {
    deterministicScore: number;
    calibrationScore?: number;  // confidence ↔ correctness correlation (0–1)
    subjectiveReviewed: boolean;
    notes: string;
  };
  knownLimitations: string[];
  blockedBy?: string;   // set if a mandatory check failed
}

const SCORE_WEIGHTS = {
  performance:   40,
  observability: 35,
  documentation: 25,
} as const;

export class IntegrationCertification {

  /**
   * Evaluates a provider against the two-tier certification framework.
   *
   * @param providerName  Human-readable name
   * @param version       Semantic version of the provider adapter
   * @param mandatory     Results of the three mandatory checks
   * @param scored        Results of the three scored checks
   * @param benchmark     Optional benchmark data for regression detection
   * @param extras        Optional AI quality results and known limitations
   */
  static evaluate(
    providerName: string,
    version: string,
    mandatory: MandatoryChecks,
    scored: ScoredChecks,
    benchmark: BenchmarkSummary | null = null,
    extras: { aiQuality?: CertificationArtifact['aiQualityResults'], limitations?: string[] } = {}
  ): CertificationArtifact {
    console.log(`\n[Certification] Evaluating: ${providerName} ${version}`);

    // ── Tier 1: Mandatory checks ───────────────────────────────────────────────
    const mandatoryFailed = Object.entries(mandatory)
      .filter(([, passed]) => !passed)
      .map(([key]) => key);

    if (mandatoryFailed.length > 0) {
      const blockedBy = `Mandatory check(s) failed: ${mandatoryFailed.join(', ')}`;
      const artifact: CertificationArtifact = {
        provider: providerName,
        version,
        certificationDate: new Date().toISOString(),
        verdict: 'NOT_CERTIFIED',
        mandatoryChecks: mandatory,
        scoredResults: { ...scored, overallScore: 0 },
        benchmarkSummary: benchmark,
        knownLimitations: extras.limitations ?? [],
        blockedBy,
      };
      this.printVerdict(artifact);
      return artifact;
    }

    // ── Tier 2: Weighted score ─────────────────────────────────────────────────
    const overallScore = Object.entries(scored).reduce((total, [key, passed]) => {
      const weight = SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS] ?? 0;
      return total + (passed ? weight : 0);
    }, 0);

    const verdict = overallScore >= 80 ? 'CERTIFIED' : 'NOT_CERTIFIED';

    const artifact: CertificationArtifact = {
      provider: providerName,
      version,
      certificationDate: new Date().toISOString(),
      verdict,
      mandatoryChecks: mandatory,
      scoredResults: { ...scored, overallScore },
      benchmarkSummary: benchmark,
      aiQualityResults: extras.aiQuality,
      knownLimitations: extras.limitations ?? [],
    };

    this.printVerdict(artifact);
    return artifact;
  }

  private static printVerdict(a: CertificationArtifact): void {
    const icon = a.verdict === 'CERTIFIED' ? '✅' : '❌';
    console.log(`\n  ┌── ${a.provider} ${a.version} ─────────────────────────────`);
    console.log(`  │ Mandatory Checks`);
    for (const [k, v] of Object.entries(a.mandatoryChecks)) {
      console.log(`  │   ${v ? '✅' : '❌'} ${k}`);
    }
    if (a.blockedBy) {
      console.log(`  │ 🚫 BLOCKED: ${a.blockedBy}`);
    } else {
      console.log(`  │ Scored Checks (min 80%)`);
      const { overallScore, ...checks } = a.scoredResults;
      for (const [k, v] of Object.entries(checks)) {
        const w = SCORE_WEIGHTS[k as keyof typeof SCORE_WEIGHTS];
        console.log(`  │   ${v ? '✅' : '❌'} ${k.padEnd(16)} ${w}%`);
      }
      console.log(`  │   Overall Score: ${overallScore}%`);
    }
    if (a.benchmarkSummary) {
      const b = a.benchmarkSummary;
      const regression = b.regressionDetected ? ' ⚠️ REGRESSION' : '';
      console.log(`  │ Benchmarks — P50: ${b.p50Ms}ms | P95: ${b.p95Ms}ms | P99: ${b.p99Ms}ms${regression}`);
    }
    if (a.aiQualityResults) {
      const q = a.aiQualityResults;
      const det = `${(q.deterministicScore * 100).toFixed(0)}%`;
      const cal = q.calibrationScore != null ? `${(q.calibrationScore * 100).toFixed(0)}%` : 'N/A';
      const subj = q.subjectiveReviewed ? '✅ Reviewed' : '⚠️ Pending';
      console.log(`  │ AI Quality — Deterministic: ${det} | Calibration: ${cal} | Subjective: ${subj}`);
    }
    console.log(`  │`);
    console.log(`  └── Verdict: ${icon} ${a.verdict}`);
  }
}
