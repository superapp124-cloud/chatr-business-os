export class PermissionDeniedError extends Error {
  constructor(public capability: string, public packageId?: string) {
    super(`Permission Denied: Package '${packageId || 'unknown'}' attempted to access capability '${capability}' without explicit permission in its manifest.`);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Phase E.5: Runtime Permission Enforcer
 * 
 * Intercepts capability usage at runtime and asserts that the node's
 * package actually requested and was granted this permission.
 */
export class PermissionEnforcer {
  /**
   * Enforces that the given package has the required permission.
   */
  static assertPermission(grantedPermissions: string[] | undefined, requiredPermission: string, packageId?: string): void {
    if (!grantedPermissions || !grantedPermissions.includes(requiredPermission)) {
      throw new PermissionDeniedError(requiredPermission, packageId);
    }
  }
}
