import { randomUUID } from '../utils/id';
import type { Resource, ResourceId, ResourceRequirement, ResourceToken, IntentId, ResourceType } from '../abi/v1';
import { kernelBus } from '../core/EventBus'; // For publishing internal events if needed, but ABI publishEvent is preferred

export class ResourceScheduler {
  private resources = new Map<ResourceId, Resource>();

  constructor() {
    // Initialize with some default pools for testing
    this.createPool('api_quota', 'call', 10000);
    this.createPool('compute', 'ms', 1000000);
    this.createPool('network', 'bytes', 1000000000);
  }

  private createPool(type: ResourceType, unit: string, total: number): ResourceId {
    const id = `res_${randomUUID()}` as ResourceId;
    const pool: Resource = {
      id,
      type,
      owner: 'kernel' as any,
      total,
      allocated: 0,
      consumed: 0,
      unit,
      costPerUnit: 0,
      priority: 1.0,
    };
    this.resources.set(id, pool);
    return id;
  }

  public allocate(intentId: IntentId, requirements: ResourceRequirement[]): ResourceToken {
    const allocatedIds: ResourceId[] = [];

    for (const req of requirements) {
      let pool = Array.from(this.resources.values()).find(r => r.type === req.type);

      if (!pool) {
        pool = this.resources.get(this.createPool(req.type, req.unit, 1_000_000))!;
      }

      const available = pool.total - pool.allocated;
      if (available < req.amount) {
        throw new Error(
          `[ResourceScheduler] Insufficient ${req.type}: need ${req.amount} ${req.unit}, available ${available} ${req.unit}`
        );
      }

      this.resources.set(pool.id, { ...pool, allocated: pool.allocated + req.amount });
      allocatedIds.push(pool.id);
    }

    const token: ResourceToken = {
      id: `rt_${randomUUID()}`,
      intentId,
      resources: allocatedIds,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 min TTL
    };

    return token;
  }

  public release(token: ResourceToken): void {
    for (const resourceId of token.resources) {
      const pool = this.resources.get(resourceId);
      if (pool) {
        this.resources.set(resourceId, {
          ...pool,
          allocated: Math.max(0, pool.allocated - 1),
        });
      }
    }
  }

  public query(type?: ResourceType): Resource[] {
    let results = Array.from(this.resources.values());
    if (type) {
      results = results.filter(r => r.type === type);
    }
    return results;
  }
}
