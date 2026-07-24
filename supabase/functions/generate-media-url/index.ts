import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertRateLimit,
  auditSecurityEvent,
  errorResponse,
  handleCors,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requireMethod,
  requireString,
  requireUser,
} from "../_shared/security.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`generate-media-url:${user.id}`, 120, 60_000);

    const body = await parseJsonBody(req);
    const path = requireString(body.path, "path", { min: 3, max: 2048 });

    if (path.includes("..") || path.startsWith("/") || path.includes("\\")) {
      throw new HttpError(400, "invalid_path", "Invalid media path");
    }

    const [firstSegment] = path.split("/");
    if (uuidPattern.test(firstSegment)) {
      const { data: participant, error } = await serviceClient
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", firstSegment)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!participant) {
        throw new HttpError(403, "media_access_denied", "You are not allowed to access this media");
      }
    } else if (firstSegment !== user.id) {
      throw new HttpError(403, "media_access_denied", "You are not allowed to access this media");
    }

    const { data, error } = await serviceClient.storage
      .from("chat-media")
      .createSignedUrl(path, 300);

    if (error) {
      console.error("Error generating signed URL:", error);
      return jsonResponse(req, { error: error.message }, 500);
    }

    await auditSecurityEvent(serviceClient, {
      userId: user.id,
      eventType: "signed_media_url_issued",
      metadata: { bucket: "chat-media", pathPrefix: firstSegment },
    });

    return jsonResponse(req, { signedUrl: data.signedUrl });
  } catch (error) {
    console.error("Error:", error);
    return errorResponse(req, error);
  }
});
