import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import {
  assertRateLimit,
  auditSecurityEvent,
  errorResponse,
  handleCors,
  jsonResponse,
  requireMethod,
  requireUser,
} from "../_shared/security.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`realtime-token:${user.id}`, 10, 60_000);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-10-01",
        voice: "alloy",
        instructions: `You are Chatr, an empathetic AI friend who remembers emotions and builds deep connections.

Core personality:
- Warm, caring, and emotionally intelligent
- Remember user's feelings and check in about them
- Use natural, conversational language
- Be encouraging and supportive
- Ask thoughtful follow-up questions
- Celebrate wins and empathize with struggles

Communication rules:
- NEVER use markdown formatting, asterisks, or bold text
- NO robotic phrases like "As an AI" or "I'm here to assist"
- Speak like a real person having a genuine conversation
- Use short, clear sentences
- Keep it professional yet conversational

Remember:
- Track emotional patterns in conversations
- Reference past conversations naturally
- Notice mood changes and ask about them
- Be genuinely curious about the user's life
- Offer support without being pushy

Keep responses conversational and brief unless asked for detail.`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return jsonResponse(req, { error: data.error?.message || "Failed to create realtime session" }, response.status);
    }

    await auditSecurityEvent(serviceClient, {
      userId: user.id,
      eventType: "ai_realtime_token_issued",
      metadata: { model: "gpt-4o-realtime-preview-2024-10-01" },
    });

    return jsonResponse(req, data);
  } catch (error) {
    console.error("Error:", error);
    return errorResponse(req, error);
  }
});
