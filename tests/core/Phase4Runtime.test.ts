import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowVersionManager } from '@/platform/AutomationOS/WorkflowVersionManager';
import { ApprovalEngine } from '@/platform/AutomationOS/ApprovalEngine';
import { AuditLogger } from '@/platform/Infrastructure/AuditLogger';
import { validateManifest } from '@/platform/SDK/ChatrPluginManifest';
import { normalizeEvent } from '@/platform/AutomationOS/NormalizedEvent';

// ── WorkflowVersionManager ─────────────────────────────────────────────────
describe('WorkflowVersionManager', () => {
  it('increments semver patch correctly', () => {
    // @ts-ignore — access private method for unit test
    const mgr = WorkflowVersionManager as any;
    expect(mgr.incrementPatch('1.0.0')).toBe('1.0.1');
    expect(mgr.incrementPatch('1.2.9')).toBe('1.2.10');
    expect(mgr.incrementPatch('0.0.0')).toBe('0.0.1');
  });
});

// ── NormalizedEvent ────────────────────────────────────────────────────────
describe('normalizeEvent', () => {
  it('produces a consistent envelope regardless of source', () => {
    const rawCron = { schedule: '*/5 * * * *', workflow_id: 'wf-123' };
    const event = normalizeEvent(rawCron, 'cron');

    expect(event.trigger_type).toBe('cron');
    expect(event.correlation_id).toBeDefined();
    expect(typeof event.correlation_id).toBe('string');
    expect(event.timestamp).toBeDefined();
    // workflow_id is promoted to a top-level envelope field, NOT left in payload
    expect(event.workflow_id).toBe('wf-123');
    expect(event.payload.schedule).toBe('*/5 * * * *');
  });

  it('promotes envelope fields and preserves non-envelope fields in payload', () => {
    const raw = { id: 'existing-id', correlation_id: 'existing-corr', data: 'hello' };
    const event = normalizeEvent(raw, 'webhook');

    // The factory REUSES valid string ids (as documented: promotes them)
    expect(event.id).toBe('existing-id');
    expect(event.correlation_id).toBe('existing-corr');
    // Non-envelope fields (like 'data') must remain in payload
    expect(event.payload.data).toBe('hello');
    // Envelope fields must NOT be duplicated inside payload
    expect(event.payload.id).toBeUndefined();
    expect(event.payload.correlation_id).toBeUndefined();
  });

  it('stamps normalized_at in metadata', () => {
    const event = normalizeEvent({}, 'manual');
    expect(event.metadata.normalized_at).toBeDefined();
    expect(event.metadata.source_trigger_type).toBe('manual');
  });
});

// ── Plugin Manifest Validator ──────────────────────────────────────────────
describe('validateManifest', () => {
  const validManifest = {
    id: 'com.chatr.plugin.stripe',
    name: 'Stripe Payments',
    version: '1.0.0',
    author: 'CHATR Labs',
    chatr_os_version: '>=4.0.0',
    min_sdk_version: '1.0.0',
    description: 'Stripe payment capability for CHATR',
    required_permissions: {
      network_destinations: ['api.stripe.com'],
      storage_access: false,
      background_execution: false,
      secret_references: ['stripe_api_key'],
    },
    optional_permissions: {},
    ui_contributions: [],
    capabilities: ['payment.charge', 'payment.refund'],
  };

  it('passes a fully valid manifest', () => {
    const result = validateManifest(validManifest as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a manifest with invalid semver', () => {
    const bad = { ...validManifest, version: 'not-a-version' };
    const result = validateManifest(bad as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('version'))).toBe(true);
  });

  it('rejects a manifest missing required fields', () => {
    const { name, ...missing } = validManifest;
    const result = validateManifest(missing as any);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('name'))).toBe(true);
  });

  it('rejects a manifest with missing required_permissions sub-fields', () => {
    const bad = { ...validManifest, required_permissions: { storage_access: false } };
    const result = validateManifest(bad as any);
    expect(result.valid).toBe(false);
  });
});

// ── AuditLogger (smoke test — no real Supabase) ────────────────────────────
describe('AuditLogger', () => {
  it('never throws on failure', async () => {
    // Supabase is mocked to return null/error in tests/setup.ts
    const result = await AuditLogger.log({
      action: 'workflow.published',
      resource_type: 'workflow',
      resource_id: 'wf-test-123',
      actor_id: 'user-abc',
    });
    // Should return false (failure) but never throw
    expect(typeof result).toBe('boolean');
  });
});
