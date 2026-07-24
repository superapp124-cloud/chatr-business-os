/**
 * CHATR Kernel Runtime v2.0 — MemoryEngine
 *
 * Layer 3 — Core Engines
 *
 * Five-tier memory architecture:
 * 1. Working Memory      — current session entities (in-memory)
 * 2. Conversation Memory — N recent exchanges (IndexedDB)
 * 3. Relationship Memory — per-contact history (IndexedDB)
 * 4. Long-term Memory    — structured facts/prefs (IndexedDB)
 * 5. Semantic Memory     — entity relationships graph (IndexedDB)
 */

import { IEngine, EngineHealth, EngineStatus } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';
import { semanticMemory } from '../services/SemanticMemory';

interface MemoryItem {
  id: string;
  type: string;
  content: unknown;
  timestamp: number;
  source: string;
}

export class MemoryEngineImpl implements IEngine {
  readonly id = 'MemoryEngine';
  readonly version = '2.0.0';
  readonly kernelCompatibility = '>=2.0.0';
  readonly dependsOn = []; // base engine

  private _status: EngineStatus = 'stopped';
  private kernel!: KernelAPI;

  // Tier 1: Working Memory (in-memory only)
  private workingMemory = new Map<string, unknown>();

  status(): EngineStatus { return this._status; }
  ready(): boolean { return this._status === 'ready'; }
  metrics(): Record<string, number> { return {}; }

  async health(): Promise<EngineHealth> {
    return { status: this._status, lastChecked: Date.now() };
  }

  async init(api: KernelAPI): Promise<void> {
    this._status = 'booting';
    this.kernel = api;

    try {
      this.kernel.events.on('TRANSCRIPT_CHUNK_RECEIVED', (e) => {
        const payload = e.payload as { sessionId: string; text: string };
        const history = this.workingMemory.get(`call_${payload.sessionId}`) as string[] || [];
        history.push(payload.text);
        this.setWorking(`call_${payload.sessionId}`, history);
      });

      this._status = 'ready';
      this.kernel.events.publish('KERNEL_READY', { engine: this.id }, { priority: 'background' });
    } catch (err) {
      this._status = 'crashed';
      throw err;
    }
  }

  // ── Tier 1: Working Memory ────────────────────────────────────────────────

  setWorking(key: string, value: unknown): void {
    this.workingMemory.set(key, value);
    this.kernel.state.update('memory', s => ({
      workingEntities: { ...s.workingEntities, [key]: [value] }
    }));
  }

  getWorking<T>(key: string): T | null {
    return (this.workingMemory.get(key) as T) ?? null;
  }

  clearWorking(): void {
    this.workingMemory.clear();
    this.kernel.state.update('memory', () => ({ workingEntities: {} }));
  }

  // ── High-level Memory API ─────────────────────────────────────────────────

  async store(key: string, value: unknown): Promise<void> {
    // Store in semantic long-term memory
    await semanticMemory.store('doc', typeof value === 'string' ? value : JSON.stringify(value), { key });
    this.kernel.cache.delete(`memory:longterm:${key}`);
  }

  async recall(query: string): Promise<unknown | null> {
    // Check cache first
    const cached = this.kernel.cache.get(`memory:longterm:${query}`);
    if (cached) return cached;

    // Check Working Memory (fastest)
    const working = this.workingMemory.get(query);
    if (working) return working;

    // Check Semantic Memory
    const results = await semanticMemory.search(query, 'doc', 1);
    if (results.length > 0) {
      let val = results[0].content;
      try { val = JSON.parse(val); } catch (e) {}
      this.kernel.cache.set(`memory:longterm:${query}`, val, { ttl: 60000 });
      return val;
    }

    return null;
  }

  getWorkingEntities(): Record<string, unknown[]> {
    return this.kernel.state.get('memory').workingEntities;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async restart(): Promise<void> {
    await this.dispose();
    await this.init(this.kernel);
  }

  async dispose(): Promise<void> {
    this.workingMemory.clear();
    this._status = 'stopped';
  }
}

export const memoryEngine = new MemoryEngineImpl();
