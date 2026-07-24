import { eventBus } from '@/core/runtime/EventBus';
import { IEvent, IService } from '../Shared/Types';
import { Logger } from './Logger';

type EventHandler = (event: IEvent) => Promise<void> | void;

class EventBusService implements IService {
  name = 'EventBus';
  dependencies: string[] = [];

  async initialize(): Promise<void> {
    Logger.info('[EventBus] Initialized.');
  }

  subscribe(eventType: string, handler: EventHandler): () => void {
    return eventBus.on(eventType, (evt) => {
      handler({
        id: evt.id,
        type: evt.type,
        payload: evt.payload,
        timestamp: evt.timestamp,
        priority: (evt.priority === 'background' ? 'low' : evt.priority) as any,
        persistent: evt.persist
      });
    });
  }

  async publish(type: string, payload: any, options: { priority?: 'low'|'normal'|'high'|'critical', persistent?: boolean } = {}): Promise<void> {
    Logger.debug(`[EventBus] Publishing ${type}`, { priority: options.priority });
    
    let priority: any = options.priority;
    if (priority === 'low') priority = 'background';
    
    eventBus.publish(type, payload, { priority });
  }
}

export const EventBus = new EventBusService();

