/**
 * CHATR Kernel Runtime v2.0 — ServiceRegistry
 *
 * Layer 2 — Runtime Infrastructure
 *
 * Engines never instantiate services directly.
 * All services are registered here and accessed via the Kernel API.
 *
 * Benefits:
 * - Testing: swap a real service for a stub without changing engine code
 * - Provider swap: replace CalendarService implementation without touching consumers
 * - Lazy init: services are initialized once, on first request
 * - Health monitoring: RuntimeSupervisor pings all registered services
 *
 * Service Catalog:
 *   CalendarService     — Google + Outlook + Local calendar
 *   SupabaseService     — Auth + DB + Realtime
 *   StorageService      — Local file persistence
 *   NotificationService — Push + in-app notifications
 *   BrowserService      — URL open, clipboard, native share
 */

import { IService, ServiceHealth, ServiceStatus } from './types';

// ─── ServiceRegistry ──────────────────────────────────────────────────────────

class ServiceRegistryImpl {
  private services = new Map<string, IService>();
  private initialized = new Set<string>();
  private initPromises = new Map<string, Promise<void>>();

  // ── Register ──────────────────────────────────────────────────────────────

  register(service: IService): void {
    if (this.services.has(service.id)) {
      console.warn(`[ServiceRegistry] Service "${service.id}" already registered. Overwriting.`);
    }
    this.services.set(service.id, service);
  }

  registerMany(services: IService[]): void {
    for (const service of services) this.register(service);
  }

  // ── Get ───────────────────────────────────────────────────────────────────

  get<T extends IService>(id: string): T {
    const service = this.services.get(id);
    if (!service) {
      throw new Error(`[ServiceRegistry] Service "${id}" not registered`);
    }
    return service as T;
  }

  tryGet<T extends IService>(id: string): T | null {
    return (this.services.get(id) as T) ?? null;
  }

  has(id: string): boolean {
    return this.services.has(id);
  }

  // ── Initialize ────────────────────────────────────────────────────────────

  /** Initialize a single service (idempotent) */
  async initService(id: string): Promise<void> {
    if (this.initialized.has(id)) return;

    // Deduplicate concurrent init calls
    if (this.initPromises.has(id)) {
      return this.initPromises.get(id);
    }

    const service = this.services.get(id);
    if (!service) {
      console.warn(`[ServiceRegistry] Cannot init unknown service "${id}"`);
      return;
    }

    const promise = service.init()
      .then(() => {
        this.initialized.add(id);
        this.initPromises.delete(id);
        console.info(`[ServiceRegistry] ✓ ${id} initialized`);
      })
      .catch(err => {
        this.initPromises.delete(id);
        console.error(`[ServiceRegistry] ✗ ${id} failed to initialize:`, err);
        throw err;
      });

    this.initPromises.set(id, promise);
    return promise;
  }

  /** Initialize all registered services in parallel */
  async initAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.services.keys()).map(id => this.initService(id))
    );
  }

  /** Initialize only the services listed in the manifest */
  async initFromManifest(serviceIds: string[]): Promise<void> {
    await Promise.allSettled(
      serviceIds
        .filter(id => this.services.has(id))
        .map(id => this.initService(id))
    );
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async healthCheck(id: string): Promise<ServiceHealth> {
    const service = this.services.get(id);
    if (!service) return { status: 'unavailable', lastChecked: Date.now(), error: 'Not registered' };
    try {
      return await service.health();
    } catch (err) {
      return {
        status: 'unavailable',
        lastChecked: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async healthCheckAll(): Promise<Record<string, ServiceHealth>> {
    const results: Record<string, ServiceHealth> = {};
    await Promise.all(
      Array.from(this.services.keys()).map(async id => {
        results[id] = await this.healthCheck(id);
      })
    );
    return results;
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  async disposeAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.services.values()).map(s => s.dispose())
    );
    this.services.clear();
    this.initialized.clear();
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  getRegisteredIds(): string[] {
    return Array.from(this.services.keys());
  }

  getInitializedIds(): string[] {
    return Array.from(this.initialized);
  }
}

// ─── Service ID catalog ───────────────────────────────────────────────────────

export const SERVICE_IDS = {
  CALENDAR:      'CalendarService',
  SUPABASE:      'SupabaseService',
  STORAGE:       'StorageService',
  NOTIFICATION:  'NotificationService',
  BROWSER:       'BrowserService',
  EMAIL:         'EmailService',
  CALL:          'CallService',
} as const;

export const serviceRegistry = new ServiceRegistryImpl();
export type { ServiceRegistryImpl };
