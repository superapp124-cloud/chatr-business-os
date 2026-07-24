/**
 * CHATR Kernel Runtime v2.0 — RuntimeSupervisor
 *
 * Layer 1 — Kernel
 *
 * Monitors health of all running engines and services.
 * Implements crash recovery (restart isolated engines without tearing down the Kernel).
 */

import { IEngine, IService } from './types';
import { kernelAPI } from './KernelAPI';

export class RuntimeSupervisorImpl {
  private engines = new Map<string, IEngine>();
  private services = new Map<string, IService>();
  private intervalId?: number;

  start(): void {
    // Check health every 30 seconds
    this.intervalId = window.setInterval(() => this.checkHealth(), 30_000);
    console.info('[RuntimeSupervisor] Started health monitoring');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  registerEngine(engine: IEngine): void {
    this.engines.set(engine.id, engine);
  }

  registerService(service: IService): void {
    this.services.set(service.id, service);
  }

  private async checkHealth(): Promise<void> {
    const engineUpdates: Record<string, import('./types').EngineStatus> = {};
    const serviceUpdates: Record<string, import('./types').ServiceStatus> = {};

    let hasCrash = false;

    // Check Engines
    for (const [id, engine] of this.engines.entries()) {
      try {
        const health = await engine.health();
        engineUpdates[id] = health.status;
        
        if (health.status === 'crashed') {
          hasCrash = true;
          this.handleEngineCrash(engine);
        }
      } catch (err) {
        engineUpdates[id] = 'crashed';
        hasCrash = true;
        this.handleEngineCrash(engine);
      }
    }

    // Check Services
    for (const [id, service] of this.services.entries()) {
      try {
        const health = await service.health();
        serviceUpdates[id] = health.status;
      } catch (err) {
        serviceUpdates[id] = 'unavailable';
      }
    }

    // Update global state
    kernelAPI.state.update('runtime', (s) => ({
      engineStatuses: { ...s.engineStatuses, ...engineUpdates },
      serviceStatuses: { ...s.serviceStatuses, ...serviceUpdates },
      kernelStatus: hasCrash ? 'degraded' : s.kernelStatus === 'degraded' ? 'ready' : s.kernelStatus
    }));
  }

  private async handleEngineCrash(engine: IEngine): Promise<void> {
    console.error(`[RuntimeSupervisor] Engine CRASH detected: ${engine.id}. Attempting restart...`);
    kernelAPI.events.publish('CRASH_DETECTED', { component: engine.id }, { priority: 'critical', source: 'supervisor' });

    try {
      await engine.restart();
      console.info(`[RuntimeSupervisor] Engine ${engine.id} successfully restarted.`);
    } catch (err) {
      console.error(`[RuntimeSupervisor] Failed to restart ${engine.id}:`, err);
      // Wait before next attempt or require manual intervention
    }
  }
}

export const runtimeSupervisor = new RuntimeSupervisorImpl();
