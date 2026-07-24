import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

const DEFAULT_ALLOWED_ORIGINS = [
  "https://chatr.chat",
  "https://www.chatr.chat",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:8085",
  "http://127.0.0.1:8085",
  "capacitor://localhost",
  "ionic://localhost",
];

const rateLimitState = new Map<string, { count: number; resetAt: number }>();

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function allowedOrigins() {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function isLocalNetwork(origin: string): boolean {
  return /^http:\/\/(192\.168\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin);
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin");
  const allowed = allowedOrigins();
  const allowOrigin = origin && (allowed.includes(origin) || isLocalNetwork(origin)) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-cron-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

export function handleCors(req: Request) {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { headers: corsHeaders(req) });
}

export function jsonResponse(req: Request, body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function errorResponse(req: Request, error: unknown) {
  if (error instanceof HttpError) {
    return jsonResponse(req, { error: error.message, code: error.code }, error.status);
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[security] Unhandled function error:", error);
  return jsonResponse(req, { error: message, code: "internal_error" }, 500);
}

export function requireMethod(req: Request, allowed: string[]) {
  if (!allowed.includes(req.method)) {
    throw new HttpError(405, "method_not_allowed", "Method not allowed");
  }
}

export async function parseJsonBody<T extends JsonRecord>(req: Request, maxBytes = 32_768): Promise<T> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) {
    throw new HttpError(413, "payload_too_large", "Request body is too large");
  }

  try {
    return await req.json() as T;
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
}

export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "missing_authorization", "Authentication is required");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new HttpError(500, "missing_supabase_config", "Supabase configuration is incomplete");
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    throw new HttpError(401, "invalid_token", "Invalid or expired session");
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { user, authClient, serviceClient, authHeader };
}

export function requireSameUser(authenticatedUserId: string, requestedUserId?: unknown) {
  if (requestedUserId === undefined || requestedUserId === null || requestedUserId === "") {
    return authenticatedUserId;
  }

  if (requestedUserId !== authenticatedUserId) {
    throw new HttpError(403, "user_mismatch", "Requested user does not match the authenticated session");
  }

  return authenticatedUserId;
}

export function requireUuid(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "invalid_uuid", `${fieldName} must be a valid UUID`);
  }
  return value;
}

export function requireString(value: unknown, fieldName: string, options: { min?: number; max?: number; pattern?: RegExp } = {}) {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_string", `${fieldName} is required`);
  }

  const trimmed = value.trim();
  if (options.min !== undefined && trimmed.length < options.min) {
    throw new HttpError(400, "invalid_string", `${fieldName} is too short`);
  }
  if (options.max !== undefined && trimmed.length > options.max) {
    throw new HttpError(400, "invalid_string", `${fieldName} is too long`);
  }
  if (options.pattern && !options.pattern.test(trimmed)) {
    throw new HttpError(400, "invalid_string", `${fieldName} has an invalid format`);
  }

  return trimmed;
}

export function requireEnum<T extends string>(value: unknown, fieldName: string, values: readonly T[]) {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new HttpError(400, "invalid_enum", `${fieldName} is invalid`);
  }
  return value as T;
}

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  if (Deno.env.get("EDGE_RATE_LIMIT_DISABLED") === "true") return;

  const now = Date.now();
  const existing = rateLimitState.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitState.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > limit) {
    throw new HttpError(429, "rate_limited", "Too many requests. Try again shortly.");
  }
}

export async function auditSecurityEvent(
  serviceClient: ReturnType<typeof createClient>,
  event: {
    userId?: string;
    eventType: string;
    severity?: "info" | "warning" | "critical";
    metadata?: JsonRecord;
  },
) {
  try {
    await serviceClient.from("security_audit_events").insert({
      user_id: event.userId ?? null,
      event_type: event.eventType,
      severity: event.severity ?? "info",
      metadata: event.metadata ?? {},
    });
  } catch (error) {
    console.warn("[security] Audit event was not persisted:", error);
  }
}
