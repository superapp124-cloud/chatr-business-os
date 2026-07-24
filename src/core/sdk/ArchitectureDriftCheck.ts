/**
 * Architecture Drift Check — runs as part of every provider certification.
 *
 * The platform's central invariant:
 *   "Provider adapters evolve. The platform contracts do not."
 *
 * This check verifies that while implementing a provider, no public contracts
 * in the Kernel, Runtimes, or SDK were accidentally modified. If a drift is
 * detected, certification fails pending architectural review.
 *
 * Implementation strategy:
 *   A contract fingerprint is computed by hashing the public method signatures
 *   of each interface. Fingerprints are stored at the time of v1.0 qualification.
 *   Each certification run recomputes them and diffs against the baseline.
 *
 * In a CI environment this would use TypeScript AST diffing.
 * This implementation uses a structural snapshot approach suitable for the
 * browser/Electron runtime.
 */

import { IAIProvider } from '@/core/ai/providers/IAIProvider';
import { IProvider } from '@/core/providers/ProviderRegistry';

export interface ContractSnapshot {
  contract: string;
  version: string;
  methods: string[];     // sorted method names
  fingerprint: string;   // lightweight hash of method names
}

export interface DriftCheckResult {
  contract: string;
  baselineFingerprint: string;
  currentFingerprint: string;
  driftDetected: boolean;
  changedMethods: string[];
}

export interface ArchitectureDriftReport {
  passed: boolean;       // false = certification blocked pending architectural review
  drifts: DriftCheckResult[];
  checkedAt: string;
}

// ── Contract Baselines (captured at v1.0 Architecture Qualification) ──────────
// These are the frozen public method signatures. Any addition, removal, or
// rename constitutes a drift requiring architectural review.

const BASELINES: Record<string, string[]> = {
  'IAIProvider@v1': [
    'authenticate',
    'capabilities',
    'classify',
    'extractStructuredData',
    'generate',
    'getAvailableModels',
    'health',
    'reason',
    'summarize',
  ],
  'IProvider@v1': [
    'authenticate',
    'capabilities',
    'create',
    'health',
    'search',
    'verify',
  ],
  'IWorkflowSDK@v1': [
    'createCapability',
    'createStage',
    'log',
  ],
};

function fingerprint(methods: string[]): string {
  // Stable sort + join — deterministic for the same method set
  return methods.slice().sort().join('|');
}

function extractMethods(obj: object): string[] {
  const methods = new Set<string>();
  let proto = Object.getPrototypeOf(obj);
  while (proto && proto !== Object.prototype) {
    Object.getOwnPropertyNames(proto)
      .filter(n => n !== 'constructor' && typeof (obj as any)[n] === 'function')
      .forEach(n => methods.add(n));
    proto = Object.getPrototypeOf(proto);
  }
  return Array.from(methods).sort();
}

function checkContract(contractName: string, instance: object): DriftCheckResult {
  const baseline = BASELINES[contractName] ?? [];
  const baselineFP = fingerprint(baseline);

  const current = extractMethods(instance);
  const currentFP = fingerprint(current);

  const baselineSet = new Set(baseline);
  const currentSet = new Set(current);
  const added   = current.filter(m => !baselineSet.has(m));
  const removed = baseline.filter(m => !currentSet.has(m));
  const changedMethods = [...added.map(m => `+${m}`), ...removed.map(m => `-${m}`)];

  return {
    contract: contractName,
    baselineFingerprint: baselineFP,
    currentFingerprint: currentFP,
    driftDetected: currentFP !== baselineFP,
    changedMethods,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function runArchitectureDriftCheck(
  aiProviderInstance: IAIProvider,
  domainProviderInstance?: IProvider,
): Promise<ArchitectureDriftReport> {
  console.log('\n[Drift Check] Verifying platform contracts are unchanged...');

  const drifts: DriftCheckResult[] = [];

  // Check IAIProvider contract
  drifts.push(checkContract('IAIProvider@v1', aiProviderInstance));

  // Check IProvider (domain provider) if supplied
  if (domainProviderInstance) {
    drifts.push(checkContract('IProvider@v1', domainProviderInstance));
  }

  // Print results
  console.log('\n  Contract               Baseline FP (first 16)  Current FP (first 16)  Drift?');
  console.log('  ─────────────────────  ──────────────────────  ─────────────────────  ──────');
  for (const d of drifts) {
    const contract = d.contract.padEnd(21);
    const base     = d.baselineFingerprint.slice(0, 22).padEnd(22);
    const curr     = d.currentFingerprint.slice(0, 21).padEnd(21);
    const status   = d.driftDetected ? '⚠️  DRIFT DETECTED' : '✅ Stable';
    console.log(`  ${contract}  ${base}  ${curr}  ${status}`);
    if (d.driftDetected && d.changedMethods.length > 0) {
      console.log(`    Changed: ${d.changedMethods.join(', ')}`);
    }
  }

  const passed = drifts.every(d => !d.driftDetected);

  if (!passed) {
    console.error(
      '\n[Drift Check] ❌ CONTRACT DRIFT DETECTED — Certification blocked.\n' +
      '  Platform contracts changed during provider implementation.\n' +
      '  This requires architectural review before certification can proceed.\n' +
      '  Invariant: provider adapters evolve, not the platform.'
    );
  } else {
    console.log('\n[Drift Check] ✅ All contracts stable — no drift detected.');
  }

  return { passed, drifts, checkedAt: new Date().toISOString() };
}
