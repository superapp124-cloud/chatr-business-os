import { kernel, bindPlannerHandler, bindTransportHandler } from '../abi/KernelImpl';
import type { Intent, EntityId, CapabilityId } from '../abi/v1';
import { transportRegistry } from '../transport/TransportRegistry';
import { snapshotManager } from '../world/SnapshotManager';
import { MCPDiscoveryPlugin } from '../ecosystem/discovery/MCPDiscoveryPlugin';
import { discoveryEngine } from '../ecosystem/DiscoveryEngine';
import { healthEngine } from '../ecosystem/HealthEngine';
import { trustEngine } from '../ecosystem/TrustEngine';
import { monitoringEngine } from '../ecosystem/MonitoringEngine';
import { explainabilityEngine } from '../ecosystem/ExplainabilityEngine';
import { ecosystemRegistrationService } from '../ecosystem/EcosystemRegistrationService';
import { policyService } from '../governance/PolicyService';
import { resourceScheduler } from './ResourceScheduler';
import { observabilityService } from './ObservabilityService';

export async function bootKernel(): Promise<void> {
  console.log('[Kernel] ABI v1.0 / Phase 5 booting...');
  // State: BOOTING
  
  const world = (kernel as any).getWorldModel();

  // State: LOADING_SNAPSHOT
  const snapshot = await snapshotManager.loadSnapshot();
  if (snapshot) {
    world.loadFromSnapshot(snapshot);
    // State: REPLAYING_EVENTS (Placeholder for actual event log replay)
  }

  // State: INITIALIZING_PLUGINS
  
  // 1. Initialize Ecosystem & Execution Engines
  // (Just accessing them ensures their constructors run and they subscribe to kernelBus)
  healthEngine;
  trustEngine;
  explainabilityEngine;
  ecosystemRegistrationService;
  policyService;
  resourceScheduler;
  observabilityService;

  // 2. Register Transports
  await kernel.registerTransport({
    id: 'REST',
    version: '1.0.0',
    protocols: ['http', 'https'],
  });
  await kernel.registerTransport({
    id: 'MCP',
    version: '1.0.0',
    protocols: ['http', 'https', 'stdio'],
  });

  bindTransportHandler('REST', async (capabilityId, entityId, params, _context) => {
    try {
      const entities = await kernel.resolveEntity({ id: entityId } as any);
      const entity = entities[0];
      const executionPlan = (entity?.metadata as any)?.executionPlan;

      if (!executionPlan) {
        return { success: false, payload: null, latencyMs: 0, error: 'No execution plan on entity' };
      }

      const transport = transportRegistry.get(executionPlan.transport);
      const start = Date.now();
      const response = await transport.execute(executionPlan, params, _context.abortSignal);

      return {
        success: response.status === 'SUCCESS',
        payload: response.payload,
        latencyMs: Date.now() - start,
        error: response.error,
      };
    } catch (err: any) {
      return { success: false, payload: null, latencyMs: 0, error: err.message };
    }
  });

  if (!snapshot) {
    // 2. Register Built-in Capabilities (only if cold boot)
    const weatherCapId = await kernel.registerCapability({
      id: 'weather.current' as CapabilityId,
      primitive: 'OBSERVE',
      version: '1.0.0',
      inputSchema: { type: 'object', properties: { location: { type: 'string' } } },
      outputSchema: { type: 'object', properties: {
        temperature: { type: 'number' },
        wind_speed: { type: 'number' },
        unit: { type: 'string' },
      }},
      trustRequired: 0.0,
      costEstimate: { resources: [{ type: 'api_quota', amount: 1, unit: 'call' }], totalUSD: 0 },
    });

    // 3. Register Built-in Entities (Providers)
    const openMeteoId = await kernel.registerEntity({
      type: 'service',
      identity: undefined,
      capabilities: [weatherCapId],
      trust: {
        confidence: 0.99,
        reputation: 0.99,
        verification: 0.95,
        reliability: 0.99,
        security: 0.90,
        compliance: 0.85,
        privacy: 0.90,
      },
      state: 'active',
      relationships: [],
      permissions: { granted: [], denied: [] },
      economy: { credits: 0, spent: 0, earned: 0, currency: 'USD' },
      location: { type: 'digital', region: 'global' },
      metadata: {
        transport: 'REST',
        providerId: 'provider.openmeteo',
        executionPlan: {
          providerId: 'provider.openmeteo',
          transport: 'REST',
          timeoutMs: 5000,
          retryCount: 1,
          normalizer: 'OpenMeteoNormalizer',
          verifier: 'WeatherVerifier',
          authority: 'Public',
          transportConfig: {
            endpoint: 'https://api.open-meteo.com/v1/forecast'
          }
        },
      },
    });

    // 3A. Draw Edges in the World Model natively
    if (world) {
      const tx = {
        id: `tx_boot_${Date.now()}`,
        timestamp: Date.now(),
        mutations: [
          {
            type: 'UPSERT_EDGE' as const,
            edge: {
              id: `edge_${Date.now()}_om_weather`,
              source: openMeteoId,
              target: weatherCapId,
              predicate: 'offers',
              weight: 1.0,
              validFrom: Date.now(),
              confidence: 1.0,
              createdBy: 'system'
            }
          }
        ]
      };
      world.applyTransaction(tx);
    }
    
    // Save snapshot immediately after cold boot seeding
    if (world) {
      const { state, indexes } = world.extractStateForSnapshot();
      await snapshotManager.saveSnapshot(state, indexes);
    }
  }

  // 4. Register Default Planner
  await kernel.registerPlanner({
    id: 'default-planner',
    version: '1.0.0',
    supportedPrimitives: ['OBSERVE', 'THINK', 'COMMUNICATE', 'CREATE', 'STORE', 'RETRIEVE'],
  });

  bindPlannerHandler(async (intent: Intent, _kernel) => {
    // Legacy bridge
    const { kernelBus } = await import('./EventBus');
    await kernelBus.publish({
      eventId: `evt_${Date.now()}`,
      type: 'IntentSubmitted',
      timestamp: Date.now(),
      sourceService: 'KernelPlanner',
      authority: 'User',
      payload: {
        intentId: intent.id,
        rawInput: (intent.goal as any)?.rawInput ?? '',
        context: intent.context,
      },
      version: '1.0',
    });
  });

  // 5. Start Discovery & Monitoring
  discoveryEngine.registerPlugin(new MCPDiscoveryPlugin([
    'http://localhost:3001/mcp', // Mock default endpoint
    'http://localhost:3002/mcp'
  ]));
  
  discoveryEngine.start(60000); // scan every minute
  monitoringEngine.start(120000); // health check every 2 minutes

  // State: READY
  console.log('[Kernel] State: READY (ABI v1.0 + Capability Ecosystem)');
}
