/**
 * CHATR OS — Business Object Store v2.0
 *
 * Supabase-backed CRUD store for all Business OS capability records.
 * Falls back to localStorage if Supabase is unavailable (offline / no session).
 *
 * Persistence layer: `bos_records` table (tenant-isolated via RLS)
 * Local fallback key format: `chatr_bor_<capabilityId>_<objectName>`
 *
 * Every write fires EventBus + maintains an immutable _history audit trail.
 */

import { supabase } from '@/integrations/supabase/client';
import { StateMachineEngine } from './StateMachineEngine';
import { PolicyEngine } from './PolicyEngine';
import { EventBus } from './EventBus';

import { runtimeObservability } from '@/core/os/telemetry/RuntimeObservability';

// ─── Internal helpers ────────────────────────────────────────────────────────

function localKey(capabilityId: string, objectName: string): string {
  return `chatr_bor_${capabilityId}_${objectName}`;
}

function readLocal(capabilityId: string, objectName: string): Record<string, any>[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(capabilityId, objectName)) ?? '[]');
  } catch { return []; }
}

function writeLocal(capabilityId: string, objectName: string, records: Record<string, any>[]): void {
  localStorage.setItem(localKey(capabilityId, objectName), JSON.stringify(records));
}

function activeLocal(capabilityId: string, objectName: string): Record<string, any>[] {
  return readLocal(capabilityId, objectName).filter(r => !r._deletedAt);
}

function generateId(objectName: string): string {
  return `${objectName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function getTenantId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** Checks whether the Supabase session + bos_records table are reachable */
async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const { error } = await supabase
      .from('bos_records')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    clearTimeout(timeout);
    return !error;
  } catch {
    return false;
  }
}

// ─── Row shape helpers ────────────────────────────────────────────────────────

function toSupabaseRow(
  id: string,
  capabilityId: string,
  objectName: string,
  tenantId: string,
  data: Record<string, any>,
  history: any[],
  currentStatus?: string
) {
  const { _createdAt, _updatedAt, _createdBy, _history, _deletedAt, _archivedAt, _pendingPolicy, ...fields } = data;
  return {
    id,
    capability_id: capabilityId,
    object_name: objectName,
    tenant_id: tenantId,
    data: fields,
    history,
    current_status: currentStatus ?? null,
    created_by: _createdBy ?? 'current-user',
    deleted_at: _deletedAt ?? null,
    archived_at: _archivedAt ?? null,
    pending_policy: _pendingPolicy ?? null,
  };
}

function fromSupabaseRow(row: any): Record<string, any> {
  return {
    id: row.id,
    ...row.data,
    _createdAt: row.created_at,
    _updatedAt: row.updated_at,
    _createdBy: row.created_by,
    _history: row.history ?? [],
    _deletedAt: row.deleted_at ?? undefined,
    _archivedAt: row.archived_at ?? undefined,
    _pendingPolicy: row.pending_policy ?? undefined,
    current_status: row.current_status,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const BusinessObjectStore = {

  async list(capabilityId: string, objectName: string): Promise<Record<string, any>[]> {
    const start = performance.now();
    try {
      if (await isSupabaseAvailable()) {
        const tenantId = await getTenantId();
        const { data, error } = await supabase
          .from('bos_records')
          .select('*')
          .eq('capability_id', capabilityId)
          .eq('object_name', objectName)
          .eq('tenant_id', tenantId!)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) {
          runtimeObservability.recordCall('bos_store', performance.now() - start, false);
          console.warn('[BusinessObjectStore] Supabase list error, falling back to local:', error.message);
          return activeLocal(capabilityId, objectName);
        }
        runtimeObservability.recordCall('bos_store', performance.now() - start, true);
        return (data ?? []).map(fromSupabaseRow);
      }
      const res = activeLocal(capabilityId, objectName);
      runtimeObservability.recordCall('bos_store', performance.now() - start, true);
      return res;
    } catch {
      runtimeObservability.recordCall('bos_store', performance.now() - start, false);
      return activeLocal(capabilityId, objectName);
    }
  },

  async get(capabilityId: string, objectName: string, id: string): Promise<Record<string, any> | undefined> {
    if (await isSupabaseAvailable()) {
      const { data, error } = await supabase
        .from('bos_records')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return activeLocal(capabilityId, objectName).find(r => r.id === id);
      }
      return fromSupabaseRow(data);
    }
    return activeLocal(capabilityId, objectName).find(r => r.id === id);
  },

  async create(capabilityId: string, objectName: string, data: Record<string, any>): Promise<Record<string, any>> {
    const id = generateId(objectName);
    const now = new Date().toISOString();
    const history = [{ type: 'created', timestamp: now, actor: 'current-user', details: 'Record created' }];

    const record = {
      id,
      ...data,
      _createdAt: now,
      _updatedAt: now,
      _createdBy: 'current-user',
      _history: history,
    };

    if (await isSupabaseAvailable()) {
      const tenantId = await getTenantId();
      const row = toSupabaseRow(id, capabilityId, objectName, tenantId!, data, history);
      const { error } = await supabase.from('bos_records').insert(row);
      if (error) {
        console.warn('[BusinessObjectStore] Supabase create error, writing to local:', error.message);
        const records = readLocal(capabilityId, objectName);
        records.push(record);
        writeLocal(capabilityId, objectName, records);
      }
    } else {
      const records = readLocal(capabilityId, objectName);
      records.push(record);
      writeLocal(capabilityId, objectName, records);
    }

    EventBus.publish(capabilityId, 'WorkObjectCreated', { objectName, object: record });
    return record;
  },

  async update(capabilityId: string, objectName: string, id: string, data: Record<string, any>): Promise<Record<string, any> | null> {
    const existing = await BusinessObjectStore.get(capabilityId, objectName, id);
    if (!existing) return null;

    // State Machine Enforcement
    const sdk = (window as any).__CHATR_SDK_REGISTRY__?.[capabilityId];
    const objectDef = sdk?.objects?.find((o: any) => o.name === objectName);
    const statusField = objectDef?.statusField || 'Status';
    let isStateTransition = false;
    const oldState = existing[statusField];
    const newState = data[statusField];

    if (newState !== undefined && oldState !== newState) {
      const machine = StateMachineEngine.getMachine(capabilityId, objectName);
      if (machine) {
        const error = StateMachineEngine.validateTransition(machine, oldState || machine.initialState, newState, data);
        if (error) throw new Error(error);
        isStateTransition = true;
      }
    }

    // Policy Enforcement
    const policies = PolicyEngine.getPolicies(capabilityId);
    const triggeredPolicy = PolicyEngine.evaluate(policies, objectName, 'update', { ...existing, ...data });
    if (triggeredPolicy) {
      if (triggeredPolicy.decision === 'Block') {
        throw new Error(`Policy Blocked: This action violates policy '${triggeredPolicy.id}' (${triggeredPolicy.condition})`);
      } else if (triggeredPolicy.decision === 'RequireApproval') {
        data[statusField] = 'Pending Approval';
        data['_pendingPolicy'] = triggeredPolicy.id;
      }
    }

    const now = new Date().toISOString();
    const historyEntry = isStateTransition
      ? { type: 'state_change', timestamp: now, actor: 'current-user', details: `State transitioned from ${oldState} to ${newState}` }
      : triggeredPolicy?.decision === 'RequireApproval'
      ? { type: 'policy_approval_requested', timestamp: now, actor: 'system', details: `Policy ${triggeredPolicy.id} requires approval` }
      : { type: 'updated', timestamp: now, actor: 'current-user', details: 'Record updated' };

    const updatedHistory = [...(existing._history ?? []), historyEntry];
    const updated = { ...existing, ...data, _updatedAt: now, _history: updatedHistory };

    if (await isSupabaseAvailable()) {
      const tenantId = await getTenantId();
      const { _createdAt, _updatedAt, _createdBy, _history, _deletedAt, _archivedAt, _pendingPolicy, current_status, ...fields } = updated;
      const { error } = await supabase
        .from('bos_records')
        .update({
          data: fields,
          history: updatedHistory,
          updated_at: now,
          current_status: newState ?? existing.current_status ?? null,
          pending_policy: updated._pendingPolicy ?? null,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId!);

      if (error) {
        console.warn('[BusinessObjectStore] Supabase update error, writing to local:', error.message);
        const records = readLocal(capabilityId, objectName);
        const idx = records.findIndex(r => r.id === id);
        if (idx !== -1) { records[idx] = updated; writeLocal(capabilityId, objectName, records); }
      }
    } else {
      const records = readLocal(capabilityId, objectName);
      const idx = records.findIndex(r => r.id === id);
      if (idx !== -1) { records[idx] = updated; writeLocal(capabilityId, objectName, records); }
    }

    EventBus.publish(capabilityId, 'WorkObjectUpdated', { objectName, object: updated, previous: existing });
    if (isStateTransition) {
      StateMachineEngine.onTransitionCompleted(capabilityId, objectName, id, oldState, newState);
    }
    return updated;
  },

  async delete(capabilityId: string, objectName: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const existing = await BusinessObjectStore.get(capabilityId, objectName, id);
    if (!existing) return false;

    if (await isSupabaseAvailable()) {
      const tenantId = await getTenantId();
      const updatedHistory = [...(existing._history ?? []), { type: 'deleted', timestamp: now, actor: 'current-user', details: 'Record moved to trash' }];
      const { error } = await supabase
        .from('bos_records')
        .update({ deleted_at: now, history: updatedHistory, updated_at: now })
        .eq('id', id)
        .eq('tenant_id', tenantId!);
      if (error) console.warn('[BusinessObjectStore] Supabase delete error:', error.message);
    } else {
      const records = readLocal(capabilityId, objectName);
      const idx = records.findIndex(r => r.id === id);
      if (idx !== -1) {
        records[idx] = { ...records[idx], _deletedAt: now, _updatedAt: now };
        writeLocal(capabilityId, objectName, records);
      }
    }

    EventBus.publish(capabilityId, 'WorkObjectDeleted', { objectName, id });
    return true;
  },

  async restore(capabilityId: string, objectName: string, id: string): Promise<Record<string, any> | null> {
    const now = new Date().toISOString();
    if (await isSupabaseAvailable()) {
      const tenantId = await getTenantId();
      const { data: row } = await supabase.from('bos_records').select('*').eq('id', id).single();
      if (!row) return null;
      const updatedHistory = [...(row.history ?? []), { type: 'restored', timestamp: now, actor: 'current-user', details: 'Record restored from trash' }];
      await supabase.from('bos_records').update({ deleted_at: null, history: updatedHistory, updated_at: now }).eq('id', id).eq('tenant_id', tenantId!);
      return fromSupabaseRow({ ...row, deleted_at: null, history: updatedHistory });
    }
    const records = readLocal(capabilityId, objectName);
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const restored = { ...records[idx], _updatedAt: now };
    delete restored._deletedAt;
    records[idx] = restored;
    writeLocal(capabilityId, objectName, records);
    return restored;
  },

  async archive(capabilityId: string, objectName: string, id: string): Promise<Record<string, any> | null> {
    return BusinessObjectStore.update(capabilityId, objectName, id, { _archivedAt: new Date().toISOString() });
  },

  async duplicate(capabilityId: string, objectName: string, id: string): Promise<Record<string, any> | null> {
    const original = await BusinessObjectStore.get(capabilityId, objectName, id);
    if (!original) return null;
    const { id: _id, _createdAt, _updatedAt, _createdBy, _history, _deletedAt, ...data } = original;
    return BusinessObjectStore.create(capabilityId, objectName, data);
  },

  async hardDelete(capabilityId: string, objectName: string, id: string): Promise<boolean> {
    // Hard deletes are intentionally restricted — use delete() (soft) instead.
    // This calls the local fallback only; Supabase hard deletes require service role.
    const records = readLocal(capabilityId, objectName);
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) return false;
    writeLocal(capabilityId, objectName, filtered);
    EventBus.publish(capabilityId, 'WorkObjectHardDeleted', { objectName, id });
    return true;
  },

  async count(capabilityId: string, objectName: string, filters?: Record<string, any>): Promise<number> {
    if (await isSupabaseAvailable()) {
      const tenantId = await getTenantId();
      let query = supabase
        .from('bos_records')
        .select('id', { count: 'exact', head: true })
        .eq('capability_id', capabilityId)
        .eq('object_name', objectName)
        .eq('tenant_id', tenantId!)
        .is('deleted_at', null);

      // Apply simple equality filters
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          query = query.eq(`data->>${k}`, String(v));
        });
      }

      const { count, error } = await query;
      if (!error && count !== null) return count;
    }

    // Fallback to local count
    let records = activeLocal(capabilityId, objectName);
    if (filters) {
      records = records.filter(r => Object.entries(filters).every(([k, v]) => r[k] === v));
    }
    return records.length;
  },
};
