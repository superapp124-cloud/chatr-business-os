import { kernelBus } from '../core/EventBus';
import { normalizationEngine } from './NormalizationEngine';
import { certificationEngine } from './CertificationEngine';
import { kernel } from '../abi';
import { CapabilityId } from '../abi/v1';

export class EcosystemRegistrationService {
  constructor() {
    kernelBus.subscribe('ecosystem.source_candidate', this.handleSourceCandidate.bind(this));
  }

  private async handleSourceCandidate(event: any): Promise<void> {
    const source = event.payload; // RawCapabilitySource

    const capabilityIds: CapabilityId[] = [];

    for (const rawCap of source.capabilities) {
      // 1. Normalize
      const normalized = normalizationEngine.normalize(rawCap);
      
      // 2. Certify
      const certification = await certificationEngine.certifyCapability(normalized.capabilityId, source.endpoint);

      if (certification === 'DISCOVERED' || certification === 'VERIFIED' || certification === 'CERTIFIED') {
        // 3. Register via ABI
        // (If it already exists in the world model, event sourcing UPSERT handles it cleanly)
        const capId = await kernel.registerCapability({
          id: normalized.capabilityId,
          primitive: 'OBSERVE', // Mock mapping
          version: '1.0.0',
          inputSchema: normalized.inputSchema,
          outputSchema: { type: 'object' },
          trustRequired: 0.0,
          costEstimate: { resources: [], totalUSD: 0 },
          certification: certification,
          contract: {
            inputSchema: normalized.inputSchema,
            outputSchema: { type: 'object' },
            version: '1.0.0',
            timeoutMs: 10000,
            cost: { resources: [], totalUSD: 0 },
            permissions: [],
            sideEffects: [],
            retryPolicy: { maxRetries: 3, backoffMs: 1000 }
          }
        } as any);

        capabilityIds.push(capId);
      }
    }

    // 4. Register the Entity (CapabilitySource) via ABI
    await kernel.registerEntity({
      type: 'service',
      capabilities: capabilityIds,
      trust: {
        confidence: 0.5,
        reputation: 0.5,
        verification: 0.5,
        reliability: 0.5,
        security: 0.5,
        compliance: 0.5,
        privacy: 0.5,
        latency: 0.5,
        costEfficiency: 0.5,
        freshness: 1.0,
        userRating: 0.5,
        kernelConfidence: 0.5
      },
      state: 'active',
      health: 'ONLINE', // Initial health
      relationships: [],
      permissions: { granted: [], denied: [] },
      economy: { credits: 0, spent: 0, earned: 0, currency: 'USD' },
      location: { type: 'digital', region: 'global' },
      metadata: {
        transport: source.transport,
        providerId: source.id,
        executionPlan: {
          providerId: source.id,
          transport: source.transport,
          timeoutMs: 10000,
          retryCount: 3,
          transportConfig: {
            endpoint: source.endpoint
          }
        }
      }
    });

    console.log(`[EcosystemRegistration] Successfully registered source ${source.id} with ${capabilityIds.length} capabilities.`);
  }
}

export const ecosystemRegistrationService = new EcosystemRegistrationService();
