import { getTenantSupabaseClient } from '../utils/supabaseClient.js';
import { TenantContextManager } from '../kernel/tenant/TenantContextManager.js';
import { EventEmitter } from 'events';
import { ISystemEvent, StoredEvent } from '../types.js';

class OSEventBus extends EventEmitter {
  constructor() {
    super();
    // Increase limit for a large system
    this.setMaxListeners(100);
  }

  /**
   * Subscribes a service to specific business events.
   * e.g., EventBusService.subscribe('IntentResolved', WorkflowService.handleIntent);
   */
  subscribe(eventType: string, handler: (event: ISystemEvent) => void) {
    this.on(eventType, handler);
    console.log(`[EventBus] Subscribed handler to: ${eventType}`);
  }

  /**
   * Publishes a StoredEvent to all in-memory subscribers.
   * This is strictly for volatility/delivery, not persistence.
   */
  publishVolatile(event: StoredEvent) {
    console.log(`[EventBus] Broadcasting ${event.eventType} for Stream ${event.streamId}`);
    
    // Emit to generic wildcard listeners
    this.emit('*', event);
    
    // Emit to specific event type listeners
    this.emit(event.eventType, event);
  }

  private isMock = false;

  setMockMode(mock: boolean) {
    this.isMock = mock;
  }

  /**
   * Publishes an event. This is the SINGLE SOURCE OF TRUTH.
   * It writes permanently to the database (which triggers UI Realtime),
   * and optionally broadcasts to volatile listeners.
   */
  async publish(event: Omit<ISystemEvent, 'id' | 'createdAt'>, dispatchVolatile: boolean = true) {
    if (this.isMock) {
      console.log(`[EventBus] Mock mode active. Skipping DB persistence for: ${event.eventType}`);
      const mockEvent: ISystemEvent = {
        ...event,
        id: 'mock-' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };
      if (dispatchVolatile) {
        this.publishVolatile(mockEvent as unknown as StoredEvent);
      }
      return mockEvent;
    }

    try {
      const context = TenantContextManager.getContextOrThrow();
      const supabase = getTenantSupabaseClient(context.tenant);

      // 1. Permanent Persistence (Source of Truth)
      const { data, error } = await supabase
        .from('os_events')
        .insert([{
          event_type: event.eventType,
          payload: event.payload,
          source: event.source,
          actor_id: event.actorId,
          tenant_id: event.tenantId
        }])
        .select()
        .single();

      if (error) {
        console.error('Failed to persist event to DB:', error);
        throw error;
      }

      console.log(`[EventBus] DB Persisted: ${event.eventType} from ${event.source}`);

      // 2. Local Pub/Sub Broadcast (Triggers side effects like Workflow, Notifications, Indexing)
      const fullEvent: ISystemEvent = {
        id: data.id,
        eventType: data.event_type,
        payload: data.payload,
        source: data.source,
        actorId: data.actor_id,
        tenantId: data.tenant_id,
        createdAt: data.created_at
      };

      this.emit(event.eventType, fullEvent);
      // Also emit a catch-all for system-wide monitors
      this.emit('*', fullEvent);

      return fullEvent;
    } catch (err) {
      console.error('[EventBus] Error in publish:', err);
      throw err;
    }
  }

  /**
   * Universal Audit Log (Synchronous background trace)
   */
  async audit(objectType: string, objectId: string, action: string, previousState: any, newState: any, actorId: string, tenantId: string, source: string) {
    if (this.isMock) return;

    try {
      const context = TenantContextManager.getContextOrThrow();
      const supabase = getTenantSupabaseClient(context.tenant);

      const { error } = await supabase
        .from('os_audit_logs')
        .insert([{
          objectType,
          objectId,
          action,
          previousState,
          newState,
          actorId,
          tenantId,
          source
        }]);

      if (error) console.error(`[EventBus] Failed to write audit log: ${error.message}`);
    } catch (err: any) {
      if (err.message?.includes('fetch failed')) {
        console.warn(`[EventBus] Supabase offline. Mock Audit: ${action} on ${objectType}/${objectId}`);
        return;
      }
      console.error(`[EventBus] Failed to write audit log:`, err);
    }
  }
}

// Export a singleton instance of the bus
export const EventBus = new OSEventBus();
