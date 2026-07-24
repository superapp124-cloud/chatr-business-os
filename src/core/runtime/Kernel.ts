/**
 * CHATR Kernel Runtime v2.0 — Kernel
 *
 * Layer 1 — Kernel
 *
 * The master boot sequence.
 * 1. Reads RuntimeManifest
 * 2. Initializes Layer 2 (State, EventBus, Services)
 * 3. Resolves engine dependency graph
 * 4. Boots engines in order
 * 5. Hands over to RuntimeSupervisor
 */

import { IEngine } from './types';
import { kernelAPI } from './KernelAPI';
import { runtimeSupervisor } from './RuntimeSupervisor';
import { telemetry } from '../services/TelemetryService';

// Import all engine singletons directly for the boot registry
import { memoryEngine } from '../engines/MemoryEngine';
import { knowledgeEngine } from '../engines/KnowledgeEngine';
import { relationshipEngine } from '../engines/RelationshipEngine';
import { aiContextManager } from '../engines/AIContextManager';
import { aiEngine } from '../engines/AIEngine';
import { searchIndexer } from '../engines/SearchIndexer';
import { searchRankingEngine } from '../engines/SearchRankingEngine';
import { timelineEngine } from '../engines/TimelineEngine';
import { workflowEngine } from '../engines/WorkflowEngine';
import { dataSyncLayer } from '../engines/DataSyncLayer';
import { callEngine } from '../engines/CallEngine';
import { resourceManagerEngine } from '../engines/ResourceManagerEngine';

export class CHATRKernelImpl {
  private isBooted = false;
  
  // Registry of all available engines
  private engineRegistry = new Map<string, IEngine>([
    [memoryEngine.id, memoryEngine],
    [knowledgeEngine.id, knowledgeEngine],
    [relationshipEngine.id, relationshipEngine],
    [aiContextManager.id, aiContextManager],
    [aiEngine.id, aiEngine],
    [searchIndexer.id, searchIndexer],
    [searchRankingEngine.id, searchRankingEngine],
    [timelineEngine.id, timelineEngine],
    [workflowEngine.id, workflowEngine],
    [dataSyncLayer.id, dataSyncLayer],
    [callEngine.id, callEngine],
    [resourceManagerEngine.id, resourceManagerEngine],
  ]);

  async boot(): Promise<void> {
    if (this.isBooted) return;
    const startTime = Date.now();
    
    console.group('[Kernel] Boot Sequence Initiated');

    try {
      // 1. Load Manifest
      const manifest = kernelAPI.manifest.load();
      kernelAPI.state.update('runtime', () => ({
        kernelStatus: 'booting',
        runtimeMode: manifest.runtimeMode,
        startedAt: startTime,
        apiVersion: manifest.apiVersion
      }));

      // 2. Init Feature Flags
      kernelAPI.flags.init(manifest.runtimeMode, manifest.featureFlags);
      
      // 2.5 Init Telemetry
      console.log('[Kernel] Initializing telemetry...');
      telemetry.init();
      
      // 3. Init Security/Session
      kernelAPI.security.initSession('local-user'); // Hardcoded for now
      
      // 4. Init Permissions
      kernelAPI.permissions.initEnginePermissions();

      // 5. Init Services
      console.log('[Kernel] Initializing services...');
      const { adapters } = await import('../services/ServiceAdapters');
      kernelAPI.services.registerMany(Object.values(adapters));
      await kernelAPI.services.initFromManifest(manifest.services);

      // 6. Boot Engines (Resolving dependency order)
      console.log('[Kernel] Booting engines...');
      const enginesToBoot = this.resolveBootOrder(manifest.engines);
      
      for (const engineId of enginesToBoot) {
        const engine = this.engineRegistry.get(engineId);
        if (engine) {
          console.log(`  → Booting ${engine.id}...`);
          kernelAPI.events.publish('ENGINE_BOOT_START', { engineId });
          // Register in KernelAPI first so it can be accessed
          kernelAPI.registerEngine(engine.id, engine);
          // Init the engine
          await engine.init(kernelAPI);
          // Register with supervisor
          runtimeSupervisor.registerEngine(engine);
          kernelAPI.events.publish('ENGINE_BOOT_SUCCESS', { engineId });
        }
      }

      // 7. Start Supervisor
      runtimeSupervisor.start();

      this.isBooted = true;
      kernelAPI.state.update('runtime', () => ({ kernelStatus: 'ready' }));
      kernelAPI.events.publish('KERNEL_READY', { durationMs: Date.now() - startTime }, { priority: 'critical' });
      
      console.log(`[Kernel] Boot complete in ${Date.now() - startTime}ms`);
      console.groupEnd();
      
    } catch (err) {
      console.error('[Kernel] BOOT FAILED', err);
      kernelAPI.state.update('runtime', () => ({ kernelStatus: 'crashed' }));
      kernelAPI.events.publish('KERNEL_CRASHED', { error: String(err) }, { priority: 'critical' });
      console.groupEnd();
      throw err;
    }
  }

  // ── Dependency Resolution ──────────────────────────────────────────────────

  private resolveBootOrder(engineIds: string[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string, dependent?: string) => {
      if (!this.engineRegistry.has(id)) {
        const error = `[Kernel] CRITICAL: Missing dependency. Engine '${id}' required by '${dependent || 'Manifest'}'. Boot aborted.`;
        kernelAPI.security.logSystemEvent('BootFailed', { reason: error });
        throw new Error(error);
      }
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        const error = `[Kernel] CRITICAL: Circular dependency detected in engine: ${id}`;
        kernelAPI.security.logSystemEvent('BootFailed', { reason: error });
        throw new Error(error);
      }

      visiting.add(id);
      const engine = this.engineRegistry.get(id)!;
      
      // Simple version check stub (would use semver in real impl)
      if (engine.kernelCompatibility && !engine.kernelCompatibility.includes('2.0')) {
        const error = `[Kernel] CRITICAL: Engine '${id}' version mismatch. Requires ${engine.kernelCompatibility}. Boot aborted.`;
        kernelAPI.security.logSystemEvent('BootFailed', { reason: error });
        throw new Error(error);
      }

      for (const dep of engine.dependsOn) {
        visit(dep, id);
      }
      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of engineIds) {
      visit(id);
    }

    return order;
  }
}

export const kernel = new CHATRKernelImpl();
