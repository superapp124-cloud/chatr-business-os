export interface PermissionManifest {
  scopes: string[];
  resources: string[];
  actions: string[];
  justification?: string;
}

export interface CapabilityManifest {
  id: string;
  type: 'workflow' | 'action' | 'trigger' | 'ui_component' | 'data_connector';
  name: string;
  description: string;
  entryPoint: string;
  parametersSchema?: Record<string, any>;
  returnSchema?: Record<string, any>;
}

export interface AppManifest {
  id: string;
  version: string;
  name: string;
  developer: string;
  description: string;
  iconUrl?: string;
  permissions: PermissionManifest;
  capabilities: CapabilityManifest[];
  webhooks?: Record<string, string>;
  setupUrl?: string;
}

export interface PluginRegistry {
  apps: Record<string, AppManifest>;
  installApp(manifest: AppManifest): Promise<boolean>;
  uninstallApp(appId: string): Promise<boolean>;
  getAppCapabilities(appId: string): CapabilityManifest[];
  verifyPermissions(appId: string, requiredScopes: string[]): boolean;
}
