import type { AuthContext, Role } from "./auth.ts";
import { PlatformError } from "./errors.ts";

export function enforceOwner(auth: AuthContext, ownerId: string) {
  if (!auth.user) throw new PlatformError(401, "missing_authorization", "Authentication is required");
  if (auth.user.id !== ownerId) throw new PlatformError(403, "owner_required", "Owner access is required");
}

export function enforceTenant(auth: AuthContext, tenantId?: string | null) {
  if (!tenantId) return;
  if (!auth.user) throw new PlatformError(401, "missing_authorization", "Authentication is required");
  if (auth.user.tenantId && auth.user.tenantId !== tenantId) {
    throw new PlatformError(403, "tenant_mismatch", "Tenant access denied");
  }
}

export function hasRole(auth: AuthContext, role: Role) {
  return Boolean(auth.user?.roles.includes(role));
}

export function enforceHealthcareAccess(auth: AuthContext, patientId: string) {
  if (!auth.user) throw new PlatformError(401, "missing_authorization", "Authentication is required");
  if (auth.user.id !== patientId && !hasRole(auth, "admin") && !hasRole(auth, "provider")) {
    throw new PlatformError(403, "healthcare_access_denied", "Healthcare record access denied");
  }
}

