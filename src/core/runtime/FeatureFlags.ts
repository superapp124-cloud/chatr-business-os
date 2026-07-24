/**
 * CHATR Kernel Runtime v2.0 — FeatureFlags
 *
 * Layer 2 — Runtime Infrastructure
 *
 * Independently toggleable capabilities. Each flag can be:
 * - Overridden by RuntimeManifest
 * - Overridden by localStorage (developer override)
 * - Restricted to specific RuntimeModes
 *
 * No flags are sent anywhere. Local only.
 */

import { FeatureFlagDef, RuntimeMode } from './types';

// ─── Flag definitions ─────────────────────────────────────────────────────────

const FLAG_DEFS: FeatureFlagDef[] = [
  {
    id: 'knowledge_graph',
    name: 'Knowledge Graph',
    description: 'Live entity extraction and graph visualization',
    defaultEnabled: true,
  },
  {
    id: 'ai_timeline',
    name: 'AI Timeline',
    description: 'AI-predicted future events and commitments',
    defaultEnabled: true,
  },
  {
    id: 'universal_search',
    name: 'Universal Search',
    description: 'Search across all data sources simultaneously',
    defaultEnabled: true,
  },
  {
    id: 'workspace_os',
    name: 'Workspace OS',
    description: 'Template-based workspace with AI builder',
    defaultEnabled: true,
  },
  {
    id: 'voice_copilot',
    name: 'Voice Copilot',
    description: 'Voice-activated AI assistant',
    defaultEnabled: false,
  },
  {
    id: 'healthcare_module',
    name: 'Healthcare Module',
    description: 'EHR, patient records, appointments',
    defaultEnabled: false,
    runtimeModes: ['enterprise'],
  },
  {
    id: 'use_kernel_timeline',
    name: 'Kernel Timeline Migration',
    description: 'Switch from Legacy Scheduler to Kernel Timeline Engine',
    defaultEnabled: false,
  },
  {
    id: 'use_kernel_contacts',
    name: 'Kernel Contacts Migration',
    description: 'Switch from Legacy Data to Kernel Relationship Engine',
    defaultEnabled: false,
  },
  {
    id: 'crm_module',
    name: 'CRM Module',
    description: 'Full CRM pipeline with deal tracking',
    defaultEnabled: true,
  },
  {
    id: 'distributed_events',
    name: 'Distributed Events',
    description: 'WebSocket event bus for multi-device sync',
    defaultEnabled: false,
  },
  {
    id: 'diagnostics_dashboard',
    name: 'Diagnostics Dashboard',
    description: 'Visual kernel health panel',
    defaultEnabled: false,
    runtimeModes: ['developer'],
  },
  {
    id: 'ai_agent_runtime',
    name: 'AI Agent Runtime',
    description: 'Multi-agent planner/executor pipeline',
    defaultEnabled: false,
    runtimeModes: ['developer', 'enterprise'],
  },
  {
    id: 'workflow_engine',
    name: 'Workflow Engine',
    description: 'Multi-step business process orchestration',
    defaultEnabled: true,
  },
  {
    id: 'semantic_memory',
    name: 'Semantic Memory',
    description: 'Long-lived structured knowledge across sessions',
    defaultEnabled: true,
  },
  {
    id: 'data_sync',
    name: 'Data Sync Layer',
    description: 'Offline-first sync with conflict resolution',
    defaultEnabled: true,
  },
  {
    id: 'plugin_system',
    name: 'Plugin System',
    description: 'Install and manage capability plugins',
    defaultEnabled: true,
  },
];

const STORAGE_KEY = 'chatr:feature_flags';

// ─── FeatureFlagsManager ──────────────────────────────────────────────────────

class FeatureFlagsManager {
  private flags: Map<string, boolean> = new Map();
  private defs: Map<string, FeatureFlagDef> = new Map();
  private currentMode: RuntimeMode = 'production';

  init(
    mode: RuntimeMode,
    manifestOverrides: Record<string, boolean> = {}
  ): void {
    this.currentMode = mode;

    for (const def of FLAG_DEFS) {
      this.defs.set(def.id, def);
    }

    // 1. Start with defaults
    for (const def of FLAG_DEFS) {
      let enabled = def.defaultEnabled;
      // Disable if restricted to specific modes and current mode isn't one of them
      if (def.runtimeModes && !def.runtimeModes.includes(mode)) {
        enabled = false;
      }
      this.flags.set(def.id, enabled);
    }

    // 2. Apply manifest overrides
    for (const [id, value] of Object.entries(manifestOverrides)) {
      if (this.defs.has(id)) {
        this.flags.set(id, value);
      }
    }

    // 3. Apply developer localStorage overrides (highest precedence, dev only)
    if (mode === 'developer') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const devOverrides = JSON.parse(stored) as Record<string, boolean>;
          for (const [id, value] of Object.entries(devOverrides)) {
            if (this.defs.has(id)) {
              this.flags.set(id, value);
            }
          }
        }
      } catch { /* non-fatal */ }
    }
  }

  isEnabled(flagId: string): boolean {
    return this.flags.get(flagId) ?? false;
  }

  enable(flagId: string): void {
    if (!this.defs.has(flagId)) {
      console.warn(`[FeatureFlags] Unknown flag: "${flagId}"`);
      return;
    }
    this.flags.set(flagId, true);
    this.persistDevOverride(flagId, true);
  }

  disable(flagId: string): void {
    if (!this.defs.has(flagId)) {
      console.warn(`[FeatureFlags] Unknown flag: "${flagId}"`);
      return;
    }
    this.flags.set(flagId, false);
    this.persistDevOverride(flagId, false);
  }

  toggle(flagId: string): boolean {
    const current = this.isEnabled(flagId);
    if (current) this.disable(flagId);
    else this.enable(flagId);
    return !current;
  }

  getAllFlags(): Array<{ id: string; name: string; enabled: boolean; description: string }> {
    return Array.from(this.defs.values()).map(def => ({
      id: def.id,
      name: def.name,
      description: def.description,
      enabled: this.flags.get(def.id) ?? false,
    }));
  }

  private persistDevOverride(flagId: string, value: boolean): void {
    if (this.currentMode !== 'developer') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const overrides = stored ? JSON.parse(stored) : {};
      overrides[flagId] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch { /* non-fatal */ }
  }
}

export const featureFlags = new FeatureFlagsManager();
export type { FeatureFlagsManager };
