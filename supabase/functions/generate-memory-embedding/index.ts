import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generates embedding for text using Google Gemini's embedding model
async function generateEmbedding(text: string, apiKey: string) {
  // Using OpenRouter or Lovable Gateway
  const fetchUrl = Deno.env.get("OPENROUTER_API_KEY") 
    ? 'https://openrouter.ai/api/v1/embeddings' 
    : 'https://ai.gateway.lovable.dev/v1/embeddings';

  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chatr.chat',
      'X-Title': 'Chatr Communication Memory'
    },
    body: JSON.stringify({
      model: 'google/text-embedding-004', // 768 dimensions
      input: text
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Error generating embedding: ${response.status}`, errorBody);
    throw new Error(`Failed to generate embedding: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // We expect this to be called either directly or via a Postgres Webhook
    const record = payload.record || payload; 
    
    if (!record.content || !record.id) {
      return new Response(JSON.stringify({ error: "Missing content or id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("AI API Key is missing");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding
    console.log(`Generating embedding for memory id: ${record.id}`);
    const embedding = await generateEmbedding(record.content, apiKey);

    // Calculate basic importance score (for metadata enrichment)
    // Here we can use simple heuristics, or call a lightweight LLM. 
    // We will do a basic heuristic for speed.
    const isOTP = /\b\d{4,6}\b/.test(record.content) && /code|otp|verify/i.test(record.content);
    const hasMoney = /\$|₹|€/.test(record.content);
    const importance = isOTP ? 0.2 : (hasMoney ? 0.9 : 0.5);

    const metadata = {
      ...record.metadata,
      importance,
      auto_tagged: true,
      tags: hasMoney ? ['finance'] : (isOTP ? ['otp'] : [])
    };

    // Update the record with the embedding and metadata
    const { error: updateError } = await supabase
      .from('communication_memory')
      .update({ 
        embedding,
        metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, id: record.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing memory embedding:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
