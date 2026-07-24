'use strict';

/**
 * CHATR Kernel — Workspace Manager
 *
 * Manages the declarative workspaces within the Intent OS.
 * Workspaces are collections of capabilities, context, and permissions.
 * The UI is simply a Shell that renders a Workspace based on the active context.
 *
 * ABI v1.0
 */

const { ManifestValidator } = require('./manifests.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class WorkspaceManager {
  constructor() {
    this.workspaces = new Map(); // id -> workspace manifest
    this.activeWorkspaceId = null;
  }

  /**
   * Registers a Workspace from a declarative manifest.
   */
  registerWorkspace(manifestPayload) {
    try {
      const manifest = ManifestValidator.validateWorkspace(manifestPayload);
      this.workspaces.set(manifest.id, manifest);
      log.info(`[WorkspaceManager] Registered Workspace: ${manifest.name} (${manifest.id})`);
      
      // Auto-activate the first registered workspace if none is active
      if (!this.activeWorkspaceId) {
        this.activeWorkspaceId = manifest.id;
      }
      return manifest;
    } catch (err) {
      log.error(`[WorkspaceManager] Failed to register workspace: ${err.message}`);
      throw err;
    }
  }

  /**
   * Returns all registered workspaces.
   */
  getWorkspaces() {
    return Array.from(this.workspaces.values());
  }

  /**
   * Switches the active workspace.
   */
  switchWorkspace(workspaceId) {
    if (!this.workspaces.has(workspaceId)) {
      throw new Error(`[WorkspaceManager] Workspace '${workspaceId}' not found.`);
    }
    this.activeWorkspaceId = workspaceId;
    log.info(`[WorkspaceManager] Switched to Workspace: ${workspaceId}`);
    return this.workspaces.get(workspaceId);
  }

  /**
   * Returns the currently active workspace.
   */
  getActiveWorkspace() {
    if (!this.activeWorkspaceId) return null;
    return this.workspaces.get(this.activeWorkspaceId);
  }

  /**
   * Verifies if a capability is allowed in the current workspace.
   */
  isCapabilityAllowed(capabilityId) {
    const active = this.getActiveWorkspace();
    if (!active) return false;
    // For now, if the workspace declares it in capabilities, it's allowed.
    // If capabilities array is empty, we assume all are allowed (for default personal workspace).
    if (active.capabilities.length === 0) return true;
    return active.capabilities.includes(capabilityId);
  }
}

const workspaceManager = new WorkspaceManager();
module.exports = { workspaceManager, WorkspaceManager };
