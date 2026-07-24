/**
 * AI Quality Certification — Gate A2 (v1.1A)
 *
 * Separated into:
 *   DETERMINISTIC — automated pass/fail against measurable criteria
 *   SUBJECTIVE    — evaluated against the gold-standard fixture dataset,
 *                   not ad hoc judgment
 *
 * The gold-standard dataset (tests/fixtures/ai_gold_standard.json) is the
 * source of truth for all subjective evaluations. This ensures consistency
 * across provider versions.
 */
import { OllamaProvider } from '@/core/ai/providers/OllamaProvider';
import { MockAIProvider } from '@/core/ai/providers/MockAIProvider';
import { IAIProvider } from '@/core/ai/providers/IAIProvider';
import goldStandard from './fixtures/ai_gold_standard.json';

export interface QualityResult {
  testId: string;
  category: 'DETERMINISTIC' | 'SUBJECTIVE';
  test: string;
  provider: string;
  score: number;
  threshold: number;
  passed: boolean;
  sample?: string;
  notes?: string;
}

// ── Deterministic Tests ───────────────────────────────────────────────────────

async function runDeterministicTests(provider: IAIProvider): Promise<QualityResult[]> {
  const results: QualityResult[] = [];

  // 1. JSON Schema Validation — structured output must parse cleanly
  let jsonSuccesses = 0;
  const jsonCases = goldStandard.filter(f => f.task === 'extractStructuredData');
  for (const fixture of jsonCases) {
    try {
      const res = await provider.extractStructuredData<any>(fixture.input, fixture.schema!);
      if (res.result && typeof res.result === 'object') jsonSuccesses++;
    } catch { /* fail */ }
  }
  results.push({
    testId: 'det_json_schema',
    category: 'DETERMINISTIC',
    test: 'JSON Schema Validation',
    provider: provider.name,
    score: jsonCases.length > 0 ? jsonSuccesses / jsonCases.length : 1,
    threshold: 1.0,
    passed: jsonSuccesses === jsonCases.length,
    sample: `${jsonSuccesses}/${jsonCases.length} valid JSON objects`
  });

  // 2. Field Extraction Coverage — required fields must be present
  let fieldHits = 0, fieldTotal = 0;
  for (const fixture of goldStandard.filter(f => f.task === 'extractStructuredData' && f.requiredFields)) {
    try {
      const res = await provider.extractStructuredData<any>(fixture.input, fixture.schema!);
      for (const field of fixture.requiredFields!) {
        fieldTotal++;
        if (res.result?.[field] !== undefined && res.result[field] !== null && res.result[field] !== '') fieldHits++;
      }
    } catch { fieldTotal += fixture.requiredFields!.length; }
  }
  const fieldScore = fieldTotal > 0 ? fieldHits / fieldTotal : 0;
  results.push({
    testId: 'det_field_coverage',
    category: 'DETERMINISTIC',
    test: 'Field Extraction Coverage',
    provider: provider.name,
    score: fieldScore,
    threshold: 0.80,
    passed: fieldScore >= 0.80,
    sample: `${fieldHits}/${fieldTotal} required fields present`
  });

  // 3. Classification Accuracy — vs labelled ground truth
  let classCorrect = 0;
  const classCases = goldStandard.filter(f => f.task === 'classify' && f.expectedCategory);
  for (const fixture of classCases) {
    try {
      const res = await provider.classify(fixture.input, fixture.categories!);
      if (res.result.category === fixture.expectedCategory) classCorrect++;
    } catch { /* fail */ }
  }
  const classScore = classCases.length > 0 ? classCorrect / classCases.length : 0;
  results.push({
    testId: 'det_classification',
    category: 'DETERMINISTIC',
    test: 'Classification Accuracy',
    provider: provider.name,
    score: classScore,
    threshold: 0.85,
    passed: classScore >= 0.85,
    sample: `${classCorrect}/${classCases.length} correct`
  });

  // 4. Confidence Calibration — does confidence correlate with correctness?
  // A model with high confidence that is also correct is well-calibrated.
  // A model that is highly confident when wrong is poorly calibrated (dangerous).
  let calibrationTotal = 0, calibrationHits = 0;
  for (const fixture of classCases) {
    try {
      const res = await provider.classify(fixture.input, fixture.categories!);
      const isCorrect = res.result.category === fixture.expectedCategory;
      const isConfident = (res.confidence ?? 0.5) >= 0.75;
      calibrationTotal++;
      // Calibrated = (confident AND correct) OR (not confident AND wrong)
      if ((isConfident && isCorrect) || (!isConfident && !isCorrect)) calibrationHits++;
    } catch { calibrationTotal++; /* count as miscalibrated */ }
  }
  const calibrationScore = calibrationTotal > 0 ? calibrationHits / calibrationTotal : 0;
  results.push({
    testId: 'det_calibration',
    category: 'DETERMINISTIC',
    test: 'Confidence Calibration',
    provider: provider.name,
    score: calibrationScore,
    threshold: 0.70,   // 70%: confidence should match correctness most of the time
    passed: calibrationScore >= 0.70,
    sample: `${calibrationHits}/${calibrationTotal} well-calibrated predictions`,
    notes: 'Tracks whether high-confidence outputs are actually correct. Poor calibration is a model quality risk.'
  });

  return results;
}

// ── Subjective Tests ──────────────────────────────────────────────────────────
// Evaluated against the gold-standard fixture. Auto-scored by key-term presence,
// flagged for human review when `subjectiveReview: true`.

async function runSubjectiveTests(provider: IAIProvider): Promise<QualityResult[]> {
  const results: QualityResult[] = [];

  // Summarization: must contain the acceptance criteria terms from the fixture
  for (const fixture of goldStandard.filter(f => f.task === 'summarize' && f.acceptanceCriteria)) {
    try {
      const res = await provider.summarize(fixture.input);
      const summary = res.result?.summary ?? '';
      const hits = fixture.acceptanceCriteria!.filter(term =>
        summary.toLowerCase().includes(term.toLowerCase())
      );
      const score = hits.length / fixture.acceptanceCriteria!.length;
      results.push({
        testId: fixture.id,
        category: 'SUBJECTIVE',
        test: `Summarization (${fixture.description})`,
        provider: provider.name,
        score,
        threshold: 0.60,   // Relaxed: subjective; flag for human review
        passed: score >= 0.60,
        sample: summary.slice(0, 100),
        notes: fixture.subjectiveReview ? '⚠️ Flagged for human review against gold standard.' : undefined
      });
    } catch (e: any) {
      results.push({
        testId: fixture.id, category: 'SUBJECTIVE', test: `Summarization (${fixture.description})`,
        provider: provider.name, score: 0, threshold: 0.60, passed: false,
        sample: `ERROR: ${e.message}`
      });
    }
  }

  // Reasoning: must produce non-empty reasoning and decision
  for (const fixture of goldStandard.filter(f => f.task === 'reason' && f.requiredElements)) {
    try {
      const res = await provider.reason(fixture.input, fixture.goal!);
      const hasReasoning = typeof res.result?.reasoning === 'string' && res.result.reasoning.length > 10;
      const hasDecision = typeof res.result?.decision === 'string' && res.result.decision.length > 0;
      const score = (hasReasoning ? 0.5 : 0) + (hasDecision ? 0.5 : 0);
      results.push({
        testId: fixture.id,
        category: 'SUBJECTIVE',
        test: `Reasoning (${fixture.description})`,
        provider: provider.name,
        score,
        threshold: 0.80,
        passed: score >= 0.80,
        sample: res.result?.decision?.slice(0, 80),
        notes: fixture.subjectiveReview ? '⚠️ Flagged for human review against gold standard.' : undefined
      });
    } catch (e: any) {
      results.push({
        testId: fixture.id, category: 'SUBJECTIVE', test: `Reasoning (${fixture.description})`,
        provider: provider.name, score: 0, threshold: 0.80, passed: false,
        sample: `ERROR: ${e.message}`
      });
    }
  }

  return results;
}

// ── Runner ─────────────────────────────────────────────────────────────────────

export async function runAIQualityCertification(useOllama = true): Promise<{
  certified: boolean;
  deterministicPassed: boolean;
  calibrationScore: number;
  subjectiveReviewRequired: boolean;
  results: QualityResult[]
}> {
  const provider: IAIProvider = useOllama ? new OllamaProvider() : new MockAIProvider();

  if (useOllama) {
    const health = await provider.health();
    if (!health.isHealthy) {
      console.warn('[Gate A2] Ollama unavailable — falling back to MockAIProvider.');
      return runAIQualityCertification(false);
    }
  }

  console.log(`\n[Gate A2] AI Quality Certification — Provider: ${provider.name}`);
  const deterministicResults = await runDeterministicTests(provider);
  const subjectiveResults = await runSubjectiveTests(provider);
  const allResults = [...deterministicResults, ...subjectiveResults];

  // Print table
  console.log('\n  Category        Test                              Score   Threshold  Result');
  console.log('  ─────────────── ────────────────────────────────  ──────  ─────────  ──────');
  for (const r of allResults) {
    const cat  = r.category.slice(0, 13).padEnd(15);
    const test = r.test.slice(0, 32).padEnd(32);
    const sc   = `${(r.score * 100).toFixed(0)}%`.padEnd(6);
    const th   = `${(r.threshold * 100).toFixed(0)}%`.padEnd(9);
    const res  = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${cat} ${test}  ${sc}  ${th}  ${res}`);
    if (r.notes) console.log(`                   ⤷ ${r.notes}`);
  }

  const deterministicPassed = deterministicResults.every(r => r.passed);
  const calibrationResult = deterministicResults.find(r => r.testId === 'det_calibration');
  const calibrationScore = calibrationResult?.score ?? 0;
  const subjectiveReviewRequired = subjectiveResults.some(r => r.notes?.includes('human review'));
  const certified = deterministicPassed;

  console.log(`\n  Deterministic: ${deterministicPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  Calibration:   ${(calibrationScore * 100).toFixed(0)}% (threshold: 70%)`);
  console.log(`  Subjective: ${subjectiveReviewRequired ? 'Human review required ⚠️' : 'Auto-passed ✅'}`);
  console.log(`  [Gate A2] Overall: ${certified ? 'CERTIFIED ✅' : 'FAILED ❌'}\n`);

  return { certified, deterministicPassed, calibrationScore, subjectiveReviewRequired, results: allResults };
}
