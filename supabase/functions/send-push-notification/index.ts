import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  notificationType?: string;
}

const MESSAGES_CHANNEL_ID = 'messages_visible_v2';

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firebaseServerKey = Deno.env.get('FIREBASE_SERVER_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, title, body, data, notificationType } = await req.json() as PushNotificationRequest;

    console.log('📲 Sending push notification to user:', userId, 'Type:', notificationType);

    // Check user's notification preferences
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Check if this notification type is enabled
    if (preferences) {
      const typeMapping: Record<string, keyof typeof preferences> = {
        'chat': 'chat_notifications',
        'call': 'call_notifications',
        'group': 'group_notifications',
        'transaction': 'transaction_alerts',
        'update': 'app_updates',
        'marketing': 'marketing_alerts'
      };

      const prefKey = typeMapping[notificationType || 'chat'];
      if (prefKey && !preferences[prefKey]) {
        console.log('⚠️ User has disabled', notificationType, 'notifications');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'User has disabled this notification type' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
    }

    // Get all device tokens for this user
    const { data: deviceTokens, error: tokenError } = await supabase
      .from('device_tokens')
      .select('device_token, platform')
      .eq('user_id', userId);

    if (tokenError) {
      console.error('Error fetching device tokens:', tokenError);
      throw tokenError;
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log('⚠️ No device tokens found for user:', userId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No device tokens found' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log('📱 Sending push to', deviceTokens.length, 'device(s)');

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
      console.warn('Could not resolve sender avatar:', profileErr);
    }

    // Send FCM notifications
    const results = await Promise.allSettled(
      deviceTokens.map(async (tokenData) => {
        const resolvedType = notificationType || data?.type || data?.notificationType || 'general';
        const conversationId = data?.conversation_id || data?.conversationId || '';
        const route = data?.route || data?.click_action || data?.clickAction || (conversationId ? `/chat/${conversationId}` : '/');
        const dataPayload = stringifyData({
            ...data,
            type: resolvedType,
            notificationType: data?.notificationType || resolvedType,
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
            click_action: route,
            route,
            android_channel_id: data?.android_channel_id || MESSAGES_CHANNEL_ID,
            timestamp: new Date().toISOString(),
        });

        const fcmPayload = isAndroidPlatform(tokenData.platform)
          ? {
            to: tokenData.device_token,
            data: dataPayload,
            priority: 'high',
            content_available: true,
          }
          : {
            to: tokenData.device_token,
            notification: {
              title,
              body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-192x192.png',
              tag: 'chatr-notification',
              requireInteraction: true,
              click_action: data?.click_action || 'FLUTTER_NOTIFICATION_CLICK',
              android_channel_id: MESSAGES_CHANNEL_ID,
              sound: preferences?.sound_enabled ? 'default' : undefined,
              vibrate: preferences?.vibration_enabled ? [200, 100, 200] : undefined,
            },
            data: dataPayload,
            priority: 'high',
            content_available: true,
            android: {
              priority: 'high',
              notification: {
                channel_id: MESSAGES_CHANNEL_ID,
                visibility: 'PUBLIC',
              },
            },
          };

        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${firebaseServerKey}`,
          },
          body: JSON.stringify(fcmPayload),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('FCM Error for token:', tokenData.device_token.substring(0, 20) + '...', error);
          throw new Error(`FCM request failed: ${error}`);
        }

        const result = await response.json();
        console.log('FCM Success:', result);
        
        // Update last_used_at for successful delivery
        await supabase
          .from('device_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('device_token', tokenData.device_token);

        return result;
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Sent ${successful} notifications, ❌ Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentTo: successful,
        failed,
        message: `Push notifications sent to ${successful} device(s)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
