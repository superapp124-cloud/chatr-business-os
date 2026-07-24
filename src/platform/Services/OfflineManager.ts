import Dexie, { Table } from 'dexie';
import { IService } from '../Shared/Types';
import { Logger } from '../Infrastructure/Logger';

// ─── Dexie Database Definition ───────────────────────────────────────────────
export class CHATRDatabase extends Dexie {
  queues!: Table<QueuedAction, string>;

  constructor() {
    super('CHATRDatabase');
    this.version(1).stores({
      queues: 'id, type, status, timestamp'
    });
  }
}

export const db = new CHATRDatabase();

// ─── Queue Types ─────────────────────────────────────────────────────────────
export interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  timestamp: number;
}

// ─── Offline Manager Service ──────────────────────────────────────────────────
class OfflineManagerService implements IService {
  name = 'OfflineManager';
  dependencies = ['Configuration'];
  
  private isOnline = navigator.onLine;

  async initialize(): Promise<void> {
    Logger.info('[OfflineManager] Initializing Offline Runtime...');
    
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    if (this.isOnline) {
      this.replayQueue();
    }
  }

  private handleOnline() {
    this.isOnline = true;
    Logger.info('[OfflineManager] Network connected. Replaying queue...');
    this.replayQueue();
  }

  private handleOffline() {
    this.isOnline = false;
    Logger.warn('[OfflineManager] Network disconnected. Working offline...');
  }

  async enqueueAction(type: string, payload: any): Promise<string> {
    const action: QueuedAction = {
      id: crypto.randomUUID(),
      type,
      payload,
      status: 'pending',
      timestamp: Date.now()
    };
    await db.queues.add(action);
    Logger.debug(`[OfflineManager] Queued action: ${type}`, { id: action.id });
    
    if (this.isOnline) {
      this.replayQueue(); // trigger immediately if we're actually online
    }
    
    return action.id;
  }

  async replayQueue(): Promise<void> {
    if (!this.isOnline) return;

    try {
      const pending = await db.queues.where('status').equals('pending').sortBy('timestamp');
      for (const action of pending) {
        // Mark as processing
        await db.queues.update(action.id, { status: 'processing' });
        
        // Execute sync logic here (often delegated to SyncManager or EventBus)
        Logger.info(`[OfflineManager] Processing queued action: ${action.type}`);
        
        // Simulate success for now
        await db.queues.update(action.id, { status: 'completed' });
      }
    } catch (e) {
      Logger.error(`[OfflineManager] Error replaying queue`, e);
    }
  }
}

export const OfflineManager = new OfflineManagerService();
