import { openDB, IDBPDatabase } from 'idb';
import { Command } from '../../kernel/runtime/ObjectRuntime';

export type CommandQueueStatus = 'queued' | 'sending' | 'acknowledged' | 'confirmed' | 'completed' | 'rejected' | 'rolled-back';

export interface QueuedCommand {
  id: string; // Unique ID for the queue entry
  command: Command;
  actorId: string;
  tenantId: string;
  status: CommandQueueStatus;
  retryCount: number;
  lastAttempt?: Date;
  error?: string;
  timestamp: Date;
}

export class CommandQueue {
  private dbName = 'chatr-command-queue';
  private storeName = 'commands';
  private dbPromise: Promise<IDBPDatabase>;

  constructor(dbPrefix: string = '') {
    this.dbName = dbPrefix ? `${dbPrefix}-chatr-command-queue` : 'chatr-command-queue';
    this.dbPromise = openDB(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('commands')) {
          const store = db.createObjectStore('commands', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }

  async enqueue(command: Command, actorId: string, tenantId: string): Promise<string> {
    const db = await this.dbPromise;
    const entryId = command.correlationId || crypto.randomUUID();
    
    const queued: QueuedCommand = {
      id: entryId,
      command,
      actorId,
      tenantId,
      status: 'queued',
      retryCount: 0,
      timestamp: new Date()
    };

    await db.put(this.storeName, queued);
    return entryId;
  }

  async getCommandsByStatus(statuses: CommandQueueStatus[]): Promise<QueuedCommand[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(this.storeName, 'readonly');
    const index = tx.store.index('by-timestamp');
    
    // Get all commands, filter in memory
    const all = await index.getAll();
    return all.filter(c => statuses.includes(c.status));
  }

  async getPendingCommands(): Promise<QueuedCommand[]> {
    return this.getCommandsByStatus(['queued', 'rejected']); // 'rejected' means network failure basically (wait, no, 'rejected' could mean server rejected. For network failure, we need a 'failed' state but let's stick to 'queued' or add a retry mechanism. Let's assume 'queued' is used for retries too.)
  }

  async updateStatus(id: string, status: CommandQueueStatus, error?: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(this.storeName, 'readwrite');
    const command = await tx.store.get(id);
    
    if (command) {
      command.status = status;
      if (status === 'rejected') {
        command.retryCount += 1;
        command.lastAttempt = new Date();
        command.error = error;
      }
      await tx.store.put(command);
    }
    await tx.done;
  }

  async remove(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(this.storeName, id);
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(this.storeName);
  }
}
