import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertRateLimit,
  auditSecurityEvent,
  errorResponse,
  handleCors,
  jsonResponse,
  parseJsonBody,
  requireMethod,
  requireSameUser,
  requireString,
  requireUser,
  requireUuid,
} from "../_shared/security.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`screen-incoming-call:${user.id}`, 60, 60_000);

    const body = await parseJsonBody(req);
    const receiverId = requireSameUser(user.id, body.receiver_id);
    const callerId = body.caller_id ? requireUuid(body.caller_id, "caller_id") : null;
    const callerPhone = body.caller_phone ? requireString(body.caller_phone, "caller_phone", { min: 5, max: 32 }) : null;

    if (!callerId && !callerPhone) {
      return jsonResponse(req, { error: "caller and receiver info required" }, 400);
    }

    let callerProfile = null;
    let trustScore = null;

    if (callerId) {
      const [profileRes, trustRes] = await Promise.all([
        serviceClient.from("profiles").select("username, avatar_url, primary_handle, phone_number").eq("id", callerId).single(),
        serviceClient.from("user_trust_scores").select("trust_score, verification_level").eq("user_id", callerId).single(),
      ]);
      callerProfile = profileRes.data;
      trustScore = trustRes.data;
    } else if (callerPhone) {
      const { data } = await serviceClient
        .from("profiles")
        .select("id, username, avatar_url, primary_handle")
        .eq("phone_number", callerPhone)
        .maybeSingle();

      if (data) {
        callerProfile = data;
        const { data: ts } = await serviceClient
          .from("user_trust_scores")
          .select("trust_score, verification_level")
          .eq("user_id", data.id)
          .single();
        trustScore = ts;
      }
    }

    let contactIntel = null;
    if (callerId) {
      const { data } = await serviceClient
        .from("contact_intelligence")
        .select("pickup_likelihood, preferred_route, total_calls, missed_calls, last_outcome")
        .eq("user_id", receiverId)
        .eq("contact_id", callerId)
        .maybeSingle();
      contactIntel = data;
    }

    let spamCount = 0;
    if (callerId) {
      const { count } = await serviceClient
        .from("trust_factors")
        .select("*", { count: "exact", head: true })
        .eq("user_id", callerId)
        .eq("factor_type", "spam_report");
      spamCount = count || 0;
    }

    let isBlocked = false;
    if (callerId) {
      const { data } = await serviceClient
        .from("blocked_contacts")
        .select("id")
        .eq("user_id", receiverId)
        .eq("blocked_user_id", callerId)
        .maybeSingle();
      isBlocked = !!data;
    }

    const score = trustScore?.trust_score ?? 50;
    let riskLevel: "safe" | "medium" | "high" = "medium";
    let intent = "unknown";
    let confidence = 50;

    if (isBlocked) {
      riskLevel = "high";
      intent = "blocked_contact";
      confidence = 100;
    } else if (spamCount > 3) {
      riskLevel = "high";
      intent = "likely_spam";
      confidence = 85 + Math.min(spamCount * 2, 10);
    } else if (score >= 80 && contactIntel) {
      riskLevel = "safe";
      intent = "known_contact";
      confidence = 90;
    } else if (score >= 60) {
      riskLevel = "safe";
      intent = "verified_user";
      confidence = 75;
    } else if (score < 30) {
      riskLevel = "high";
      intent = "suspicious";
      confidence = 70;
    }

    let aiScreening = null;
    let fallbackToTier2 = false;
    
    // TIER 1: Rules-based fallback for unknown/risky callers.
    // If not safely resolved by Tier 1 heuristics, explicitly flag for Tier 2 on-device resolution.
    if (riskLevel === "medium" || riskLevel === "high") {
        fallbackToTier2 = true;
        // Zero-cost stance: Cloud AI is intentionally disabled. 
        // We accept the zero-day scam tradeoff to ensure DPDP compliance and zero marginal cost.
    }

    await auditSecurityEvent(serviceClient, {
      userId: user.id,
      eventType: "incoming_call_screened",
      metadata: { callerId, hasCallerPhone: !!callerPhone, riskLevel, intent },
    });

    return jsonResponse(req, {
      caller: {
        name: callerProfile?.username || "Unknown",
        avatar: callerProfile?.avatar_url,
        handle: callerProfile?.primary_handle ? `@${callerProfile.primary_handle}` : null,
        is_registered: !!callerProfile,
      },
      trust: {
        score,
        level: trustScore?.verification_level || "unverified",
        tier: score >= 70 ? "safe" : score >= 40 ? "unknown" : "risky",
      },
      screening: {
        risk_level: riskLevel,
        intent,
        confidence,
        summary: fallbackToTier2 ? "Unknown intent. Resolving locally on-device (Tier 2)..." : (
          riskLevel === "safe" ? "Trusted caller" :
          riskLevel === "high" ? "Exercise caution" :
          "Unknown caller"
        ),
        fallback_tier_2: fallbackToTier2,
        is_blocked: isBlocked,
        spam_reports: spamCount,
      },
      history: contactIntel ? {
        total_calls: contactIntel.total_calls,
        pickup_rate: Math.round((contactIntel.pickup_likelihood || 0) * 100),
        preferred_route: contactIntel.preferred_route,
      } : null,
    });
  } catch (error) {
    console.error("Call screening error:", error);
    return errorResponse(req, error);
  }
});
