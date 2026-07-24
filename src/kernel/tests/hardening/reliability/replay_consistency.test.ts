import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '../../../storage/InMemoryEventStore';
import { ProjectionService, CurrentStateProjection } from '../../../projections/ProjectionService';

describe('Reliability: Replay Consistency', () => {
  let eventStore: InMemoryEventStore;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
  });

  it('guarantees byte-for-byte equivalence after total projection loss', async () => {
    // 1. Generate a complex stream of events
    const streamId = 'Candidate-1';
    await eventStore.append(streamId, 0, { eventType: 'Created', aggregateType: 'Candidate', aggregateId: '1', actorId: 'test', tenantId: 't1', payload: { name: 'Alice', status: 'New' }, timestamp: new Date('2024-01-01') } as any);
    await eventStore.append(streamId, 1, { eventType: 'Updated', aggregateType: 'Candidate', aggregateId: '1', actorId: 'test', tenantId: 't1', payload: { status: 'Interviewing', score: 85 }, timestamp: new Date('2024-01-02') } as any);
    await eventStore.append(streamId, 2, { eventType: 'Updated', aggregateType: 'Candidate', aggregateId: '1', actorId: 'test', tenantId: 't1', payload: { notes: 'Good candidate' }, timestamp: new Date('2024-01-03') } as any);

    // 2. Build initial projection
    const service1 = new ProjectionService(eventStore);
    await service1.rebuild();
    const proj1 = (service1 as any).projections.find((p: any) => p.name === 'CurrentState') as CurrentStateProjection;
    
    // Extract the raw state map
    const stateA = JSON.stringify(Array.from((proj1 as any).stateMap.entries()));

    // 3. Destroy projection entirely
    service1.stop();
    const service2 = new ProjectionService(eventStore);
    
    // 4. Rebuild from scratch
    await service2.rebuild();
    const proj2 = (service2 as any).projections.find((p: any) => p.name === 'CurrentState') as CurrentStateProjection;
    
    // 5. Verify byte-for-byte equivalence
    const stateB = JSON.stringify(Array.from((proj2 as any).stateMap.entries()));

    expect(stateA).toBe(stateB);
    
    // Structural check
    expect(proj2.getState('1')).toEqual({
      name: 'Alice',
      status: 'Interviewing',
      score: 85,
      notes: 'Good candidate',
      _lastUpdated: new Date('2024-01-03')
    });
  });
});
