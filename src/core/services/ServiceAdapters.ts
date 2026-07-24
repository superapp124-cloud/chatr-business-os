/**
 * CHATR Kernel Runtime v2.0 — Service Adapters
 *
 * Layer 4 — Services
 *
 * Adapts existing CHATR services to the Kernel v2.0 IService interface.
 * These are registered into the ServiceRegistry during boot.
 */

import { IService, ServiceHealth } from '../runtime/types';
import { calendarService } from './CalendarService';
import { osScheduler } from './OSSchedulerService';

export class CalendarServiceAdapter implements IService {
  readonly id = 'CalendarService';
  readonly version = '2.0.0';

  async init(): Promise<void> {
    // calendarService initializes itself on import/first use in the current architecture.
    // We just wrap it here.
    return Promise.resolve();
  }

  async health(): Promise<ServiceHealth> {
    const connected = calendarService.getConnections();
    return {
      status: 'ready',
      lastChecked: Date.now(),
      // could enrich this with real provider pings later
    };
  }

  async dispose(): Promise<void> {
    // no-op for now
  }
  
  // Expose the underlying service for direct API access if needed by legacy code, 
  // though new code should use CommandBus.
  get legacy() { return calendarService; }
}

export class SupabaseServiceAdapter implements IService {
  readonly id = 'SupabaseService';
  readonly version = '2.0.0';

  async init(): Promise<void> {
    const { eventRuntime } = await import('../runtime/EventRuntime');
    const { SupabaseEventStore } = await import('../runtime/adapters/SupabaseEventStore');
    const { setWorkflowStateStore } = await import('../runtime/WorkflowStateStore');
    const { SupabaseStateStore } = await import('../runtime/adapters/SupabaseStateStore');
    
    // Inject Event Store
    const eventStore = new SupabaseEventStore();
    eventRuntime.setStoreAdapter(eventStore);
    
    // Inject State Store
    const stateStore = new SupabaseStateStore();
    setWorkflowStateStore(stateStore);
    
    // Enable Realtime bindings (Stage 1.3)
    eventStore.enableRealtimeBroadcast();
  }

  async health(): Promise<ServiceHealth> {
    return { status: 'ready', lastChecked: Date.now() };
  }

  async dispose(): Promise<void> {}
}

export class StorageServiceAdapter implements IService {
  readonly id = 'StorageService';
  readonly version = '2.0.0';

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async health(): Promise<ServiceHealth> {
    return { status: 'ready', lastChecked: Date.now() };
  }

  async dispose(): Promise<void> {}
}

export class NotificationServiceAdapter implements IService {
  readonly id = 'NotificationService';
  readonly version = '2.0.0';

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async health(): Promise<ServiceHealth> {
    return { status: 'ready', lastChecked: Date.now() };
  }

  async dispose(): Promise<void> {}
}

export class BrowserServiceAdapter implements IService {
  readonly id = 'BrowserService';
  readonly version = '2.0.0';

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async health(): Promise<ServiceHealth> {
    return { status: 'ready', lastChecked: Date.now() };
  }

  async dispose(): Promise<void> {}
}

export class SchedulerServiceAdapter implements IService {
  readonly id = 'SchedulerService';
  readonly version = '2.0.0';

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async health(): Promise<ServiceHealth> {
    return { status: 'ready', lastChecked: Date.now() };
  }

  async dispose(): Promise<void> {}
  
  get legacy() { return osScheduler; }
}

// Instantiate and export all adapters
export const adapters = {
  calendar: new CalendarServiceAdapter(),
  supabase: new SupabaseServiceAdapter(),
  storage: new StorageServiceAdapter(),
  notification: new NotificationServiceAdapter(),
  browser: new BrowserServiceAdapter(),
  scheduler: new SchedulerServiceAdapter(),
};
