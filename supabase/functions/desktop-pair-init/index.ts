import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { desktop_pubkey, device_name, device_fingerprint } = await req.json();
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';

    if (!desktop_pubkey) {
      return new Response(JSON.stringify({ error: 'desktop_pubkey is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate a fresh pairing_id (UUID)
    const pairingId = crypto.randomUUID();

    // Create a short 5-min pairing session record
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabase.from('desktop_pairing_sessions').insert({
      pairing_id: pairingId,
      desktop_pubkey,
      device_name: device_name || 'Desktop',
      device_fingerprint: device_fingerprint || null,
      ip_address: clientIp,
      status: 'pending',
      expires_at: expiresAt,
    });

    if (error) {
      console.error('[desktop-pair-init] DB insert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create pairing session', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      pairing_id: pairingId,
      expires_at: expiresAt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[desktop-pair-init] Uncaught error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
