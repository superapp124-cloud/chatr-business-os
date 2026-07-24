import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MESSAGES_CHANNEL_ID = 'messages_visible_v2'

const isAndroidPlatform = (platform?: string | null): boolean => {
  return (platform || 'android').toLowerCase() === 'android'
}

// Get OAuth2 access token from service account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600 // 1 hour

  // Create JWT header and payload
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp,
  }

  // Base64URL encode
  const base64url = (data: any) => {
    const json = JSON.stringify(data)
    const base64 = btoa(json)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const headerB64 = base64url(header)
  const payloadB64 = base64url(payload)
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Import private key and sign
  const privateKey = serviceAccount.private_key
  const pemContents = privateKey
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

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  )

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${unsignedToken}.${signatureB64}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResponse.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`)
  }

  return tokenData.access_token
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, title, body, data, platform } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ error: "FCM token is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")
    if (!serviceAccountJson) {
      console.error('[send-push] FIREBASE_SERVICE_ACCOUNT not configured')
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceAccount = JSON.parse(serviceAccountJson)
    const projectId = serviceAccount.project_id

    console.log('[send-push] Sending to token:', token.substring(0, 20) + '...')
    console.log('[send-push] Type:', data?.type || 'general')

    // Get access token
    const accessToken = await getAccessToken(serviceAccount)

    const rawData = data || {}
    const resolvedType = rawData.type || rawData.notificationType || 'chat'
    const resolvedTitle = title || rawData.title || 'Chatr'
    const resolvedBody = body || rawData.body || rawData.message || rawData.messageContent || ''
    const conversationId = rawData.conversation_id || rawData.conversationId || ''
    const senderAvatar = rawData.sender_avatar || rawData.senderAvatar || rawData.avatar_url || rawData.avatarUrl || ''
    const route = rawData.route || rawData.click_action || rawData.clickAction || (conversationId ? `/chat/${conversationId}` : '/')
    const dataPayload = {
      ...rawData,
      type: resolvedType,
      notificationType: rawData.notificationType || resolvedType,
      title: resolvedTitle,
      body: resolvedBody,
      message: rawData.message || resolvedBody,
      messageContent: rawData.messageContent || rawData.message_content || rawData.message || resolvedBody,
      sender_id: rawData.sender_id || rawData.senderId || '',
      senderId: rawData.senderId || rawData.sender_id || '',
      sender_name: rawData.sender_name || rawData.senderName || resolvedTitle,
      senderName: rawData.senderName || rawData.sender_name || resolvedTitle,
      sender_avatar: senderAvatar,
      senderAvatar,
      avatar_url: senderAvatar,
      conversation_id: rawData.conversation_id || rawData.conversationId || '',
      conversationId: rawData.conversationId || rawData.conversation_id || '',
      route,
      click_action: route,
      android_channel_id: rawData.android_channel_id || MESSAGES_CHANNEL_ID,
      timestamp: rawData.timestamp || Date.now().toString(),
    }
    const isCallPush = resolvedType === 'call' || resolvedType === 'incoming_call'
    const isAndroidPush = isAndroidPlatform(platform || rawData.platform)

    // Build FCM v1 message
    const message: any = {
      message: {
        token,
        android: {
          priority: "HIGH",
          ttl: isCallPush ? "30s" : "86400s",
          direct_boot_ok: true,
        },
        data: Object.fromEntries(
          Object.entries(dataPayload).map(([k, v]) => [k, String(v)])
        ),
      },
    }

    // Android stays data-only so the native FirebaseMessagingService owns the
    // lock-screen notification. Non-Android clients still receive an OS-rendered
    // notification block.
    if ((title || body) && !isCallPush && !isAndroidPush) {
      message.message.notification = {
        title: resolvedTitle,
        body: resolvedBody,
      }
      message.message.android.notification = {
        channel_id: MESSAGES_CHANNEL_ID,
        visibility: "PUBLIC",
      }
    }

    // Special handling for call notifications
    if (isCallPush) {
      message.message.android = {
        priority: "HIGH",
        ttl: "30s",
        direct_boot_ok: true,
      }
      console.log('[send-push] Call notification - high priority enabled')
    }

    console.log('[send-push] Payload:', JSON.stringify(message, null, 2))

    // Send via FCM v1 API
    const fcmResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    )

    const fcmResult = await fcmResponse.json()
    console.log('[send-push] FCM Response:', JSON.stringify(fcmResult))

    if (!fcmResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: fcmResult.error?.message || 'FCM send failed',
          details: fcmResult 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, messageId: fcmResult.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[send-push] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
