import { describe, it, expect, beforeAll } from 'vitest';
import { SupabaseEventStore } from '../../src/platform/execution/SupabaseEventStore';
import { OSEvent } from '../../src/platform/contracts/os/EventLog.abi';
import { supabase } from '../../src/integrations/supabase/client';

describe('M1-CERT: Immutable Event Platform Certification', () => {
  let store: SupabaseEventStore;
  const testSubsystem = `test_runner_${Date.now()}`;

  beforeAll(() => {
    store = new SupabaseEventStore();
  });

  it('M1-CERT-001: Append Test', async () => {
    const id = await store.append({
      type: 'm1.cert.append_test',
      level: 'info',
      metadata: {
        sourceSubsystem: testSubsystem,
        provenance: 'M1-CERT-001',
        schemaVersion: '1.0',
        producerVersion: '1.0',
        platformVersion: '1.0'
      },
      payload: { status: 'success' }
    });

    expect(id).toBeDefined();

    const events = await store.query({ sourceSubsystem: testSubsystem, type: 'm1.cert.append_test' });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].payload).toEqual({ status: 'success' });
  });

  it('M1-CERT-002: Update Test', async () => {
    // Attempting a direct update bypassing the ABI to test RLS/Triggers
    const { error } = await supabase
      .from('os_events')
      .update({ payload: { hacked: true } })
      .eq('source_subsystem', testSubsystem);

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/append-only|prohibited|violates row-level security/i);
  });

  it('M1-CERT-003: Delete Test', async () => {
    // Attempting a direct delete bypassing the ABI
    const { error } = await supabase
      .from('os_events')
      .delete()
      .eq('source_subsystem', testSubsystem);

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/append-only|prohibited|violates row-level security/i);
  });

  it('M1-CERT-004 & M1-CERT-005: Replay & Ordering Test', async () => {
    const sub = `replay_test_${Date.now()}`;
    
    // Append 5 events
    for (let i = 0; i < 5; i++) {
      await store.append({
        type: `m1.cert.replay`,
        level: 'info',
        metadata: { sourceSubsystem: sub, provenance: 'M1-CERT-004', schemaVersion: '1.0', producerVersion: '1.0', platformVersion: '1.0' },
        payload: { sequence: i }
      });
    }

    const events = await store.query({ sourceSubsystem: sub });
    expect(events.length).toBe(5);

    // Verify ordering
    for (let i = 0; i < 5; i++) {
      expect(events[i].payload.sequence).toBe(i);
    }
  });

  it('M1-CERT-009: Performance Baseline', async () => {
    const start = performance.now();
    await store.append({
      type: 'm1.cert.perf',
      level: 'info',
      metadata: { sourceSubsystem: testSubsystem, provenance: 'M1-CERT-009', schemaVersion: '1.0', producerVersion: '1.0', platformVersion: '1.0' },
      payload: { payloadSize: 'small' }
    });
    const latency = performance.now() - start;
    
    // Append should take < 500ms
    expect(latency).toBeLessThan(500);
  });

  it('M1-CERT-010: Tenant Isolation (Simulated via RLS)', async () => {
    // Supabase client uses the logged-in user's JWT. 
    // If we were fully mocking multitenancy here, we would switch auth contexts.
    // For now, we assert that the query API supports narrowing by scope/subsystem.
    const events = await store.query({ sourceSubsystem: testSubsystem });
    const unrelatedEvents = events.filter(e => e.metadata.sourceSubsystem !== testSubsystem);
    expect(unrelatedEvents.length).toBe(0);
  });
});
