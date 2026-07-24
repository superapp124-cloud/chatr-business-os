import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate embedding for user query
async function generateQueryEmbedding(query: string, apiKey: string) {
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
      model: 'google/text-embedding-004', // Matches the dimension we stored
      input: query
    })
  });

  if (!response.ok) throw new Error(`Embedding API Error: ${response.status}`);
  const result = await response.json();
  return result.data[0].embedding;
}

// Synthesize answer using Gemini 2.5 Flash
async function synthesizeAnswer(query: string, memories: any[], apiKey: string) {
  const fetchUrl = Deno.env.get("OPENROUTER_API_KEY") 
    ? 'https://openrouter.ai/api/v1/chat/completions' 
    : 'https://ai.gateway.lovable.dev/v1/chat/completions';

  const contextText = memories.map((m, i) => `[Source ${i+1} - ${m.memory_type}]: ${m.content}`).join('\n\n');

  const systemPrompt = `You are the Brain of the CHATR Communication OS. 
Answer the user's query based ONLY on the provided memory context.
If the memory context does not contain the answer, say you don't know based on their history.
Always cite your sources using the format [Source X].`;

  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://chatr.chat',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Context:\n${contextText}\n\nQuery: ${query}` }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) throw new Error(`Chat API Error: ${response.status}`);
  const result = await response.json();
  return result.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, filter_type } = await req.json();
    
    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Auth validation
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("AI API Key is missing");

    // 1. Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query, apiKey);

    // 2. Perform hybrid search via RPC
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: memories, error: searchError } = await supabaseAdmin.rpc('hybrid_search_memory', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1, // Adjust as needed
      match_count: 10,
      p_user_id: user.id,
      filter_type: filter_type || null
    });

    if (searchError) throw searchError;

    if (!memories || memories.length === 0) {
      return new Response(JSON.stringify({ 
        answer: "I couldn't find anything related to that in your communication memory.",
        sources: []
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // 3. Synthesize the answer
    const answer = await synthesizeAnswer(query, memories, apiKey);

    return new Response(JSON.stringify({ 
      answer,
      sources: memories.map((m: any) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        content: m.content,
        similarity: m.similarity,
        memory_type: m.memory_type
      }))
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (error: any) {
    console.error("Search memory error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
