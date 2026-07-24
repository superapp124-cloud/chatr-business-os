import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  auditSecurityEvent,
  errorResponse,
  handleCors,
  jsonResponse,
  parseJsonBody,
  requireEnum,
  requireMethod,
  requireSameUser,
  requireString,
  requireUser,
} from "../_shared/security.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    const body = await parseJsonBody(req);

    // Accept existing client payload variants while binding writes to the session user.
    const token = requireString(
      body.token || body.fcm_token || body.device_token || body.fcmToken || body.deviceToken,
      "token",
      { min: 16, max: 4096 },
    );
    const platform = requireEnum(body.platform || "android", "platform", ["android", "ios", "web"] as const);
    const userId = requireSameUser(user.id, body.userId || body.user_id);

    const { error: cleanupError } = await serviceClient
      .from("device_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("platform", platform)
      .neq("device_token", token);

    if (cleanupError) {
      console.warn("Warning: failed to clean up stale device tokens:", cleanupError);
    }

    const { error: reassignError } = await serviceClient
      .from("device_tokens")
      .delete()
      .eq("device_token", token)
      .neq("user_id", userId);

    if (reassignError) {
      console.warn("Warning: failed to clear token from other users:", reassignError);
    }

    const { error } = await serviceClient
      .from("device_tokens")
      .upsert({
        user_id: userId,
        device_token: token,
        platform,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,device_token",
      });

    if (error) {
      console.error("Error saving device token:", error);
      return jsonResponse(req, { error: error.message }, 500);
    }

    await serviceClient.from("user_push_health").upsert({
      user_id: userId,
      has_valid_token: true,
      last_checked_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    await auditSecurityEvent(serviceClient, {
      userId,
      eventType: "device_token_registered",
      metadata: { platform },
    });

    return jsonResponse(req, { success: true, message: "Device token registered" });
  } catch (error: unknown) {
    console.error("Register device token error:", error);
    return errorResponse(req, error);
  }
});
