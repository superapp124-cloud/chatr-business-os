import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const inputSchema = z.object({
  imageBase64: z.string().min(1),
  prompt: z.string().default("Analyze this image and describe what you see."),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validationResult = inputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { imageBase64, prompt } = validationResult.data;
    
    // We try OPENROUTER_API_KEY first, fallback to LOVABLE_API_KEY if needed.
    // The Lovable Gateway is structurally identical to OpenAI/OpenRouter APIs.
    const API_KEY = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    
    if (!API_KEY) {
      throw new Error("API_KEY is not configured in Edge Function secrets.");
    }

    const payload = {
      model: "google/gemini-2.5-flash-preview", // Vision-capable model
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500,
    };

    // If using Lovable Gateway instead of OpenRouter, URL changes
    const fetchUrl = Deno.env.get("OPENROUTER_API_KEY") 
      ? OPENROUTER_API_URL 
      : 'https://ai.gateway.lovable.dev/v1/chat/completions';

    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://chatr.chat",
        "X-Title": "Chatr Visual Intelligence",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      throw new Error(`AI API Error: ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.choices[0]?.message?.content || "No response generated.";

    return new Response(
      JSON.stringify({ success: true, text: aiText }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error("Visual Intelligence error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
