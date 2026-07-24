import { supabase } from '@/integrations/supabase/client';

type DevicePlatform = 'android' | 'ios' | 'web';

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: DevicePlatform
) {
  const { error } = await supabase.functions.invoke('register-device-token', {
    body: {
      token,
      userId,
      platform,
    },
  });

  if (error) {
    throw error;
  }
}
