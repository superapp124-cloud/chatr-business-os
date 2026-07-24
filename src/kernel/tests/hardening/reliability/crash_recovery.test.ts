import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '../../../storage/InMemoryEventStore';
import { ProjectionService, InMemoryCursorStore, CurrentStateProjection } from '../../../projections/ProjectionService';
import { FaultInjector } from '../faults/FaultInjector';

describe('Reliability: Projection Crash Recovery', () => {
  let eventStore: InMemoryEventStore;
  let cursorStore: InMemoryCursorStore;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    cursorStore = new InMemoryCursorStore();
  });

  it('resumes safely from cursor after arbitrary crash', async () => {
    // 1. Create a lot of events
    const streamId = 'Candidate-1';
    for (let i = 0; i < 50; i++) {
      await eventStore.append(streamId, i, {
        eventType: 'Updated',
        aggregateType: 'Candidate',
        aggregateId: '1',
        actorId: 'test',
        tenantId: 'tenant1',
        payload: { counter: i },
        timestamp: new Date()
      } as any);
    }

    // 2. Start Service 1 and intentionally crash it at event 25
    let service1 = new ProjectionService(eventStore, cursorStore);
    const faultInjector = new FaultInjector(eventStore, service1);
    
    // Crash immediately after event 25
    faultInjector.crashProjectionAfterEvents(25);
    
    try {
      // Rebuild (which also dispatches)
      await service1.rebuild();
    } catch (err: any) {
      expect(err.message).toContain('died after 25 events');
    }
    
    service1.stop(); // simulate process exit

    // The cursor for 'CurrentState' should be exactly 24 (crashed ON the 25th)
    const cursor = await cursorStore.getCursor('CurrentState');
    expect(cursor).toBe(24);

    const currentStateProj1 = (service1 as any).projections.find((p: any) => p.name === 'CurrentState') as CurrentStateProjection;
    expect(currentStateProj1.getState('1').counter).toBe(23); // 24th event has counter=23

    // 3. Start Service 2 (Recovery)
    let service2 = new ProjectionService(eventStore, cursorStore);
    
    // We start it, which should automatically load Since the cursor (25) and process the remaining 25
    await service2.start();
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 50));

    const newCursor = await cursorStore.getCursor('CurrentState');
    expect(newCursor).toBe(50); // Fully recovered!

    const currentStateProj2 = (service2 as any).projections.find((p: any) => p.name === 'CurrentState') as CurrentStateProjection;
    expect(currentStateProj2.getState('1').counter).toBe(49);
    
    service2.stop();
  });
});
