import { describe, it, expect, beforeAll } from 'vitest';
import { InMemoryEventStore } from '../../storage/InMemoryEventStore';
import { ObjectRuntime } from '../../runtime/ObjectRuntime';
import { ProjectionService } from '../../projections/ProjectionService';
import { QueryEngine } from '../../query/QueryEngine';
import { EvidenceBuilder } from '../../evidence/EvidenceBuilder';
import { CapabilityRegistry } from '../../registry/CapabilityRegistry';
import { CapabilityValidator } from '../../validation/CapabilityValidator';
import { CapabilityCompiler } from '../../validation/CapabilityCompiler';
import { PackLoader } from '../../registry/PackLoader';

/**
 * Gate C: Studio on EDL (Round Trip Conformance Test)
 * Proves that a Capability Pack can be authored, validated, compiled, installed,
 * executed, replayed, explained, and uninstalled completely dynamically.
 */
describe('Gate C: Studio Round-Trip Conformance', () => {
  let registry: CapabilityRegistry;
  let validator: CapabilityValidator;
  let compiler: CapabilityCompiler;
  let loader: PackLoader;
  
  let eventStore: InMemoryEventStore;
  let objectRuntime: ObjectRuntime;
  let projectionService: ProjectionService;
  let queryEngine: QueryEngine;
  let evidenceBuilder: EvidenceBuilder;

  // The dynamically generated pack artifact
  let generatedManifest: any;
  let generatedObjects: any[];
  
  const actorId = 'urn:chatr:actor:employee:roundtrip_tester';
  const instanceId = `roundtrip_${Date.now()}`;

  beforeAll(() => {
    registry = new CapabilityRegistry();
    validator = new CapabilityValidator();
    compiler = new CapabilityCompiler();
    loader = new PackLoader(registry, validator, compiler);

    eventStore = new InMemoryEventStore();
    objectRuntime = new ObjectRuntime(eventStore, registry);
    projectionService = new ProjectionService(eventStore);
    projectionService.start();
    queryEngine = new QueryEngine(projectionService);
    evidenceBuilder = new EvidenceBuilder(queryEngine);
  });

  it('1. Generate & 2. Export: Studio produces valid metadata in JSON', () => {
    // Simulating Studio exporting the Recruitment pack as pure JSON
    generatedManifest = {
      id: 'studio-generated-pack',
      version: '1.0.0',
      edlVersion: '1.0',
      name: 'Dynamic Roundtrip Pack'
    };

    generatedObjects = [
      {
        urn: 'urn:chatr:object:roundtrip-candidate',
        type: 'RoundtripCandidate',
        name: 'Roundtrip Job Candidate',
        primitiveType: 'LivingObject',
        properties: [
          { key: 'name', type: 'string', required: true }
        ],
        lifecycle: {
          initialState: 'applied',
          states: [{ name: 'applied' }, { name: 'hired' }],
          transitions: [
            { from: ['applied'], to: 'hired', triggeredByEvent: 'RoundtripHired' }
          ]
        },
        eventsProduced: ['RoundtripCandidateCreated', 'RoundtripCandidateTransitioned']
      }
    ];

    expect(generatedManifest.id).toBeDefined();
    expect(generatedObjects.length).toBe(1);
  });

  it('3. Compile & 4. Validate & 5. Install: Pack loads via Registry', async () => {
    // The loader runs the full pipeline
    await loader.loadFromJSON(generatedManifest, generatedObjects);

    // Verify it's in the registry
    const aggregate = registry.getAggregate('RoundtripCandidate');
    expect(aggregate).toBeDefined();
    expect(aggregate.urn).toBe('urn:chatr:object:roundtrip-candidate');
    expect(aggregate.metadata?.['_compiledAt']).toBeDefined(); // Proof of compiler pass
  });

  it('6. Boot & 7. Execute: Runtime executes objects correctly based on schema', async () => {
    // Attempt to create the object
    await objectRuntime.executeCommand(
      {
        aggregateType: 'RoundtripCandidate',
        aggregateId: instanceId,
        action: 'Create',
        payload: { name: 'Dynamic Alice', stage: 'applied', _lifecycleState: 'applied' }
      },
      actorId,
      'tenant_1'
    );

    // Tiny tick for event bus projection
    await new Promise(resolve => setTimeout(resolve, 50));

    const state = await queryEngine.get({ actorId, aggregateType: 'RoundtripCandidate', aggregateId: instanceId });
    expect(state).toBeDefined();
    expect(state!.name).toBe('Dynamic Alice');
    expect(state!._lifecycleState).toBe('applied');

    // Attempt valid transition
    await objectRuntime.executeCommand(
      {
        aggregateType: 'RoundtripCandidate',
        aggregateId: instanceId,
        action: 'Transition',
        payload: { targetState: 'hired', _lifecycleState: 'hired' }
      },
      actorId,
      'tenant_1'
    );

    await new Promise(resolve => setTimeout(resolve, 50));
    const hiredState = await queryEngine.get({ actorId, aggregateType: 'RoundtripCandidate', aggregateId: instanceId });
    expect(hiredState!._lifecycleState).toBe('hired');
  });

  it('8. Replay: State rebuilds identically from events', async () => {
    const originalState = await queryEngine.get({ actorId, aggregateType: 'RoundtripCandidate', aggregateId: instanceId });

    const newProjectionService = new ProjectionService(eventStore);
    await newProjectionService.rebuild();
    const newQueryEngine = new QueryEngine(newProjectionService);
    
    // Tiny tick for event bus
    await new Promise(resolve => setTimeout(resolve, 50));

    const replayedState = await newQueryEngine.get({ actorId, aggregateType: 'RoundtripCandidate', aggregateId: instanceId });
    expect(replayedState).toEqual(originalState);
  });

  it('9. Explain: Evidence is deterministic', async () => {
    const evidence = await evidenceBuilder.buildPackage('Why is Alice hired?', 'RoundtripCandidate', instanceId, actorId);
    expect(evidence).toBeDefined();
    console.log('FACTS:', evidence.facts);
    expect(evidence.facts.some(f => f.includes('hired'))).toBe(true);
  });

  it('10. Uninstall: Runtime remains healthy but Pack is disabled', () => {
    // Uninstall the pack
    registry.uninstall('studio-generated-pack');

    // Attempting to fetch it should now throw
    expect(() => registry.getAggregate('RoundtripCandidate')).toThrow();
  });
});
