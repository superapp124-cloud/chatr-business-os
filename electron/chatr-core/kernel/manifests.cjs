'use strict';

/**
 * CHATR Kernel — Capability & Workspace Manifest Schemas (ABI v1.0)
 *
 * Defines the strict structure required for capabilities and workspaces
 * to be registered within the Intent OS.
 */

class ManifestValidator {
  static validateCapability(manifest) {
    const required = ['id', 'name', 'version', 'runtime', 'provider'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Invalid Capability Manifest: Missing required field '${field}'`);
      }
    }
    
    // Normalize optional fields
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      runtime: manifest.runtime,
      provider: manifest.provider,
      category: manifest.category || 'General',
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      dependencies: Array.isArray(manifest.dependencies) ? manifest.dependencies : [],
      events: Array.isArray(manifest.events) ? manifest.events : [],
      inputs: manifest.inputs || {},
      outputs: manifest.outputs || {},
      approval: ['never', 'optional', 'always'].includes(manifest.approval) ? manifest.approval : 'optional',
      supportsOffline: typeof manifest.supportsOffline === 'boolean' ? manifest.supportsOffline : true,
      enterprise: typeof manifest.enterprise === 'boolean' ? manifest.enterprise : false,
      status: 'active'
    };
  }

  static validateWorkspace(manifest) {
    const required = ['id', 'name', 'capabilities'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Invalid Workspace Manifest: Missing required field '${field}'`);
      }
    }
    
    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description || '',
      capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities : [],
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      defaultContext: manifest.defaultContext || {}
    };
  }
}

module.exports = { ManifestValidator };
