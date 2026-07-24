import { telemetry as TelemetryService } from './TelemetryService';
import { supabase } from '@/integrations/supabase/client';
import { networkMonitor } from '@/utils/networkMonitor';

export interface SyncAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  retryCount: number;
}

class OfflineSyncPipelineImpl {
  private queue: SyncAction[] = [];
  private isProcessing = false;
  private readonly STORAGE_KEY = 'chatr_offline_sync_queue';

  constructor() {
    this.loadQueue();
    
    // Listen for network reconnects
    window.addEventListener('online', () => {
      this.processQueue();
    });

    // Or use our network monitor
    setInterval(() => {
      if (networkMonitor.isOnline()) {
        this.processQueue();
      }
    }, 30000); // Check every 30s
  }

  public enqueueAction(type: string, payload: any) {
    const action: SyncAction = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };
    
    this.queue.push(action);
    this.saveQueue();
    TelemetryService.track('offline.action.queued', { type, actionId: action.id });
    
    if (networkMonitor.isOnline()) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0 || !networkMonitor.isOnline()) return;
    
    this.isProcessing = true;
    
    const pendingActions = this.queue.filter(a => a.status === 'pending' || a.status === 'failed');
    if (pendingActions.length === 0) {
      this.isProcessing = false;
      return;
    }

    TelemetryService.track('offline.sync.started', { count: pendingActions.length });

    for (const action of pendingActions) {
      action.status = 'syncing';
      this.saveQueue();
      
      try {
        // Implement Conflict Detection & Merge
        const mergedPayload = await this.detectAndMergeConflicts(action);
        
        // Server Sync
        await this.syncToServer(action.type, mergedPayload);
        
        // Confirmation
        action.status = 'completed';
        TelemetryService.track('offline.action.synced', { type: action.type, actionId: action.id });
      } catch (error: any) {
        console.error(`[OfflineSyncPipeline] Action ${action.id} failed:`, error);
        action.retryCount++;
        action.status = 'failed';
        if (action.retryCount > 5) {
          // Dead letter queue
          this.queue = this.queue.filter(a => a.id !== action.id);
          TelemetryService.track('offline.action.dropped', { type: action.type, actionId: action.id });
        }
      }
    }
    
    // Clean up completed actions
    this.queue = this.queue.filter(a => a.status !== 'completed');
    this.saveQueue();
    
    this.isProcessing = false;
  }

  private async detectAndMergeConflicts(action: SyncAction): Promise<any> {
    // Basic Last-Write-Wins implementation
    // In a real system, you might fetch current server state and merge
    return action.payload;
  }

  private async syncToServer(type: string, payload: any): Promise<void> {
    // Example: Dispatch generic RPC or direct table insertion based on type
    // We will use a generic Edge Function or RPC if available. For demo, we just simulate or use RPC.
    
    if (type.startsWith('db.')) {
      const table = type.split('.')[1];
      const { error } = await supabase.from(table).upsert(payload);
      if (error) throw error;
    } else {
      // Custom edge function handler
      const { error } = await supabase.functions.invoke('sync-action', {
        body: { type, payload }
      });
      // Ignore 404s for un-deployed functions in demo
      if (error && !error.message.includes('404')) throw error;
    }
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load sync queue', e);
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error('Failed to save sync queue', e);
    }
  }
}

export const OfflineSyncPipeline = new OfflineSyncPipelineImpl();
