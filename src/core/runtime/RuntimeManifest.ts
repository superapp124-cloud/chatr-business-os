/**
 * CHATR Kernel Runtime v2.0 — RuntimeManifest
 *
 * Layer 2 — Runtime Infrastructure
 *
 * Configuration-driven boot definition.
 * The Kernel reads this manifest instead of having engines hardcoded.
 * Makes boot order, enabled features, and runtime mode fully declarative.
 */

import { RuntimeManifest, RuntimeMode } from './types';

// ─── Default manifests per runtime mode ──────────────────────────────────────

const PRODUCTION_MANIFEST: RuntimeManifest = {
  kernelVersion: '2.0.0',
  apiVersion: '2.0',
  runtimeMode: 'production',
  engines: [
    // Ordered by rough dependency (Kernel resolves exact order via dependsOn[])
    'MemoryEngine',
    'KnowledgeEngine',
    'RelationshipEngine',
    'TimelineEngine',
    'CallEngine',
    'SearchIndexer',
    'SearchRankingEngine',
    'AIContextManager',
    'AIEngine',
    'ResourceManagerEngine',
    'WorkflowEngine',
    'DataSyncLayer',
  ],
  services: [
    'CalendarService',
    'SupabaseService',
    'StorageService',
    'NotificationService',
    'BrowserService',
  ],
  plugins: [],
  featureFlags: {
    knowledge_graph:    true,
    ai_timeline:        true,
    universal_search:   true,
    workspace_os:       true,
    crm_module:         true,
    workflow_engine:    true,
    semantic_memory:    true,
    data_sync:          true,
    plugin_system:      true,
    diagnostics_dashboard: false,
    voice_copilot:      false,
    healthcare_module:  false,
    ai_agent_runtime:   false,
    distributed_events: false,
  },
  telemetryEnabled: false,
  persistence: 'indexedDB',
};

const DEVELOPER_MANIFEST: RuntimeManifest = {
  ...PRODUCTION_MANIFEST,
  runtimeMode: 'developer',
  featureFlags: {
    ...PRODUCTION_MANIFEST.featureFlags,
    diagnostics_dashboard: true,
    ai_agent_runtime:      true,
    distributed_events:    false, // still off, needs WebSocket server
    voice_copilot:         true,
  },
  telemetryEnabled: true,
};

const OFFLINE_MANIFEST: RuntimeManifest = {
  ...PRODUCTION_MANIFEST,
  runtimeMode: 'offline',
  services: [
    'StorageService',    // Supabase removed in offline mode
    'NotificationService',
  ],
  featureFlags: {
    ...PRODUCTION_MANIFEST.featureFlags,
    data_sync:          false,  // no sync in offline
    distributed_events: false,
  },
};

const ENTERPRISE_MANIFEST: RuntimeManifest = {
  ...PRODUCTION_MANIFEST,
  runtimeMode: 'enterprise',
  featureFlags: {
    ...PRODUCTION_MANIFEST.featureFlags,
    healthcare_module:   true,
    ai_agent_runtime:    true,
    distributed_events:  true,
    diagnostics_dashboard: true,
  },
  telemetryEnabled: true,
};

const GUEST_MANIFEST: RuntimeManifest = {
  ...PRODUCTION_MANIFEST,
  runtimeMode: 'guest',
  engines: [
    'KnowledgeEngine',
    'AIContextManager',
    'AIEngine',
  ],
  services: [],
  featureFlags: {
    knowledge_graph:    true,
    ai_timeline:        false,
    universal_search:   false,
    workspace_os:       false,
    crm_module:         false,
    workflow_engine:    false,
    semantic_memory:    false,
    data_sync:          false,
    plugin_system:      false,
    diagnostics_dashboard: false,
    voice_copilot:      false,
    healthcare_module:  false,
    ai_agent_runtime:   false,
    distributed_events: false,
  },
  telemetryEnabled: false,
};

const DEMO_MANIFEST: RuntimeManifest = {
  ...PRODUCTION_MANIFEST,
  runtimeMode: 'demo',
  persistence: 'localStorage', // demo uses localStorage only
};

const MANIFESTS: Record<RuntimeMode, RuntimeManifest> = {
  production: PRODUCTION_MANIFEST,
  developer:  DEVELOPER_MANIFEST,
  offline:    OFFLINE_MANIFEST,
  enterprise: ENTERPRISE_MANIFEST,
  guest:      GUEST_MANIFEST,
  demo:       DEMO_MANIFEST,
};

// ─── RuntimeManifestLoader ────────────────────────────────────────────────────

class RuntimeManifestLoader {
  private active: RuntimeManifest = PRODUCTION_MANIFEST;

  load(mode?: RuntimeMode): RuntimeManifest {
    const resolvedMode = mode ?? this.detectMode();
    this.active = MANIFESTS[resolvedMode] ?? PRODUCTION_MANIFEST;
    console.info(`[Manifest] Loaded: ${this.active.runtimeMode} / Kernel ${this.active.kernelVersion} / API ${this.active.apiVersion}`);
    return this.active;
  }

  /** Patch the active manifest at runtime (used by tests or admin panel) */
  patch(overrides: Partial<RuntimeManifest>): void {
    this.active = { ...this.active, ...overrides };
  }

  get current(): RuntimeManifest { return this.active; }

  private detectMode(): RuntimeMode {
    // 1. URL param (e.g. ?mode=developer)
    try {
      const param = new URLSearchParams(window.location.search).get('mode');
      if (param && param in MANIFESTS) return param as RuntimeMode;
    } catch { /* SSR guard */ }

    // 2. Environment variable
    let envMode: string | undefined = undefined;
    let isDev = false;
    
    if (typeof process !== 'undefined' && process.env) {
      envMode = process.env.VITE_RUNTIME_MODE;
      isDev = process.env.NODE_ENV !== 'production';
    } else if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      envMode = (import.meta as any).env.VITE_RUNTIME_MODE;
      isDev = (import.meta as any).env.DEV;
    }

    if (envMode && envMode in MANIFESTS) return envMode as RuntimeMode;

    // 3. Default
    return isDev ? 'developer' : 'production';
  }
}

export const runtimeManifest = new RuntimeManifestLoader();
export type { RuntimeManifestLoader };
