import { describe, it, expect, beforeAll } from 'vitest';
import { ObjectRuntime } from '../../runtime/ObjectRuntime';
import { InMemoryEventStore } from '../../storage/InMemoryEventStore';
import { ProjectionService, CurrentStateProjection } from '../../projections/ProjectionService';
import { QueryEngine } from '../../query/QueryEngine';
import { EvidenceBuilder } from '../../evidence/EvidenceBuilder';
import { CapabilityRegistry } from '../../registry/CapabilityRegistry';
import { PackLoader } from '../../registry/PackLoader';
import { EDLLivingObject } from '../../contracts/edl/types';

describe('Recruitment Conformance Test (End-to-End)', () => {
  let eventStore: InMemoryEventStore;
  let objectRuntime: ObjectRuntime;
  let projectionService: ProjectionService;
  let queryEngine: QueryEngine;
  let evidenceBuilder: EvidenceBuilder;

  const candidateId = `cand_${Date.now()}`;
  const actorId = 'urn:chatr:actor:employee:recruiter_1';

  // 1. The EDL Metadata definition (No UI, No Code, Just Schema)
  const candidateEDL: EDLLivingObject = {
    urn: 'urn:chatr:object:candidate',
    type: 'Candidate',
    name: 'Job Candidate',
    primitiveType: 'LivingObject',
    metadata: {},
    properties: [
      { key: 'name', type: 'string', required: true },
      { key: 'email', type: 'string', required: true }
    ],
    relationships: [
      { predicate: 'assigned_to', class: 'authority', targetType: 'Employee', required: true, multiple: false }
    ],
    lifecycle: {
      initialState: 'Applied',
      states: [
        { name: 'Applied' },
        { name: 'Screening' },
        { name: 'Offered' }
      ],
      transitions: [
        { from: ['Applied'], to: 'Screening', triggeredByEvent: 'CandidateScreeningStarted' },
        { from: ['Screening'], to: 'Offered', triggeredByEvent: 'CandidateOffered', requiredPolicies: ['urn:chatr:policy:background-check'] }
      ]
    },
    eventsProduced: ['CandidateCreated', 'CandidateScreeningStarted', 'CandidateOffered']
  };

  beforeAll(async () => {
    const registry = new CapabilityRegistry();
    const loader = new PackLoader(registry);
    
    // Install the mock pack
    await loader.loadFromJSON({ id: 'test-recruitment', version: '1.0', edlVersion: '1.0', name: 'Recruitment' }, [candidateEDL as any]);

    eventStore = new InMemoryEventStore();
    objectRuntime = new ObjectRuntime(eventStore, registry);
    
    projectionService = new ProjectionService(eventStore);
    // Start listening to the event stream to maintain read-models
    projectionService.start();

    queryEngine = new QueryEngine(projectionService);
    evidenceBuilder = new EvidenceBuilder(queryEngine);
  });

  it('1. Creates a Candidate through ObjectRuntime & EventStore', async () => {
    const event = await objectRuntime.executeCommand(
      {
        aggregateType: 'Candidate',
        aggregateId: candidateId,
        action: 'Create',
        payload: {
          name: 'Sarah Connor',
          email: 'sarah@example.com'
        }
      },
      actorId,
      'tenant_1'
    );

    expect(event).toBeDefined();
    expect(event.eventType).toBe('CandidateCreated');
    expect(event.aggregateId).toBe(candidateId);
  });

  it('2. Transitions the Candidate lifecycle via Event', async () => {
    const event = await objectRuntime.executeCommand(
      {
        aggregateType: 'Candidate',
        aggregateId: candidateId,
        action: 'Transition',
        payload: {
          targetState: 'Screening',
          _lifecycleState: 'Screening' // Simple patch for V0.1
        }
      },
      actorId,
      'tenant_1'
    );

    expect(event.eventType).toBe('CandidateTransitioned');
  });

  it('3. Query Engine retrieves deterministic Current State', async () => {
    // Wait for projection to catch up (in real tests, use a polling retry or await the projection completion)
    await new Promise(resolve => setTimeout(resolve, 500));

    const state = await queryEngine.get({
      actorId,
      aggregateType: 'Candidate',
      aggregateId: candidateId
    });

    expect(state).toBeDefined();
    expect(state.name).toBe('Sarah Connor');
    expect(state._lifecycleState).toBe('Screening');
    expect(state.__type).toBe('Candidate'); // Asserting Semantic resolution boundary
  });

  it('4. Evidence Builder constructs deterministic Evidence Package', async () => {
    const evidence = await evidenceBuilder.buildPackage(
      'Why is Candidate Sarah still in screening?',
      'Candidate',
      candidateId,
      actorId
    );

    expect(evidence.question).toBe('Why is Candidate Sarah still in screening?');
    // Facts must be deterministically extracted from the query projection
    expect(evidence.facts).toContain('name = Sarah Connor');
    expect(evidence.facts).toContain('Candidate status = Screening');
  });
});
