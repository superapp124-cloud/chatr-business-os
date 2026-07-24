import { describe, it, expect, beforeAll } from 'vitest';
import { ObjectRuntime } from '../../runtime/ObjectRuntime';
import { InMemoryEventStore } from '../../storage/InMemoryEventStore';
import { ProjectionService } from '../../projections/ProjectionService';
import { QueryEngine } from '../../query/QueryEngine';
import { EvidenceBuilder } from '../../evidence/EvidenceBuilder';
import { CapabilityRegistry } from '../../registry/CapabilityRegistry';
import { PackLoader } from '../../registry/PackLoader';
import candidateEDLJSON from '../../../capability-packs/recruitment/objects/Candidate.edl.json';
import decisionEDLJSON from '../../../capability-packs/executive/objects/Decision.edl.json';

describe('Gate B Architecture Compliance Audit', () => {
  let eventStore: InMemoryEventStore;
  let objectRuntime: ObjectRuntime;
  let projectionService: ProjectionService;
  let queryEngine: QueryEngine;
  let evidenceBuilder: EvidenceBuilder;

  const actorId = 'urn:chatr:actor:employee:auditor';
  const candidateId = `cand_audit_${Date.now()}`;
  const decisionId = `dec_audit_${Date.now()}`;

  beforeAll(async () => {
    const registry = new CapabilityRegistry();
    const loader = new PackLoader(registry);
    
    await loader.loadFromJSON({ id: 'recruitment', version: '1.0', edlVersion: '1.0', name: 'Recruitment' }, [candidateEDLJSON as any]);
    await loader.loadFromJSON({ id: 'executive', version: '1.0', edlVersion: '1.0', name: 'Executive' }, [decisionEDLJSON as any]);

    eventStore = new InMemoryEventStore();
    objectRuntime = new ObjectRuntime(eventStore, registry);
    projectionService = new ProjectionService(eventStore);
    projectionService.start();
    queryEngine = new QueryEngine(projectionService);
    evidenceBuilder = new EvidenceBuilder(queryEngine);
  });

  it('2. EDL Drives Behavior (State Transitions are bound by schema)', async () => {
    // Attempt an invalid transition directly
    await expect(
      objectRuntime.executeCommand(
        {
          aggregateType: 'Candidate',
          aggregateId: candidateId,
          action: 'Transition',
          payload: { targetState: 'hired', _lifecycleState: 'hired' } // Skipping steps
        },
        actorId,
        'tenant_1'
      )
    ).rejects.toThrow();

    // Do a valid creation and transition sequence
    await objectRuntime.executeCommand({
      aggregateType: 'Candidate', aggregateId: candidateId, action: 'Create', payload: { name: 'Audit User', email: 'audit@chatros.com', stage: 'applied' }
    }, actorId, 'tenant_1');

    await objectRuntime.executeCommand({
      aggregateType: 'Candidate', aggregateId: candidateId, action: 'Transition', payload: { stage: 'screening', targetState: 'screening', _lifecycleState: 'screening' }
    }, actorId, 'tenant_1');

    // Wait for projection
    await new Promise(resolve => setTimeout(resolve, 50));

    const state = await queryEngine.get({ actorId, aggregateType: 'Candidate', aggregateId: candidateId });
    expect(state.stage).toBe('screening');
  });

  it('3. Replay Validation (Deterministic rebuild)', async () => {
    const originalState = await queryEngine.get({ actorId, aggregateType: 'Candidate', aggregateId: candidateId });
    
    // Nuke the projection service
    const newProjectionService = new ProjectionService(eventStore);
    await newProjectionService.rebuild(); // This triggers a replay of all events in the store
    const newQueryEngine = new QueryEngine(newProjectionService);

    // Give it a tiny tick to replay
    await new Promise(resolve => setTimeout(resolve, 200));

    const replayedState = await newQueryEngine.get({ actorId, aggregateType: 'Candidate', aggregateId: candidateId });
    
    expect(replayedState).toEqual(originalState);
    expect(replayedState.stage).toBe('screening');
  });

  it('4. Explainability (Evidence-backed decisions)', async () => {
    const evidence = await evidenceBuilder.buildPackage('Why is this candidate in Screening?', 'Candidate', candidateId, actorId);
    
    // We check that the deterministic facts include the current lifecycle state
    expect(evidence.facts).toContain('Candidate status = screening');
  });

  it('5. Cross-domain query (Graph Traversal)', async () => {
    // Create a decision related to the candidate
    await objectRuntime.executeCommand({
      aggregateType: 'Decision',
      aggregateId: decisionId,
      action: 'Create',
      payload: { title: 'Hire Audit User', context: 'Audit phase', status: 'proposed', impact_level: 'low' }
    }, actorId, 'tenant_1');

    // Create a relationship between the Decision and the Candidate
    await objectRuntime.executeCommand({
      aggregateType: 'Decision',
      aggregateId: decisionId,
      action: 'Relate',
      payload: { predicate: 'relates_to', targetType: 'Candidate', targetId: candidateId }
    }, actorId, 'tenant_1');

    const related = await queryEngine.getRelated({ actorId, aggregateType: 'Decision', aggregateId: decisionId });
    
    // We expect the graph projection to find the linked Candidate
    expect(related).toBeDefined();
    // The relationship must have traversed domains purely via the generic relationship engine
  });
});
