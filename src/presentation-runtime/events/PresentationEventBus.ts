import { SyncStatus, ErrorCode } from '../contracts/UIContracts';

import { InstallStatus } from '../marketplace/runtime/CapabilityRuntime';

export type PresentationEvent = 
  | { type: 'ProjectionRecovered' }
  | { type: 'ProjectionLagChanged'; lag: number }
  | { type: 'CapabilityInstalled'; packId: string }
  | { type: 'CapabilityRemoved'; packId: string }
  | { type: 'InstallProgressEvent'; payload: InstallStatus }
  | { type: 'SyncStateChanged'; status: SyncStatus }
  | { type: 'CommandCompleted'; eventId: string; aggregateId: string; durationMs: number; correlationId?: string }
  | { type: 'CommandFailed'; code: ErrorCode; message: string; durationMs: number; correlationId?: string };

export type VersionedPresentationEvent = PresentationEvent & { _v: number };

export type Unsubscribe = () => void;
type EventHandler = (event: VersionedPresentationEvent) => void;

export class PresentationEventBus {
    private listeners: Map<PresentationEvent['type'], Set<EventHandler>> = new Map();
    private allListeners: Set<EventHandler> = new Set();

    publish(event: PresentationEvent): void {
        const versionedEvent = { ...event, _v: 1 } as VersionedPresentationEvent;
        
        const typeListeners = this.listeners.get(event.type);
        if (typeListeners) {
            typeListeners.forEach(handler => {
                try { handler(versionedEvent); } catch (e) { console.error('EventBus listener error', e); }
            });
        }
        
        this.allListeners.forEach(handler => {
            try { handler(versionedEvent); } catch (e) { console.error('EventBus global listener error', e); }
        });
    }

    subscribe(type: PresentationEvent['type'], handler: EventHandler): Unsubscribe {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type)!.add(handler);
        return () => {
            this.listeners.get(type)?.delete(handler);
        };
    }

    subscribeAll(handler: EventHandler): Unsubscribe {
        this.allListeners.add(handler);
        return () => {
            this.allListeners.delete(handler);
        };
    }
}
