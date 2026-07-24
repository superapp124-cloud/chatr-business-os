import { ExecutionContext } from '../../types.js';
import { EventBus } from '../../services/EventBusService.js';

export class SystemObservationEngine {
  
  /**
   * Evaluates the observations collected during execution and generates 
   * analytical events to feed the Learning Engine.
   */
  async observe(context: ExecutionContext): Promise<ExecutionContext> {
    console.log(`[ObservationEngine] Processing ${context.observations.length} observations for Context ${context.id}`);
    
    for (const obs of context.observations) {
      // In a real system, we write these to a high-throughput timeseries DB
      // For now, we emit them as analytical events on the bus
      await EventBus.publish({
        eventType: 'ObservationRecorded',
        payload: {
          contextId: context.id,
          type: obs.type,
          component: obs.component,
          details: obs.details
        },
        source: 'ObservationEngine',
        actorId: 'system',
        tenantId: context.tenant.tenantId
      });
      
      // If we detect a bottleneck, we could emit a specific alert
      if (obs.type === 'bottleneck') {
        console.warn(`[ObservationEngine] Bottleneck detected in ${obs.component}: ${obs.details}`);
      }
    }

    return context;
  }
}

export const ObservationEngine = new SystemObservationEngine();
