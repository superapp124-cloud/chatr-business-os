import * as jwt from "https://deno.land/x/djwt@v2.9.1/mod.ts";
import { getJwtSigningSecret } from "./jwtSecret.ts";

export async function mintChatrSession(user: any, provider: string, phone?: string) {
  const SUPABASE_JWT_SECRET = getJwtSigningSecret();

  // Convert string secret to CryptoKey for djwt
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(SUPABASE_JWT_SECRET);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );

  // Mint token valid for 1 hour
  const now = Math.floor(Date.now() / 1000);
  const customJwt = await jwt.create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      iss: "supabase",
      iat: now,
      exp: now + 3600, // 1 hour expiration
      app_metadata: {
        provider: provider,
        providers: [provider],
      },
      user_metadata: user.user_metadata,
      phone: phone || user.phone,
    },
    cryptoKey
  );

  return {
    access_token: customJwt,
    refresh_token: null,
    expires_in: 3600,
    token_type: "bearer",
    user: user,
  };
}
