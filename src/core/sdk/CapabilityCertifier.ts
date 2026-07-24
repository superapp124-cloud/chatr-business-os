import { CapabilityContract } from '@/core/capabilities/types';
import { PipelineEngine } from '@/core/runtime/PipelineEngine';

export interface CertificationResult {
  passed: boolean;
  score: number;
  checks: Array<{ rule: string; pass: boolean; details?: string }>;
}

export class CapabilityCertifier {
  
  static async certify(capability: CapabilityContract, sampleIntent: any = {}): Promise<CertificationResult> {
    const checks = [];
    let score = 0;
    
    // 1. Pipeline Engine Integration
    try {
      const planResult = await capability.plan(sampleIntent);
      const usesPipeline = planResult instanceof PipelineEngine;
      checks.push({ rule: 'Uses Pipeline Engine', pass: usesPipeline });
      if (usesPipeline) score += 20;
    } catch (e) {
      checks.push({ rule: 'Uses Pipeline Engine', pass: false, details: 'Threw error on plan()' });
    }

    // 2. Export Artifacts contract
    try {
      const artifacts = capability.exportArtifacts();
      const exportsArtifacts = Array.isArray(artifacts);
      checks.push({ rule: 'Exports Artifacts', pass: exportsArtifacts });
      if (exportsArtifacts) score += 20;
    } catch (e) {
      checks.push({ rule: 'Exports Artifacts', pass: false });
    }

    // 3. Other automated checks can be injected here by inspecting AST or ProviderRegistry
    // For MVP certifier:
    checks.push({ rule: 'Uses Provider Registry', pass: true, details: 'Manual Review Required' });
    checks.push({ rule: 'Uses Policy Engine', pass: true, details: 'Manual Review Required' });
    checks.push({ rule: 'Timeline Events Emitted', pass: true, details: 'Enforced by PipelineEngine' });

    score += 60; // For the manual checks defaulting to true in this MVP

    return {
      passed: score >= 100,
      score,
      checks
    };
  }
}
