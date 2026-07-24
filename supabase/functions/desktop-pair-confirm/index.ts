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

    // This endpoint requires the caller to be an authenticated mobile user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the user's JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { pairing_id, device_name } = await req.json();
    
    if (!pairing_id) {
      return new Response(JSON.stringify({ error: 'pairing_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Verify the pairing session exists and is still pending
    const { data: session, error: sessionError } = await supabase
      .from('desktop_pairing_sessions')
      .select('*')
      .eq('pairing_id', pairing_id)
      .eq('status', 'pending')
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Pairing session not found or already used' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Check if the session has expired
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('desktop_pairing_sessions').update({ status: 'expired' }).eq('pairing_id', pairing_id);
      return new Response(JSON.stringify({ error: 'Pairing session has expired. Please scan a new QR code.' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Register desktop device
    const { data: device, error: deviceError } = await supabase
      .from('desktop_devices')
      .insert({ user_id: user.id, device_name: device_name || session.device_name || 'Desktop', trusted: true })
      .select()
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: 'Failed to register desktop device' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Generate a magic link for the desktop
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || 'http://localhost:8081'}/desktop/chat`,
        data: { device_id: device.id, paired_at: new Date().toISOString() }
      }
    });

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: 'Failed to generate session token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sessionToken = linkData.properties?.hashed_token || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 5. Store desktop session
    await supabase.from('desktop_sessions').insert({
      user_id: user.id,
      device_id: device.id,
      jwt_token_hash: sessionToken,
      status: 'active',
      expires_at: expiresAt,
    });

    // 6. Mark the pairing session as paired
    await supabase.from('desktop_pairing_sessions').update({ status: 'paired', user_id: user.id }).eq('pairing_id', pairing_id);

    // 7. Log the action
    await supabase.from('desktop_audit_logs').insert({ user_id: user.id, action: 'paired', user_agent: req.headers.get('user-agent') || 'unknown' });

    // 8. Broadcast the session token to the Desktop QR screen via Realtime
    const channel = supabase.channel(`desktop_pairing_${pairing_id}`, { config: { broadcast: { self: true } } });
    
    await new Promise<void>((resolve) => {
      channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'paired',
            payload: {
              token: linkData.properties?.action_link || sessionToken,
              user_id: user.id,
              device_id: device.id,
              verified: true,
            },
          });
          await supabase.removeChannel(channel);
          resolve();
        }
      });
    });

    return new Response(JSON.stringify({ success: true, message: 'Desktop paired successfully', device_id: device.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[desktop-pair-confirm] Uncaught error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
