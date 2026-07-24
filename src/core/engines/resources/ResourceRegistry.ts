export type ResourceState = 'UNLOADED' | 'LOADING' | 'READY' | 'BUSY' | 'IDLE' | 'UNLOADING';
export type ResourceType = 'ai_model' | 'browser_session' | 'container' | 'memory_cache' | 'embedding_model' | 'gpu_resource';

export interface ResourceMetadata {
  id: string;
  providerId: string;
  type: ResourceType;
  sizeGB?: number;
  loadTimeMs?: number;
  lastUsedMs: number;
  state: ResourceState;
  memoryUsageBytes: number;
}

export class ResourceRegistryImpl {
  private resources = new Map<string, ResourceMetadata>();

  register(resource: ResourceMetadata) {
    this.resources.set(resource.id, resource);
  }

  get(id: string): ResourceMetadata | undefined {
    return this.resources.get(id);
  }

  getAll(): ResourceMetadata[] {
    return Array.from(this.resources.values());
  }

  updateState(id: string, state: ResourceState) {
    const res = this.resources.get(id);
    if (res) {
      res.state = state;
    }
  }

  updateLastUsed(id: string, timestamp: number = Date.now()) {
    const res = this.resources.get(id);
    if (res) {
      res.lastUsedMs = timestamp;
    }
  }

  remove(id: string) {
    this.resources.delete(id);
  }
}

export const resourceRegistry = new ResourceRegistryImpl();
