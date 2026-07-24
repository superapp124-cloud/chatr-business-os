import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Layer 1: Fast Heuristics
function runHeuristics(content: string) {
  const hasLink = /(https?:\/\/[^\s]+)/g.test(content);
  const hasFinancial = /\b(bank|crypto|bitcoin|eth|transfer|wire|western union|gift card|otp|password|verify)\b/i.test(content);
  const isUrgent = /\b(urgent|immediate|account suspended|locked|warning|final notice)\b/i.test(content);
  
  let score = 0;
  if (hasLink) score += 20;
  if (hasFinancial) score += 20;
  if (isUrgent) score += 20;
  
  return {
    needsDeepScan: score >= 20 || hasLink, // Only run AI if suspicious keywords or links are found
    baseScore: score,
    findings: { hasLink, hasFinancial, isUrgent }
  };
}

// Layer 3: AI Risk Classifier
async function analyzeThreatWithAI(content: string, apiKey: string) {
  const fetchUrl = Deno.env.get("OPENROUTER_API_KEY") 
    ? 'https://openrouter.ai/api/v1/chat/completions' 
    : 'https://ai.gateway.lovable.dev/v1/chat/completions';

  const systemPrompt = `You are CHATR Shield, an advanced active threat detection AI. 
Analyze the following message for scams, phishing, malware links, or fraud.
Return a strict JSON object with this exact schema:
{
  "overall_score": number (0-100, where 100 is most dangerous),
  "overall_level": string ("safe", "suspicious", "dangerous"),
  "detections": {
    "phishing": number (0-100),
    "spam": number (0-100),
    "malware": number (0-100),
    "fraud": number (0-100)
  },
  "explanation": string[] (Array of concise, user-friendly bullet points explaining why it's dangerous. Max 3 bullets. Empty array if safe.),
  "recommended_action": string ("None", "Do not click links", "Block sender", "Ignore")
}`;

  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chatr.chat',
      'X-Title': 'Chatr Shield Pipeline'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-preview',
      response_format: { type: "json_object" },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Message to analyze: "${content}"` }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
  const result = await response.json();
  const rawContent = result.choices[0].message.content;
  
  try {
    return JSON.parse(rawContent);
  } catch (e) {
    console.error("Failed to parse AI response:", rawContent);
    throw new Error("Invalid AI response format");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const record = payload.record || payload; 
    
    if (!record.content || !record.id) {
      return new Response(JSON.stringify({ error: "Missing content or message id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Layer 1 & 2: Heuristics & Reputation (simplified for edge function)
    const heuristics = runHeuristics(record.content);
    
    // If not suspicious based on fast rules, we can skip AI to save cost and latency
    if (!heuristics.needsDeepScan) {
      // It's safe, we don't even need to write to the DB unless we want to track everything
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Passed fast heuristics" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Layer 3: Deep AI Scan
    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("AI API Key is missing");

    const aiResult = await analyzeThreatWithAI(record.content, apiKey);

    // Only save if it's actually suspicious or dangerous (score >= 40)
    // to avoid bloating the DB with 'safe' scans.
    if (aiResult.overall_score >= 40) {
      const { error: insertError } = await supabaseAdmin
        .from('message_security_scans')
        .insert({
          message_id: record.id,
          overall_score: aiResult.overall_score,
          overall_level: aiResult.overall_level,
          detections: aiResult.detections,
          explanation: aiResult.explanation,
          recommended_action: aiResult.recommended_action
        });

      if (insertError) {
        console.error("DB Insert Error:", insertError);
        throw insertError;
      }
    }

    return new Response(JSON.stringify({ success: true, scan: aiResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Shield pipeline error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
