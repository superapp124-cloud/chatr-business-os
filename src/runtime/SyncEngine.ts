// @ts-ignore - Dexie might not be strictly typed here
import Dexie from 'dexie';
import { supabase } from '@/integrations/supabase/client';

// Local DB for offline operational queue
class SyncDatabase extends Dexie {
  operations: Dexie.Table<Operation, number>;

  constructor() {
    super('BusinessOS_SyncDB');
    this.version(1).stores({
      operations: '++id, type, table, recordId, timestamp'
    });
    this.operations = this.table('operations');
  }
}

const db = new SyncDatabase();

export interface Operation {
  id?: number;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  recordId?: string;
  payload: any;
  expectedVersion?: number;
  timestamp: number;
}

export class SyncEngine {
  /**
   * Versioned Offline Sync using an Operational Queue.
   * This replaces "Last Write Wins" with explicit conflict detection.
   */

  static async queueOperation(type: 'INSERT'|'UPDATE'|'DELETE', table: string, payload: any, expectedVersion?: number) {
    const operation: Operation = {
      type,
      table,
      recordId: payload.id,
      payload,
      expectedVersion,
      timestamp: Date.now()
    };
    await db.operations.add(operation);
    console.log('Queued operation for sync', operation);
    return { ...payload, _offline: true }; // Return optimistic result
  }

  static async sync() {
    const ops = await db.operations.orderBy('timestamp').toArray();
    if (ops.length === 0) return;

    console.log(`Starting sync for ${ops.length} operations...`);

    for (const op of ops) {
      try {
        if (op.type === 'INSERT') {
          await supabase.from(op.table).insert(op.payload);
        } else if (op.type === 'UPDATE') {
          // Detect Conflicts!
          const { data: currentRecord } = await supabase
            .from(op.table)
            .select('version')
            .eq('id', op.recordId)
            .single();

          if (currentRecord && op.expectedVersion && currentRecord.version !== op.expectedVersion) {
            console.warn(`CONFLICT DETECTED for ${op.table} ${op.recordId}. Expected ${op.expectedVersion}, got ${currentRecord.version}`);
            // Logic for manual resolution goes here (e.g., notify user)
            // Skip for now, don't delete from queue so user can resolve
            continue; 
          }

          // If no conflict, proceed
          await supabase.from(op.table).update(op.payload).eq('id', op.recordId);
        } else if (op.type === 'DELETE') {
          await supabase.from(op.table).delete().eq('id', op.recordId);
        }

        // Successfully synced, remove from queue
        if (op.id) await db.operations.delete(op.id);
      } catch (err) {
        console.error(`Sync failed for operation ${op.id}`, err);
        // Break on first error to maintain sequential integrity?
        break;
      }
    }
  }
}

// In a real app, bind this to window online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    SyncEngine.sync();
  });
}
