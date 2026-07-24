import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("Missing auth header")
    
    const { session_id } = await req.json()
    if (!session_id) throw new Error("Missing session_id")

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify requesting user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error("Unauthorized")

    // Revoke the session
    const { data: session, error: updateError } = await supabaseClient
      .from('desktop_sessions')
      .update({ status: 'revoked' })
      .eq('id', session_id)
      .eq('user_id', user.id) // Security check
      .select('id, device_id')
      .single()

    if (updateError || !session) throw new Error("Failed to revoke session. Not found or unauthorized.")

    // Log the revocation
    await supabaseClient
      .from('desktop_audit_logs')
      .insert({
        user_id: user.id,
        session_id: session.id,
        action: 'revoked',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      })

    // Optionally: Disconnect device from Realtime by broadcasting a kill signal
    const channel = supabaseClient.channel(`device_control_${session.device_id}`)
    await channel.send({
      type: 'broadcast',
      event: 'session_revoked',
      payload: { session_id: session.id }
    })

    return new Response(
      JSON.stringify({ success: true, message: "Session revoked" }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
})
