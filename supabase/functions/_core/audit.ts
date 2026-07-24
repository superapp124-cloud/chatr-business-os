import type { AuthContext } from "./auth.ts";

export async function auditEvent(
  auth: Pick<AuthContext, "serviceClient" | "user" | "machine">,
  event: {
    type: string;
    severity?: "info" | "warning" | "critical";
    tenantId?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
  },
) {
  try {
    await auth.serviceClient.from("security_audit_events").insert({
      user_id: auth.user?.id ?? null,
      event_type: event.type,
      severity: event.severity ?? "info",
      metadata: {
        tenant_id: event.tenantId ?? auth.user?.tenantId ?? null,
        machine_id: auth.machine?.id ?? null,
        correlation_id: event.correlationId ?? null,
        ...(event.metadata ?? {}),
      },
    });
  } catch (error) {
    console.warn("[core-audit] Audit event was not persisted:", error);
  }
}

