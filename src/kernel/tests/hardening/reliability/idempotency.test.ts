import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '../../../storage/InMemoryEventStore';
import { ObjectRuntime } from '../../../runtime/ObjectRuntime';
import { CapabilityRegistry } from '../../../registry/CapabilityRegistry';
import { CapabilityValidator } from '../../../validation/CapabilityValidator';
import { CapabilityCompiler } from '../../../validation/CapabilityCompiler';

describe('Reliability: Idempotency', () => {
  let eventStore: InMemoryEventStore;
  let registry: CapabilityRegistry;
  let runtime: ObjectRuntime;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    const validator = new CapabilityValidator();
    const compiler = new CapabilityCompiler();
    registry = new CapabilityRegistry(validator, compiler);
    runtime = new ObjectRuntime(eventStore, registry);

    registry.install(
      {
        id: 'urn:chatr:pack:test',
        name: 'Test Pack',
        version: '1.0.0',
        author: 'Test',
        dependencies: []
      },
      [{
        type: 'Order',
        lifecycle: {
          initialState: 'Pending',
          states: {
            Pending: { transitions: { Process: 'Processed' } },
            Processed: { transitions: {} }
          }
        } as any,
        schema: {
          properties: {
            amount: { type: 'number' }
          }
        } as any
      }]
    );
  });

  it('prevents duplicate events when retrying a command with the same commandId', async () => {
    const aggregateId = 'order-1';
    const commandId = 'unique-cmd-123';
    const actorId = 'actor-1';

    // First execution
    const result1 = await runtime.executeCommand({
      commandId,
      aggregateType: 'Order',
      aggregateId,
      action: 'Create',
      payload: { amount: 100 }
    }, actorId, 'tenant_1');

    expect(result1.eventType).toBe('OrderCreated');
    expect(result1.commandId).toBe(commandId);

    // Second execution (simulate retry due to network timeout)
    const result2 = await runtime.executeCommand({
      commandId,
      aggregateType: 'Order',
      aggregateId,
      action: 'Create',
      payload: { amount: 100 }
    }, actorId, 'tenant_1');

    // Should return exactly the same event
    expect(result2.eventId).toBe(result1.eventId);
    expect(result2.globalSequence).toBe(result1.globalSequence);

    // Ensure it didn't append a duplicate
    const history = await eventStore.loadAggregate('Order', aggregateId);
    expect(history.length).toBe(1);
    expect(history[0].eventId).toBe(result1.eventId);
  });
});
