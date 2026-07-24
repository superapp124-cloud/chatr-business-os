import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "https://deno.land/x/jose@v4.14.4/index.ts";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";
import { PlatformError } from "../_core/errors.ts";
import { mintChatrSession } from "../_core/session.ts";
import { getJwtSigningSecret } from "../_core/jwtSecret.ts";

const requestSchema = z.object({
  id_token: z.string().min(10).optional(),
  device_assertion: z.string().min(10).optional(),
});

const JWKS_URI = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));
const DEFAULT_FIREBASE_PROJECT_ID = "chatr-91067";

type SupabaseAdminClient = ReturnType<typeof createClient>;

function firebaseProjectIds() {
  const raw =
    Deno.env.get("FIREBASE_PROJECT_IDS") ||
    Deno.env.get("FIREBASE_PROJECT_ID") ||
    Deno.env.get("VITE_FIREBASE_PROJECT_ID") ||
    DEFAULT_FIREBASE_PROJECT_ID;

  return raw.split(",").map((projectId) => projectId.trim()).filter(Boolean);
}

async function verifyFirebaseIdToken(idToken: string) {
  let lastError: unknown;

  for (const projectId of firebaseProjectIds()) {
    try {
      const verification = await jwtVerify(idToken, JWKS, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      });

      return verification.payload;
    } catch (err) {
      lastError = err;
    }
  }

  console.error("Firebase JWT verification failed:", lastError);
  throw new PlatformError(401, "invalid_id_token", "The provided Firebase ID token is invalid or expired.");
}

function normalizePhone(phoneNumber: string) {
  return phoneNumber.replace(/\s/g, "");
}

function phoneDigits(phoneNumber: string) {
  return phoneNumber.replace(/\D/g, "");
}

async function findAuthUserByPhone(supabaseAdmin: SupabaseAdminClient, normalizedPhone: string) {
  const normalizedDigits = phoneDigits(normalizedPhone);

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw new PlatformError(500, "phone_user_lookup_failed", error.message);
    }

    const users = data?.users ?? [];
    const match = users.find((candidate: any) =>
      candidate.phone && phoneDigits(candidate.phone) === normalizedDigits
    );

    if (match) return match;
    if (users.length < 1000) break;
  }

  return null;
}

function isOptionalProfileColumnError(error: { message?: string }) {
  return /column/i.test(error.message ?? "") && /(phone_number|email)/i.test(error.message ?? "");
}

async function syncPublicUser(supabaseAdmin: SupabaseAdminClient, user: any, normalizedPhone?: string) {
  const username = `user_${user.id.substring(0, 8)}`;
  const baseProfile = { id: user.id, username };
  const richProfile = {
    ...baseProfile,
    phone_number: normalizedPhone || user.phone || null,
    email: user.email || null,
  };

  const { error: richUpsertError } = await supabaseAdmin
    .from("users")
    .upsert(richProfile, { onConflict: "id", ignoreDuplicates: true });

  if (richUpsertError) {
    if (!isOptionalProfileColumnError(richUpsertError)) {
      throw new PlatformError(500, "db_error", "Failed to sync auth user to public profile: " + richUpsertError.message);
    }

    const { error: baseUpsertError } = await supabaseAdmin
      .from("users")
      .upsert(baseProfile, { onConflict: "id", ignoreDuplicates: true });

    if (baseUpsertError) {
      throw new PlatformError(500, "db_error", "Failed to sync auth user to public profile: " + baseUpsertError.message);
    }

    return;
  }

  const optionalUpdates = {
    phone_number: normalizedPhone || user.phone || null,
    email: user.email || null,
  };

  if (optionalUpdates.phone_number || optionalUpdates.email) {
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update(optionalUpdates)
      .eq("id", user.id);

    if (updateError) {
      console.warn("Public user optional profile sync skipped:", updateError);
    }
  }
}

serve(createEdgeFunction({
  name: "identity-exchange",
  classification: ["HIGH_VALUE", "PUBLIC_SAFE"],
  methods: ["POST"],
  auth: "optional",
  rateLimit: { limit: 20, windowMs: 60_000, key: (req) => `identity-exchange:${req.headers.get("x-forwarded-for") ?? "anonymous"}` },
}, async ({ req, auth, correlationId }) => {
  const { id_token, device_assertion } = await validateJson(req, requestSchema);

  if (!id_token && !device_assertion) {
    throw new PlatformError(400, "missing_token", "Must provide either id_token or device_assertion.");
  }

  let user: any;
  let isNewUser = false;
  let authProvider = "firebase";
  let phone = "";

  if (id_token) {
    // --- FIREBASE OTP FLOW ---
    const payload = await verifyFirebaseIdToken(id_token);

    const firebase_uid = payload.sub;
    const phone_number = payload.phone_number as string | undefined;

    if (!firebase_uid || !phone_number) {
      throw new PlatformError(400, "missing_phone", "The Firebase ID token does not contain a verified phone number.");
    }


    const normalizedPhone = normalizePhone(phone_number);
    phone = normalizedPhone;

    const supabaseAdmin = auth.serviceClient;

    // Step 1: Look up user via identity_providers table using the Firebase UID
    // This is the most reliable lookup — avoids the non-existent getUserByPhone API
    const { data: ipRow } = await supabaseAdmin
      .from("identity_providers")
      .select("user_id")
      .eq("provider", "firebase")
      .eq("provider_uid", firebase_uid)
      .maybeSingle();

    if (ipRow?.user_id) {
      const { data: existingUserData, error: existingUserError } = await auth.serviceClient.auth.admin.getUserById(ipRow.user_id);
      if (existingUserError) {
        console.warn("Mapped Supabase user lookup failed:", existingUserError);
      }
      user = existingUserData?.user ?? null;
    }

    // Step 2: If not found via identity_providers, try to create the user
    if (!user) {
      const { data: newUser, error: createError } = await auth.serviceClient.auth.admin.createUser({
        phone: normalizedPhone,
        phone_confirm: true,
        user_metadata: { provider: "firebase" },
      });

      if (createError) {
        // Phone already exists in Supabase but not yet in identity_providers
        // This happens when a user signed up before we started tracking identity_providers
        if (createError.message?.includes("already") || createError.message?.includes("duplicate") || createError.message?.includes("exists")) {
          // Find them via the admin listUsers with phone filter
          user = await findAuthUserByPhone(supabaseAdmin, normalizedPhone);
          if (!user) throw new PlatformError(400, "phone_user_lookup_failed", createError.message);
        } else {
          throw new PlatformError(400, "phone_user_create_failed", createError.message);
        }
      } else {
        user = newUser.user;
        isNewUser = true;
      }
    }

    // Ensure phone is confirmed
    if (user && !user.phone_confirmed_at) {
      await auth.serviceClient.auth.admin.updateUserById(user.id, { phone_confirm: true });
    }

    // Sync the auth user to public.users so identity_providers and trusted_devices
    // can satisfy their public.users foreign keys even if the database trigger lags.
    if (user && user.id) {
      await syncPublicUser(supabaseAdmin, user, normalizedPhone);
    }

    // Upsert Identity Provider Mapping (so future lookups hit Step 1 directly)
    const { error: upsertError } = await supabaseAdmin.from("identity_providers").upsert({
      user_id: user.id,
      provider: "firebase",
      provider_uid: firebase_uid,
      provider_phone: normalizedPhone,
      last_login_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_uid" });

    if (upsertError) console.error("Failed to upsert identity provider:", upsertError);

  } else if (device_assertion) {
    // --- TRUSTED DEVICE FLOW ---
    authProvider = "trusted_device";
    const SECRET = getJwtSigningSecret();

    const encoder = new TextEncoder();
    let payload;
    try {
      const verification = await jwtVerify(device_assertion, encoder.encode(SECRET), {
        issuer: "chatr-device-auth",
        audience: "identity-exchange"
      });
      payload = verification.payload;
    } catch (err) {
      throw new PlatformError(401, "invalid_assertion", "Device assertion is invalid or expired.");
    }

    const user_id = payload.sub;
    if (!user_id) throw new PlatformError(401, "invalid_assertion", "Missing sub in assertion.");

    const { data: userData, error: userError } = await auth.serviceClient.auth.admin.getUserById(user_id);
    if (userError || !userData?.user) {
      throw new PlatformError(401, "user_not_found", "User associated with device not found.");
    }
    user = userData.user;
    phone = user.phone || "";
  }

  // Common: Mint the unified CHATR session
  const session = await mintChatrSession(user, authProvider, phone);

  return jsonResponse(req, {
    session,
    isNewUser,
  }, 200, correlationId);
}));
