import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";
import { PlatformError } from "../_core/errors.ts";
import { getJwtSigningSecret } from "../_core/jwtSecret.ts";
import * as jwt from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const registerSchema = z.object({
  public_key_jwk: z.any(),
  device_name: z.string().optional(),
  platform: z.string().optional(),
  device_fingerprint: z.string().optional(),
});

const challengeSchema = z.object({
  device_id: z.string(),
});

const verifySchema = z.object({
  device_id: z.string(),
  challenge: z.string(),
  signature_hex: z.string(),
});

serve(createEdgeFunction({
  name: "device-auth",
  classification: ["HIGH_VALUE", "PUBLIC_SAFE"],
  methods: ["POST"],
  auth: "optional", // We handle auth manually per route
}, async ({ req, auth, correlationId }) => {
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop(); // register, challenge, verify

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  if (path === "register") {
    // Requires authenticated session
    if (!auth.user) {
      throw new PlatformError(401, "unauthorized", "Must be logged in to register a device.");
    }
    const body = await validateJson(req, registerSchema);
    
    // Convert JWK to string to store
    const publicKeyStr = JSON.stringify(body.public_key_jwk);
    const deviceId = crypto.randomUUID();

    const { error } = await supabaseAdmin.from("trusted_devices").insert({
      user_id: auth.user.id,
      device_id: deviceId,
      device_name: body.device_name || "Unknown Device",
      platform: body.platform,
      public_key: publicKeyStr,
      device_fingerprint: body.device_fingerprint,
    });

    if (error) throw new PlatformError(500, "db_error", "Failed to register device: " + error.message);

    return jsonResponse(req, { device_id: deviceId }, 200, correlationId);

  } else if (path === "challenge") {
    const { device_id } = await validateJson(req, challengeSchema);

    // Verify device exists and is not revoked
    const { data: device, error } = await supabaseAdmin
      .from("trusted_devices")
      .select("id, revoked_at")
      .eq("device_id", device_id)
      .single();

    if (error || !device) throw new PlatformError(404, "not_found", "Device not found.");
    if (device.revoked_at) throw new PlatformError(403, "revoked", "Device is revoked.");

    // Generate challenge (random 32 bytes hex)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const challenge = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');

    // Hash the challenge for storage
    const challengeHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(challenge));
    const challengeHashHex = Array.from(new Uint8Array(challengeHash)).map(b => b.toString(16).padStart(2, '0')).join('');

    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60 seconds

    const { error: insertError } = await supabaseAdmin.from("device_challenges").insert({
      device_id,
      challenge_hash: challengeHashHex,
      expires_at: expiresAt,
    });

    if (insertError) throw new PlatformError(500, "db_error", "Failed to create challenge.");

    return jsonResponse(req, { challenge }, 200, correlationId);

  } else if (path === "verify") {
    const { device_id, challenge, signature_hex } = await validateJson(req, verifySchema);

    // 1. Validate challenge
    const challengeHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(challenge));
    const challengeHashHex = Array.from(new Uint8Array(challengeHash)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: challengeRecord, error: challengeError } = await supabaseAdmin
      .from("device_challenges")
      .select("*")
      .eq("device_id", device_id)
      .eq("challenge_hash", challengeHashHex)
      .is("used_at", null)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (challengeError || !challengeRecord) {
      throw new PlatformError(401, "invalid_challenge", "Challenge is invalid, expired, or already used.");
    }

    // Mark used immediately
    await supabaseAdmin
      .from("device_challenges")
      .update({ used_at: new Date().toISOString() })
      .eq("id", challengeRecord.id);

    // 2. Fetch Device Public Key
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("trusted_devices")
      .select("user_id, public_key, revoked_at")
      .eq("device_id", device_id)
      .single();

    if (deviceError || !device) throw new PlatformError(404, "not_found", "Device not found.");
    if (device.revoked_at) throw new PlatformError(403, "revoked", "Device is revoked.");

    // 3. Verify Signature
    try {
      const jwk = JSON.parse(device.public_key);
      const cryptoKey = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );

      const signatureBytes = new Uint8Array(signature_hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const dataBytes = new TextEncoder().encode(challenge);

      const isValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        cryptoKey,
        signatureBytes,
        dataBytes
      );

      if (!isValid) throw new Error("Invalid signature");
    } catch (err) {
      console.error("Signature verification failed:", err);
      throw new PlatformError(401, "invalid_signature", "Signature verification failed.");
    }

    // Update last_login_at
    await supabaseAdmin
      .from("trusted_devices")
      .update({ last_login_at: new Date().toISOString() })
      .eq("device_id", device_id);

    // 4. Mint Device Assertion Token (DAT) for identity-exchange
    const SECRET = getJwtSigningSecret();

    const encoder = new TextEncoder();
    const keyBuf = encoder.encode(SECRET);
    const hmacKey = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, true, ["sign"]);

    const now = Math.floor(Date.now() / 1000);
    const dat = await jwt.create(
      { alg: "HS256", typ: "JWT" },
      {
        sub: device.user_id,
        device_id: device_id,
        iss: "chatr-device-auth",
        aud: "identity-exchange",
        iat: now,
        exp: now + 120, // 2 minutes expiry
      },
      hmacKey
    );

    return jsonResponse(req, { device_assertion: dat }, 200, correlationId);

  } else {
    throw new PlatformError(404, "not_found", "Invalid device-auth route.");
  }
}));
