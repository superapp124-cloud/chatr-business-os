import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";
import { PlatformError } from "../_core/errors.ts";
import { auditEvent } from "../_core/audit.ts";

const otpSchema = z.object({
  phoneNumber: z.string().min(6).max(24).regex(/^\+?[0-9\s().-]+$/),
  action: z.enum(["send", "verify"]),
  firebaseUid: z.string().min(4).max(160).optional(),
  otp: z.string().min(4).max(160).optional(),
});

serve(createEdgeFunction({
  name: "auth-phone-otp",
  classification: ["HIGH_VALUE", "PUBLIC_SAFE"],
  methods: ["POST"],
  auth: "optional",
  rateLimit: {
    limit: 10,
    windowMs: 60_000,
    key: (req) => `auth-phone-otp:${req.headers.get("x-forwarded-for") ?? "anonymous"}`,
  },
  audit: { eventType: "phone_otp_requested", severity: "warning" },
}, async ({ req, auth, correlationId }) => {
  const { phoneNumber, action, firebaseUid, otp } = await validateJson(req, otpSchema);
  const normalizedPhone = phoneNumber.replace(/\s/g, "").replace(/\+/g, "");

  if (action === "send") {
    await auditEvent(auth, {
      type: "phone_otp_send_acknowledged",
      severity: "info",
      correlationId,
      metadata: { phoneHashSuffix: normalizedPhone.slice(-4) },
    });
    return jsonResponse(req, { success: true, message: "OTP will be sent via Firebase" }, 200, correlationId);
  }

  const uid = firebaseUid || otp;
  if (!uid) {
    throw new PlatformError(400, "firebase_uid_required", "Firebase UID required for verification");
  }

  const email = `${normalizedPhone}@chatr.local`;
  const password = phoneNumber.replace(/\s/g, "");
  const username = normalizedPhone.slice(-10);

  const { data: existingUsers } = await auth.serviceClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((user) => user.email === email);

  let isNewUser = false;
  if (existingUser) {
    const { error } = await auth.serviceClient.auth.admin.updateUserById(existingUser.id, {
      password,
      user_metadata: {
        phone_number: phoneNumber,
        firebase_uid: uid,
        username,
      },
    });
    if (error) throw new PlatformError(400, "phone_user_update_failed", error.message);
  } else {
    const { error } = await auth.serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        phone_number: phoneNumber,
        firebase_uid: uid,
        username,
      },
    });
    if (error) throw new PlatformError(400, "phone_user_create_failed", error.message);
    isNewUser = true;
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    throw new PlatformError(400, "phone_signin_failed", error.message);
  }

  await auditEvent(auth, {
    type: "phone_otp_verify_completed",
    severity: "warning",
    correlationId,
    metadata: { phoneHashSuffix: normalizedPhone.slice(-4), isNewUser },
  });

  return jsonResponse(req, {
    accessToken: data.session?.access_token,
    refreshToken: data.session?.refresh_token,
    expiresIn: data.session?.expires_in || 3600,
    user: {
      id: data.user?.id,
      email: data.user?.email,
      phone: phoneNumber,
      username: data.user?.user_metadata?.username || username,
      avatarUrl: data.user?.user_metadata?.avatar_url || null,
      bio: data.user?.user_metadata?.bio || null,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      createdAt: data.user?.created_at,
    },
    isNewUser,
  }, 200, correlationId);
}));
