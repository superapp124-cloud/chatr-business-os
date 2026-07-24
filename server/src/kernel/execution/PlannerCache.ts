import { ICapabilityWorkflow, ExecutionPlan } from '../../types.js';

interface CacheEntry {
  capabilityId: string;
  workflow: ICapabilityWorkflow;
  template: ExecutionPlan;
}

export class PlannerCache {
  private cache = new Map<string, CacheEntry>();

  get(cacheKey: string): CacheEntry | undefined {
    return this.cache.get(cacheKey);
  }

  set(cacheKey: string, entry: CacheEntry) {
    this.cache.set(cacheKey, entry);
  }

  generateKey(action: string): string {
    // E.g., Sales.CreateLead
    return action.trim().toLowerCase();
  }
}

export const GlobalPlannerCache = new PlannerCache();
