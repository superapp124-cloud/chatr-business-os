/**
 * CHATR Kernel Runtime v2.0 — KernelAPI (Stable Public Surface)
 *
 * Layer 1 — Kernel
 *
 * This is the ONLY surface that the rest of the codebase touches.
 * All engine access goes through here. Internal engines can be refactored
 * freely as long as this API contract is maintained.
 *
 * API Versioning:
 *   v2.0 — initial production release
 *   Future versions will maintain backward compatibility or provide
 *   explicit migration paths.
 *
 * This file is a forward declaration used by IEngine.init().
 * The full implementation lives in Kernel.ts.
 */

import { CommandResult, TimelineEntry, RuntimeMode } from './types';
import { eventBus, EventBusImpl } from './EventBus';
import { commandBus, CommandBusImpl, COMMANDS } from './CommandBus';
import { stateStore, StateStoreImpl } from './StateStore';
import { cache, CacheLayerImpl } from './CacheLayer';
import { permissionManager, PermissionManagerImpl } from './PermissionManager';
import { serviceRegistry, ServiceRegistryImpl } from './ServiceRegistry';
import { featureFlags, FeatureFlagsManager } from './FeatureFlags';
import { securityManager, SecurityManagerImpl } from './SecurityManager';
import { identityManager, IdentityManagerImpl } from '../auth/IdentityManager';
import { workerPool, BackgroundWorkerPoolImpl } from './BackgroundWorkerPool';
import { runtimeManifest, RuntimeManifestLoader } from './RuntimeManifest';

// ─── KernelAPI ────────────────────────────────────────────────────────────────

export class KernelAPI {
  readonly version = '2.0';

  // ── Infrastructure (Layer 2) ──────────────────────────────────────────────
  readonly events: EventBusImpl = eventBus;
  readonly commands: CommandBusImpl = commandBus;
  readonly state: StateStoreImpl = stateStore;
  readonly cache: CacheLayerImpl = cache;
  readonly permissions: PermissionManagerImpl = permissionManager;
  readonly services: ServiceRegistryImpl = serviceRegistry;
  readonly flags: FeatureFlagsManager = featureFlags;
  readonly security: SecurityManagerImpl = securityManager;
  readonly identity: IdentityManagerImpl = identityManager;
  readonly workers: BackgroundWorkerPoolImpl = workerPool;
  readonly manifest: RuntimeManifestLoader = runtimeManifest;

  // ── Engine accessors (populated by Kernel.ts after engines boot) ──────────
  // These are typed as any here and overridden with proper types in Kernel.ts
  // to avoid circular imports between engines and the API.
  private _engines = new Map<string, { [key: string]: unknown }>();

  registerEngine(id: string, engine: object): void {
    this._engines.set(id, engine as { [key: string]: unknown });
  }

  getEngine<T = unknown>(id: string): T {
    const engine = this._engines.get(id);
    if (!engine) throw new Error(`[KernelAPI] Engine "${id}" not available`);
    return engine as T;
  }

  hasEngine(id: string): boolean {
    return this._engines.has(id);
  }

  // ── High-level convenience methods ────────────────────────────────────────

  /**
   * Execute any command through the CommandBus.
   * This is the primary execution entry point for all user intents.
   */
  async execute<TResult = unknown>(
    type: string,
    payload: unknown,
    opts?: { requestedBy?: string; rollback?: () => Promise<void> }
  ): Promise<CommandResult<TResult>> {
    return commandBus.dispatch<unknown, TResult>(type, payload, opts);
  }

  /**
   * Universal search across all data sources.
   * Delegates to SearchRankingEngine via engine accessor.
   */
  async search(query: string): Promise<unknown[]> {
    if (!this.hasEngine('SearchRankingEngine')) return [];
    const engine = this.getEngine<{ search(q: string): Promise<unknown[]> }>('SearchRankingEngine');
    return engine.search(query);
  }

  /**
   * Access memory engine for recall and storage.
   */
  get memory() {
    if (!this.hasEngine('MemoryEngine')) {
      return {
        recall: async (_query: string) => null,
        store: async () => {},
        getWorkingEntities: () => ({}),
      };
    }
    return this.getEngine<{
      recall(query: string): Promise<unknown>;
      store(key: string, value: unknown): Promise<void>;
      getWorkingEntities(): Record<string, unknown[]>;
    }>('MemoryEngine');
  }

  /**
   * Access timeline engine.
   */
  get timeline() {
    if (!this.hasEngine('TimelineEngine')) {
      return {
        getToday: () => [] as TimelineEntry[],
        getPast: (_days: number) => [] as TimelineEntry[],
        getFuture: () => [] as TimelineEntry[],
        getPredictions: () => [] as TimelineEntry[],
      };
    }
    return this.getEngine<{
      getToday(): TimelineEntry[];
      getPast(days: number): TimelineEntry[];
      getFuture(): TimelineEntry[];
      getPredictions(): TimelineEntry[];
      getForContact(contactId: string): TimelineEntry[];
    }>('TimelineEngine');
  }

  /**
   * Access AI engine for generation.
   */
  get ai() {
    if (!this.hasEngine('AIEngine')) {
      return { generate: async (_prompt: string) => '' };
    }
    return this.getEngine<{
      generate(prompt: string, opts?: { mode?: string }): Promise<{ response: string; confidence: number; reason: string }>;
      setMode(mode: string): void;
    }>('AIEngine');
  }

  /**
   * Access relationship engine.
   */
  get relationship() {
    if (!this.hasEngine('RelationshipEngine')) {
      return { get: async (_contactId: string) => null };
    }
    return this.getEngine<{
      get(contactId: string): Promise<unknown>;
      getScore(contactId: string): Promise<number>;
    }>('RelationshipEngine');
  }

  /**
   * Access call session engine.
   */
  get call() {
    if (!this.hasEngine('CallEngine')) {
      return { getActiveSession: () => null };
    }
    return this.getEngine<{
      // In a real implementation this would expose public getters to the session state
      // but commands/events are strictly used for mutations.
    }>('CallEngine');
  }

  // ── Runtime mode ──────────────────────────────────────────────────────────

  get runtimeMode(): RuntimeMode {
    return this.manifest.current.runtimeMode;
  }
}

// Singleton — populated by Kernel.ts during boot
export const kernelAPI = new KernelAPI();
