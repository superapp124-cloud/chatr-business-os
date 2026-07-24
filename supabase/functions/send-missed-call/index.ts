import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate JWT for Google OAuth2
async function createJWT(serviceAccount: any): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }

  const encoder = new TextEncoder()
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const unsignedToken = `${headerB64}.${payloadB64}`

  const pemContents = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(unsignedToken))
  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))
  return `${unsignedToken}.${signatureB64}`
}

function base64UrlEncode(str: string): string {
  const b64 = btoa(str)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createJWT(serviceAccount)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  })
  if (!response.ok) throw new Error(`Failed to get access token: ${await response.text()}`)
  return (await response.json()).access_token
}

async function sendFCMv1(
  projectId: string,
  accessToken: string,
  fcmToken: string,
  callData: { callId: string, callerId: string, callerName: string, callerAvatar: string, isVideo: boolean, conversationId: string }
): Promise<any> {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  
  const fcmPayload = {
    message: {
      token: fcmToken,
      android: {
        priority: "HIGH",
        ttl: "86400s" // Missed calls can be delivered up to 24h later if device is off
      },
      data: {
        type: "missed_call",
        call_id: callData.callId,
        caller_id: callData.callerId,
        caller_name: callData.callerName || "Unknown",
        caller_avatar: callData.callerAvatar || "",
        is_video: callData.isVideo ? "true" : "false",
        conversation_id: callData.conversationId || "",
        timestamp: Date.now().toString()
      }
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fcmPayload)
  })

  if (!response.ok) throw new Error(`FCM v1 request failed: ${response.status} - ${await response.text()}`)
  return await response.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json()
    const { callId, receiverId, callType, conversationId } = body
    let { callerName, callerAvatar } = body

    const serviceClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    try {
      const { data: callerProfile } = await serviceClient
        .from('profiles')
        .select('full_name, display_name, username, avatar_url, phone_number, phone')
        .eq('id', user.id)
        .maybeSingle()
      if (callerProfile) {
        const resolved = callerProfile.full_name || callerProfile.display_name || callerProfile.username || callerProfile.phone_number || callerProfile.phone
        if (resolved && resolved.trim().length > 0) callerName = resolved.trim()
        if (!callerAvatar) callerAvatar = (callerProfile as any).avatar_url || ''
      }
    } catch (e) { console.warn(e) }

    const { data: tokenData, error: tokenError } = await serviceClient
      .from('device_tokens')
      .select('device_token, platform')
      .eq('user_id', receiverId)
      .not('device_token', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (tokenError || !tokenData?.device_token) {
      return new Response(JSON.stringify({ success: true, fcmSent: false, reason: 'no_fcm_token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const firebaseServiceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!firebaseServiceAccountJson) {
      return new Response(JSON.stringify({ success: false, error: 'FCM not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const serviceAccount = JSON.parse(firebaseServiceAccountJson)
    const projectId = serviceAccount.project_id
    const accessToken = await getAccessToken(serviceAccount)

    const fcmResult = await sendFCMv1(projectId, accessToken, tokenData.device_token, {
      callId, callerId: user.id, callerName, callerAvatar, isVideo: callType === 'video', conversationId
    })

    return new Response(JSON.stringify({ success: true, fcmSent: true, messageId: fcmResult.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
