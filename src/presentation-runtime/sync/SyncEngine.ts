import { Command } from '../../kernel/runtime/ObjectRuntime';
import { EventStore, KernelEvent } from '../../kernel/storage/EventStore';
import { SyncTransport, CommandEnvelope } from './SyncTransport';
import { CommandQueue } from './CommandQueue';
import { SyncSession, INITIAL_SYNC_SESSION } from './SyncSession';
import { PresentationEventBus } from '../events/PresentationEventBus';
import { IndexedDBEventStore } from '../../kernel/storage/IndexedDBEventStore';
import { TelemetrySink } from '../telemetry/TelemetrySink';

export class SyncEngine {
  private syncSession: SyncSession = { ...INITIAL_SYNC_SESSION };
  private onSessionChange?: (session: SyncSession) => void;
  private isSyncing = false;
  private isProcessingQueue = false;
  private syncInterval?: ReturnType<typeof setInterval>;
  
  private clientId = crypto.randomUUID();
  private sessionId = crypto.randomUUID();

  private totalSyncAttempts = 0;
  private successfulSyncs = 0;

  constructor(
    private transport: SyncTransport,
    private commandQueue: CommandQueue,
    private eventStore: EventStore,
    private eventBus: PresentationEventBus,
    private telemetry: TelemetrySink
  ) {
    this.listenToEventBus();
  }

  public onStateChange(handler: (session: SyncSession) => void) {
    this.onSessionChange = handler;
    handler(this.syncSession);
  }

  private updateSession(updates: Partial<SyncSession>) {
    this.syncSession = { ...this.syncSession, ...updates };
    this.onSessionChange?.(this.syncSession);
  }

  public start(pollIntervalMs = 5000) {
    this.updateSession({ connectionState: 'connecting' });
    this.checkConnectionAndSync();
    
    this.syncInterval = setInterval(() => {
      this.checkConnectionAndSync();
    }, pollIntervalMs);
  }

  public stop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.updateSession({ connectionState: 'offline' });
  }

  private listenToEventBus() {
    this.eventBus.subscribe('CommandStarted', async (event: any) => {
      if (event.command) {
        const command = event.command as Command;
        const actorId = event.actorId || 'system';
        const tenantId = event.tenantId || 'tenant-1';
        
        await this.commandQueue.enqueue(command, actorId, tenantId);
        await this.updateQueueStats();
        
        this.processQueue().catch(console.error);
      }
    });
  }

  private async updateQueueStats() {
    const queued = await this.commandQueue.getCommandsByStatus(['queued']);
    const rejected = await this.commandQueue.getCommandsByStatus(['rejected']);
    
    this.updateSession({ 
      queuedCommands: queued.length + rejected.length, // both are technically pending
      failedCommands: rejected.length
    });
    
    this.telemetry.emit({
      type: 'Metric',
      name: 'PendingQueueDepth',
      value: queued.length + rejected.length,
      timestamp: new Date()
    });
  }

  private async checkConnectionAndSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.totalSyncAttempts++;
    const startTime = Date.now();

    try {
      // Typically we'd have a getServerStatus in transport, but we'll assume it works if pull works
      await this.pullRemoteEvents();
      this.updateSession({ connectionState: 'online' });
      await this.processQueue();
      
      this.successfulSyncs++;
      const successRate = this.successfulSyncs / this.totalSyncAttempts;
      
      this.telemetry.emit({
        type: 'Metric',
        name: 'SyncSuccessRate',
        value: successRate,
        timestamp: new Date()
      });

      this.telemetry.emit({
        type: 'Metric',
        name: 'AverageSyncLatency',
        value: Date.now() - startTime,
        timestamp: new Date()
      });
      
    } catch (e) {
      this.updateSession({ connectionState: 'offline' });
    } finally {
      this.isSyncing = false;
    }
  }

  private async pullRemoteEvents() {
    const pullStart = Date.now();
    try {
      const newEvents = await this.transport.pullEventsSince({
        protocolVersion: 1,
        sequence: this.syncSession.watermark.serverSequence,
        clientId: this.clientId,
        sessionId: this.sessionId
      });

      if (newEvents.length > 0) {
        const writeStart = Date.now();
        if ('appendFromServer' in this.eventStore) {
          await (this.eventStore as IndexedDBEventStore).appendFromServer(newEvents);
        } else {
          for (const ev of newEvents) {
            await this.eventStore.appendBatch(ev.streamId, ev.expectedVersion - 1, [ev]).catch(() => {});
          }
        }
        
        this.telemetry.emit({
          type: 'Metric',
          name: 'IndexedDBWriteLatency',
          value: Date.now() - writeStart,
          timestamp: new Date()
        });
        
        const highestSeq = Math.max(...newEvents.map(e => e.globalSequence || 0));
        this.updateSession({ 
          watermark: { 
            clientSequence: highestSeq, // Once synced locally, client matches server 
            serverSequence: highestSeq 
          } 
        });
      }
      
      this.telemetry.emit({
        type: 'Metric',
        name: 'PullDuration',
        value: Date.now() - pullStart,
        timestamp: new Date()
      });
      
    } catch (e) {
      console.error('Failed to pull events:', e);
      throw e; // Bubble up to affect connection state
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.syncSession.connectionState === 'offline') return;
    this.isProcessingQueue = true;

    try {
      const pending = await this.commandQueue.getPendingCommands();
      
      for (const item of pending) {
        await this.commandQueue.updateStatus(item.id, 'sending');
        this.updateSession({ pendingCommands: 1 });
        
        try {
          const envelope: CommandEnvelope = {
            protocolVersion: 1,
            commandId: item.command.correlationId || item.id,
            correlationId: item.command.correlationId || item.id,
            clientId: this.clientId,
            sessionId: this.sessionId,
            payload: item.command
          };

          const serverEvents = await this.transport.sendCommand(envelope);
          
          await this.commandQueue.updateStatus(item.id, 'acknowledged');
          
          // Conflict Policy v1: Server Always Wins
          if ('appendFromServer' in this.eventStore && serverEvents.length > 0) {
            await (this.eventStore as IndexedDBEventStore).appendFromServer(serverEvents);
            const highestSeq = Math.max(...serverEvents.map(e => e.globalSequence || 0));
            if (highestSeq > this.syncSession.watermark.serverSequence) {
              this.updateSession({ 
                watermark: {
                  clientSequence: highestSeq,
                  serverSequence: highestSeq
                }
              });
            }
          }
          
          await this.commandQueue.updateStatus(item.id, 'completed');
          // For garbage collection, we can remove completed items
          await this.commandQueue.remove(item.id);

        } catch (e: any) {
          const errMsg = e.message || 'Unknown error';
          if (errMsg.includes('ConcurrencyError') || errMsg.includes('ValidationError')) {
            // Server permanently rejected the command
            await this.commandQueue.updateStatus(item.id, 'rejected', errMsg);
            
            this.telemetry.emit({
              type: 'Metric',
              name: 'RollbackFrequency',
              value: 1,
              timestamp: new Date()
            });

            await this.pullRemoteEvents(); // Server Wins: overwrite optimistic state
            
            await this.commandQueue.updateStatus(item.id, 'rolled-back');
            await this.commandQueue.remove(item.id);

            this.eventBus.publish({
              type: 'CommandFailed',
              correlationId: item.command.correlationId,
              message: errMsg,
              code: errMsg.includes('ConcurrencyError') ? 'CONCURRENCY' : 'VALIDATION'
            });
          } else {
            // Network failure during send
            await this.commandQueue.updateStatus(item.id, 'rejected', errMsg);
            
            this.telemetry.emit({
              type: 'Metric',
              name: 'RetryCount',
              value: 1,
              timestamp: new Date()
            });
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
      this.updateSession({ pendingCommands: 0 });
      await this.updateQueueStats();
    }
  }
}
