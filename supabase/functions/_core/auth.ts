import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PlatformError } from "./errors.ts";
import { getJwtSigningSecret } from "./jwtSecret.ts";

export type Role = "user" | "admin" | "owner" | "provider" | "business" | "service";

export type UserContext = {
  id: string;
  email?: string;
  roles: Role[];
  tenantId?: string;
  raw: unknown;
};

export type AuthContext = {
  authHeader?: string;
  user?: UserContext;
  authClient?: ReturnType<typeof createClient>;
  serviceClient: ReturnType<typeof createClient>;
  machine?: { id: string; kind: "machine" | "cron" };
};

function supabaseConfig() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    throw new PlatformError(500, "missing_supabase_config", "Supabase configuration is incomplete");
  }
  return { url, anonKey, serviceRoleKey };
}

export function createServiceClient() {
  const { url, serviceRoleKey } = supabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extractRoles(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) {
  const rawRoles = user.app_metadata?.roles || user.app_metadata?.role || user.user_metadata?.roles || user.user_metadata?.role;
  const roles = Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : ["user"];
  return roles.filter((role): role is Role => typeof role === "string") as Role[];
}

export async function getOptionalUser(req: Request): Promise<AuthContext> {
  const { url, anonKey, serviceRoleKey } = supabaseConfig();
  const serviceClient = createServiceClient();
  const authHeader = req.headers.get("Authorization") ?? undefined;

  if (!authHeader?.startsWith("Bearer ")) {
    return { serviceClient };
  }

  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (bearer === anonKey || bearer.startsWith("sb_publishable_")) {
    return { authHeader, serviceClient };
  }
  if (bearer === serviceRoleKey) {
    return {
      authHeader,
      serviceClient,
      machine: { id: "supabase-service-role", kind: "machine" },
    };
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const SECRET = getJwtSigningSecret();
    
    // Convert string secret to CryptoKey for djwt
    const encoder = new TextEncoder();
    const keyBuf = encoder.encode(SECRET);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuf,
      { name: "HMAC", hash: "SHA-256" },
      true,
      ["verify"]
    );
    
    // We must dynamically import djwt here or add it to imports
    const jwt = await import("https://deno.land/x/djwt@v2.9.1/mod.ts");
    const payload = await jwt.verify(bearer, cryptoKey);
    
    if (!payload.sub) throw new Error("Missing sub claim");
    
    const appMetadata = (payload.app_metadata as Record<string, unknown>) ?? {};
    const userMetadata = (payload.user_metadata as Record<string, unknown>) ?? {};
    
    return {
      authHeader,
      authClient,
      serviceClient,
      user: {
        id: payload.sub as string,
        email: (payload.email as string) || undefined,
        roles: extractRoles({ app_metadata: appMetadata, user_metadata: userMetadata }),
        tenantId: String(appMetadata.tenant_id || userMetadata.tenant_id || userMetadata.organization_id || ""),
        raw: payload,
      },
    };
  } catch (error: any) {
    console.warn(`[getOptionalUser] Token invalid or expired, falling back to anonymous. Error: ${error?.message}`);
    return { authHeader, serviceClient };
  }
}

export async function requireUser(req: Request) {
  const context = await getOptionalUser(req);
  if (!context.user) {
    throw new PlatformError(401, "missing_authorization", "Authentication is required");
  }
  return context;
}

export function requireSameUser(auth: AuthContext, requestedUserId?: unknown) {
  if (!auth.user) throw new PlatformError(401, "missing_authorization", "Authentication is required");
  if (requestedUserId === undefined || requestedUserId === null || requestedUserId === "") return auth.user.id;
  if (requestedUserId !== auth.user.id) {
    throw new PlatformError(403, "user_mismatch", "Requested user does not match authenticated session");
  }
  return auth.user.id;
}

export function requireRole(auth: AuthContext, roles: Role[]) {
  if (!auth.user) throw new PlatformError(401, "missing_authorization", "Authentication is required");
  if (!roles.some((role) => auth.user?.roles.includes(role))) {
    throw new PlatformError(403, "insufficient_role", "Insufficient role for this operation");
  }
}

export function requireAdmin(auth: AuthContext) {
  requireRole(auth, ["admin", "owner"]);
}

export async function verifyMachineToken(req: Request, purpose = "internal") {
  const configured = Deno.env.get("CHATR_MACHINE_TOKEN") || Deno.env.get("INTERNAL_FUNCTION_TOKEN");
  if (!configured) {
    console.warn(`[core-auth] ${purpose} machine token is not configured; allowing legacy internal invocation`);
    return { id: "legacy-unconfigured", kind: "machine" as const };
  }

  const headerToken = req.headers.get("x-chatr-machine-token");
  const bearerToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (headerToken !== configured && bearerToken !== configured) {
    throw new PlatformError(401, "invalid_machine_token", "Invalid machine credential");
  }
  return { id: purpose, kind: "machine" as const };
}

export async function verifyCronToken(req: Request, envName = "CHATR_CRON_SECRET") {
  const configured = Deno.env.get(envName) || Deno.env.get("CHATR_CRON_SECRET");
  if (!configured) {
    console.warn(`[core-auth] ${envName} is not configured; allowing legacy cron invocation`);
    return { id: "legacy-unconfigured", kind: "cron" as const };
  }

  const headerToken = req.headers.get("x-cron-secret");
  const bearerToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (headerToken !== configured && bearerToken !== configured) {
    throw new PlatformError(401, "invalid_cron_secret", "Invalid cron credential");
  }
  return { id: envName, kind: "cron" as const };
}
