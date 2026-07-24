import { handleOptions, corsHeaders } from "./cors.ts";
import { normalizeError, PlatformError } from "./errors.ts";
import { createTelemetryContext, logCompletion, logFailure, logRequest } from "./telemetry.ts";
import { assertRateLimit, clientIp } from "./rateLimit.ts";
import { getOptionalUser, requireAdmin, requireUser, verifyCronToken, verifyMachineToken, type AuthContext } from "./auth.ts";
import { auditEvent } from "./audit.ts";

export type FunctionClassification =
  | "PUBLIC_SAFE"
  | "AUTH_REQUIRED"
  | "HIGH_VALUE"
  | "ADMIN_ONLY"
  | "HEALTHCARE_SENSITIVE"
  | "AI_COST_SENSITIVE"
  | "PAYMENT_SENSITIVE"
  | "INTERNAL_ONLY"
  | "CRON_ONLY"
  | "SERVICE_ONLY";

export type GovernedContext = {
  req: Request;
  auth: AuthContext;
  correlationId: string;
  functionName: string;
};

export type GovernedFunctionConfig = {
  name: string;
  classification: FunctionClassification[];
  methods?: string[];
  auth?: "none" | "optional" | "user" | "admin" | "machine" | "cron";
  rateLimit?: { limit: number; windowMs: number; key?: (req: Request, auth: AuthContext) => string };
  audit?: { eventType: string; severity?: "info" | "warning" | "critical" };
};

export function jsonResponse(req: Request, body: Record<string, unknown>, status = 200, correlationId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "X-Correlation-ID": correlationId ?? "",
    },
  });
}

export function createEdgeFunction(
  config: GovernedFunctionConfig,
  handler: (ctx: GovernedContext) => Promise<Response> | Response,
) {
  return async (req: Request) => {
    const options = handleOptions(req);
    if (options) return options;

    const telemetry = createTelemetryContext(req, config.name);
    logRequest(telemetry, { classification: config.classification });

    let auth: AuthContext | undefined;
    try {
      if (config.methods && !config.methods.includes(req.method)) {
        throw new PlatformError(405, "method_not_allowed", "Method not allowed");
      }

      if (config.auth === "user") auth = await requireUser(req);
      else if (config.auth === "admin") {
        auth = await requireUser(req);
        requireAdmin(auth);
      } else if (config.auth === "machine") {
        auth = await getOptionalUser(req);
        auth.machine = await verifyMachineToken(req, config.name);
      } else if (config.auth === "cron") {
        auth = await getOptionalUser(req);
        auth.machine = await verifyCronToken(req, `${config.name.toUpperCase().replace(/-/g, "_")}_CRON_SECRET`);
      } else {
        auth = await getOptionalUser(req);
      }

      if (config.rateLimit) {
        const key = config.rateLimit.key?.(req, auth) ??
          `${config.name}:${auth.user?.id ?? auth.machine?.id ?? clientIp(req)}`;
        await assertRateLimit({ key, limit: config.rateLimit.limit, windowMs: config.rateLimit.windowMs });
      }

      if (config.audit) {
        await auditEvent(auth, {
          type: config.audit.eventType,
          severity: config.audit.severity,
          correlationId: telemetry.correlationId,
          metadata: { classification: config.classification },
        });
      }

      const response = await handler({
        req,
        auth,
        correlationId: telemetry.correlationId,
        functionName: config.name,
      });
      response.headers.set("X-Correlation-ID", telemetry.correlationId);
      logCompletion(telemetry, response.status, { actor: auth.user?.id ?? auth.machine?.id ?? "anonymous" });
      return response;
    } catch (error) {
      const normalized = normalizeError(error);
      logFailure(telemetry, error, { code: normalized.code });
      if (auth) {
        await auditEvent(auth, {
          type: "edge_function_failure",
          severity: normalized.severity,
          correlationId: telemetry.correlationId,
          metadata: { function: config.name, code: normalized.code },
        });
      }
      logCompletion(telemetry, normalized.status, { code: normalized.code });
      return jsonResponse(req, {
        error: normalized.message,
        code: normalized.code,
        correlationId: telemetry.correlationId,
      }, normalized.status, telemetry.correlationId);
    }
  };
}

