/**
 * CHATR Kernel Runtime v2.0 — StateStore
 *
 * Layer 2 — Runtime Infrastructure
 *
 * Domain-partitioned reactive state. Each domain updates independently.
 * Components subscribe only to their domain → no unnecessary re-renders.
 *
 * Backed by a simple pub/sub store (no external dependency).
 * In Phase 3, this can be swapped for Zustand or Jotai transparently.
 */

import {
  ChatDomain, CallsDomain, ContactsDomain, WorkspaceDomain,
  MemoryDomain, KnowledgeDomain, SearchDomain, SchedulerDomain,
  NotificationsDomain, RuntimeDomain
} from './types';

// ─── Full state shape ─────────────────────────────────────────────────────────

export interface CHATRState {
  chat:          ChatDomain;
  calls:         CallsDomain;
  contacts:      ContactsDomain;
  workspace:     WorkspaceDomain;
  memory:        MemoryDomain;
  knowledge:     KnowledgeDomain;
  search:        SearchDomain;
  scheduler:     SchedulerDomain;
  notifications: NotificationsDomain;
  runtime:       RuntimeDomain;
}

const INITIAL_STATE: CHATRState = {
  chat: {
    activeConversationId: null,
    typingContactIds: [],
    unreadCount: 0,
  },
  calls: {
    activeCallId: null,
    callStatus: 'idle',
    callHistory: [],
  },
  contacts: {
    activeContactId: null,
    searchQuery: '',
  },
  workspace: {
    activeWorkspaceId: null,
    activeModules: [],
  },
  memory: {
    workingEntities: {},
    sessionId: '',
  },
  knowledge: {
    nodes: [],
    edges: [],
    lastExtracted: 0,
  },
  search: {
    query: '',
    results: [],
    indexStatus: 'idle',
    lastIndexed: 0,
  },
  scheduler: {
    entries: [],
    todayCount: 0,
  },
  notifications: {
    unread: [],
    read: [],
  },
  runtime: {
    kernelStatus: 'booting',
    engineStatuses: {},
    serviceStatuses: {},
    runtimeMode: 'production',
    startedAt: 0,
    apiVersion: '2.0',
  },
};

type DomainKey = keyof CHATRState;
type DomainListener<K extends DomainKey> = (domain: CHATRState[K]) => void;

// ─── StateStore ───────────────────────────────────────────────────────────────

class StateStoreImpl {
  private state: CHATRState = structuredClone(INITIAL_STATE);
  // Listeners per domain
  private listeners = new Map<DomainKey, Set<DomainListener<DomainKey>>>();

  // ── Read ──────────────────────────────────────────────────────────────────

  get<K extends DomainKey>(domain: K): CHATRState[K] {
    return this.state[domain];
  }

  getAll(): Readonly<CHATRState> {
    return this.state;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  update<K extends DomainKey>(
    domain: K,
    updater: (current: CHATRState[K]) => Partial<CHATRState[K]>
  ): void {
    const current = this.state[domain];
    const patch = updater(current);
    this.state[domain] = { ...current, ...patch };
    this.notify(domain);
  }

  set<K extends DomainKey>(domain: K, value: CHATRState[K]): void {
    this.state[domain] = value;
    this.notify(domain);
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────

  subscribe<K extends DomainKey>(
    domain: K,
    listener: DomainListener<K>
  ): () => void {
    if (!this.listeners.has(domain)) {
      this.listeners.set(domain, new Set());
    }
    const domainListeners = this.listeners.get(domain)!;
    domainListeners.add(listener as DomainListener<DomainKey>);
    // Immediately call with current state
    listener(this.state[domain]);
    return () => domainListeners.delete(listener as DomainListener<DomainKey>);
  }

  private notify(domain: DomainKey): void {
    const domainListeners = this.listeners.get(domain);
    if (!domainListeners) return;
    const value = this.state[domain];
    for (const listener of domainListeners) {
      try { listener(value); } catch (err) {
        console.error(`[StateStore] Listener error in domain "${domain}":`, err);
      }
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  reset(): void {
    this.state = structuredClone(INITIAL_STATE);
    // Notify all domains
    for (const domain of Object.keys(this.state) as DomainKey[]) {
      this.notify(domain);
    }
  }

  resetDomain<K extends DomainKey>(domain: K): void {
    this.state[domain] = structuredClone(INITIAL_STATE[domain]);
    this.notify(domain);
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────

  snapshot<K extends DomainKey>(domain: K): CHATRState[K] {
    return structuredClone(this.state[domain]);
  }

  restore<K extends DomainKey>(domain: K, snapshot: CHATRState[K]): void {
    this.state[domain] = structuredClone(snapshot);
    this.notify(domain);
  }
}

export const stateStore = new StateStoreImpl();
export type { StateStoreImpl };
