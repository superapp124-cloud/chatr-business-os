import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  skipInAppInsert?: boolean;
}

const MESSAGES_CHANNEL_ID = 'messages_visible_v2';

// Channel mapping for Android notification channels
const getChannelId = (type: string): string => {
  if (type.includes('call')) return 'calls_high_v2';
  if (type.includes('message') || type.includes('chat')) return MESSAGES_CHANNEL_ID;
  if (type.includes('health') || type.includes('medication')) return 'health';
  return MESSAGES_CHANNEL_ID;
};

// Priority mapping
const getPriority = (type: string): string => {
  if (type.includes('call') || type.includes('alert') || type.includes('urgent')) return 'high';
  if (type.includes('reminder') || type.includes('payment')) return 'high';
  return 'normal';
};

const isAndroidPlatform = (platform?: string | null): boolean => {
  return (platform || 'android').toLowerCase() === 'android';
};

const stringifyData = (payload: Record<string, unknown>): Record<string, string> => {
  const entries = Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]);
  return Object.fromEntries(entries);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firebaseServerKey = Deno.env.get("FIREBASE_SERVER_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, type, title, body, data, skipInAppInsert } = await req.json() as NotificationRequest;

    if (!userId || !type || !title || !body) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-module-notification] Sending ${type} notification to user ${userId} (skipInsert=${!!skipInAppInsert})`);

    // 1. Store notification in database (skip when caller already inserted)
    if (!skipInAppInsert) {
      const { error: dbError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message: body,
          type,
          data: data || {},
          read: false,
          created_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('[send-module-notification] DB insert error:', dbError);
      }
    }

    // 2. Check user notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Default to enabled if no preferences found
    const pushEnabled = prefs?.push_enabled !== false;

    if (!pushEnabled) {
      console.log(`[send-module-notification] Push disabled for user ${userId}`);
      return new Response(
        JSON.stringify({ success: true, pushed: false, reason: 'push_disabled' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get device tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('device_tokens')
      .select('device_token, platform')
      .eq('user_id', userId);

    if (tokenError || !tokens?.length) {
      console.log(`[send-module-notification] No device tokens for user ${userId}`);
      return new Response(
        JSON.stringify({ success: true, pushed: false, reason: 'no_tokens' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Send FCM notifications
    if (!firebaseServerKey) {
      console.error('[send-module-notification] Firebase server key not configured');
      return new Response(
        JSON.stringify({ success: true, pushed: false, reason: 'fcm_not_configured' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const channelId = getChannelId(type);
    const priority = getPriority(type);
    const senderId = data?.sender_id || data?.senderId || data?.from_id || data?.fromId;
    let resolvedSenderName = data?.sender_name || data?.senderName || title;
    let resolvedSenderAvatar = data?.sender_avatar || data?.senderAvatar || data?.avatar_url || data?.avatarUrl || '';
    try {
      if (senderId) {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', senderId)
          .maybeSingle();
        if (senderProfile) {
          resolvedSenderName = data?.sender_name || data?.senderName || senderProfile.username || title;
          resolvedSenderAvatar = resolvedSenderAvatar || senderProfile.avatar_url || '';
        }
      }
    } catch (profileErr) {
      console.warn('[send-module-notification] Could not resolve sender avatar:', profileErr);
    }

    let successCount = 0;
    let failureCount = 0;

    for (const tokenRecord of tokens) {
      const dataPayload = stringifyData({
        type,
        title,
        body,
        message: data?.message || body,
        messageContent: data?.messageContent || data?.message_content || data?.message || body,
        sender_id: data?.sender_id || data?.senderId || '',
        senderId: data?.senderId || data?.sender_id || '',
        sender_name: resolvedSenderName,
        senderName: resolvedSenderName,
        sender_avatar: resolvedSenderAvatar,
        senderAvatar: resolvedSenderAvatar,
        avatar_url: resolvedSenderAvatar,
        conversation_id: data?.conversation_id || data?.conversationId || '',
        conversationId: data?.conversationId || data?.conversation_id || '',
        route: data?.route || data?.click_action || '/',
        click_action: data?.click_action || data?.route || '/',
        action: data?.action || 'view',
        android_channel_id: channelId,
        ...data,
      });

      const fcmPayload = isAndroidPlatform(tokenRecord.platform)
        ? {
          to: tokenRecord.device_token,
          priority: 'high',
          data: dataPayload,
          content_available: true,
        }
        : {
          to: tokenRecord.device_token,
          priority,
          notification: {
            title,
            body,
            sound: 'default',
            badge: 1,
            click_action: data?.route || '/',
            android_channel_id: channelId,
          },
          data: dataPayload,
          android: {
            priority,
            notification: {
              channel_id: channelId,
              sound: 'default',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              visibility: 'PUBLIC',
            }
          },
          apns: {
            payload: {
              aps: {
                alert: { title, body },
                sound: 'default',
                badge: 1,
                'mutable-content': 1,
                'content-available': 1
              }
            }
          }
        };

      try {
        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${firebaseServerKey}`
          },
          body: JSON.stringify(fcmPayload)
        });

        const fcmResult = await fcmResponse.json();

        if (fcmResult.success === 1) {
          successCount++;
          // Update last used timestamp
          await supabase
            .from('device_tokens')
            .update({ last_used_at: new Date().toISOString() })
            .eq('device_token', tokenRecord.device_token);
        } else {
          failureCount++;
          console.error('[send-module-notification] FCM error:', fcmResult);
          
          // Remove invalid tokens
          if (fcmResult.results?.[0]?.error === 'NotRegistered') {
            await supabase
              .from('device_tokens')
              .delete()
              .eq('device_token', tokenRecord.device_token);
          }
        }
      } catch (fcmError) {
        failureCount++;
        console.error('[send-module-notification] FCM request error:', fcmError);
      }
    }

    console.log(`[send-module-notification] Sent: ${successCount}, Failed: ${failureCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pushed: successCount > 0,
        sent: successCount,
        failed: failureCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[send-module-notification] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
