import { KernelABI, KernelEvent } from '../abi/v1';
import { worldModel } from './WorldModel';
import { Transaction, GraphMutation } from './types';
import { randomUUID } from '../utils/id';

export class EventReducer {
  public boot(kernel: KernelABI): void {
    // Entity events
    kernel.subscribeEvents('entity.registered', this.handleEntityRegistered.bind(this));
    
    // Capability events
    kernel.subscribeEvents('capability.registered', this.handleCapabilityRegistered.bind(this));
    
    // Intent events
    kernel.subscribeEvents('intent.submitted', this.handleIntentSubmitted.bind(this));

    // Process events
    kernel.subscribeEvents('process.spawned', this.handleProcessSpawned.bind(this));
    kernel.subscribeEvents('process.retry_requested', this.handleRetryRequested.bind(this));
    kernel.subscribeEvents('process.completed', this.handleProcessStateChanged.bind(this));
    kernel.subscribeEvents('process.failed', this.handleProcessStateChanged.bind(this));
    kernel.subscribeEvents('process.cancelled', this.handleProcessStateChanged.bind(this));
    
    // Additional domain events will be mapped to mutations here...
  }

  private async handleEntityRegistered(event: KernelEvent): Promise<void> {
    const payload = event.payload as any;
    const now = Date.now();

    const tx: Transaction = {
      id: `tx_${randomUUID()}`,
      timestamp: now,
      mutations: [
        {
          type: 'UPSERT_NODE',
          node: {
            id: event.source as string,
            type: 'Entity',
            properties: payload,
            version: 1,
            createdAt: now,
            updatedAt: now
          }
        }
      ]
    };

    worldModel.applyTransaction(tx);
  }

  private async handleCapabilityRegistered(event: KernelEvent): Promise<void> {
    const payload = event.payload as any;
    const now = Date.now();
    const capabilityId = payload.id;

    const tx: Transaction = {
      id: `tx_${randomUUID()}`,
      timestamp: now,
      mutations: [
        {
          type: 'UPSERT_NODE',
          node: {
            id: capabilityId,
            type: 'Capability',
            properties: payload,
            version: 1,
            createdAt: now,
            updatedAt: now
          }
        }
      ]
    };

    // If a capability is registered, and the source is an entity, we can automatically draw an OFFERS edge.
    // However, the ABI capability.registered event currently fires with source="kernel" 
    // unless an entity registered it themselves.
    // We can allow KernelBootstrap to explicitly create 'OFFERS' edges via a 'graph.edge.created' event later,
    // or infer it if the source is an actual entity.
    
    worldModel.applyTransaction(tx);
  }

  private async handleIntentSubmitted(event: KernelEvent): Promise<void> {
    const payload = event.payload as any; // This is the full Intent object from KernelImpl
    const now = Date.now();
    const intentId = payload.id;

    const tx: Transaction = {
      id: `tx_${randomUUID()}`,
      timestamp: now,
      mutations: [
        {
          type: 'UPSERT_NODE',
          node: {
            id: intentId,
            type: 'Intent',
            properties: payload,
            version: 1,
            createdAt: now,
            updatedAt: now
          }
        }
      ]
    };

    worldModel.applyTransaction(tx);
  }

  private async handleProcessSpawned(event: KernelEvent): Promise<void> {
    const payload = event.payload as any; 
    const now = Date.now();
    const processId = event.content?.processId || payload.processId || (event as any).processId; 

    // We expect KernelImpl to pass processId in the event payload or at root level. 
    // Usually it's event.payload.processId in our spawnProcess implementation.

    const tx: Transaction = {
      id: `tx_${randomUUID()}`,
      timestamp: now,
      mutations: [
        {
          type: 'UPSERT_NODE',
          node: {
            id: processId,
            type: 'Process',
            properties: { id: processId, ...payload },
            version: 1,
            createdAt: now,
            updatedAt: now
          }
        }
      ]
    };

    worldModel.applyTransaction(tx);
  }

  private async handleRetryRequested(event: KernelEvent): Promise<void> {
    const payload = event.payload as any;
    const processId = event.content?.processId || payload.processId || (event as any).processId;
    if (!processId) return;

    const node = worldModel.getNode(processId);
    if (!node) return;

    const tx: Transaction = {
      id: `tx_${randomUUID()}`,
      timestamp: Date.now(),
      mutations: [
        {
          type: 'UPSERT_NODE',
          node: {
            ...node,
            properties: {
              ...node.properties,
              retriesAttempted: payload.currentRetry
            },
            updatedAt: Date.now()
          }
        }
      ]
    };

    worldModel.applyTransaction(tx);
  }

  private async handleProcessStateChanged(event: KernelEvent): Promise<void> {
    const payload = event.payload as any;
    const processId = event.content?.processId || payload.processId || (event as any).processId;
    if (!processId) return;

    const node = worldModel.getNode(processId);
    if (!node) return;

    let newState = 'UNKNOWN';
    if (event.type === 'process.completed') newState = 'COMPLETED';
    if (event.type === 'process.failed') newState = 'FAILED';
    if (event.type === 'process.cancelled') newState = 'CANCELLED';

    const tx: Transaction = {
      id: `tx_${randomUUID()}`,
      timestamp: Date.now(),
      mutations: [
        {
          type: 'UPSERT_NODE',
          node: {
            ...node,
            properties: {
              ...node.properties,
              state: newState,
              error: payload.error || payload.reason
            },
            updatedAt: Date.now()
          }
        }
      ]
    };

    worldModel.applyTransaction(tx);
  }
}

export const eventReducer = new EventReducer();
