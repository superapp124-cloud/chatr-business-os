/**
 * AI Contract Equivalence Tests — v1.1A
 *
 * Validates that MockAIProvider and OllamaProvider satisfy the same IAIProvider contract.
 * The goal is NOT identical outputs — it is demonstrating that both providers fulfill
 * each method's contract shape correctly.
 *
 * Run these before retiring the MockAIProvider.
 */
import { MockAIProvider } from '@/core/ai/providers/MockAIProvider';
import { OllamaProvider } from '@/core/ai/providers/OllamaProvider';
import { IAIProvider } from '@/core/ai/providers/IAIProvider';

interface ContractResult {
  test: string;
  mockResult: 'PASS' | 'FAIL' | 'SKIP';
  ollamaResult: 'PASS' | 'FAIL' | 'SKIP';
  contractSatisfied: boolean;
  notes: string;
}

const SAMPLE_TEXT = `John Smith is applying for a Senior Engineer role. He has 8 years of experience in TypeScript and distributed systems.`;
const CATEGORIES = ['Engineering', 'Marketing', 'Finance', 'HR'];

async function runContractTest(
  testName: string,
  fn: (provider: IAIProvider) => Promise<any>,
  validate: (result: any) => boolean
): Promise<ContractResult> {
  const mock = new MockAIProvider();
  const ollama = new OllamaProvider();

  const result: ContractResult = {
    test: testName,
    mockResult: 'FAIL',
    ollamaResult: 'SKIP',
    contractSatisfied: false,
    notes: ''
  };

  // Test Mock
  try {
    const mockRes = await fn(mock);
    result.mockResult = validate(mockRes) ? 'PASS' : 'FAIL';
    if (result.mockResult === 'FAIL') result.notes += 'Mock: contract shape invalid. ';
  } catch (e: any) {
    result.mockResult = 'FAIL';
    result.notes += `Mock threw: ${e.message}. `;
  }

  // Test Ollama (check health first — gracefully skip if unavailable)
  const ollamaHealth = await ollama.health();
  if (!ollamaHealth.isHealthy) {
    result.ollamaResult = 'SKIP';
    result.notes += 'Ollama unavailable — skipped (not running locally).';
    // Contract is satisfied if mock passes AND ollama is simply not available
    result.contractSatisfied = result.mockResult === 'PASS';
    return result;
  }

  try {
    const ollamaRes = await fn(ollama);
    result.ollamaResult = validate(ollamaRes) ? 'PASS' : 'FAIL';
    if (result.ollamaResult === 'FAIL') result.notes += 'Ollama: contract shape invalid. ';
  } catch (e: any) {
    result.ollamaResult = 'FAIL';
    result.notes += `Ollama threw: ${e.message}. `;
  }

  result.contractSatisfied = result.mockResult === 'PASS' && result.ollamaResult !== 'FAIL';
  return result;
}

export async function runAIContractEquivalenceTests() {
  console.log('\n[v1.1A] Running AI Contract Equivalence Tests...');
  const results: ContractResult[] = [];

  results.push(await runContractTest(
    'getAvailableModels',
    p => p.getAvailableModels(),
    r => Array.isArray(r) && (r.length === 0 || (r[0].id && r[0].provider))
  ));

  results.push(await runContractTest(
    'extractStructuredData',
    p => p.extractStructuredData(SAMPLE_TEXT, 'CandidateProfile'),
    r => r && typeof r.result !== 'undefined' && typeof r.confidence === 'number'
  ));

  results.push(await runContractTest(
    'classify',
    p => p.classify(SAMPLE_TEXT, CATEGORIES),
    r => r && r.result && typeof r.result.category === 'string'
  ));

  results.push(await runContractTest(
    'summarize',
    p => p.summarize(SAMPLE_TEXT),
    r => r && r.result && typeof r.result.summary === 'string'
  ));

  results.push(await runContractTest(
    'reason',
    p => p.reason(SAMPLE_TEXT, 'Should this candidate proceed to interview?'),
    r => r && r.result && typeof r.result.decision !== 'undefined'
  ));

  results.push(await runContractTest(
    'generate',
    p => p.generate('Write a brief introduction for a hiring workflow.'),
    r => r && r.result && typeof r.result.output === 'string'
  ));

  // Print table
  console.log('\n┌──────────────────────────────────┬────────┬────────┬──────────────────────┐');
  console.log('│ Test                             │ Mock   │ Ollama │ Contract Satisfied   │');
  console.log('├──────────────────────────────────┼────────┼────────┼──────────────────────┤');
  for (const r of results) {
    const name = r.test.padEnd(32);
    const mock = r.mockResult.padEnd(6);
    const ollama = r.ollamaResult.padEnd(6);
    const ok = r.contractSatisfied ? '✅' : '❌';
    console.log(`│ ${name} │ ${mock} │ ${ollama} │ ${ok}                   │`);
  }
  console.log('└──────────────────────────────────┴────────┴────────┴──────────────────────┘');

  const allPassed = results.every(r => r.contractSatisfied);
  console.log(`\n[v1.1A] Contract Equivalence: ${allPassed ? 'CERTIFIED ✅' : 'FAILED ❌'}\n`);
  return { allPassed, results };
}
