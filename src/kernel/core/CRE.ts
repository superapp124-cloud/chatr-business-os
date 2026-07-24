import { kernelBus } from './EventBus';
import { kernel } from '../abi';
import { CapabilityId, EntityId, ProcessId, IntentId } from '../abi/v1';

/**
 * 1. Discovery Engine
 * Determines WHAT needs to be done.
 */
class DiscoveryEngine {
  constructor() {
    kernelBus.subscribe('process.spawned', this.handleProcessSpawned.bind(this));
  }

  private async handleProcessSpawned(event: any): Promise<void> {
    const { processId, intentId } = event.payload;
    const authority = event.source || 'system';

    const intent = await kernel.queryIntent(intentId as IntentId);
    if (!intent) {
      console.error(`[DiscoveryEngine] Failed to find intent: ${intentId}`);
      return;
    }

    const rawInput = intent.goal.rawInput?.toLowerCase() || '';
    
    // Mock NLP extraction
    let targetCapability = 'system.echo';
    if (rawInput.includes('weather')) targetCapability = 'weather.current';
    if (rawInput.includes('flight')) targetCapability = 'travel.flight.book';
    if (rawInput.includes('food')) targetCapability = 'commerce.food.order';

    console.log(`[DiscoveryEngine] Discovered capability for ${processId}: ${targetCapability}`);

    await kernelBus.publish({
      eventId: `evt_${Date.now()}`,
      type: 'process.discovery_completed',
      timestamp: Date.now(),
      sourceService: 'DiscoveryEngine',
      authority,
      payload: { processId, intentId, targetCapability },
      version: '1.0'
    });
  }
}

/**
 * 2. Ranking Engine
 * Determines WHO can do it (and ranks them).
 */
class RankingEngine {
  constructor() {
    kernelBus.subscribe('process.discovery_completed', this.handleDiscoveryCompleted.bind(this));
  }

  private async handleDiscoveryCompleted(event: any): Promise<void> {
    const { processId, intentId, targetCapability } = event.payload;
    const authority = event.source || 'system';

    const context = {
      entityId: authority as EntityId,
      timestamp: Date.now(),
      metadata: { processId, intentId }
    };

    // Use Kernel ABI to resolve and rank entities based on default Trust/Cost metrics
    const candidates = await kernel.resolveCapability(targetCapability as CapabilityId, context);
    
    console.log(`[RankingEngine] Found ${candidates.length} candidates for ${targetCapability}`);

    await kernelBus.publish({
      eventId: `evt_${Date.now()}`,
      type: 'process.ranking_completed',
      timestamp: Date.now(),
      sourceService: 'RankingEngine',
      authority,
      payload: { processId, intentId, targetCapability, candidates },
      version: '1.0'
    });
  }
}

/**
 * 3. Selection Engine
 * Makes the final choice (e.g., load balancing, fallback logic).
 */
class SelectionEngine {
  constructor() {
    kernelBus.subscribe('process.ranking_completed', this.handleRankingCompleted.bind(this));
  }

  private async handleRankingCompleted(event: any): Promise<void> {
    const { processId, intentId, targetCapability, candidates } = event.payload;
    const authority = event.source || 'system';

    if (!candidates || candidates.length === 0) {
      console.warn(`[SelectionEngine] No candidates available for ${targetCapability}`);
      await kernelBus.publish({
        eventId: `evt_${Date.now()}`,
        type: 'process.failed',
        timestamp: Date.now(),
        sourceService: 'SelectionEngine',
        authority,
        payload: { processId, intentId, reason: 'No providers found' },
        version: '1.0'
      });
      return;
    }

    // Select the top-ranked candidate
    const providerEntity = candidates[0];

    console.log(`[SelectionEngine] Selected provider ${providerEntity.id} for ${targetCapability}`);

    await kernelBus.publish({
      eventId: `evt_${Date.now()}`,
      type: 'process.selection_completed',
      timestamp: Date.now(),
      sourceService: 'SelectionEngine',
      authority,
      payload: { processId, intentId, targetCapability, providerEntity },
      version: '1.0'
    });
  }
}

export const discoveryEngine = new DiscoveryEngine();
export const rankingEngine = new RankingEngine();
export const selectionEngine = new SelectionEngine();
