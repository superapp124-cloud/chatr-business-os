/**
 * CHATR OS — Seed Engine
 * Loads initial data into the BusinessObjectRepository on capability install.
 * Ensures seed data only loads once (not duplicated on reinstall).
 */
import { ISeedData } from '../types';

const SEED_KEY = 'chatr_seed_loaded';

export const SeedEngine = {
  async seed(capabilityId: string, seedData: ISeedData): Promise<void> {
    const loaded = new Set(JSON.parse(localStorage.getItem(SEED_KEY) ?? '[]'));
    if (loaded.has(capabilityId)) return; // already seeded
    
    for (const seedRecord of seedData.objects) {
      const storeKey = `chatr_bor_${capabilityId}_${seedRecord.object}`;
      const existing = JSON.parse(localStorage.getItem(storeKey) ?? '[]');
      if (existing.length > 0) continue; // don't overwrite existing data
      
      const records = seedRecord.data.map((d, i) => ({
        id: `seed_${i + 1}_${Date.now()}`,
        ...d,
        _createdAt: new Date().toISOString(),
        _updatedAt: new Date().toISOString(),
        _createdBy: 'system',
        _seeded: true,
      }));
      
      localStorage.setItem(storeKey, JSON.stringify(records));
    }
    
    loaded.add(capabilityId);
    localStorage.setItem(SEED_KEY, JSON.stringify([...loaded]));
  },
  
  clearSeedFlag(capabilityId: string): void {
    const loaded = new Set(JSON.parse(localStorage.getItem(SEED_KEY) ?? '[]'));
    loaded.delete(capabilityId);
    localStorage.setItem(SEED_KEY, JSON.stringify([...loaded]));
  },
};
