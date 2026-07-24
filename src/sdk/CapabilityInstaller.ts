/**
 * CHATR OS — Capability Installer
 *
 * Orchestrates the 10-step installation pipeline for any capability.
 * After install(), the capability is a fully working application.
 */

import { ICapabilitySDK } from './types';
import { SeedEngine } from './engines/SeedEngine';
import { AutomationEngine } from './engines/AutomationEngine';
import { SearchEngine } from './engines/SearchEngine';

// ─── Install State ────────────────────────────────────────────────────────────

export interface IInstallProgress {
  step: number;
  total: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export type InstallProgressCallback = (progress: IInstallProgress) => void;

const STEPS = [
  'Validating capability',
  'Registering business objects',
  'Loading seed data',
  'Registering workflows',
  'Applying permissions',
  'Indexing search fields',
  'Registering AI skills',
  'Setting up automations',
  'Registering notifications',
  'Activating capability',
];

// ─── In-Memory Registries ────────────────────────────────────────────────────

/** Tracks which capability IDs are installed in this session */
const installedCapabilities = new Set<string>(
  JSON.parse(localStorage.getItem('chatr_installed_capabilities') ?? '[]')
);

/** Stores full SDK for each installed capability */
const capabilityStore = new Map<string, ICapabilitySDK>();

// Restore from localStorage on page load
try {
  const stored = localStorage.getItem('chatr_capability_sdks');
  if (stored) {
    const parsed = JSON.parse(stored) as ICapabilitySDK[];
    parsed.forEach(sdk => capabilityStore.set(sdk.id, sdk));
  }
} catch { /* ignore */ }

// ─── Capability Installer ─────────────────────────────────────────────────────

export const CapabilityInstaller = {
  /** Install a capability by its SDK object */
  async install(
    sdk: ICapabilitySDK,
    onProgress?: InstallProgressCallback
  ): Promise<{ success: boolean; error?: string }> {
    const emit = (step: number, label: string, status: IInstallProgress['status']) => {
      onProgress?.({ step, total: STEPS.length, label, status });
    };

    try {
      // Step 1: Validate
      emit(1, STEPS[0], 'running');
      const validation = CapabilityInstaller.validate(sdk);
      if (!validation.valid) throw new Error(validation.error);
      emit(1, STEPS[0], 'done');
      await delay(100);

      // Step 2: Register objects
      emit(2, STEPS[1], 'running');
      sdk.objects.forEach(obj => ObjectRegistry.register(sdk.id, obj));
      emit(2, STEPS[1], 'done');
      await delay(100);

      // Step 3: Seed data
      emit(3, STEPS[2], 'running');
      if (sdk.seed?.objects?.length > 0) {
        await SeedEngine.seed(sdk.id, sdk.seed);
      }
      emit(3, STEPS[2], 'done');
      await delay(100);

      // Step 4: Workflows
      emit(4, STEPS[3], 'running');
      // WorkflowEngine.register(sdk.id, sdk.workflows); // future
      emit(4, STEPS[3], 'done');
      await delay(100);

      // Step 5: Permissions
      emit(5, STEPS[4], 'running');
      PermissionRegistry.register(sdk.id, sdk.permissions);
      emit(5, STEPS[4], 'done');
      await delay(100);

      // Step 6: Search index
      emit(6, STEPS[5], 'running');
      SearchEngine.index(sdk.id, sdk.search);
      emit(6, STEPS[5], 'done');
      await delay(100);

      // Step 7: AI skills
      emit(7, STEPS[6], 'running');
      AISkillRegistry.register(sdk.id, sdk.ai);
      emit(7, STEPS[6], 'done');
      await delay(100);

      // Step 8: Automations
      emit(8, STEPS[7], 'running');
      AutomationEngine.register(sdk.id, sdk.automations);
      emit(8, STEPS[7], 'done');
      await delay(100);

      // Step 9: Notifications
      emit(9, STEPS[8], 'running');
      NotificationRegistry.register(sdk.id, sdk.notifications);
      emit(9, STEPS[8], 'done');
      await delay(100);

      // Step 10: Activate
      emit(10, STEPS[9], 'running');
      installedCapabilities.add(sdk.id);
      capabilityStore.set(sdk.id, sdk);

      // Persist to localStorage
      localStorage.setItem(
        'chatr_installed_capabilities',
        JSON.stringify([...installedCapabilities])
      );
      localStorage.setItem(
        'chatr_capability_sdks',
        JSON.stringify([...capabilityStore.values()])
      );
      emit(10, STEPS[9], 'done');

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /** Uninstall a capability */
  uninstall(capabilityId: string): void {
    installedCapabilities.delete(capabilityId);
    capabilityStore.delete(capabilityId);
    ObjectRegistry.unregister(capabilityId);
    SearchEngine.deindex(capabilityId);
    AutomationEngine.deregister(capabilityId);
    localStorage.setItem(
      'chatr_installed_capabilities',
      JSON.stringify([...installedCapabilities])
    );
    localStorage.setItem(
      'chatr_capability_sdks',
      JSON.stringify([...capabilityStore.values()])
    );
  },

  /** Check if a capability is installed */
  isInstalled(capabilityId: string): boolean {
    return installedCapabilities.has(capabilityId);
  },

  /** Get all installed capability IDs */
  getInstalledIds(): string[] {
    return [...installedCapabilities];
  },

  /** Get full SDK for an installed capability */
  getSDK(capabilityId: string): ICapabilitySDK | undefined {
    return capabilityStore.get(capabilityId);
  },

  /** Get all installed SDKs */
  getAllInstalled(): ICapabilitySDK[] {
    return [...capabilityStore.values()];
  },

  /** Validate an SDK before installation */
  validate(sdk: ICapabilitySDK): { valid: boolean; error?: string } {
    if (!sdk.id) return { valid: false, error: 'Capability ID is required' };
    if (!sdk.name) return { valid: false, error: 'Capability name is required' };
    if (!sdk.objects || sdk.objects.length === 0) {
      // Allow capabilities with no objects (platform-level tools)
    }
    return { valid: true };
  },
};

// ─── Supporting Registries ────────────────────────────────────────────────────

export const ObjectRegistry = {
  store: new Map<string, { capabilityId: string; object: any }>(),

  register(capabilityId: string, object: any) {
    this.store.set(`${capabilityId}.${object.name}`, { capabilityId, object });
  },

  unregister(capabilityId: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${capabilityId}.`)) this.store.delete(key);
    }
  },

  get(capabilityId: string, objectName: string) {
    return this.store.get(`${capabilityId}.${objectName}`)?.object;
  },

  all() {
    return [...this.store.values()];
  },
};

export const PermissionRegistry = {
  store: new Map<string, any>(),
  register(capabilityId: string, permissions: any) {
    this.store.set(capabilityId, permissions);
  },
  get(capabilityId: string) {
    return this.store.get(capabilityId);
  },
};

export const AISkillRegistry = {
  store: new Map<string, any>(),
  register(capabilityId: string, ai: any) {
    this.store.set(capabilityId, ai);
  },
  getAll() {
    return [...this.store.values()].flatMap(a => a.skills || []);
  },
};

export const NotificationRegistry = {
  store: new Map<string, any[]>(),
  register(capabilityId: string, notifications: any[]) {
    this.store.set(capabilityId, notifications || []);
  },
  getAll() {
    return [...this.store.values()].flat();
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
