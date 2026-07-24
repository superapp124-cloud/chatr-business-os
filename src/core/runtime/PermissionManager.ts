/**
 * CHATR Kernel Runtime v2.0 — PermissionManager
 *
 * Layer 2 — Runtime Infrastructure
 *
 * Capability access control for engines, plugins, and workspace modules.
 * Every capability execution is permission-gated and audit-logged.
 *
 * Layers:
 *   1. Engine permissions — built-in, always granted
 *   2. Plugin permissions — declared in PluginManifest, granted on install
 *   3. User-level overrides — via admin panel (enterprise only)
 */

import { Permission } from './types';
import { securityManager } from './SecurityManager';

type Actor = string; // engine id, plugin id, or 'user'

// ─── PermissionManager ────────────────────────────────────────────────────────

class PermissionManagerImpl {
  // actor → Set of permissions
  private grants = new Map<Actor, Set<Permission>>();

  // ── Built-in engine grants ────────────────────────────────────────────────

  initEnginePermissions(): void {
    // Core engines get full access by default
    const coreEngines = [
      'MemoryEngine', 'KnowledgeEngine', 'RelationshipEngine',
      'TimelineEngine', 'AIContextManager', 'AIEngine',
      'SearchIndexer', 'SearchRankingEngine', 'WorkflowEngine',
      'DataSyncLayer', 'NotificationEngine', 'CapabilityRegistry',
      'WorkspaceEngine',
    ];
    const allPermissions: Permission[] = [
      'read:contacts', 'write:contacts', 'read:files', 'write:files',
      'read:calendar', 'write:calendar', 'execute:ai', 'execute:calls',
      'read:messages', 'write:messages', 'access:crm', 'access:financial',
      'access:health', 'access:admin',
    ];
    for (const engine of coreEngines) {
      this.grants.set(engine, new Set(allPermissions));
    }
  }

  // ── Grant / Revoke ────────────────────────────────────────────────────────

  grant(actor: Actor, permissions: Permission | Permission[]): void {
    if (!this.grants.has(actor)) {
      this.grants.set(actor, new Set());
    }
    const actorGrants = this.grants.get(actor)!;
    const perms = Array.isArray(permissions) ? permissions : [permissions];
    for (const perm of perms) {
      actorGrants.add(perm);
    }
    securityManager.audit(
      'PermissionManager',
      'grant',
      actor,
      'allowed',
      { permissions: perms }
    );
  }

  revoke(actor: Actor, permissions: Permission | Permission[]): void {
    const actorGrants = this.grants.get(actor);
    if (!actorGrants) return;
    const perms = Array.isArray(permissions) ? permissions : [permissions];
    for (const perm of perms) {
      actorGrants.delete(perm);
    }
  }

  revokeAll(actor: Actor): void {
    this.grants.delete(actor);
  }

  // ── Check ─────────────────────────────────────────────────────────────────

  check(actor: Actor, permission: Permission): boolean {
    const actorGrants = this.grants.get(actor);
    const allowed = actorGrants?.has(permission) ?? false;

    securityManager.audit(
      actor,
      'check_permission',
      permission,
      allowed ? 'allowed' : 'denied'
    );

    return allowed;
  }

  /**
   * Require a permission. Throws if not granted.
   * Used inside engines before executing sensitive operations.
   */
  require(actor: Actor, permission: Permission): void {
    if (!this.check(actor, permission)) {
      throw new Error(
        `[PermissionManager] "${actor}" does not have permission "${permission}"`
      );
    }
  }

  hasAll(actor: Actor, permissions: Permission[]): boolean {
    return permissions.every(p => this.check(actor, p));
  }

  hasAny(actor: Actor, permissions: Permission[]): boolean {
    return permissions.some(p => this.check(actor, p));
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  getGrants(actor: Actor): Permission[] {
    return Array.from(this.grants.get(actor) ?? []);
  }

  getAllActors(): string[] {
    return Array.from(this.grants.keys());
  }
}

export const permissionManager = new PermissionManagerImpl();
export type { PermissionManagerImpl };
