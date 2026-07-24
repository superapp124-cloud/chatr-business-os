import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGES_CHANNEL_ID = 'messages_visible_v2';

const isAndroidPlatform = (platform?: string | null): boolean => {
  return (platform || 'android').toLowerCase() === 'android';
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

    const { newUserId, inviteCode, referrerId } = await req.json();

    console.log('🎉 Processing referral join notification:', { newUserId, inviteCode, referrerId });

    // Get new user's profile
    const { data: newUserProfile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', newUserId)
      .single();

    const newUserName = newUserProfile?.username || 'A friend';

    // Find the inviter from invite code or referrer ID
    let inviterId = referrerId;
    
    if (!inviterId && inviteCode) {
      const { data: invite } = await supabase
        .from('contact_invites')
        .select('inviter_id')
        .eq('invite_code', inviteCode)
        .single();
      inviterId = invite?.inviter_id;
    }

    if (!inviterId) {
      console.log('⚠️ No inviter found for this signup');
      return new Response(
        JSON.stringify({ success: false, message: 'No inviter found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update invite status if we have an invite code
    if (inviteCode) {
      await supabase
        .from('contact_invites')
        .update({
          status: 'joined',
          joined_at: new Date().toISOString(),
          joined_user_id: newUserId,
          reward_given: true
        })
        .eq('invite_code', inviteCode);
    }

    // Get inviter's device tokens for push notification
    const { data: deviceTokens } = await supabase
      .from('device_tokens')
      .select('device_token, platform')
      .eq('user_id', inviterId);

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log('⚠️ No device tokens found for inviter');
      
      // Still create in-app notification
      await supabase.from('notifications').insert({
        user_id: inviterId,
        title: '🎉 Friend Joined!',
        message: `${newUserName} joined Chatr using your invite! You earned 50 coins!`,
        type: 'referral',
        data: { newUserId, coinsEarned: 50 }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'In-app notification created' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send FCM push notifications
    const fcmUrl = 'https://fcm.googleapis.com/fcm/send';
    
    const results = await Promise.allSettled(
      deviceTokens.map(async ({ device_token, platform }) => {
        const dataPayload = {
          type: 'referral_join',
          title: 'Friend Joined Chatr!',
          body: `${newUserName} joined using your invite! You earned 50 coins!`,
          newUserId,
          coinsEarned: '50',
          route: '/chatr-points',
          click_action: '/chatr-points'
        };

        const payload = isAndroidPlatform(platform)
          ? {
            to: device_token,
            priority: 'high',
            data: dataPayload,
            content_available: true,
          }
          : {
            to: device_token,
            notification: {
              title: '🎉 Friend Joined Chatr!',
              body: `${newUserName} joined using your invite! You earned 50 coins! 🪙`,
              icon: newUserProfile?.avatar_url || '/favicon.ico',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              android_channel_id: MESSAGES_CHANNEL_ID,
            },
            data: dataPayload,
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channel_id: MESSAGES_CHANNEL_ID,
                visibility: 'PUBLIC',
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
            }
          };

        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `key=${firebaseServerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        return response.json();
      })
    );

    console.log('📱 Push notification results:', results);

    // Also create in-app notification
    await supabase.from('notifications').insert({
      user_id: inviterId,
      title: '🎉 Friend Joined!',
      message: `${newUserName} joined Chatr using your invite! You earned 50 coins!`,
      type: 'referral',
      data: { newUserId, coinsEarned: 50 },
      read: false
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notifications sent',
        pushResults: results.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-referral-join:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
