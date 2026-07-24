import { worldModel } from '../world/WorldModel';
import { transportRegistry } from '../transport/TransportRegistry';
import { kernelBus } from '../core/EventBus';
import { Entity } from '../abi/v1';

export class MonitoringEngine {
  private scanInterval: NodeJS.Timeout | null = null;

  public start(intervalMs: number = 120000) {
    console.log('[MonitoringEngine] Starting continuous ecosystem health checks...');
    this.scanInterval = setInterval(() => this.scan(), intervalMs);
  }

  public stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  private async scan() {
    // 1. Get all registered service entities
    const entities = worldModel.getAllNodes().filter(n => n.type === 'Entity' && (n.properties as Entity).type === 'service');

    for (const node of entities) {
      const entity = node.properties as Entity;
      const metadata = entity.metadata as any;
      
      if (!metadata || !metadata.transport || !metadata.executionPlan) continue;

      try {
        const transport = transportRegistry.get(metadata.transport);
        const endpoint = metadata.executionPlan.transportConfig?.endpoint;
        
        if (!endpoint) continue;

        // 2. Perform Health Check
        const currentHealth = await transport.healthCheck(endpoint);

        if (currentHealth !== entity.health) {
          console.log(`[MonitoringEngine] Entity ${entity.id} health shifted from ${entity.health} to ${currentHealth}`);
          // Update entity
          await kernelBus.publish({
            eventId: `evt_${Date.now()}_${Math.random()}`,
            type: 'entity.updated',
            timestamp: Date.now(),
            sourceService: 'MonitoringEngine',
            authority: 'system',
            payload: { ...entity, health: currentHealth },
            version: '1.0'
          });
        }
      } catch (err) {
        console.warn(`[MonitoringEngine] Failed to monitor ${entity.id}`);
      }
    }
  }
}

export const monitoringEngine = new MonitoringEngine();
