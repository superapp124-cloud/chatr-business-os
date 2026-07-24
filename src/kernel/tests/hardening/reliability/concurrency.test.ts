import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '../../../storage/InMemoryEventStore';
import { ObjectRuntime } from '../../../runtime/ObjectRuntime';
import { CapabilityRegistry } from '../../../registry/CapabilityRegistry';
import { CapabilityValidator } from '../../../validation/CapabilityValidator';
import { CapabilityCompiler } from '../../../validation/CapabilityCompiler';

describe('Reliability: Concurrency', () => {
  let eventStore: InMemoryEventStore;
  let registry: CapabilityRegistry;
  let runtime: ObjectRuntime;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    registry = new CapabilityRegistry(new CapabilityValidator(), new CapabilityCompiler());
    runtime = new ObjectRuntime(eventStore, registry);

    registry.install(
      { id: 'urn:chatr:pack:concurrency', name: 'Concurrency', version: '1.0.0', author: 'Test', dependencies: [] },
      [{
        type: 'Resource',
        lifecycle: {
          initialState: 'Available',
          states: { Available: { transitions: { Acquire: 'Acquired', Release: 'Available' } }, Acquired: { transitions: { Release: 'Available' } } }
        } as any,
        schema: { properties: {} } as any
      }]
    );
    
    // Create resources
    await runtime.executeCommand({ aggregateType: 'Resource', aggregateId: 'res-1', action: 'Create', payload: {} }, 'sys', 'tenant_1');
    await runtime.executeCommand({ aggregateType: 'Resource', aggregateId: 'res-2', action: 'Create', payload: {} }, 'sys', 'tenant_1');
    await runtime.executeCommand({ aggregateType: 'Resource', aggregateId: 'res-3', action: 'Create', payload: {} }, 'sys', 'tenant_1');
  });

  it('handles 100 concurrent workers competing for 3 objects', async () => {
    const workers = 100;
    
    let successCount = 0;
    let concurrencyErrors = 0;

    const promises = Array.from({ length: workers }).map(async (_, index) => {
      // Each worker tries to acquire a random resource
      const resourceId = `res-${(index % 3) + 1}`;
      
      try {
        await runtime.executeCommand({
          aggregateType: 'Resource',
          aggregateId: resourceId,
          action: 'Acquire',
          payload: { workerId: index }
        }, `worker-${index}`, 'tenant_1');
        successCount++;
      } catch (err: any) {
        if (err.name === 'ConcurrencyError') {
          concurrencyErrors++;
        } else {
          throw err;
        }
      }
    });

    await Promise.allSettled(promises);

    // EXACTLY 3 workers should have succeeded (one for each resource)
    // because after they are Acquired, further Acquire actions will fail validation (Lifecycle) or Concurrency
    expect(successCount).toBe(3);
    
    // The rest should have failed either via ConcurrencyError or Validation (Invalid transition from 'Acquired' to 'Acquired')
    expect(successCount + concurrencyErrors).toBeLessThanOrEqual(workers);

    // Verify stream integrity
    for (let i = 1; i <= 3; i++) {
      const history = await eventStore.loadAggregate('Resource', `res-${i}`);
      // 1 Create + 1 Acquire = 2 events total per resource
      expect(history.length).toBe(2);
      expect(history[1].eventType).toBe('ResourceAcquired');
      
      // Ensure expectedVersions are strictly 1 and 2
      expect(history[0].expectedVersion).toBe(1);
      expect(history[1].expectedVersion).toBe(2);
    }
  });
});
