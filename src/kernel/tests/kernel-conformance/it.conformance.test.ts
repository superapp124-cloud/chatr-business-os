import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ObjectRuntime } from '../../runtime/ObjectRuntime';
import { PostgresEventStore } from '../../storage/PostgresEventStore';
import { ProjectionService } from '../../projections/ProjectionService';
import { QueryEngine } from '../../query/QueryEngine';
import { EvidenceBuilder } from '../../evidence/EvidenceBuilder';
import { EDLLivingObject } from '../../contracts/edl/types';
import { CapabilityRegistry } from '../../registry/CapabilityRegistry';
import { PackLoader } from '../../registry/PackLoader';

describe('IT Asset Conformance Test (End-to-End)', () => {
  let supabase: SupabaseClient;
  let eventStore: PostgresEventStore;
  let objectRuntime: ObjectRuntime;
  let projectionService: ProjectionService;
  let queryEngine: QueryEngine;
  let evidenceBuilder: EvidenceBuilder;

  const assetId = `laptop_${Date.now()}`;
  const actorId = 'urn:chatr:actor:employee:it_admin_1';

  // 1. The EDL Metadata definition (No UI, No Code, Just Schema)
  // Notice that the runtime code will not change, only this metadata changes.
  const laptopEDL: EDLLivingObject = {
    urn: 'urn:chatr:object:it-asset',
    type: 'Asset',
    name: 'Company Laptop',
    primitiveType: 'LivingObject',
    metadata: {},
    properties: [
      { key: 'serialNumber', type: 'string', required: true },
      { key: 'model', type: 'string', required: true }
    ],
    relationships: [
      { predicate: 'assigned_to', class: 'authority', targetType: 'Employee', required: false, multiple: false }
    ],
    lifecycle: {
      initialState: 'Inventory',
      states: [
        { name: 'Inventory' },
        { name: 'Assigned' },
        { name: 'Repair' },
        { name: 'Retired', isTerminal: true }
      ],
      transitions: [
        { from: ['Inventory'], to: 'Assigned', triggeredByEvent: 'AssetAssigned' },
        { from: ['Assigned'], to: 'Repair', triggeredByEvent: 'AssetRepairStarted' },
        { from: ['Repair'], to: 'Retired', triggeredByEvent: 'AssetRetired' }
      ]
    },
    eventsProduced: ['AssetCreated', 'AssetAssigned', 'AssetRepairStarted', 'AssetRetired']
  };

  beforeAll(async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
    supabase = createClient(supabaseUrl, supabaseKey);

    const registry = new CapabilityRegistry();
    const loader = new PackLoader(registry);
    await loader.loadFromJSON({ id: 'test-it', version: '1.0', edlVersion: '1.0', name: 'IT Assets' }, [laptopEDL as any]);

    eventStore = new PostgresEventStore(supabase);
    objectRuntime = new ObjectRuntime(eventStore, registry);
    
    projectionService = new ProjectionService(eventStore);
    projectionService.start();

    queryEngine = new QueryEngine(projectionService);
    evidenceBuilder = new EvidenceBuilder(queryEngine);
  });

  it('1. Creates an Asset through ObjectRuntime & EventStore', async () => {
    const event = await objectRuntime.executeCommand(
      {
        aggregateType: 'Asset',
        aggregateId: assetId,
        action: 'Create',
        payload: {
          serialNumber: 'MAC-12345',
          model: 'MacBook Pro M3'
        }
      },
      actorId,
      'tenant_1'
    );

    expect(event).toBeDefined();
    expect(event.eventType).toBe('AssetCreated');
  });

  it('2. Transitions the Asset lifecycle to Assigned via Event', async () => {
    const event = await objectRuntime.executeCommand(
      {
        aggregateType: 'Asset',
        aggregateId: assetId,
        action: 'Transition',
        payload: {
          targetState: 'Assigned',
          _lifecycleState: 'Assigned'
        }
      },
      actorId,
      'tenant_1'
    );

    expect(event.eventType).toBe('AssetTransitioned');
  });

  it('3. Query Engine retrieves deterministic Current State', async () => {
    await new Promise(resolve => setTimeout(resolve, 500)); // wait for projection

    const state = await queryEngine.get({
      actorId,
      aggregateType: 'Asset',
      aggregateId: assetId
    });

    expect(state).toBeDefined();
    expect(state.serialNumber).toBe('MAC-12345');
    expect(state._lifecycleState).toBe('Assigned');
    expect(state.__type).toBe('Asset');
  });

  it('4. Evidence Builder constructs deterministic Evidence Package', async () => {
    const evidence = await evidenceBuilder.buildPackage(
      'What is the status of laptop MAC-12345?',
      'Asset',
      assetId,
      actorId
    );

    expect(evidence.question).toBe('What is the status of laptop MAC-12345?');
    expect(evidence.facts).toContain('serialNumber = MAC-12345');
    expect(evidence.facts).toContain('Asset status = Assigned');
  });
});
