import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPTS: Record<string, string> = {
  sales: `You are a sales coaching AI. Given the context of a sales call, generate exactly {count} specific, actionable conversation topics or questions the salesperson should raise with this client. Make them specific to the context provided, not generic. Return ONLY a JSON array of strings like ["topic 1", "topic 2"]. No explanation.`,
  recruitment: `You are a technical recruiter AI. Given the context of an interview, generate exactly {count} specific interview questions tailored to the candidate and role. Make them insightful and specific. Return ONLY a JSON array of strings like ["question 1", "question 2"]. No explanation.`,
  clinic: `You are a clinical assistant AI. Given the patient consultation context, generate exactly {count} clinical next steps the doctor should take. Be medically appropriate and specific to the complaint. Return ONLY a JSON array of strings like ["step 1", "step 2"]. No explanation.`,
  general: `You are a meeting assistant AI. Given the meeting context and transcript, generate exactly {count} AI-powered suggestions or action items for the current meeting. Return ONLY a JSON array of strings like ["suggestion 1", "suggestion 2"]. No explanation.`,
  insights: `You are a real-time meeting AI. Analyze the meeting transcript and generate exactly {count} live AI suggestions (e.g. silent participants, action items, decisions, follow-ups). Be specific to the transcript. Return ONLY a JSON array of JSON objects like [{"type":"info","text":"..."}, {"type":"action","text":"..."}]. Types: info, warning, action. No explanation.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal = 'general', context = '', count = 5 } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const systemPrompt = (SYSTEM_PROMPTS[goal] || SYSTEM_PROMPTS.general)
      .replace('{count}', String(count));

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://chatr.chat",
        "X-Title": "Chatr AI Questions Generator",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context || `Generate ${count} items for a ${goal} context.` },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter error: ${err}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '[]';

    // Parse the JSON array from the AI response
    let parsed: any[] = [];
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: extract lines as plain strings
      parsed = raw.split('\n').filter((l: string) => l.trim().length > 5).slice(0, count);
    }

    // Normalize: for 'insights' goal return objects, else return strings
    if (goal === 'insights') {
      return new Response(JSON.stringify({ suggestions: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questions = parsed.map((item: any) => typeof item === 'string' ? item : item.text || String(item));
    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('generate-questions error:', error);
    return new Response(
      JSON.stringify({ error: error.message, questions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
