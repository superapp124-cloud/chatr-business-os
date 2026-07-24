import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '../../../storage/InMemoryEventStore';
import { ObjectRuntime } from '../../../runtime/ObjectRuntime';
import { CapabilityRegistry } from '../../../registry/CapabilityRegistry';
import { CapabilityValidator } from '../../../validation/CapabilityValidator';
import { CapabilityCompiler } from '../../../validation/CapabilityCompiler';
import { ProjectionService, InMemoryCursorStore, CurrentStateProjection } from '../../../projections/ProjectionService';
import { FaultInjector } from '../faults/FaultInjector';
import { ReliabilityMetrics } from '../metrics/ReliabilityMetrics';

describe('Reliability: Long Running Randomized Chaos', () => {
  let eventStore: InMemoryEventStore;
  let cursorStore: InMemoryCursorStore;
  let registry: CapabilityRegistry;
  let runtime: ObjectRuntime;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    cursorStore = new InMemoryCursorStore();
    registry = new CapabilityRegistry(new CapabilityValidator(), new CapabilityCompiler());
    runtime = new ObjectRuntime(eventStore, registry);

    registry.install(
      { id: 'urn:chatr:pack:chaos', name: 'Chaos Pack', version: '1.0.0', author: 'Test', dependencies: [] },
      [{
        type: 'Counter',
        lifecycle: {
          initialState: 'Active',
          states: { Active: { transitions: { Increment: 'Active' } } }
        } as any,
        schema: { properties: { count: { type: 'number' } } } as any
      }]
    );
  });

  it('maintains absolute consistency after 1000 randomized events with arbitrary crashes', async () => {
    // Keep it fast for CI (e.g. 1000 events) but structurally identical to a 100k run
    const TOTAL_EVENTS = 1000;
    const metrics = new ReliabilityMetrics();
    
    let projectionService = new ProjectionService(eventStore, cursorStore);
    let faultInjector = new FaultInjector(eventStore, projectionService);
    await projectionService.start();

    let expectedFinalCount = 0;
    let aggregateId = 'counter-1';

    // Initial state
    await runtime.executeCommand({
      aggregateType: 'Counter',
      aggregateId,
      action: 'Create',
      payload: { count: 0 }
    }, 'system', 'tenant1');
    expectedFinalCount = 0;

    let crashIn = Math.floor(Math.random() * 100) + 10;
    faultInjector.crashProjectionAfterEvents(crashIn);

    for (let i = 0; i < TOTAL_EVENTS; i++) {
      try {
        await runtime.executeCommand({
          aggregateType: 'Counter',
          aggregateId,
          action: 'Increment',
          payload: { count: expectedFinalCount + 1 }
        }, 'system', 'tenant1');
        expectedFinalCount++;
        crashIn--;

        if (crashIn <= 0) {
          // It crashed!
          metrics.recordCrashRecovery();
          
          // Small pause to let async crash settle
          await new Promise(resolve => setTimeout(resolve, 5));
          
          // Restart projection service
          projectionService.stop();
          projectionService = new ProjectionService(eventStore, cursorStore);
          faultInjector = new FaultInjector(eventStore, projectionService);
          
          // Next crash in
          crashIn = Math.floor(Math.random() * 100) + 10;
          faultInjector.crashProjectionAfterEvents(crashIn);
          
          await projectionService.start();
        }
      } catch (err) {
        // Concurrency or other runtime error
      }
    }

    // Wait for all projections to catch up
    await new Promise(resolve => setTimeout(resolve, 100));
    projectionService.stop();

    // Now, run a clean replay from the event store in a fresh projection service
    const cleanService = new ProjectionService(eventStore);
    await cleanService.rebuild();
    metrics.recordReplaySuccess();

    const chaosProj = (projectionService as any).projections.find((p: any) => p.name === 'CurrentState') as CurrentStateProjection;
    const cleanProj = (cleanService as any).projections.find((p: any) => p.name === 'CurrentState') as CurrentStateProjection;

    const chaosState = chaosProj.getState(aggregateId);
    const cleanState = cleanProj.getState(aggregateId);

    // 1. Must match deterministic rebuild byte for byte
    expect(JSON.stringify(chaosState)).toBe(JSON.stringify(cleanState));

    // 2. Must exactly match the expected mathematical result
    expect(chaosState.count).toBe(expectedFinalCount);
    
    // Print metrics for observability
    metrics.print();
  });
});
