import { PlatformError } from "./errors.ts";

export function getJwtSigningSecret() {
  const secret =
    Deno.env.get("JWT_SIGNING_SECRET") ||
    Deno.env.get("SUPABASE_JWT_SECRET") ||
    Deno.env.get("JWT_SECRET");

  if (!secret) {
    throw new PlatformError(
      500,
      "server_config_error",
      "JWT signing secret is not configured. Set JWT_SIGNING_SECRET to the Supabase JWT secret.",
    );
  }

  return secret;
}
