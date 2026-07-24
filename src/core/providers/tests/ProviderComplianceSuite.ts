import { ProviderAdapter, CanonicalRuntimeError } from '../sdk/ProviderSDK';
import crypto from 'crypto';

export interface ComplianceResult {
  status: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'PASS_WITH_OBSERVATIONS';
  duration_ms: number;
  evidence?: any;
  message?: string;
}

export class ProviderComplianceSuite {
  constructor(private adapter: ProviderAdapter) {}

  public async runAll(): Promise<Record<string, ComplianceResult>> {
    const results: Record<string, ComplianceResult> = {};
    
    console.log(`\n=== Running Compliance Suite for ${this.adapter.id} v${this.adapter.version} ===\n`);
    
    // 1. Health
    results.health = await this.measure(async () => {
      const h = await this.adapter.health();
      if (!h.isHealthy) throw new Error('Health check failed');
      return { msg: 'Health OK', latency: h.latencyMs };
    });

    // 2. Discover Capabilities
    results.discoverCapabilities = await this.measure(async () => {
      const caps = await this.adapter.discoverCapabilities();
      if (caps.length === 0) throw new Error('No capabilities discovered');
      return { capabilities: caps };
    });

    // Note: To test actual live execution, authentication, and idempotency, 
    // the caller must run a dedicated execution test injecting real credentials.
    // The Compliance Suite verifies the Adapter adheres to SDK contracts.
    
    console.log(`\n=== Compliance Suite Completed ===\n`);
    return results;
  }

  private async measure(fn: () => Promise<any>): Promise<ComplianceResult> {
    const start = Date.now();
    try {
      const evidence = await fn();
      const end = Date.now();
      return { status: 'PASS', duration_ms: end - start, evidence };
    } catch (err: any) {
      const end = Date.now();
      return { status: 'FAIL', duration_ms: end - start, message: err.message || err.toString() };
    }
  }

  public generateComplianceHash(results: Record<string, ComplianceResult>): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(results));
    return hash.digest('hex');
  }
}
