import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";
import { PlatformError } from "../_core/errors.ts";
import { auditEvent } from "../_core/audit.ts";

const phoneAuthSchema = z.object({
  firebase_id_token: z.string().min(20),
});

// We can safely hardcode the public Web API key here, or pass it via ENV. 
// Using the one from the client config since it is a public key for identity verification.
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY") || "AIzaSyDUUbQlOmkHsrEyMw9AmQBXbjNx11iM7w4";

serve(createEdgeFunction({
  name: "firebase-phone-auth",
  classification: ["HIGH_VALUE", "PUBLIC_SAFE"],
  methods: ["POST"],
  auth: "optional",
  rateLimit: {
    limit: 10,
    windowMs: 60_000,
    key: (req) => `firebase-phone-auth:${req.headers.get("x-forwarded-for") ?? "anonymous"}`,
  },
  audit: { eventType: "firebase_phone_auth_requested", severity: "warning" },
}, async ({ req, auth, correlationId }) => {
  const { firebase_id_token } = await validateJson(req, phoneAuthSchema);

  // 1. Verify the Firebase ID Token
  const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: firebase_id_token }),
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || verifyData.error) {
    throw new PlatformError(401, "invalid_firebase_token", verifyData.error?.message || "Invalid Firebase token");
  }

  const firebaseUser = verifyData.users?.[0];
  if (!firebaseUser || !firebaseUser.phoneNumber) {
    throw new PlatformError(400, "missing_phone_number", "Verified user does not have a phone number");
  }

  const phone_number = firebaseUser.phoneNumber;
  const firebase_uid = firebaseUser.localId;
  const normalizedPhone = phone_number.replace(/\s/g, "").replace(/\+/g, "");
  const email = `${normalizedPhone}@chatr.local`;
  
  // Use a secure deterministic password derived from UID to ensure seamless re-login
  const password = `${normalizedPhone}_${firebase_uid.slice(0, 10)}`;

  // 2. Find or Create Supabase User
  const { data: existingUsers } = await auth.serviceClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((user) => user.email === email);

  let isNewUser = false;
  if (existingUser) {
    // Update password in case we need to reset the deterministic login
    const { error } = await auth.serviceClient.auth.admin.updateUserById(existingUser.id, {
      password,
      user_metadata: { phone_number, firebase_uid },
    });
    if (error) throw new PlatformError(400, "phone_user_update_failed", error.message);
  } else {
    const { error } = await auth.serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm to avoid rate limits!
      user_metadata: { phone_number, firebase_uid },
    });
    if (error) throw new PlatformError(400, "phone_user_create_failed", error.message);
    isNewUser = true;
  }

  // 3. Issue Supabase Session
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: session, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new PlatformError(400, "phone_signin_failed", signInError.message);
  }

  await auditEvent(auth, {
    type: "firebase_phone_auth_completed",
    severity: "warning",
    correlationId,
    metadata: { phoneHashSuffix: normalizedPhone.slice(-4), isNewUser },
  });

  return jsonResponse(req, {
    session: session.session,
    user: session.user,
    isNewUser,
  }, 200, correlationId);
}));
