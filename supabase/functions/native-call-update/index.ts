import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertRateLimit,
  auditSecurityEvent,
  errorResponse,
  handleCors,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requireEnum,
  requireMethod,
  requireSameUser,
  requireUser,
  requireUuid,
} from "../_shared/security.ts";

const CALL_STATUSES = ["active", "ended", "rejected"] as const;
const ALLOWED_ADDITIONAL_FIELDS = new Set([
  "duration",
  "ended_reason",
  "quality_score",
  "webrtc_state",
]);

type CallUpdateBody = {
  callId?: unknown;
  status?: unknown;
  userId?: unknown;
  additionalFields?: unknown;
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`native-call-update:${user.id}`, 60, 60_000);

    const body = await parseJsonBody<CallUpdateBody>(req);
    const callId = requireUuid(body.callId, "callId");
    const status = requireEnum(body.status, "status", CALL_STATUSES);
    const authenticatedUserId = requireSameUser(user.id, body.userId);

    const { data: call, error: fetchError } = await serviceClient
      .from("calls")
      .select("id, caller_id, receiver_id, status")
      .eq("id", callId)
      .single();

    if (fetchError || !call) {
      throw new HttpError(404, "call_not_found", "Call not found");
    }

    if (authenticatedUserId !== call.caller_id && authenticatedUserId !== call.receiver_id) {
      await auditSecurityEvent(serviceClient, {
        userId: authenticatedUserId,
        eventType: "native_call_update_denied",
        severity: "warning",
        metadata: { callId },
      });
      throw new HttpError(403, "call_participant_required", "User not authorized for this call");
    }

    const updateData: Record<string, unknown> = { status };

    if (status === "active") {
      updateData.started_at = new Date().toISOString();
      updateData.webrtc_state = "connecting";
    } else if (status === "ended" || status === "rejected") {
      updateData.ended_at = new Date().toISOString();
      updateData.webrtc_state = "ended";
      if (status === "rejected") {
        updateData.missed = false;
      }
    }

    if (body.additionalFields && typeof body.additionalFields === "object" && !Array.isArray(body.additionalFields)) {
      for (const [key, value] of Object.entries(body.additionalFields as Record<string, unknown>)) {
        if (!ALLOWED_ADDITIONAL_FIELDS.has(key)) continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
          updateData[key] = value;
        }
      }
    }

    const { error: updateError } = await serviceClient
      .from("calls")
      .update(updateData)
      .eq("id", callId);

    if (updateError) {
      throw new HttpError(500, "call_update_failed", updateError.message);
    }

    await auditSecurityEvent(serviceClient, {
      userId: authenticatedUserId,
      eventType: "native_call_status_updated",
      metadata: { callId, status, previousStatus: call.status },
    });

    return jsonResponse(req, { success: true, callId, status });
  } catch (error: unknown) {
    return errorResponse(req, error);
  }
});
