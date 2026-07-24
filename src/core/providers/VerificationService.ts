import { registryService } from './RegistryService';
import { executionAdapter, ExecutionRequest } from './ExecutionAdapter';

export class VerificationService {
  /**
   * Runs a dry-run execution on all providers in the registry to verify they are real and working.
   * Updates their status and health metrics in the registry.
   */
  public async verifyAll(): Promise<void> {
    const providers = registryService.getAll();
    console.log(`[VerificationService] Starting verification for ${providers.length} providers...`);

    for (const provider of providers) {
      if (provider.status === 'DEPRECATED') continue;

      const capabilityToTest = provider.capabilities[0]?.capabilityId;
      if (!capabilityToTest) continue;

      console.log(`[VerificationService] Verifying provider ${provider.id} for capability ${capabilityToTest}...`);

      const request: ExecutionRequest = {
        capabilityId: capabilityToTest,
        parameters: { dryRun: true }
      };

      try {
        const response = await executionAdapter.execute(provider, request);

        if (response.status === 'SUCCESS') {
          registryService.update(provider.id, {
            status: 'ACTIVE',
            health: {
              ...provider.health,
              uptime: 100,
              latencyMs: response.latencyMs,
              lastVerified: Date.now()
            }
          });
          console.log(`[VerificationService] ✓ Provider ${provider.id} verified successfully.`);
        } else {
          registryService.update(provider.id, {
            status: 'REJECTED',
            health: {
              ...provider.health,
              successRate: Math.max(0, provider.health.successRate - 10),
              lastVerified: Date.now()
            }
          });
          console.log(`[VerificationService] ✗ Provider ${provider.id} rejected. Reason: ${response.error}`);
        }
      } catch (error: any) {
        registryService.update(provider.id, {
          status: 'REJECTED',
          health: {
            ...provider.health,
            successRate: 0,
            lastVerified: Date.now()
          }
        });
        console.error(`[VerificationService] ✗ Provider ${provider.id} verification crashed: ${error.message}`);
      }
    }

    console.log(`[VerificationService] Verification complete.`);
  }
}

export const verificationService = new VerificationService();
