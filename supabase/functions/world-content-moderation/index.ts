import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";
import { PlatformError } from "../_core/errors.ts";
import { verifyMachineToken } from "../_core/auth.ts";
import { auditEvent } from "../_core/audit.ts";

const moderationSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1).max(10_000),
  action: z.enum(["check", "flag", "approve"]).default("check"),
});

serve(createEdgeFunction({
  name: "world-content-moderation",
  classification: ["HIGH_VALUE", "SERVICE_ONLY"],
  methods: ["POST"],
  auth: "optional",
  rateLimit: {
    limit: 60,
    windowMs: 60_000,
    key: (_req, auth) => `world-content-moderation:${auth.user?.id ?? auth.machine?.id ?? "anonymous"}`,
  },
  audit: { eventType: "world_content_moderation_requested" },
}, async ({ req, auth, correlationId }) => {
  if (!auth.user && !auth.machine) {
    auth.machine = await verifyMachineToken(req, "world-content-moderation");
  }

  const { postId, content, action } = await validateJson(req, moderationSchema);
  const forbiddenWords = ["spam", "scam", "abuse"];
  const containsForbidden = forbiddenWords.some((word) => content.toLowerCase().includes(word));

  if (containsForbidden || action === "flag") {
    const { error } = await auth.serviceClient
      .from("world_posts")
      .update({
        moderation_status: "flagged",
        moderation_reason: containsForbidden ? "Contains prohibited content" : "User reported",
      })
      .eq("id", postId);

    if (error) {
      throw new PlatformError(500, "moderation_update_failed", error.message);
    }

    await auditEvent(auth, {
      type: "world_content_flagged",
      severity: "warning",
      correlationId,
      metadata: { postId, action, containsForbidden },
    });

    return jsonResponse(req, { moderated: true, action: "flagged" }, 200, correlationId);
  }

  await auditEvent(auth, {
    type: "world_content_approved",
    correlationId,
    metadata: { postId, action },
  });

  return jsonResponse(req, { moderated: false, action: "approved" }, 200, correlationId);
}));
