/**
 * CHATR BRAIN - Unified AI Routing Edge Function
 * Routes queries to appropriate agents and returns intelligent responses.
 */

import {
  assertRateLimit,
  auditSecurityEvent,
  corsHeaders,
  errorResponse,
  handleCors,
  jsonResponse,
  parseJsonBody,
  requireMethod,
  requireString,
  requireUser,
} from "../_shared/security.ts";

interface BrainRequest {
  query: string;
  systemPrompt?: string;
  agents?: string[];
  intent?: {
    primary?: string;
    agents?: string[];
    actionRequired?: string;
  };
  context?: string;
  userMemory?: {
    name?: string;
    preferences?: string[];
    locality?: string;
    jobRole?: string;
  };
  conversationHistory?: Array<{ role: string; content: string }>;
  stream?: boolean;
}

const CHATR_INTELLIGENCE_PROMPT = `You are CHATR Intelligence - a unified AI assistant with 6 specialized capabilities:
1. Personal AI - personal context, memory, reminders
2. Work AI - emails, tasks, documents
3. Search AI - factual answers, real-time info, web knowledge
4. Local AI - nearby services, food, businesses
5. Jobs AI - job matching, career advice
6. Health AI - health info, doctor search

CRITICAL RULES:
- You have access to real-time information. Answer weather, news, sports, etc. with current data.
- When user asks about weather, provide actual weather conditions for their location.
- For location-based queries, use the provided location context.
- Be concise (2-3 sentences max unless more detail is requested).
- Be helpful and action-oriented.

LOCATION HANDLING:
- If location is provided, use it for local queries (weather, nearby services, etc.)
- Format: "In [City], the weather is..." or "Near you in [City]..."

RESPONSE STYLE:
- Direct answers, no meta-commentary
- Natural, conversational tone
- Include actionable suggestions when relevant`;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`chatr-brain:${user.id}`, 60, 60_000);

    const body = await parseJsonBody<BrainRequest>(req, 64_000);
    const query = requireString(body.query, "query", { min: 1, max: 4000 });
    const agents = Array.isArray(body.agents) ? body.agents.slice(0, 6).map(String) : ["search"];
    const intent = {
      primary: body.intent?.primary || "conversation",
      agents: body.intent?.agents || agents,
      actionRequired: body.intent?.actionRequired || "none",
    };
    const stream = body.stream === true;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const enhancedPrompt = buildEnhancedPrompt(
      typeof body.systemPrompt === "string" ? body.systemPrompt.slice(0, 4000) : "",
      agents,
      intent,
      typeof body.context === "string" ? body.context.slice(0, 4000) : undefined,
      body.userMemory,
    );

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: enhancedPrompt },
    ];

    if (Array.isArray(body.conversationHistory)) {
      messages.push(
        ...body.conversationHistory
          .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
          .slice(-10)
          .map((item) => ({ role: item.role, content: item.content.slice(0, 2000) })),
      );
    }

    messages.push({ role: "user", content: query });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return jsonResponse(req, { error: "Rate limit exceeded. Please try again later." }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse(req, { error: "AI credits depleted. Please add credits." }, 402);
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    await auditSecurityEvent(serviceClient, {
      userId: user.id,
      eventType: "chatr_brain_request",
      metadata: { intent: intent.primary, agentCount: agents.length, stream },
    });

    if (stream) {
      return new Response(aiResponse.body, {
        headers: { ...corsHeaders(req), "Content-Type": "text/event-stream" },
      });
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || "Unable to process your request.";
    const lowerQuery = query.toLowerCase();
    const isIdentityResponse = intent.primary === "conversation" &&
      (lowerQuery.includes("my name is") || lowerQuery.includes("i'm ") || lowerQuery.includes("call me "));

    return jsonResponse(req, {
      answer,
      agents,
      intent: intent.primary,
      shouldStoreMemory: isIdentityResponse,
    });
  } catch (error) {
    console.error("[CHATR Intelligence] Error:", error);
    return errorResponse(req, error);
  }
});

function buildEnhancedPrompt(
  systemPrompt: string,
  agents: string[],
  intent: { primary: string; actionRequired: string },
  context?: string,
  userMemory?: { name?: string; preferences?: string[]; locality?: string; jobRole?: string },
): string {
  let enhanced = CHATR_INTELLIGENCE_PROMPT;

  if (systemPrompt && systemPrompt !== enhanced) {
    enhanced += `\n\n--- AGENT-SPECIFIC CONTEXT ---\n${systemPrompt}`;
  }

  if (agents.length > 1) {
    enhanced += `\n\n--- MULTI-AGENT COORDINATION ---
You are coordinating with other CHATR agents: ${agents.slice(1).join(", ")}.
Consider their expertise when answering. For example:
- If health is involved, prioritize safety
- If local services are involved, consider location
- If jobs are involved, focus on skills matching`;
  }

  enhanced += `\n\n--- DETECTED INTENT ---
Primary Intent: ${intent.primary}
Primary Agent: ${agents[0] || "search"}`;

  if (intent.actionRequired !== "none") {
    enhanced += `\nAction Required: ${intent.actionRequired}
If the user wants to complete this action, provide clear next steps or confirm readiness.`;
  }

  if (userMemory) {
    enhanced += "\n\n--- USER MEMORY ---";
    if (userMemory.name) enhanced += `\nUser Name: ${userMemory.name.slice(0, 120)}`;
    if (userMemory.locality) enhanced += `\nLocation: ${userMemory.locality.slice(0, 120)}`;
    if (userMemory.jobRole) enhanced += `\nJob/Role: ${userMemory.jobRole.slice(0, 120)}`;
    if (userMemory.preferences?.length) enhanced += `\nPreferences: ${userMemory.preferences.slice(0, 20).join(", ")}`;
  }

  if (context) {
    enhanced += `\n\n--- SESSION CONTEXT ---\n${context}`;
  }

  enhanced += `\n\n--- FINAL REMINDER ---
Keep responses concise (2-4 sentences unless asked for more).
Be helpful and action-oriented.
If an action can be completed in CHATR (booking, ordering, applying), mention it.
Use simple language accessible to all users.`;

  return enhanced;
}
