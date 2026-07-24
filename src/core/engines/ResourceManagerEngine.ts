import { IEngine, EngineStatus, EngineHealth } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';
import { resourceRegistry, ResourceMetadata } from './resources/ResourceRegistry';
import { providerRegistry } from '../providers/ProviderRegistry';
import { IAIProvider } from '../ai/providers/IAIProvider';

export class ResourceManagerEngineImpl implements IEngine {
  readonly id = 'ResourceManagerEngine';
  readonly version = '1.0.0';
  readonly kernelCompatibility = '>=2.0.0';
  readonly dependsOn = [];
  
  private _status: EngineStatus = 'stopped';
  private kernel!: KernelAPI;
  private unloadTimers = new Map<string, ReturnType<typeof setTimeout>>();

  status(): EngineStatus { return this._status; }
  ready(): boolean { return this._status === 'ready'; }
  metrics(): Record<string, number> { return { managedResources: resourceRegistry.getAll().length }; }

  async health(): Promise<EngineHealth> {
    return { status: this._status, lastChecked: Date.now() };
  }

  async init(api: KernelAPI): Promise<void> {
    this._status = 'booting';
    this.kernel = api;
    
    // Subscribe to AI Inference events
    this.kernel.events.subscribe('AI_INFERENCE_START', this.handleInferenceStart.bind(this));
    this.kernel.events.subscribe('AI_INFERENCE_COMPLETE', this.handleInferenceComplete.bind(this));
    
    // Subscribe to OS Memory Pressure event
    this.kernel.events.subscribe('OS_MEMORY_PRESSURE', this.handleMemoryPressure.bind(this));

    this._status = 'ready';
  }

  private getIdleTimeoutMs(): number {
    // Dynamic timeout resolution based on runtimeMode (dev vs prod vs battery)
    const mode = this.kernel.state.select('runtime')?.runtimeMode || 'production';
    if (mode === 'development') return 15 * 60 * 1000; // 15 mins
    if (mode === 'battery') return 2 * 60 * 1000;      // 2 mins
    return 5 * 60 * 1000;                              // 5 mins (production)
  }

  private handleInferenceStart(evt: any) {
    const { providerId, model } = evt.payload || evt.detail || evt;
    if (!model) return;

    // Register or update resource state
    let res = resourceRegistry.get(model);
    if (!res) {
      res = {
        id: model,
        providerId,
        type: 'ai_model',
        state: 'BUSY',
        lastUsedMs: Date.now(),
        memoryUsageBytes: 0
      };
      resourceRegistry.register(res);
    } else {
      resourceRegistry.updateState(model, 'BUSY');
      resourceRegistry.updateLastUsed(model);
    }

    // Cancel any pending unload timer
    const existingTimer = this.unloadTimers.get(model);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.unloadTimers.delete(model);
    }
  }

  private handleInferenceComplete(evt: any) {
    const { model } = evt.payload || evt.detail || evt;
    if (!model) return;

    resourceRegistry.updateState(model, 'IDLE');
    resourceRegistry.updateLastUsed(model);

    // Schedule unload
    const timeoutMs = this.getIdleTimeoutMs();
    
    const timer = setTimeout(() => {
      this.unloadResource(model);
    }, timeoutMs);

    this.unloadTimers.set(model, timer);
  }

  private async unloadResource(id: string) {
    const res = resourceRegistry.get(id);
    if (!res || res.state === 'UNLOADED') return;

    resourceRegistry.updateState(id, 'UNLOADING');

    // Find the provider and call unloadModel
    try {
      const providers = providerRegistry.getProvidersByType('ai') as IAIProvider[];
      const provider = providers.find(p => p.id === res.providerId);
      
      if (provider && provider.unloadModel) {
        await provider.unloadModel(id);
      }

      resourceRegistry.updateState(id, 'UNLOADED');
      this.unloadTimers.delete(id);
      console.log(`[ResourceManagerEngine] Successfully unloaded idle resource: ${id}`);
    } catch (e) {
      console.error(`[ResourceManagerEngine] Failed to unload resource ${id}`, e);
      resourceRegistry.updateState(id, 'IDLE'); // Revert state
    }
  }

  private handleMemoryPressure() {
    console.warn('[ResourceManagerEngine] OS_MEMORY_PRESSURE detected! Evicting idle resources.');
    
    const idleResources = resourceRegistry.getAll().filter(r => r.state === 'IDLE');
    
    // Evict all idle resources (could be optimized to sort by size and evict largest first)
    for (const res of idleResources) {
      const timer = this.unloadTimers.get(res.id);
      if (timer) {
        clearTimeout(timer);
        this.unloadTimers.delete(res.id);
      }
      this.unloadResource(res.id);
    }
  }

  async restart(): Promise<void> {
    await this.dispose();
    await this.init(this.kernel);
  }

  async dispose(): Promise<void> {
    this._status = 'stopped';
    for (const timer of this.unloadTimers.values()) {
      clearTimeout(timer);
    }
    this.unloadTimers.clear();
  }
}

export const resourceManagerEngine = new ResourceManagerEngineImpl();
